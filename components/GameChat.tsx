"use client";

import { useState, useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { GameMessage } from "@/lib/db-operations";
import { Send } from "lucide-react";

interface GameChatProps {
  gameId: string;
  playerId: string;
  messages: GameMessage[];
  isMyTurn: boolean;
  gameStatus: "active" | "completed";
  onMessageSent: (message: GameMessage, gameStatus: string, winnerId?: string) => void;
}

export function GameChat({
  gameId,
  playerId,
  messages,
  isMyTurn,
  gameStatus,
  onMessageSent,
}: GameChatProps) {
  const [input, setInput] = useState("");
  const [isQuestion, setIsQuestion] = useState(true);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || !isMyTurn || gameStatus !== "active" || loading) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/game/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          playerId,
          type: isQuestion ? "question" : "guess",
          content: input.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Add player's message
        onMessageSent(data.message, data.gameStatus, data.winnerId);

        // Add AI's message if it exists
        if (data.aiMessage) {
          onMessageSent(data.aiMessage, data.gameStatus, data.winnerId);
        }

        setInput("");
      } else {
        alert(data.error || "Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg font-semibold mb-2">Start guessing!</p>
            <p className="text-sm">Ask questions or make a guess to win.</p>
          </div>
        )}
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isCurrentPlayer={message.playerId === playerId}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {gameStatus === "active" && (
        <div className="border-t bg-white p-4">
          <div className="flex gap-2 mb-3">
            <Button
              type="button"
              variant={isQuestion ? "default" : "outline"}
              onClick={() => setIsQuestion(true)}
              className="flex-1"
              size="sm"
            >
              Ask Question
            </Button>
            <Button
              type="button"
              variant={!isQuestion ? "default" : "outline"}
              onClick={() => setIsQuestion(false)}
              className="flex-1"
              size="sm"
            >
              Guess Word
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                !isMyTurn
                  ? "Waiting for other player..."
                  : isQuestion
                  ? "Ask a yes/no question..."
                  : "Enter your guess..."
              }
              disabled={!isMyTurn || loading}
              className="flex-1"
            />
            <Button type="submit" disabled={!isMyTurn || loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>

          {!isMyTurn && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              Waiting for the other player's turn...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
