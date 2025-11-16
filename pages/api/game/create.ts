import { NextApiRequest, NextApiResponse } from "next";
import { createGame, getTodayWord } from "@/lib/db-operations";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { playerId, mode } = req.body;

  if (!playerId || !mode) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (mode !== "ai" && mode !== "friend") {
    return res.status(400).json({ error: "Invalid game mode" });
  }

  try {
    const secretWord = await getTodayWord();
    const game = await createGame(playerId, mode, secretWord);

    // Don't send secret word to client
    const { secretWord: _, ...gameWithoutSecret } = game;

    res.status(200).json({ game: gameWithoutSecret });
  } catch (error) {
    console.error("Create Game Error:", error);
    res.status(500).json({ error: "Failed to create game" });
  }
}
