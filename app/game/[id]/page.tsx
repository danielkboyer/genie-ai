"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { GameChat } from "@/components/GameChat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Trophy, Clock } from "lucide-react";
import { Game, GameMessage } from "@/lib/db-operations";

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params?.id as string;
  const [game, setGame] = useState<Partial<Game> | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerId] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("playerId") || "";
    }
    return "";
  });

  const fetchGame = async () => {
    try {
      const response = await fetch(`/api/game/${gameId}`);
      const data = await response.json();

      if (response.ok) {
        setGame(data.game);
      } else {
        alert(data.error || "Failed to load game");
        router.push("/");
      }
    } catch (error) {
      console.error("Error fetching game:", error);
      alert("Failed to load game");
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (gameId) {
      fetchGame();
      // Poll for updates every 3 seconds
      const interval = setInterval(fetchGame, 3000);
      return () => clearInterval(interval);
    }
  }, [gameId]);

  const handleMessageSent = (
    message: GameMessage,
    gameStatus: string,
    winnerId?: string
  ) => {
    setGame((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [...(prev.messages || []), message],
        status: gameStatus as "active" | "completed",
        winnerId,
        // In AI mode, keep the turn with the current player
        currentTurn: prev.mode === "ai" ? playerId : prev.currentTurn,
      };
    });
  };

  const copyGameCode = () => {
    if (game?.code) {
      navigator.clipboard.writeText(game.code);
      alert("Game code copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-100 to-pink-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading game...</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return null;
  }

  const isMyTurn = game.currentTurn === playerId;
  const isWinner = game.winnerId === playerId;
  const isCompleted = game.status === "completed";

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-100 to-pink-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Genie AI
              </CardTitle>
              {game.mode === "ai" ? (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">vs AI</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {game.code && !game.player2Id && (
                    <Button
                      onClick={copyGameCode}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      {game.code}
                    </Button>
                  )}
                  {!game.player2Id && (
                    <span className="text-sm text-orange-600 font-medium">
                      Waiting for friend...
                    </span>
                  )}
                </div>
              )}
            </div>
            {!isCompleted && (
              <div className="mt-2">
                {isMyTurn ? (
                  <div className="text-sm font-medium text-green-600">
                    Your turn!
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    {game.mode === "ai"
                      ? "Waiting for response..."
                      : "Opponent's turn..."}
                  </div>
                )}
              </div>
            )}
          </CardHeader>
        </Card>

        {/* Game Result */}
        {isCompleted && (
          <Card className="mb-4 border-2 border-purple-500">
            <CardContent className="pt-6">
              <div className="text-center">
                <Trophy className="h-12 w-12 mx-auto mb-3 text-yellow-500" />
                <h2 className="text-2xl font-bold mb-2">
                  {isWinner ? "You Won!" : "You Lost!"}
                </h2>
                <p className="text-gray-600 mb-4">
                  The secret word was:{" "}
                  <span className="font-bold text-purple-600">
                    {game.secretWord}
                  </span>
                </p>
                <Button onClick={() => router.push("/")} size="lg">
                  Play Again
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chat */}
        <Card className="h-[600px] flex flex-col">
          <GameChat
            gameId={gameId}
            playerId={playerId}
            messages={game.messages || []}
            isMyTurn={isMyTurn}
            gameStatus={game.status || "active"}
            onMessageSent={handleMessageSent}
          />
        </Card>

        {/* Back button */}
        <div className="mt-4 text-center">
          <Button
            onClick={() => router.push("/")}
            variant="ghost"
            className="text-gray-600"
          >
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
