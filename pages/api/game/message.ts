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
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

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
      // Handle hint request
      // Get all previous player messages and hints for context
      const playerMessages = game.messages.filter(
        (m) => m.playerId === playerId
      );
      const previousHints = game.messages
        .filter((m) => m.type === "hint" && m.playerId === playerId)
        .map((m) => m.aiResponse || "")
        .filter((h) => h !== "");

      // Generate a hint based on conversation history and previous hints
      const hint = await generateHint(
        secretWord,
        playerMessages,
        previousHints
      );

      // Store just the hint
      aiResponse = hint;

      await incrementHintsUsed(gameId);
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
        `${msg.playerId === "ai" ? "AI" : "Player"}: ${
          msg.content
        } → Response: ${msg.aiResponse}`
    )
    .join("\n");

  const { text } = await generateText({
    model: openai("gpt-5-nano"),
    system: `You are playing a word guessing game against a human. You need to ask yes/no questions to figure out the secret word.
The human will either ask a question or make a guess each turn.

After they go, it's now your turn to do the same. Your goal is to guess the secret word before they do.

Use their questions (and the responses to them) to inform your next question.

Also use your previous questions and guesses to inform your next guess/question.

Guidelines:
- You probably want to start by asking broad question to narrow down the category.
- As you gather more information, ask more specific questions to zero in on the word.
- Once you feel confident, you can make a guess. To make a guess, just output the word without a question mark.

Previous conversation:
${formattedHistory || "No previous questions yet."}`,
    prompt:
      "What is your next yes/no question to figure out the secret word? (Or make a guess if you're confident)",
    maxRetries: 2,
  });

  return text.trim();
}

// Generate a hint based on conversation history
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
            ? "Hint Request"
            : msg.type === "guess"
            ? "Guess"
            : "Question"
        }: ${msg.content} → Response: ${msg.aiResponse}`
    )
    .join("\n");

  const formattedPreviousHints =
    previousHints.length > 0
      ? `Previous riddles given:\n${previousHints
          .map((h, i) => `${i + 1}. ${h}`)
          .join("\n")}`
      : "No previous riddles given.";

  const { text } = await generateText({
    model: openai("gpt-5-nano"),
    system: `You are helping a player in a word guessing game. The secret word is "${secretWord}".

The player has asked for a hint. Your job is to provide an obtuse riddle that barely helps them get closer to the secret word. 

The riddle must be very very subtle and sometimes even cryptic.

Guidelines for riddles:
- DO NOT say the secret word or any part of it
- Keep riddles concise (1 sentence max but hopefully just a few words)
- Consider what they already know from their questions and answers, sometimes playing off of that.
- If the secret word is already in one of the previous questions, you should make the riddle be "The secret word was already mentioned in a question". Only do this riddles once if applicable.
- You should be riddle like with the hint if possible.

**Important**
- riddles should be very subtle and usually not let them figure it out right away.
${formattedPreviousHints}

Conversation history:
${formattedHistory || "No questions asked yet."}`,
    prompt: "Provide a riddle based on the above guidelines.",
    maxRetries: 2,
  });

  return text.trim();
}

// Mock hint generator for testing without OpenAI
function getMockHint(secretWord: string, previousHints: string[]): string {
  const hintCount = previousHints.length;

  // Define hints for common words
  const hints: Record<string, string[]> = {
    computer: [
      "It's an electronic device commonly found in homes and offices.",
      "People use it for work, entertainment, and communication.",
      "It has a keyboard and screen.",
    ],
    elephant: [
      "It's the largest land animal.",
      "It has a long trunk.",
      "It's native to Africa and Asia.",
    ],
    pizza: [
      "It's a popular food item.",
      "It usually has cheese and tomato sauce.",
      "It's often cut into triangular slices.",
    ],
  };

  const wordHints = hints[secretWord.toLowerCase()] || [
    "Think about common everyday things.",
    "Consider its main purpose or use.",
    "What category does it belong to?",
  ];

  return wordHints[Math.min(hintCount, wordHints.length - 1)];
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
