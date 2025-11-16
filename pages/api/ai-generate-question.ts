import { NextApiRequest, NextApiResponse } from "next";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { GameMessage } from "@/lib/db-operations";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { previousMessages } = req.body;

  // Check if we should use mock AI
  const useMockAI = !process.env.OPENAI_API_KEY ||
                    process.env.OPENAI_API_KEY.startsWith("mock") ||
                    process.env.USE_MOCK_AI === "true";

  try {
    let question: string;

    console.log("USE_MOCK_AI:", useMockAI);
    if (useMockAI) {
      // Generate a simple mock question
      question = getMockQuestion(previousMessages || []);
    } else {
      // Use real AI to generate intelligent questions
      const conversationHistory = (previousMessages || [])
        .map((msg: GameMessage) =>
          `${msg.playerId === "ai" ? "AI" : "Player"}: ${msg.content} → Response: ${msg.aiResponse}`
        )
        .join("\n");

      const { text } = await generateText({
        model: openai("gpt-5-nano"),
        system: `You are playing a word guessing game against a human. You need to ask yes/no questions to figure out the secret word.
The human will either ask a question or make a guess each turn.

After they go, it's now your turn to do the same. Your goal is to guess the secret word before they do.

Use their questions (and the reponses to them) to inform your next question.

Also use your previous questions and guesses to inform your next guess/question.

Guidelines:
- You probably want to start by asking broad question to narrow down the category.
- As you gather more information, ask more specific questions to zero in on the word.
- Once you feel confident, you can make a guess.

Previous conversation:
${conversationHistory || "No previous questions yet."}`,
        prompt: "What is your next yes/no question to figure out the secret word?",
        maxRetries: 2,
      });

      question = text.trim();
    }

    res.status(200).json({ question });
  } catch (error) {
    console.error("AI Question Generation Error:", error);
    res.status(500).json({ error: "Failed to generate AI question" });
  }
}

// Mock AI question generator for testing without OpenAI
function getMockQuestion(previousMessages: GameMessage[]): string {
  const aiMessages = previousMessages.filter(msg => msg.playerId === "ai");
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
