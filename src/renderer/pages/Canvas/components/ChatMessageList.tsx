import type { RefObject } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "shared/utils/utils";
import type { NoteGenerationMessage } from "shared/types/NoteGeneration";

type ChatMessageListProps = {
  messages: NoteGenerationMessage[];
  isLoading?: boolean;
  className?: string;
  containerRef?: RefObject<HTMLDivElement | null>;
};

export const ChatMessageList = ({
  messages,
  isLoading = false,
  className,
  containerRef,
}: ChatMessageListProps) => {
  const lastMessage = messages[messages.length - 1];
  const shouldShowThinking =
    isLoading && (!lastMessage || lastMessage.role === "user");

  return (
    <div
      ref={containerRef}
      className={cn("flex-1 overflow-y-auto px-3 py-3 no-scrollbar", className)}
    >
      <div className="space-y-3.5">
        {messages.map((message, index) => {
          const isUser = message.role === "user";

          return (
            <div
              key={`${message.role}-${index}-${message.content.slice(0, 12)}`}
              className={cn(
                "flex w-full",
                isUser ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[92%] rounded-[22px] px-3.5 py-2.5 shadow-[0_10px_24px_rgba(0,0,0,0.22)]",
                  isUser
                    ? "rounded-br-[8px] bg-[#b43feb] text-white"
                    : "rounded-bl-[8px] border border-white/10 bg-[#151821] text-white/88",
                )}
              >
                <div className="text-[14px] leading-[1.7] prose prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          );
        })}

        {shouldShowThinking && (
          <div className="flex justify-start">
            <div className="max-w-[92%] rounded-[22px] rounded-bl-[8px] border border-white/10 bg-[#151821] px-3.5 py-2.5 text-[14px] text-white/55 shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#b43feb]/80" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#b43feb]/80 [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#b43feb]/80 [animation-delay:300ms]" />
                <span className="ml-1">正在思考中...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
