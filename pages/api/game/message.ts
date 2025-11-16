import { NextApiRequest, NextApiResponse } from "next";
import { addMessage, getGame, updateGameStatus, updateTurn } from "@/lib/db-operations";
import { GameMessage } from "@/lib/db-operations";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

// Check if we should use mock AI
const useMockAI = () => !process.env.OPENAI_API_KEY ||
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

  if (type !== "question" && type !== "guess") {
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

    let aiResponse: string | undefined;
    let isCorrectGuess = false;

    if (type === "guess") {
      // Check if guess is correct
      isCorrectGuess = content.toLowerCase().trim() === game.secretWord.toLowerCase().trim();
      aiResponse = isCorrectGuess ? "Correct!" : "Incorrect!";
    } else {
      // Get AI response for question
      aiResponse = await generateGameAIResponse(content, game.secretWord);
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
        winnerId: playerId
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

      let aiAiResponse: string | undefined;
      let aiCorrectGuess = false;

      if (aiType === "guess") {
        // The AI returns just the word when guessing
        const aiGuessWord = aiQuestion.trim();

        aiCorrectGuess = aiGuessWord.toLowerCase() === game.secretWord.toLowerCase();
        aiAiResponse = aiCorrectGuess ? "Correct!" : "Incorrect!";
      } else {
        // Get Game AI response to Player AI's question
        aiAiResponse = await generateGameAIResponse(aiQuestion, game.secretWord);
      }

      aiMessage = {
        id: generateId(),
        type: aiType,
        content: aiQuestion,
        aiResponse: aiAiResponse,
        playerId: "ai",
        timestamp: Date.now(),
      };

      await addMessage(gameId, aiMessage);

      if (aiCorrectGuess) {
        await updateGameStatus(gameId, "completed", "ai");
        return res.status(200).json({
          message,
          aiMessage,
          gameStatus: "completed",
          winnerId: "ai"
        });
      }

      // Switch turn back to player
      await updateTurn(gameId, playerId);
    } else {
      // Friend mode - switch turns
      const nextPlayer = playerId === game.player1Id ? game.player2Id : game.player1Id;
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
  return Date.now().toString(36) +
         Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

// Generate Game AI response to a question about the secret word
async function generateGameAIResponse(question: string, secretWord: string): Promise<string> {
  if (useMockAI()) {
    return getMockGameAIResponse(question.toLowerCase(), secretWord.toLowerCase());
  }

  const { text } = await generateText({
    model: openai("gpt-5-nano"),
    system: `You are the judge/question answerer in a word guessing game. The secret word is "${secretWord}".

A player will ask you a yes/no question to try to figure out the secret word. You must respond with ONLY one of these eight options:
- "Yes"
- "No"
- "Unknown"
- "Sometimes"
- "Probably"
- "Probably Not"
- "Irrelevant"
- "Depends"

Try to be as accurate as possible.`,
    prompt: question,
    maxRetries: 0,
  });

  const responseText = text.trim().toLowerCase();

  // Validate response is one of the allowed options
  const validResponses = ["yes", "no", "sometimes", "unknown", "probably", "probably not", "depends", "irrelevant"];
  return validResponses.includes(responseText) ? responseText : "I don't know";
}

// Mock Game AI for testing without OpenAI API
function getMockGameAIResponse(question: string, secretWord: string): string {
  // Basic logic for common question patterns
  if (question.includes("animal") || question.includes("living")) {
    return ["dog", "cat", "elephant", "penguin", "kangaroo"].includes(secretWord) ? "yes" : "no";
  }
  if (question.includes("food") || question.includes("eat")) {
    return ["pizza", "chocolate", "champagne"].includes(secretWord) ? "yes" : "no";
  }
  if (question.includes("person") || question.includes("human")) {
    return secretWord === "astronaut" ? "yes" : "no";
  }
  if (question.includes("object") || question.includes("thing")) {
    return ["computer", "guitar", "telephone", "umbrella", "telescope", "submarine"].includes(secretWord) ? "yes" : "no";
  }
  if (question.includes("nature") || question.includes("natural")) {
    return ["mountain", "rainbow", "volcano", "butterfly", "hurricane"].includes(secretWord) ? "yes" : "no";
  }
  if (question.includes("big") || question.includes("large")) {
    return ["elephant", "mountain", "volcano", "submarine", "telescope"].includes(secretWord) ? "yes" : "no";
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
async function generateAIQuestion(conversationHistory: GameMessage[]): Promise<string> {
  if (useMockAI()) {
    return getMockQuestion(conversationHistory);
  }

  // Use real AI to generate intelligent questions
  const formattedHistory = conversationHistory
    .map((msg: GameMessage) =>
      `${msg.playerId === "ai" ? "AI" : "Player"}: ${msg.content} → Response: ${msg.aiResponse}`
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
    prompt: "What is your next yes/no question to figure out the secret word? (Or make a guess if you're confident)",
    maxRetries: 2,
  });

  return text.trim();
}

// Mock AI question generator for testing without OpenAI
function getMockQuestion(conversationHistory: GameMessage[]): string {
  const aiMessages = conversationHistory.filter(msg => msg.playerId === "ai");
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
      .filter(msg => msg.type === "guess")
      .map(msg => msg.content.toLowerCase());

    const availableGuesses = guesses.filter(g => !alreadyGuessed.includes(g));

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
  const askedQuestions = aiMessages.map(msg => msg.content.toLowerCase());

  const availableQuestions = questions.filter(q =>
    !askedQuestions.some(asked => asked.includes(q.toLowerCase().slice(6, 15)))
  );

  if (availableQuestions.length > 0) {
    return availableQuestions[0];
  }

  // If we've asked all predefined questions, make a guess
  return "computer";
}
