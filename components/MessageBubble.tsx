import { cn } from "@/lib/utils";
import { GameMessage } from "@/lib/db-operations";
import { colors } from "@/lib/colors";

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
          "max-w-[75%] rounded-3xl px-5 py-3 shadow-lg font-[family-name:var(--font-comic)] relative overflow-hidden",
          isCurrentPlayer
            ? "rounded-br-md"
            : isAI
            ? "rounded-bl-md"
            : "rounded-bl-md"
        )}
        style={{
          backgroundColor: isCurrentPlayer ? `${colors.primary.main}CC` : "#FF8C42CC",
          color: "white"
        }}
      >
        {/* Shine effect */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 50%, rgba(255,255,255,0.1) 100%)"
          }}
        />
        <div className="relative z-10">
          <div className="text-xs font-semibold mb-1 opacity-90">
            {!isCurrentPlayer ? "Opponent " : ""}{isQuestion ? "Question:" : "Guess:"}
          </div>
          <div className="break-words text-base">{message.content}</div>
        </div>
      </div>

      {/* AI Response */}
      {message.aiResponse && (
        <div
          className={cn(
            "max-w-[75%] rounded-3xl px-5 py-3 shadow-md text-gray-900 font-[family-name:var(--font-comic)] relative overflow-hidden",
            isCurrentPlayer ? "rounded-br-md" : "rounded-bl-md"
          )}
          style={{
            backgroundColor: "#E5E7EBCC"
          }}
        >
          {/* Subtle shine effect */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 60%)"
            }}
          />
          <div className="break-words font-medium text-base relative z-10">{message.aiResponse}</div>
        </div>
      )}
    </div>
  );
}
