/**
 * 剧本Agent 消息列表 + 流式渲染 + 复制按钮
 */
import { Check, Copy, Globe2 } from "lucide-react";
import { useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ScriptAgentMessage, ScriptAgentSource } from "shared/types/scriptAgent";
import { isSafeExternalUrl, parseAssistantContent } from "./sourceUtils";

type Props = {
    messages: ScriptAgentMessage[];
    streamingContent: string;
    loading: boolean;
    sending: boolean;
    endRef: React.RefObject<HTMLDivElement | null>;
    onShowSources: (sources: ScriptAgentSource[]) => void;
};

const AssistantMarkdown = ({ content }: { content: string }) => (
    <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
            a: ({ href, children }) =>
                href && isSafeExternalUrl(href) ? (
                    <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#79cfff] underline underline-offset-2 hover:text-[#b0e4ff]"
                    >
                        {children}
                    </a>
                ) : (
                    <span>{children}</span>
                ),
            h1: ({ children }) => (
                <h1 className="mb-3 border-b border-white/10 pb-2 text-xl font-semibold tracking-tight text-white">
                    {children}
                </h1>
            ),
            h2: ({ children }) => (
                <h2 className="mb-2 mt-5 text-base font-semibold text-[#f2d4ff]">{children}</h2>
            ),
            h3: ({ children }) => (
                <h3 className="mb-2 mt-4 text-sm font-semibold text-white">{children}</h3>
            ),
            p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
            blockquote: ({ children }) => (
                <blockquote className="my-3 border-l-2 border-[#B43FEB] bg-[#B43FEB]/10 px-3 py-2 text-white/75">
                    {children}
                </blockquote>
            ),
            ul: ({ children }) => <ul className="mb-3 list-disc space-y-1.5 pl-5 marker:text-[#d793ff] last:mb-0">{children}</ul>,
            ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1.5 pl-5 marker:text-[#d793ff] last:mb-0">{children}</ol>,
            li: ({ children }) => <li className="pl-1">{children}</li>,
            hr: () => <hr className="my-4 border-white/10" />,
            table: ({ children }) => (
                <div className="my-3 overflow-x-auto rounded-lg border border-white/10">
                    <table className="w-full min-w-max border-collapse text-left text-xs">{children}</table>
                </div>
            ),
            thead: ({ children }) => <thead className="bg-white/10 text-white/90">{children}</thead>,
            th: ({ children }) => <th className="border-b border-white/10 px-3 py-2 font-semibold">{children}</th>,
            td: ({ children }) => <td className="border-b border-white/10 px-3 py-2 align-top text-white/70 last:border-b-0">{children}</td>,
            pre: ({ children }) => (
                <pre className="my-3 overflow-x-auto rounded-lg border border-white/10 bg-[#0c0c10] p-3 text-xs leading-5 text-white/85">
                    {children}
                </pre>
            ),
            code: ({ className, children }) => {
                const isBlock = Boolean(className?.startsWith("language-"));
                return isBlock ? (
                    <code className={className}>{children}</code>
                ) : (
                    <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-[#f3d2ff]">{children}</code>
                );
            },
        }}
    >
        {content}
    </ReactMarkdown>
);

const SourceSummary = ({
    sources,
    onShowSources,
}: {
    sources: ScriptAgentSource[];
    onShowSources: (sources: ScriptAgentSource[]) => void;
}) => {
    if (sources.length === 0) return null;

    return (
        <div className="mt-4 border-t border-white/10 pt-3">
            <button
                onClick={() => onShowSources(sources)}
                className="flex items-center gap-1.5 text-xs font-medium text-[#79cfff] hover:text-[#b0e4ff]"
            >
                <Globe2 size={14} />
                <span>已参考 / 已阅读 {sources.length} 个网页</span>
            </button>
        </div>
    );
};

/** AI 消息气泡（含复制按钮） */
const AssistantBubble = ({
    content,
    onShowSources,
}: {
    content: string;
    onShowSources: (sources: ScriptAgentSource[]) => void;
}) => {
    const [copied, setCopied] = useState(false);
    const { answer, sources } = parseAssistantContent(content);

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
            <div className="wrap-break-word pr-10">
                <AssistantMarkdown content={answer} />
                <SourceSummary sources={sources} onShowSources={onShowSources} />
            </div>
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
    onShowSources,
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
                        <AssistantBubble content={msg.content} onShowSources={onShowSources} />
                    )}
                </div>
            ))}

            {/* 流式输出中的 AI 消息 */}
            {streamingContent && (
                <div className="mb-4 flex justify-start">
                    <div className="relative max-w-[80%] rounded-xl border border-white/10 bg-[#1a1a22] px-4 py-3 text-sm leading-relaxed text-white/90">
                        <div className="wrap-break-word">
                            <AssistantMarkdown content={parseAssistantContent(streamingContent).answer} />
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
