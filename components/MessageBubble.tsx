import { cn } from "@/lib/utils";
import { GameMessage } from "@/lib/db-operations";

interface MessageBubbleProps {
  message: GameMessage;
  isCurrentPlayer: boolean;
}

export function MessageBubble({ message, isCurrentPlayer }: MessageBubbleProps) {
  const isQuestion = message.type === "question";
  const isGuess = message.type === "guess";
  const isAI = message.playerId === "ai";

  return (
    <div className={cn("flex flex-col gap-1 mb-3", isCurrentPlayer ? "items-end" : "items-start")}>
      {/* User's or AI's message */}
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2 shadow-sm",
          isCurrentPlayer
            ? "bg-blue-500 text-white rounded-br-md"
            : isAI
            ? "bg-orange-500 text-white rounded-bl-md"
            : "bg-gray-200 text-gray-900 rounded-bl-md"
        )}
      >
        <div className={cn("text-xs font-semibold mb-1", isCurrentPlayer || isAI ? "opacity-90" : "opacity-70")}>
          {isAI ? "AI " : ""}{isQuestion ? "Question:" : "Guess:"}
        </div>
        <div className="break-words">{message.content}</div>
      </div>

      {/* AI Response */}
      {message.aiResponse && (
        <div
          className={cn(
            "max-w-[75%] rounded-2xl px-4 py-2 shadow-sm bg-gray-100 text-gray-900",
            isCurrentPlayer ? "rounded-br-md" : "rounded-bl-md"
          )}
        >
          <div className="text-xs font-semibold mb-1 text-purple-600">
            Genie AI:
          </div>
          <div className="break-words font-medium">{message.aiResponse}</div>
        </div>
      )}

      <div className={cn("text-xs text-gray-500 px-2")}>
        {new Date(message.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
    </div>
  );
}
