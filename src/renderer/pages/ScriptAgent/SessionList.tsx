/**
 * 剧本Agent 会话列表侧边栏
 */
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import type { ScriptAgentSessionMeta } from "shared/types/scriptAgent";

type Props = {
    sessions: ScriptAgentSessionMeta[];
    activeId: string | null;
    onSelect: (id: string) => void;
    onCreate: () => void;
    onDelete: (id: string) => void;
};

export const SessionList = ({
    sessions,
    activeId,
    onSelect,
    onCreate,
    onDelete,
}: Props) => (
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
                    onClick={() => onSelect(s.id)}
                    className={`group mb-1 flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors ${activeId === s.id
                            ? "bg-[#B43FEB]/15 text-[#d793ff]"
                            : "text-white/70 hover:bg-white/5 hover:text-white/90"
                        }`}
                >
                    <MessageSquare size={14} className="shrink-0 opacity-60" />
                    <span className="flex-1 truncate">{s.title}</span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(s.id);
                        }}
                        className="hidden rounded p-1 text-white/30 hover:bg-white/10 hover:text-red-400 group-hover:block"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            ))}
        </div>
    </div>
);
