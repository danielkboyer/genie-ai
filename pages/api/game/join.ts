import { NextApiRequest, NextApiResponse } from "next";
import { joinGame } from "@/lib/db-operations";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code, playerId } = req.body;

  if (!code || !playerId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const game = await joinGame(code, playerId);

    if (!game) {
      return res.status(404).json({ error: "Game not found or already full" });
    }

    // Don't send secret word to client
    const { secretWord: _, ...gameWithoutSecret } = game;

    res.status(200).json({ game: gameWithoutSecret });
  } catch (error) {
    console.error("Join Game Error:", error);
    res.status(500).json({ error: "Failed to join game" });
  }
}
