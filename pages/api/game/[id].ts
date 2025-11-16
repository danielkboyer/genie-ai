import { NextApiRequest, NextApiResponse } from "next";
import { getGame } from "@/lib/db-operations";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid game ID" });
  }

  try {
    const game = await getGame(id);

    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }

    // Don't send secret word to client unless game is completed
    if (game.status === "active") {
      const { secretWord: _, ...gameWithoutSecret } = game;
      return res.status(200).json({ game: gameWithoutSecret });
    }

    res.status(200).json({ game });
  } catch (error) {
    console.error("Get Game Error:", error);
    res.status(500).json({ error: "Failed to get game" });
  }
}
