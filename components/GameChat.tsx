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
  gameMode?: "ai" | "friend";
  onMessageSent: (message: GameMessage, gameStatus: string, winnerId?: string) => void;
}

export function GameChat({
  gameId,
  playerId,
  messages,
  isMyTurn,
  gameStatus,
  gameMode,
  onMessageSent,
}: GameChatProps) {
  const [input, setInput] = useState("");
  const [isQuestion, setIsQuestion] = useState(true);
  const [loading, setLoading] = useState(false);
  const [waitingForAI, setWaitingForAI] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<{ content: string; type: "question" | "guess" } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Only scroll when messages length changes (new message added)
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length]);

  // Track when new messages arrive to hide loading indicators
  useEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      const newMessages = messages.slice(lastMessageCountRef.current);
      const hasPlayerAIMessage = newMessages.some(m => m.playerId === "ai");

      // If we got the Game AI response (player's message with aiResponse), stop loading
      if (loading && newMessages.some(m => m.playerId === playerId && m.aiResponse)) {
        setLoading(false);
        setPendingQuestion(null);
        // If in AI mode and we haven't gotten the AI's question yet, show AI thinking
        // BUT only if game is still active (not completed) AND we're in AI mode
        if (gameMode === "ai" && gameStatus === "active" && !hasPlayerAIMessage) {
          setWaitingForAI(true);
        }
      }

      // If we got the Player AI's message, stop showing AI thinking
      if (waitingForAI && hasPlayerAIMessage) {
        setWaitingForAI(false);
      }

      // If game completed, clear all loading states
      if (gameStatus === "completed") {
        setLoading(false);
        setPendingQuestion(null);
        setWaitingForAI(false);
      }

      lastMessageCountRef.current = messages.length;
    }
  }, [messages, loading, waitingForAI, playerId, gameStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || !isMyTurn || gameStatus !== "active" || loading) {
      return;
    }

    const userInput = input.trim();
    const messageType = isQuestion ? "question" : "guess";

    setInput("");
    setPendingQuestion({ content: userInput, type: messageType });
    setLoading(true);

    try {
      const response = await fetch("/api/game/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          playerId,
          type: messageType,
          content: userInput,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setLoading(false);
        setPendingQuestion(null);
        alert(data.error || "Failed to send message");
      }
      // Don't handle success here - let the polling handle it
      // The useEffect will detect new messages and update loading states
    } catch (error) {
      setLoading(false);
      setPendingQuestion(null);
      console.error("Error sending message:", error);
      alert("Failed to send message");
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
        {loading && pendingQuestion && (
          <div className="flex flex-col gap-1 mb-3 items-end">
            {/* Player's pending question */}
            <div className="max-w-[75%] rounded-2xl px-4 py-2 shadow-sm bg-blue-500 text-white rounded-br-md">
              <div className="text-xs font-semibold mb-1 opacity-90">
                {pendingQuestion.type === "question" ? "Question:" : "Guess:"}
              </div>
              <div className="break-words">{pendingQuestion.content}</div>
            </div>
            {/* Loading indicator */}
            <div className="max-w-[75%] rounded-2xl px-4 py-2 shadow-sm bg-gray-100 text-gray-900 rounded-br-md">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                <span className="text-sm text-gray-600">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        {waitingForAI && (
          <div className="flex items-start gap-1 mb-3">
            <div className="max-w-[75%] rounded-2xl px-4 py-2 shadow-sm bg-orange-100 text-gray-900 rounded-bl-md">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                <span className="text-sm text-gray-600">Opponent is thinking...</span>
              </div>
            </div>
          </div>
        )}
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
              className={`flex-1 ${isQuestion ? 'ring-2 ring-purple-600 ring-offset-2' : ''}`}
              size="sm"
            >
              Ask Question
            </Button>
            <Button
              type="button"
              variant={!isQuestion ? "default" : "outline"}
              onClick={() => setIsQuestion(false)}
              className={`flex-1 ${!isQuestion ? 'ring-2 ring-purple-600 ring-offset-2' : ''}`}
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
