import { NextApiRequest, NextApiResponse } from "next";
import { addMessage, getGame, updateGameStatus, updateTurn } from "@/lib/db-operations";
import { GameMessage } from "@/lib/db-operations";

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
      const aiRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/ai-respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: content, secretWord: game.secretWord }),
      });

      const aiData = await aiRes.json();
      aiResponse = aiData.response;
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
        gameStatus: "completed",
        winnerId: playerId
      });
    }

    // Switch turns
    const nextPlayer = game.mode === "ai"
      ? playerId // In AI mode, it's always the player's turn
      : (playerId === game.player1Id ? game.player2Id : game.player1Id);

    if (nextPlayer) {
      await updateTurn(gameId, nextPlayer);
    }

    res.status(200).json({ message, gameStatus: "active" });
  } catch (error) {
    console.error("Message Error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}
