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

  try {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: `You are a helpful assistant in a word guessing game. The secret word is "${secretWord}".

A player will ask you a yes/no question to try to figure out the secret word. You must respond with ONLY one of these five options:
- "yes" - if the answer is clearly yes
- "no" - if the answer is clearly no
- "sometimes" - if it depends on context or is sometimes true
- "maybe" - if it's uncertain or could go either way
- "not relevant" - if the question doesn't help identify the word

Be fair but challenging. Don't make it too easy. Respond with ONLY the single word response, nothing else.`,
      prompt: question,
      maxRetries: 2,
    });

    const response = text.trim().toLowerCase();

    // Validate response is one of the allowed options
    const validResponses = ["yes", "no", "sometimes", "maybe", "not relevant"];
    const finalResponse = validResponses.includes(response)
      ? response
      : "not relevant";

    res.status(200).json({ response: finalResponse });
  } catch (error) {
    console.error("AI Response Error:", error);
    res.status(500).json({ error: "Failed to generate AI response" });
  }
}
