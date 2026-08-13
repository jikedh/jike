/** 剧本Agent 消息输入框 */
import { FileText, Globe2, Paperclip, Send, Sparkles, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { extractScriptAgentFileText } from "./fileTextExtractor";

type Props = {
    disabled: boolean;
    onSend: (
        content: string,
        displayContent: string,
        deepThinking: boolean,
        webSearchEnabled: boolean,
    ) => void;
};

export const ChatInput = ({ disabled, onSend }: Props) => {
    const [value, setValue] = useState("");
    const [attachment, setAttachment] = useState<{
        name: string;
        content: string;
    } | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [parseError, setParseError] = useState("");
    const [deepThinking, setDeepThinking] = useState(false);
    const [webSearchEnabled, setWebSearchEnabled] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSend = useCallback(() => {
        const trimmed = value.trim();
        if ((!trimmed && !attachment) || disabled || isParsing) return;
        const content = attachment
            ? `【附件：${attachment.name}】\n${attachment.content}${trimmed ? `\n\n【补充说明】\n${trimmed}` : ""}`
            : trimmed;
        const displayContent = attachment
            ? `${trimmed ? `${trimmed}\n\n` : ""}【已附加文件：${attachment.name}】`
            : trimmed;
        onSend(content, displayContent, deepThinking, webSearchEnabled);
        setValue("");
        setAttachment(null);
        setParseError("");
        // 重置高度
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }
    }, [attachment, deepThinking, disabled, isParsing, onSend, value, webSearchEnabled]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey && (value.trim() || attachment)) {
                e.preventDefault();
                handleSend();
            }
        },
        [handleSend],
    );

    // 自动调整高度
    const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setValue(e.target.value);
        const el = e.target;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, []);

    const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        setIsParsing(true);
        setParseError("");
        try {
            const content = await extractScriptAgentFileText(file);
            setAttachment({ name: file.name, content });
        } catch (e: any) {
            setAttachment(null);
            setParseError(e.message || "文件解析失败，请更换文件后重试");
        } finally {
            setIsParsing(false);
        }
    }, []);

    return (
        <div className="shrink-0 border-t border-white/10 bg-[#0c0c10] px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-4 text-xs text-white/60">
                    <div className="flex items-center gap-2">
                        <Sparkles size={14} className={deepThinking ? "text-[#d793ff]" : "text-white/35"} />
                        <span className={deepThinking ? "text-white/90" : ""}>深度思考</span>
                        <span className="text-white/35">{deepThinking ? "已开启" : "已关闭"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Globe2 size={14} className={webSearchEnabled ? "text-[#62c9ff]" : "text-white/35"} />
                        <span className={webSearchEnabled ? "text-white/90" : ""}>联网搜索</span>
                        <span className="text-white/35">{webSearchEnabled ? "已开启" : "已关闭"}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Switch
                        checked={deepThinking}
                        disabled={disabled || isParsing}
                        onCheckedChange={setDeepThinking}
                        className="data-[state=checked]:bg-[#B43FEB] data-[state=unchecked]:bg-white/15"
                    />
                    <Switch
                        checked={webSearchEnabled}
                        disabled={disabled || isParsing}
                        onCheckedChange={setWebSearchEnabled}
                        className="data-[state=checked]:bg-[#2499d6] data-[state=unchecked]:bg-white/15"
                    />
                </div>
            </div>

            {(attachment || isParsing || parseError) && (
                <div className="mb-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs">
                    {isParsing ? (
                        <>
                            <FileText size={15} className="animate-pulse text-[#d793ff]" />
                            <span className="text-white/70">正在解析文件内容…</span>
                        </>
                    ) : attachment ? (
                        <>
                            <FileText size={15} className="text-[#d793ff]" />
                            <span className="min-w-0 flex-1 truncate text-white/80">{attachment.name}</span>
                            <span className="text-white/35">已解析</span>
                            <button
                                onClick={() => setAttachment(null)}
                                className="rounded p-0.5 text-white/40 hover:bg-white/10 hover:text-white"
                                title="移除附件"
                            >
                                <X size={14} />
                            </button>
                        </>
                    ) : (
                        <span className="text-red-300">{parseError}</span>
                    )}
                </div>
            )}

            <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-[#151519] px-3 py-2">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".docx,.xlsx,.xls,.pptx,.md,.markdown,.txt,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled || isParsing}
                    className="shrink-0 rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    title="上传 Word、Excel、PPT、Markdown 或文本文件"
                >
                    <Paperclip size={17} />
                </button>
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    placeholder="描述你的剧本需求，或上传文件作为创作资料..."
                    disabled={disabled || isParsing}
                    rows={1}
                    className="max-h-40 flex-1 resize-none bg-transparent text-sm text-white placeholder-white/30 outline-none"
                />
                <button
                    onClick={handleSend}
                    disabled={disabled || isParsing || (!value.trim() && !attachment)}
                    className="shrink-0 rounded-lg bg-[#B43FEB] p-2 text-white transition-colors hover:bg-[#9d35ce] disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <Send size={16} />
                </button>
            </div>
        </div>
    );
};
