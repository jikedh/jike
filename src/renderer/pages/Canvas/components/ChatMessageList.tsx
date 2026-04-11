import { cn } from "shared/utils/utils";
import type { NoteGenerationMessage } from "shared/types/NoteGeneration";

type ChatMessageListProps = {
  messages: NoteGenerationMessage[];
  isLoading?: boolean;
};

export const ChatMessageList = ({
  messages,
  isLoading = false,
}: ChatMessageListProps) => {
  const lastMessage = messages[messages.length - 1];
  const shouldShowThinking =
    isLoading && (!lastMessage || lastMessage.role === "user");

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
      {messages.map((message, index) => {
        const isUser = message.role === "user";

        return (
          <div
            key={`${message.role}-${index}-${message.content.slice(0, 12)}`}
            className="space-y-1"
          >
            <div className="text-[11px] text-slate-400">
              {isUser ? "你" : "AI"}
            </div>
            <div
              className={cn(
                "max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-6 whitespace-pre-wrap",
                isUser
                  ? "ml-auto bg-blue-600 text-white"
                  : "mr-auto bg-neutral-700 text-neutral-100",
              )}
            >
              {message.content}
            </div>
          </div>
        );
      })}

      {shouldShowThinking && (
        <div className="mr-auto max-w-[90%] rounded-2xl bg-neutral-700 px-3 py-2 text-sm text-neutral-400">
          AI 正在思考中...
        </div>
      )}
    </div>
  );
};
