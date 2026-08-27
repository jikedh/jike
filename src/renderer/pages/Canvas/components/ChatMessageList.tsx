import { IconCheck, IconCopy, IconRefresh } from "@tabler/icons-react";
import { useCallback, useEffect, useState, type RefObject } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  CANVAS_IMAGE_DRAG_MIME,
  CANVAS_IMAGE_DRAG_TYPE,
  type CanvasImageDragPayload,
} from "shared/constants/canvasDrag";
import type {
  NoteGenerationImage,
  NoteGenerationMessage,
} from "shared/types/NoteGeneration";
import { cn } from "shared/utils/utils";

type ChatMessageListProps = {
  messages: NoteGenerationMessage[];
  isLoading?: boolean;
  className?: string;
  containerRef?: RefObject<HTMLDivElement | null>;
  onRetry?: (messageIndex: number) => void;
};

type ChatImagePreviewProps = {
  image: NoteGenerationImage;
  imageIndex: number;
};

const shouldUseIpcImageFallback = (url: string) => {
  if (!/^https?:\/\//i.test(url)) {
    return false;
  }

  try {
    const { hostname } = new URL(url);
    return !hostname.includes("aliyuncs.com");
  } catch {
    return false;
  }
};

const ChatImagePreview = ({ image, imageIndex }: ChatImagePreviewProps) => {
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const imageUrl = image.previewUrl ?? image.url;
  const [displayUrl, setDisplayUrl] = useState(imageUrl);
  const [naturalSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    setDisplayUrl(imageUrl);
    setLoadState("loading");
    setNaturalSize(null);
  }, [imageUrl]);

  useEffect(() => {
    if (
      loadState === "loaded" ||
      !shouldUseIpcImageFallback(displayUrl) ||
      !window.download?.imageAsBase64
    ) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await window.download.imageAsBase64(image.url);
        if (cancelled) return;

        if (result.success && result.data?.base64) {
          setDisplayUrl(result.data.base64);
          return;
        }

        setLoadState("error");
      } catch {
        if (!cancelled) {
          setLoadState("error");
        }
      }
    }, 2500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [displayUrl, image.url, loadState]);

  const handleDragStart = (event: React.DragEvent<HTMLAnchorElement>) => {
    const payload: CanvasImageDragPayload = {
      type: CANVAS_IMAGE_DRAG_TYPE,
      images: [
        {
          url: image.url,
          previewUrl: image.previewUrl,
          originalUrl: image.originalUrl,
          localPath: image.localPath,
          localName: image.localName,
          width: image.width ?? naturalSize?.width,
          height: image.height ?? naturalSize?.height,
        },
      ],
    };

    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(CANVAS_IMAGE_DRAG_MIME, JSON.stringify(payload));
    event.dataTransfer.setData("text/uri-list", image.url);
    event.dataTransfer.setData("text/plain", image.url);
  };

  return (
    <a
      href={image.url}
      target="_blank"
      rel="noreferrer"
      draggable
      onDragStart={handleDragStart}
      className="relative block min-h-[220px] overflow-hidden rounded-xl border border-white/10 bg-black/30"
      title="打开图片"
    >
      {loadState !== "loaded" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#10131b] text-xs text-white/50">
          {loadState === "loading" ? (
            <>
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-[#b43feb]" />
              <span>正在加载预览...</span>
            </>
          ) : (
            <>
              <span>预览加载失败</span>
              <span className="rounded-md border border-white/15 px-2 py-1 text-white/70">
                打开原图
              </span>
            </>
          )}
        </div>
      )}
      <img
        src={displayUrl}
        alt={`生成图片 ${imageIndex + 1}`}
        className={cn(
          "max-h-[360px] w-full object-contain transition-opacity duration-200",
          loadState === "loaded" ? "opacity-100" : "opacity-0",
        )}
        loading={imageIndex === 0 ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={imageIndex === 0 ? "high" : "auto"}
        onLoad={(event) => {
          setLoadState("loaded");
          setNaturalSize({
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          });
        }}
        onError={() => setLoadState("error")}
      />
    </a>
  );
};

export const ChatMessageList = ({
  messages,
  isLoading = false,
  className,
  containerRef,
  onRetry,
}: ChatMessageListProps) => {
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(
    null,
  );
  const lastMessage = messages[messages.length - 1];
  const shouldShowThinking =
    isLoading && (!lastMessage || lastMessage.role === "user");

  const handleCopyMessage = useCallback(async (index: number, content: string) => {
    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageIndex(index);
      window.setTimeout(() => setCopiedMessageIndex(null), 2000);
    } catch (error: any) {
      console.error("[CanvasChat] copy message failed", error);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "canvas-chat-scrollbar flex-1 overflow-y-auto px-3 py-3",
        className,
      )}
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
                    : "relative rounded-bl-[8px] border border-white/10 bg-[#151821] pb-9 text-white/88",
                )}
              >
                <div className="select-text text-[14px] leading-[1.7] prose prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
                {message.images && message.images.length > 0 && (
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    {message.images.map((image, imageIndex) => (
                      <ChatImagePreview
                        key={`${image.url}-${imageIndex}`}
                        image={image}
                        imageIndex={imageIndex}
                      />
                    ))}
                  </div>
                )}
                {message.status === "failed" &&
                  index === messages.length - 1 &&
                  !isLoading &&
                  onRetry && (
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[#b43feb]/35 bg-[#b43feb]/10 px-2.5 py-1.5 text-xs text-[#d793ff] transition-colors hover:bg-[#b43feb]/20"
                      onClick={() => onRetry(index)}
                    >
                      <IconRefresh size={14} />
                      <span>重试</span>
                    </button>
                  )}
                {!isUser && (
                  <button
                    type="button"
                    title={
                      copiedMessageIndex === index ? "已复制回复" : "复制回复"
                    }
                    className={cn(
                      "absolute bottom-2 right-2 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/40 transition-colors hover:bg-white/10 hover:text-white/80",
                      copiedMessageIndex === index && "text-emerald-400",
                    )}
                    onClick={() => handleCopyMessage(index, message.content)}
                    disabled={!message.content}
                  >
                    {copiedMessageIndex === index ? (
                      <>
                        <IconCheck size={12} />
                        <span>已复制</span>
                      </>
                    ) : (
                      <>
                        <IconCopy size={12} />
                        <span>复制</span>
                      </>
                    )}
                  </button>
                )}
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
