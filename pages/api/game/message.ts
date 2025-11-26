import { NextApiRequest, NextApiResponse } from "next";
import {
  addMessage,
  getGame,
  updateGameStatus,
  updateTurn,
  incrementHintsUsed,
  updateMessageResponse,
} from "@/lib/db-operations";
import { GameMessage } from "@/lib/db-operations";
import { openai, OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { generateText } from "ai";
import { track } from "@vercel/analytics/server";

// Check if we should use mock AI
const useMockAI = () =>
  !process.env.OPENAI_API_KEY ||
  process.env.OPENAI_API_KEY.startsWith("mock") ||
  process.env.USE_MOCK_AI === "true";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { gameId, playerId, type, content } = req.body;

  if (!gameId || !playerId || !type || !content) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (type !== "question" && type !== "guess" && type !== "hint") {
    return res.status(400).json({ error: "Invalid message type" });
  }

  try {
    const game = await getGame(gameId);

    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }

    if (game.status !== "active") {
      return res.status(400).json({ error: "Game is not active" });
    }

    if (game.currentTurn !== playerId) {
      return res.status(400).json({ error: "Not your turn" });
    }

    // Use the secret word stored with the game
    const secretWord = game.secretWord;

    let aiResponse: string | undefined;
    let isCorrectGuess = false;

    if (type === "hint") {
      // Handle help request - generate a suggested question
      // Get all previous player messages and hints for context
      const playerMessages = game.messages.filter(
        (m) => m.playerId === playerId
      );
      const previousHints = game.messages
        .filter((m) => m.type === "hint" && m.playerId === playerId)
        .map((m) => m.content || "")
        .filter((h) => h !== "");

      // Generate a suggested question based on conversation history
      const suggestedQuestion = await generateHint(
        secretWord,
        playerMessages,
        previousHints
      );

      // The user's message content should be the suggested question
      // And the AI response should be yes/no answer to that question
      const messageContent = suggestedQuestion;
      aiResponse = await generateGameAIResponse(suggestedQuestion, secretWord);

      await incrementHintsUsed(gameId);

      // Create and add the message with the suggested question as content
      const hintMessage: GameMessage = {
        id: generateId(),
        type: "hint",
        content: messageContent,
        aiResponse,
        playerId,
        timestamp: Date.now(),
      };

      await addMessage(gameId, hintMessage);

      // Don't switch turns in AI mode, switch in friend mode
      if (game.mode === "ai") {
        // In AI mode, generate AI's turn immediately (same as below)
        const aiQuestion = await generateAIQuestion([
          ...game.messages,
          hintMessage,
        ]);
        const aiIsGuessing = !aiQuestion.includes("?");
        const aiType = aiIsGuessing ? "guess" : "question";

        const aiQuestionMessage: GameMessage = {
          id: generateId(),
          type: aiType,
          content: aiQuestion,
          aiResponse: undefined,
          playerId: "ai",
          timestamp: Date.now(),
        };

        await addMessage(gameId, aiQuestionMessage);

        let aiAiResponse: string | undefined;
        let aiCorrectGuess = false;

        if (aiType === "guess") {
          const aiGuessWord = aiQuestion.trim();
          aiCorrectGuess =
            aiGuessWord.toLowerCase() === secretWord.toLowerCase();
          aiAiResponse = aiCorrectGuess ? "Correct!" : "Incorrect!";
        } else {
          aiAiResponse = await generateGameAIResponse(aiQuestion, secretWord);
        }

        await updateMessageResponse(aiQuestionMessage.id, aiAiResponse);

        const aiMessage = {
          ...aiQuestionMessage,
          aiResponse: aiAiResponse,
        };

        if (aiCorrectGuess) {
          await updateGameStatus(gameId, "completed", "ai");

          const playerMessages = game.messages.filter(
            (m) => m.playerId === playerId
          );
          const totalAttempts = playerMessages.length + 1;
          const hintsUsed = game.hintsUsed || 0;

          await track("game_lost", {
            game_mode: "ai",
            total_attempts: totalAttempts.toString(),
            hints_used: hintsUsed.toString(),
            secret_word: game.secretWord,
          });

          return res.status(200).json({
            message: hintMessage,
            aiMessage,
            gameStatus: "completed",
            winnerId: "ai",
          });
        }

        await updateTurn(gameId, playerId);

        return res.status(200).json({
          message: hintMessage,
          aiMessage,
          gameStatus: "active",
        });
      } else {
        // Friend mode - switch turns
        const nextPlayer =
          playerId === game.player1Id ? game.player2Id : game.player1Id;
        if (nextPlayer) {
          await updateTurn(gameId, nextPlayer);
        }

        return res.status(200).json({
          message: hintMessage,
          aiMessage: null,
          gameStatus: "active",
        });
      }
    } else if (type === "guess") {
      // Check if guess is correct (remove trailing punctuation like ?)
      const cleanedGuess = content
        .toLowerCase()
        .trim()
        .replace(/[?!.,:;]+$/, "");
      isCorrectGuess = cleanedGuess === secretWord.toLowerCase().trim();
      aiResponse = isCorrectGuess ? "Correct!" : "Incorrect!";
    } else {
      // Get AI response for question
      aiResponse = await generateGameAIResponse(content, secretWord);
    }

    const message: GameMessage = {
      id: generateId(),
      type,
      content,
      aiResponse,
      playerId,
      timestamp: Date.now(),
    };

    await addMessage(gameId, message);

    if (isCorrectGuess) {
      await updateGameStatus(gameId, "completed", playerId);

      // Track game won with server-side analytics
      const playerMessages = game.messages.filter(
        (m) => m.playerId === playerId
      );
      const totalAttempts = playerMessages.length + 1;
      const hintsUsed = game.hintsUsed || 0;

      await track("game_won", {
        game_mode: game.mode || "friend",
        total_attempts: totalAttempts.toString(),
        hints_used: hintsUsed.toString(),
        secret_word: game.secretWord,
      });

      return res.status(200).json({
        message,
        aiMessage: null,
        gameStatus: "completed",
        winnerId: playerId,
      });
    }

    // If AI mode, generate and process AI's turn immediately
    let aiMessage: GameMessage | null = null;
    if (game.mode === "ai") {
      // Generate AI question using the conversation history from the database
      const aiQuestion = await generateAIQuestion([...game.messages, message]);

      // Determine if AI is asking a question or making a guess
      // If it doesn't end with "?", it's a guess
      const aiIsGuessing = !aiQuestion.includes("?");
      const aiType = aiIsGuessing ? "guess" : "question";

      // Create AI message with just the question (no response yet)
      const aiQuestionMessage: GameMessage = {
        id: generateId(),
        type: aiType,
        content: aiQuestion,
        aiResponse: undefined,
        playerId: "ai",
        timestamp: Date.now(),
      };

      // Add the AI's question first
      await addMessage(gameId, aiQuestionMessage);

      // Now generate the response
      let aiAiResponse: string | undefined;
      let aiCorrectGuess = false;

      if (aiType === "guess") {
        // The AI returns just the word when guessing
        const aiGuessWord = aiQuestion.trim();

        aiCorrectGuess = aiGuessWord.toLowerCase() === secretWord.toLowerCase();
        aiAiResponse = aiCorrectGuess ? "Correct!" : "Incorrect!";
      } else {
        // Get Game AI response to Player AI's question
        aiAiResponse = await generateGameAIResponse(aiQuestion, secretWord);
      }

      // Update the message in the database with the response
      await updateMessageResponse(aiQuestionMessage.id, aiAiResponse);

      // Create the complete AI message with response
      aiMessage = {
        ...aiQuestionMessage,
        aiResponse: aiAiResponse,
      };

      if (aiCorrectGuess) {
        await updateGameStatus(gameId, "completed", "ai");

        // Track game lost with server-side analytics
        const playerMessages = game.messages.filter(
          (m) => m.playerId === playerId
        );
        const totalAttempts = playerMessages.length + 1;
        const hintsUsed = game.hintsUsed || 0;

        await track("game_lost", {
          game_mode: "ai",
          total_attempts: totalAttempts.toString(),
          hints_used: hintsUsed.toString(),
          secret_word: game.secretWord,
        });

        return res.status(200).json({
          message,
          aiMessage,
          gameStatus: "completed",
          winnerId: "ai",
        });
      }

      // Switch turn back to player
      await updateTurn(gameId, playerId);
    } else {
      // Friend mode - switch turns
      const nextPlayer =
        playerId === game.player1Id ? game.player2Id : game.player1Id;
      if (nextPlayer) {
        await updateTurn(gameId, nextPlayer);
      }
    }

    res.status(200).json({ message, aiMessage, gameStatus: "active" });
  } catch (error) {
    console.error("Message Error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
}

function generateId(): string {
  // Use timestamp + random to ensure uniqueness
  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

// Generate Game AI response to a question about the secret word
async function generateGameAIResponse(
  question: string,
  secretWord: string
): Promise<string> {
  if (useMockAI()) {
    return getMockGameAIResponse(
      question.toLowerCase(),
      secretWord.toLowerCase()
    );
  }

  const { text } = await generateText({
    model: openai("gpt-5-nano"),
    system: `You are the judge/question answerer in a word guessing game (similar to the old game 21 questions). The secret word is "${secretWord}".

A player will ask you a yes/no question to try to figure out the secret word. You must respond with ONLY one of these eight options:
- "Yes"
- "No"
- "Unknown"
- "Sometimes"
- "Probably"
- "Probably Not"
- "Irrelevant"
- "Depends"

Since you only have 8 options you won't be able to give detailed explanations or explain yourself, so you should choose what fits best.`,
    prompt: question,
    maxRetries: 2,
  });

  const responseText = text.trim().toLowerCase();

  // Validate response is one of the allowed options
  const validResponses = [
    "yes",
    "no",
    "sometimes",
    "unknown",
    "probably",
    "probably not",
    "depends",
    "irrelevant",
  ];
  return validResponses.includes(responseText) ? responseText : "I don't know";
}

// Mock Game AI for testing without OpenAI API
function getMockGameAIResponse(question: string, secretWord: string): string {
  // Basic logic for common question patterns
  if (question.includes("animal") || question.includes("living")) {
    return ["dog", "cat", "elephant", "penguin", "kangaroo"].includes(
      secretWord
    )
      ? "yes"
      : "no";
  }
  if (question.includes("food") || question.includes("eat")) {
    return ["pizza", "chocolate", "champagne"].includes(secretWord)
      ? "yes"
      : "no";
  }
  if (question.includes("person") || question.includes("human")) {
    return secretWord === "astronaut" ? "yes" : "no";
  }
  if (question.includes("object") || question.includes("thing")) {
    return [
      "computer",
      "guitar",
      "telephone",
      "umbrella",
      "telescope",
      "submarine",
    ].includes(secretWord)
      ? "yes"
      : "no";
  }
  if (question.includes("nature") || question.includes("natural")) {
    return [
      "mountain",
      "rainbow",
      "volcano",
      "butterfly",
      "hurricane",
    ].includes(secretWord)
      ? "yes"
      : "no";
  }
  if (question.includes("big") || question.includes("large")) {
    return [
      "elephant",
      "mountain",
      "volcano",
      "submarine",
      "telescope",
    ].includes(secretWord)
      ? "yes"
      : "no";
  }
  if (question.includes("small") || question.includes("tiny")) {
    return ["butterfly", "chocolate"].includes(secretWord) ? "yes" : "no";
  }
  if (question.includes("fly") || question.includes("flying")) {
    return ["butterfly"].includes(secretWord) ? "yes" : "no";
  }
  if (question.includes("water") || question.includes("swim")) {
    return ["submarine", "penguin"].includes(secretWord) ? "yes" : "no";
  }

  // Random response for other questions
  const responses = ["yes", "no", "sometimes", "maybe"];
  return responses[Math.floor(Math.random() * responses.length)];
}

// Generate AI question based on conversation history
async function generateAIQuestion(
  conversationHistory: GameMessage[]
): Promise<string> {
  if (useMockAI()) {
    return getMockQuestion(conversationHistory);
  }

  // Use real AI to generate intelligent questions
  const formattedHistory = conversationHistory
    .map(
      (msg: GameMessage) =>
        `${msg.playerId === "ai" ? "You" : "Player"}: ${
          msg.content
        } → Response: ${msg.aiResponse}`
    )
    .join("\n");

  const { text } = await generateText({
    model: openai("gpt-5-nano"),
    providerOptions: {
      openai: {
        reasoningEffort: "low",
      } satisfies OpenAIResponsesProviderOptions,
    },
    system: `You are playing a word guessing game against a human. You need to ask yes/no questions to figure out the secret word.
The human will either ask a question or make a guess each turn.
After they go, it's now your turn to do the same. Your goal is to guess the secret word before they do.
Always use all previous questions and answers, including both your own and the human's, to inform each next question or guess. Do not repeat questions that have already been asked. With each turn, strive to efficiently narrow down the set of possible answers by adapting your line of questioning to prior responses. It is crucial that you steer each question towards eliminating as many remaining categories or possibilities as possible, to avoid getting stuck or repeating ideas.

Guidelines:
- Begin with broad, high-impact, category-defining questions to quickly reduce large groups of possibilities.
- Carefully choose each new question so it builds logically on previous answers and targets the most critical unknowns that will help differentiate between the remaining options.
- Do not repeat previously asked questions or revisit already covered topics.
- Make well-informed guesses only when you have enough evidence, outputting only the word (without a question mark).
- Always prefer questions or guesses that most effectively help you converge on the solution faster.

Previous conversation:
${formattedHistory || "No previous questions yet."}`,
    prompt:
      "What is your next yes/no question to figure out the secret word? (Or make a guess if you're confident)",
    maxRetries: 2,
  });

  return text.trim();
}

// Generate a helpful question suggestion based on conversation history
async function generateHint(
  secretWord: string,
  playerMessages: GameMessage[],
  previousHints: string[]
): Promise<string> {
  if (useMockAI()) {
    return getMockHint(secretWord, previousHints);
  }

  // Format conversation history
  const formattedHistory = playerMessages
    .map(
      (msg: GameMessage) =>
        `${
          msg.type === "hint"
            ? "Help Request"
            : msg.type === "guess"
            ? "Guess"
            : "Question"
        }: ${msg.content} → Response: ${msg.aiResponse}`
    )
    .join("\n");

  const { text } = await generateText({
    model: openai("gpt-5-nano"),
    system: `You are helping a player in a word guessing game. The secret word is "${secretWord}".

The player has asked for help with formulating a good question. Your job is to suggest a strategic yes/no question that will help them slightly narrow down the secret word.

The most important part when suggesting a question is to make sure it's not too specific, it should be very broad but still help them.

Whatever you respond with will be used right away as the players question, it must be clear and concise and NEVER include the secret word.

Conversation history:
${formattedHistory || "No questions asked yet."}`,
    prompt:
      "Suggest a strategic yes/no question that would help them slightly narrow down the secret word.",
    maxRetries: 2,
  });

  return text.trim();
}

// Mock hint generator for testing without OpenAI
function getMockHint(secretWord: string, previousHints: string[]): string {
  const questions = [
    "Is it something you can physically touch?",
    "Is it related to technology?",
    "Is it larger than a basketball?",
    "Is it commonly found indoors?",
    "Does it have moving parts?",
  ];

  return questions[Math.min(previousHints.length, questions.length - 1)];
}

// Mock AI question generator for testing without OpenAI
function getMockQuestion(conversationHistory: GameMessage[]): string {
  const aiMessages = conversationHistory.filter((msg) => msg.playerId === "ai");
  const questionCount = aiMessages.length;

  // After 8 questions, start making guesses
  if (questionCount >= 8) {
    const guesses = [
      "computer",
      "elephant",
      "pizza",
      "guitar",
      "mountain",
      "butterfly",
      "telephone",
      "submarine",
      "rainbow",
      "volcano",
    ];

    const alreadyGuessed = aiMessages
      .filter((msg) => msg.type === "guess")
      .map((msg) => msg.content.toLowerCase());

    const availableGuesses = guesses.filter((g) => !alreadyGuessed.includes(g));

    if (availableGuesses.length > 0) {
      return availableGuesses[0];
    }

    return "mystery";
  }

  const questions = [
    "Is it a living thing?",
    "Is it an object?",
    "Is it something you can hold?",
    "Is it bigger than a person?",
    "Is it found in nature?",
    "Is it made by humans?",
    "Can it move on its own?",
    "Is it used for transportation?",
    "Is it food?",
    "Is it an animal?",
    "Does it have legs?",
    "Can it fly?",
    "Does it live in water?",
    "Is it a mammal?",
    "Is it electronic?",
  ];

  // Filter out questions similar to ones already asked
  const askedQuestions = aiMessages.map((msg) => msg.content.toLowerCase());

  const availableQuestions = questions.filter(
    (q) =>
      !askedQuestions.some((asked) =>
        asked.includes(q.toLowerCase().slice(6, 15))
      )
  );

  if (availableQuestions.length > 0) {
    return availableQuestions[0];
  }

  // If we've asked all predefined questions, make a guess
  return "computer";
}
