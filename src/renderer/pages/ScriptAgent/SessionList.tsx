/**
 * 剧本Agent 会话列表侧边栏（支持双击重命名）
 */
import { Check, MessageSquare, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ScriptAgentSessionMeta } from "shared/types/scriptAgent";

type Props = {
    sessions: ScriptAgentSessionMeta[];
    activeId: string | null;
    onSelect: (id: string) => void;
    onCreate: () => void;
    onDelete: (id: string) => void;
    onRename: (id: string, newTitle: string) => void;
};

export const SessionList = ({
    sessions,
    activeId,
    onSelect,
    onCreate,
    onDelete,
    onRename,
}: Props) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const startEdit = useCallback((id: string, title: string) => {
        setEditingId(id);
        setEditValue(title);
        setTimeout(() => inputRef.current?.focus(), 0);
    }, []);

    const confirmEdit = useCallback(() => {
        if (editingId && editValue.trim()) {
            onRename(editingId, editValue.trim());
        }
        setEditingId(null);
    }, [editingId, editValue, onRename]);

    const cancelEdit = useCallback(() => {
        setEditingId(null);
    }, []);

    // 聚焦到输入框
    useEffect(() => {
        if (editingId) inputRef.current?.focus();
    }, [editingId]);

    return (
        <div className="flex h-full w-65 shrink-0 flex-col border-r border-white/10 bg-[#0c0c10]">
            {/* 新建按钮 */}
            <div className="p-3">
                <button
                    onClick={onCreate}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#B43FEB] px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#9d35ce]"
                >
                    <Plus size={16} />
                    新建对话
                </button>
            </div>

            {/* 会话列表 */}
            <div className="flex-1 overflow-y-auto px-2 pb-2">
                {sessions.length === 0 && (
                    <div className="mt-8 text-center text-xs text-white/30">
                        暂无对话记录
                    </div>
                )}
                {sessions.map((s) => (
                    <div
                        key={s.id}
                        onClick={() => editingId !== s.id && onSelect(s.id)}
                        className={`group mb-1 flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors ${activeId === s.id
                            ? "bg-[#B43FEB]/15 text-[#d793ff]"
                            : "text-white/70 hover:bg-white/5 hover:text-white/90"
                            }`}
                    >
                        <MessageSquare size={14} className="shrink-0 opacity-60" />

                        {/* 编辑模式 / 显示模式 */}
                        {editingId === s.id ? (
                            <div className="flex flex-1 items-center gap-1">
                                <input
                                    ref={inputRef}
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") confirmEdit();
                                        if (e.key === "Escape") cancelEdit();
                                    }}
                                    onBlur={confirmEdit}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex-1 rounded bg-white/10 px-1.5 py-0.5 text-sm text-white outline-none focus:ring-1 focus:ring-[#B43FEB]/60"
                                />
                                <button
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        confirmEdit();
                                    }}
                                    className="rounded p-0.5 text-green-400 hover:bg-white/10"
                                >
                                    <Check size={12} />
                                </button>
                                <button
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        cancelEdit();
                                    }}
                                    className="rounded p-0.5 text-white/40 hover:bg-white/10 hover:text-red-400"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ) : (
                            <>
                                <span
                                    className="flex-1 truncate"
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        startEdit(s.id, s.title);
                                    }}
                                    title="双击重命名"
                                >
                                    {s.title}
                                </span>
                                {/* 操作按钮组 */}
                                <div className="hidden items-center gap-0.5 group-hover:flex">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            startEdit(s.id, s.title);
                                        }}
                                        className="rounded p-1 text-white/30 hover:bg-white/10 hover:text-[#d793ff]"
                                        title="重命名"
                                    >
                                        <Pencil size={12} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(s.id);
                                        }}
                                        className="rounded p-1 text-white/30 hover:bg-white/10 hover:text-red-400"
                                        title="删除"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
