import { NextApiRequest, NextApiResponse } from "next";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { question, secretWord } = req.body;

  if (!question || !secretWord) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Check if we should use mock AI (when OPENAI_API_KEY is not set or starts with "mock")
  const useMockAI = !process.env.OPENAI_API_KEY ||
                    process.env.OPENAI_API_KEY.startsWith("mock") ||
                    process.env.USE_MOCK_AI === "true";

  try {
    let responseText: string;
    console.log("USE_MOCK_AI:", useMockAI);
    if (useMockAI) {
      // Simple mock AI logic for testing without OpenAI
      responseText = getMockResponse(question.toLowerCase(), secretWord.toLowerCase());
    } else {
      const { text } = await generateText({
        model: openai("gpt-5-nano"),
        system: `You are a helpful assistant in a word guessing game. The secret word is "${secretWord}".

A player will ask you a yes/no question to try to figure out the secret word. You must respond with ONLY one of these five options:
- "yes" - if the answer is clearly yes
- "no" - if the answer is clearly no
- "sometimes" - if it depends on context or is sometimes true
- "maybe" - if it's uncertain or could go either way
- "not relevant" - if the question doesn't help identify the word`,
        prompt: question,
        maxRetries: 0,
      });
      responseText = text.trim().toLowerCase();
    }

    // Validate response is one of the allowed options
    const validResponses = ["yes", "no", "sometimes", "maybe", "not relevant"];
    const finalResponse = validResponses.includes(responseText)
      ? responseText
      : "not relevant";

    res.status(200).json({ response: finalResponse });
  } catch (error) {
    console.error("AI Response Error:", error);
    res.status(500).json({ error: "Failed to generate AI response" });
  }
}

// Mock AI for testing without OpenAI API
function getMockResponse(question: string, secretWord: string): string {
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
