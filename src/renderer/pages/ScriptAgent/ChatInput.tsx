/**
 * 剧本Agent 消息输入框
 */
import { Send } from "lucide-react";
import { useCallback, useRef, useState } from "react";

type Props = {
    disabled: boolean;
    onSend: (content: string) => void;
};

export const ChatInput = ({ disabled, onSend }: Props) => {
    const [value, setValue] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSend = useCallback(() => {
        const trimmed = value.trim();
        if (!trimmed || disabled) return;
        onSend(trimmed);
        setValue("");
        // 重置高度
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }
    }, [value, disabled, onSend]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
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
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`; // max-h-40 = 160px
    }, []);

    return (
        <div className="shrink-0 border-t border-white/10 bg-[#0c0c10] px-4 py-3">
            <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-[#151519] px-3 py-2">
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    placeholder="描述你的剧本需求..."
                    disabled={disabled}
                    rows={1}
                    className="max-h-40 flex-1 resize-none bg-transparent text-sm text-white placeholder-white/30 outline-none"
                />
                <button
                    onClick={handleSend}
                    disabled={disabled || !value.trim()}
                    className="shrink-0 rounded-lg bg-[#B43FEB] p-2 text-white transition-colors hover:bg-[#9d35ce] disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <Send size={16} />
                </button>
            </div>
        </div>
    );
};
