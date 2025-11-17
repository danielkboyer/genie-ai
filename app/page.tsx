"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trophy, Share2 } from "lucide-react";
import Image from "next/image";
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

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [gameCode, setGameCode] = useState("");
  const [playerId] = useState(() => {
    if (typeof window !== "undefined") {
      let id = localStorage.getItem("playerId");
      if (!id) {
        id = Math.random().toString(36).substring(2, 15);
        localStorage.setItem("playerId", id);
      }
      return id;
    }
    return "";
  });
  const [hasWonToday, setHasWonToday] = useState(false);
  const [todayGameId, setTodayGameId] = useState<string | null>(null);
  const [timeUntilNext, setTimeUntilNext] = useState(getTimeUntilNextWord());
  const [shared, setShared] = useState(false);
  const [didWin, setDidWin] = useState(false);
  const [attemptCount, setAttemptCount] = useState<number>(0);

  useEffect(() => {
    // Check if user has played today (Mountain Time)
    const fetchGameData = async () => {
      if (typeof window !== "undefined") {
        const now = new Date();
        const mountainTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
        const today = mountainTime.toISOString().split("T")[0];
        const playedDate = localStorage.getItem("lastPlayedDate");
        const wonDate = localStorage.getItem("lastWonDate");
        const gameId = localStorage.getItem("lastPlayedGameId");

        if (playedDate === today && gameId) {
          setHasWonToday(true);
          setTodayGameId(gameId);
          setDidWin(wonDate === today);

          // Fetch game data to get attempt count
          try {
            const response = await fetch(`/api/game/${gameId}`);
            const data = await response.json();
            if (response.ok && data.game) {
              const playerMessages = data.game.messages?.filter((m: any) => m.playerId === playerId) || [];
              setAttemptCount(playerMessages.length);
            }
          } catch (error) {
            console.error("Error fetching game data:", error);
          }
        }
      }
    };

    fetchGameData();
  }, [playerId]);

  // Update countdown timer every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUntilNext(getTimeUntilNextWord());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const handlePlayAI = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/game/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, mode: "ai" }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push(`/game/${data.game.id}`);
      } else {
        alert(data.error || "Failed to create game");
        setLoading(false);
      }
    } catch (error) {
      console.error("Error creating game:", error);
      alert("Failed to create game");
      setLoading(false);
    }
  };

  const handlePlayFriend = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/game/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, mode: "friend" }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push(`/game/${data.game.id}`);
      } else {
        alert(data.error || "Failed to create game");
        setLoading(false);
      }
    } catch (error) {
      console.error("Error creating game:", error);
      alert("Failed to create game");
      setLoading(false);
    }
  };

  const handleJoinGame = async () => {
    if (!gameCode.trim()) {
      alert("Please enter a game code");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/game/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: gameCode.toUpperCase(), playerId }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push(`/game/${data.game.id}`);
      } else {
        alert(data.error || "Failed to join game");
        setLoading(false);
      }
    } catch (error) {
      console.error("Error joining game:", error);
      alert("Failed to join game");
      setLoading(false);
    }
  };

  const handleShare = async () => {
    const now = new Date();
    const mountainTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
    const startDate = new Date(2025, 10, 16);
    const currentMT = new Date(mountainTime.getFullYear(), mountainTime.getMonth(), mountainTime.getDate());
    const daysSinceStart = Math.floor((currentMT.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const shareText = `The Secret Word #${daysSinceStart}\n${didWin ? '🏆 Won!' : '❌ Lost'} in ${attemptCount} ${attemptCount === 1 ? 'attempt' : 'attempts'}\n\nhttps://secretword.xyz`;

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

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: colors.background.main }}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Image src="/favicon.svg" alt="The Secret Word" width={64} height={64} />
          </div>
          <CardTitle className="text-4xl font-bold" style={{ color: colors.primary.main }}>
            The Secret Word
          </CardTitle>
          <CardDescription className="text-base mt-2">
            Guess today's secret word by asking yes/no questions!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasWonToday ? (
            <>
              <div className="text-center py-6 space-y-4">
                <Trophy className="h-16 w-16 mx-auto text-yellow-500" />
                <h3 className="text-2xl font-bold text-green-600">You played today's word!</h3>
                <p className="text-gray-600">Come back tomorrow for a new word</p>
                <div className="py-3 px-4 bg-white rounded-lg border-2" style={{ borderColor: colors.primary.light }}>
                  <p className="text-sm text-gray-600">
                    Next word in: <span className="font-semibold" style={{ color: colors.primary.main }}>{timeUntilNext}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleShare}
                    className="flex-1 text-white shadow-md hover:shadow-lg transition-all"
                    style={{ backgroundColor: colors.primary.main }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.primary.hover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primary.main}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    {shared ? "Copied!" : "Share"}
                  </Button>
                  <Button
                    onClick={() => router.push(`/game/${todayGameId}`)}
                    variant="outline"
                    className="flex-1 border-2 hover:bg-opacity-10"
                    style={{ borderColor: colors.primary.main, color: colors.primary.main }}
                  >
                    View Results
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <Button
                onClick={handlePlayAI}
                disabled={loading}
                className="w-full h-14 text-lg font-semibold text-white shadow-lg hover:shadow-xl transition-all"
                size="lg"
                style={{ backgroundColor: loading ? colors.primary.light : colors.primary.main }}
                onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = colors.primary.hover)}
                onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = colors.primary.main)}
              >
                {loading ? "Starting..." : "Play by myself"}
              </Button>

              <Button
                onClick={handlePlayFriend}
                disabled={loading}
                variant="outline"
                className="w-full h-12 border-2 font-semibold shadow-md hover:shadow-lg transition-all"
                size="lg"
                style={{ borderColor: colors.primary.main, color: colors.primary.main }}
              >
                Play with friend
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 py-1 text-gray-500 font-medium rounded-full border border-gray-200">Or</span>
                </div>
              </div>

              {!showJoinInput ? (
                <Button
                  onClick={() => setShowJoinInput(true)}
                  variant="outline"
                  className="w-full border-2"
                  style={{ borderColor: colors.primary.main, color: colors.primary.main }}
                >
                  Join a Friend's Game
                </Button>
              ) : (
                <div className="space-y-2">
                  <Input
                    placeholder="Enter game code"
                    value={gameCode}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase();
                      setGameCode(value);
                    }}
                    maxLength={6}
                    className="text-center text-lg font-mono tracking-wider"
                  />
                  {gameCode.length > 0 && gameCode.length < 6 && (
                    <p className="text-xs text-red-500 text-center">Code must be 6 letters</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleJoinGame}
                      disabled={loading || gameCode.length !== 6}
                      className="flex-1 text-white shadow-md hover:shadow-lg transition-all"
                      style={{ backgroundColor: (loading || gameCode.length !== 6) ? colors.primary.light : colors.primary.main }}
                      onMouseEnter={(e) => !(loading || gameCode.length !== 6) && (e.currentTarget.style.backgroundColor = colors.primary.hover)}
                      onMouseLeave={(e) => !(loading || gameCode.length !== 6) && (e.currentTarget.style.backgroundColor = colors.primary.main)}
                    >
                      Join Game
                    </Button>
                    <Button
                      onClick={() => {
                        setShowJoinInput(false);
                        setGameCode("");
                      }}
                      variant="outline"
                      disabled={loading}
                      className="border-2 border-gray-300 hover:bg-gray-50"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-6 p-4 bg-white rounded-lg border-2" style={{ borderColor: colors.primary.lighter }}>
                <h3 className="font-semibold text-sm mb-2" style={{ color: colors.primary.main }}>How to Play:</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• You and your opponent try to guess the same secret word</li>
                  <li>• Ask yes/no questions to narrow down the word</li>
                  <li>• Responses: yes, no, sometimes, probably, probably not, unknown, depends, or irrelevant</li>
                  <li>• Take turns asking questions or making guesses</li>
                  <li>• First to guess the word correctly wins!</li>
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
