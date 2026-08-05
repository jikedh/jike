/**
 * 剧本Agent 消息列表 + 流式渲染 + 复制按钮
 */
import { Check, Copy } from "lucide-react";
import { useCallback, useState } from "react";
import type { ScriptAgentMessage } from "shared/types/scriptAgent";

type Props = {
    messages: ScriptAgentMessage[];
    streamingContent: string;
    loading: boolean;
    sending: boolean;
    endRef: React.RefObject<HTMLDivElement | null>;
};

/** AI 消息气泡（含复制按钮） */
const AssistantBubble = ({ content }: { content: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error("[ScriptAgent] copy failed", e);
        }
    }, [content]);

    return (
        <div className="relative max-w-[80%] rounded-xl border border-white/10 bg-[#1a1a22] px-4 py-3 text-sm leading-relaxed text-white/90">
            <div className="whitespace-pre-wrap wrap-break-word">{content}</div>
            {/* 复制按钮 - 右下角 */}
            <button
                onClick={handleCopy}
                className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
                title="复制回复内容"
            >
                {copied ? (
                    <>
                        <Check size={12} className="text-green-400" />
                        <span className="text-green-400">已复制</span>
                    </>
                ) : (
                    <>
                        <Copy size={12} />
                        <span>复制</span>
                    </>
                )}
            </button>
        </div>
    );
};

export const MessageList = ({
    messages,
    streamingContent,
    loading,
    sending,
    endRef,
}: Props) => {
    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center text-white/40">
                加载中...
            </div>
        );
    }

    if (messages.length === 0 && !streamingContent) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/30">
                <span className="text-lg">🎬</span>
                <span className="text-sm">你好，我是你的剧本助手</span>
                <span className="text-xs">告诉我你想创作什么，我们一起开始吧</span>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4">
            {messages.map((msg) => (
                <div
                    key={msg.id}
                    className={`mb-4 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                    {msg.role === "user" ? (
                        <div className="max-w-[80%] rounded-xl bg-[#B43FEB] px-4 py-3 text-sm leading-relaxed text-white">
                            <div className="whitespace-pre-wrap wrap-break-word">
                                {msg.content}
                            </div>
                        </div>
                    ) : (
                        <AssistantBubble content={msg.content} />
                    )}
                </div>
            ))}

            {/* 流式输出中的 AI 消息 */}
            {streamingContent && (
                <div className="mb-4 flex justify-start">
                    <div className="relative max-w-[80%] rounded-xl border border-white/10 bg-[#1a1a22] px-4 py-3 text-sm leading-relaxed text-white/90">
                        <div className="whitespace-pre-wrap wrap-break-word">
                            {streamingContent}
                            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-[#B43FEB] align-middle" />
                        </div>
                    </div>
                </div>
            )}

            {/* 等待 AI 开始响应时的指示器 */}
            {sending && !streamingContent && (
                <div className="mb-4 flex justify-start">
                    <div className="rounded-xl border border-white/10 bg-[#1a1a22] px-4 py-3 text-sm text-white/50">
                        <span className="inline-flex gap-1">
                            <span className="animate-bounce">·</span>
                            <span className="animate-bounce [animation-delay:0.15s]">
                                ·
                            </span>
                            <span className="animate-bounce [animation-delay:0.3s]">
                                ·
                            </span>
                        </span>
                        &nbsp;思考中
                    </div>
                </div>
            )}

            <div ref={endRef} />
        </div>
    );
};
