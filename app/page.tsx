"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sparkles, Trophy } from "lucide-react";

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

  useEffect(() => {
    // Check if user has won today
    if (typeof window !== "undefined") {
      const today = new Date().toISOString().split("T")[0];
      const wonDate = localStorage.getItem("lastWonDate");
      const gameId = localStorage.getItem("lastWonGameId");

      if (wonDate === today && gameId) {
        setHasWonToday(true);
        setTodayGameId(gameId);
      }
    }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-100 to-pink-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-4 rounded-full">
              <Sparkles className="h-12 w-12 text-white" />
            </div>
          </div>
          <CardTitle className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Genie AI
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
                <h3 className="text-2xl font-bold text-green-600">You beat today's word!</h3>
                <p className="text-gray-600">Come back tomorrow for a new word</p>
                <Button
                  onClick={() => router.push(`/game/${todayGameId}`)}
                  variant="outline"
                  className="w-full"
                >
                  View Game Results
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button
                onClick={handlePlayAI}
                disabled={loading}
                className="w-full h-14 text-lg font-semibold"
                size="lg"
              >
                {loading ? "Starting..." : "Play vs AI"}
              </Button>

              <Button
                onClick={handlePlayFriend}
                disabled={loading}
                variant="outline"
                className="w-full h-12"
                size="lg"
              >
                Play with Friend
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              {!showJoinInput ? (
                <Button
                  onClick={() => setShowJoinInput(true)}
                  variant="ghost"
                  className="w-full"
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
                      className="flex-1"
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
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-6 p-4 bg-purple-50 rounded-lg">
                <h3 className="font-semibold text-sm mb-2">How to Play:</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Ask yes/no questions to narrow down the word</li>
                  <li>• The AI will respond: yes, no, sometimes, maybe, or not relevant</li>
                  <li>• Take turns with your opponent</li>
                  <li>• First to guess correctly wins!</li>
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
