"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { GameChat } from "@/components/GameChat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Trophy, Clock, Share2 } from "lucide-react";
import { Game, GameMessage } from "@/lib/db-operations";
import { colors } from "@/lib/colors";

function getTimeUntilNextWord(): string {
  const now = new Date();

  // Get current time in Mountain Time
  const mountainTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));

  // Get tomorrow at midnight Mountain Time
  const tomorrow = new Date(mountainTime);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  // Calculate difference
  const diff = tomorrow.getTime() - mountainTime.getTime();

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h ${minutes}m`;
}

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
  const [copied, setCopied] = useState(false);
  const [timeUntilNext, setTimeUntilNext] = useState(getTimeUntilNextWord());
  const [shared, setShared] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [waitingForAI, setWaitingForAI] = useState(false);

  const fetchGame = async () => {
    try {
      const response = await fetch(`/api/game/${gameId}`);
      const data = await response.json();

      if (response.ok) {
        setGame(data.game);

        // If game completed (win or loss), save to localStorage (Mountain Time)
        if (data.game.status === "completed" && typeof window !== "undefined") {
          const now = new Date();
          const mountainTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
          const today = mountainTime.toISOString().split("T")[0];
          localStorage.setItem("lastPlayedDate", today);
          localStorage.setItem("lastPlayedGameId", gameId);

          // Also track if they won
          if (data.game.winnerId === playerId) {
            localStorage.setItem("lastWonDate", today);
            localStorage.setItem("lastWonGameId", gameId);
          }
        }
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
      // Poll for updates every 3 seconds, but stop if game is completed
      const interval = setInterval(() => {
        if (game?.status !== "completed") {
          fetchGame();
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [gameId, game?.status]);

  // Update countdown timer every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUntilNext(getTimeUntilNextWord());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const handleMessageSent = (
    message: GameMessage,
    gameStatus: string,
    winnerId?: string
  ) => {
    setGame((prev) => {
      if (!prev) return prev;

      // If player won, save to localStorage (Mountain Time)
      if (gameStatus === "completed" && winnerId === playerId && typeof window !== "undefined") {
        const now = new Date();
        const mountainTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
        const today = mountainTime.toISOString().split("T")[0];
        localStorage.setItem("lastWonDate", today);
        localStorage.setItem("lastWonGameId", gameId);
      }

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

  const copyGameCode = async () => {
    if (!game?.code) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(game.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = game.code;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          console.error('Failed to copy:', err);
        }
        document.body.removeChild(textArea);
      }
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const handleShare = async () => {
    if (!game) return;

    const isWinner = game.winnerId === playerId;
    const now = new Date();
    const mountainTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
    const startDate = new Date(2025, 10, 16);
    const currentMT = new Date(mountainTime.getFullYear(), mountainTime.getMonth(), mountainTime.getDate());
    const daysSinceStart = Math.floor((currentMT.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Count player's questions and guesses
    const playerMessages = game.messages?.filter(m => m.playerId === playerId) || [];
    const totalAttempts = playerMessages.length;

    const shareText = `The Secret Word #${daysSinceStart}\n${isWinner ? '🏆 Won!' : '❌ Lost'} in ${totalAttempts} ${totalAttempts === 1 ? 'attempt' : 'attempts'}\n\nhttps://secretword.xyz`;

    try {
      if (navigator.share) {
        await navigator.share({
          text: shareText,
        });
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareText);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } else {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = shareText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          setShared(true);
          setTimeout(() => setShared(false), 2000);
        } catch (err) {
          console.error('Failed to copy:', err);
        }
        document.body.removeChild(textArea);
      }
    } catch (error) {
      // Fallback to manual copy for older browsers
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(shareText);
          setShared(true);
          setTimeout(() => setShared(false), 2000);
        } catch (err) {
          console.error('Clipboard write failed:', err);
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.background.main }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: colors.primary.main }}></div>
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

  // Determine if it's actually the player's turn considering loading states
  const showYourTurn = isMyTurn && !chatLoading && !waitingForAI;

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: colors.background.main }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <CardTitle className="text-2xl font-bold" style={{ color: colors.primary.main }}>
                The Secret Word
              </CardTitle>
              {game.mode === "ai" ? (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">Solo Mode</span>
                </div>
              ) : (
                <div className="flex flex-col items-end gap-1">
                  {game.code && (
                    <Button
                      onClick={copyGameCode}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      {copied ? "Copied!" : game.code}
                    </Button>
                  )}
                  {!game.player2Id && (
                    <span className="text-xs text-orange-600 font-medium">
                      Waiting for friend...
                    </span>
                  )}
                </div>
              )}
            </div>
            {!isCompleted && (
              <div className="mt-2">
                {showYourTurn ? (
                  <div className="text-sm font-medium text-green-600">
                    Your turn!
                  </div>
                ) : waitingForAI ? (
                  <div className="text-sm text-orange-600">
                    Opponent is thinking...
                  </div>
                ) : chatLoading ? (
                  <div className="text-sm text-gray-500">
                    Waiting for response...
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
          <Card className="mb-4 border-2" style={{ borderColor: colors.primary.main }}>
            <CardContent className="pt-6">
              <div className="text-center space-y-3">
                <Trophy className="h-12 w-12 mx-auto text-yellow-500" />
                <h2 className="text-2xl font-bold">
                  {isWinner ? "You Won!" : "You Lost!"}
                </h2>
                <p className="text-gray-600">
                  The secret word was:{" "}
                  <span className="font-bold" style={{ color: colors.primary.main }}>
                    {game.secretWord}
                  </span>
                </p>
                <Button
                  onClick={handleShare}
                  className="mt-4 text-white shadow-md hover:shadow-lg transition-all"
                  style={{ backgroundColor: colors.primary.main }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.primary.hover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primary.main}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  {shared ? "Copied!" : "Share Result"}
                </Button>
                <div className="pt-2 border-t border-gray-200 mt-4">
                  <p className="text-sm text-gray-500">
                    Next word in: <span className="font-semibold" style={{ color: colors.primary.main }}>{timeUntilNext}</span>
                  </p>
                </div>
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
            gameMode={game.mode}
            onMessageSent={handleMessageSent}
            onLoadingChange={(loading, waiting) => {
              setChatLoading(loading);
              setWaitingForAI(waiting);
            }}
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
