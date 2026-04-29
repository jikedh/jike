/**
 * 聊天历史记录面板组件
 * 显示历史会话列表，支持重命名、删除、切换等操作
 */
import {
  IconClock,
  IconDotsVertical,
  IconPencil,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatSessionMeta } from "service/chatHistoryStorage";
import { cn } from "shared/utils/utils";

type ChatHistoryPanelProps = {
  sessionList: ChatSessionMeta[];
  currentSessionId?: string;
  onSelectSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => Promise<boolean>;
  onDeleteSession: (sessionId: string) => Promise<boolean>;
  onClose: () => void;
};

export const ChatHistoryPanel = ({
  sessionList,
  currentSessionId,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
  onClose,
}: ChatHistoryPanelProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleStartRename = useCallback((session: ChatSessionMeta) => {
    setEditingId(session.id);
    setEditingTitle(session.title);
    setMenuOpenId(null);
  }, []);

  const handleConfirmRename = useCallback(
    async (sessionId: string) => {
      const trimmedTitle = editingTitle.trim();
      if (trimmedTitle) {
        await onRenameSession(sessionId, trimmedTitle);
      }
      setEditingId(null);
      setEditingTitle("");
    },
    [editingTitle, onRenameSession],
  );

  const handleCancelRename = useCallback(() => {
    setEditingId(null);
    setEditingTitle("");
  }, []);

  const handleDelete = useCallback(
    async (sessionId: string) => {
      await onDeleteSession(sessionId);
      setMenuOpenId(null);
    },
    [onDeleteSession],
  );

  const formatTime = useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday =
      new Date(now.getTime() - 86400000).toDateString() === date.toDateString();

    if (isToday) {
      return `今天 ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    }
    if (isYesterday) {
      return `昨天 ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    }
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  }, []);

  return (
    <aside className="relative flex h-full w-[280px] shrink-0 flex-col bg-[#0f1218]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,_rgba(180,63,235,0.18),_rgba(15,18,24,0)_62%)]" />

      <header className="relative flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <h3 className="text-base font-semibold text-white">历史对话</h3>
          <p className="mt-1 text-xs text-white/45">继续之前的想法和任务</p>
        </div>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 shadow-[0_8px_24px_rgba(0,0,0,0.24)] transition-colors hover:bg-white/10 hover:text-white"
          onClick={onClose}
        >
          <IconX size={16} />
        </button>
      </header>

      <div className="relative flex-1 overflow-y-auto px-4 pb-4 no-scrollbar">
        {sessionList.length === 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center rounded-[28px] border border-dashed border-white/12 bg-white/[0.03] px-6 py-12 text-center text-white/45">
            <IconClock size={32} className="mb-3 text-white/20" />
            <p className="text-sm font-medium text-white/78">还没有历史对话</p>
            <p className="mt-1 text-xs text-white/35">
              发送第一条消息后，这里会自动保存会话
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {sessionList.map((session) => (
              <li key={session.id}>
                <div
                  className={cn(
                    "group relative cursor-pointer rounded-[20px] border bg-[#151821] px-3.5 py-3.5 shadow-[0_12px_28px_rgba(0,0,0,0.24)] transition-all hover:bg-[#181c26] hover:shadow-[0_16px_36px_rgba(0,0,0,0.3)]",
                    currentSessionId === session.id
                      ? "border-[#b43feb]/40 bg-[#181621] shadow-[0_16px_36px_rgba(0,0,0,0.34)]"
                      : "border-white/10",
                  )}
                  onClick={() => {
                    if (editingId !== session.id) {
                      onSelectSession(session.id);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/55">
                      <IconClock size={15} />
                    </div>

                    <div className="min-w-0 flex-1">
                      {editingId === session.id ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleConfirmRename(session.id);
                            } else if (e.key === "Escape") {
                              handleCancelRename();
                            }
                          }}
                          onBlur={() => handleConfirmRename(session.id)}
                          className="w-full rounded-2xl border border-[#b43feb]/35 bg-[#0f1218] px-3 py-2 text-sm text-white outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <>
                          <p className="truncate text-sm font-medium text-white">
                            {session.title}
                          </p>
                          <p className="mt-1.5 text-xs text-white/45">
                            {formatTime(session.updatedAt)}
                          </p>
                          <p className="mt-0.5 text-xs text-white/32">
                            {session.messageCount} 条消息
                          </p>
                        </>
                      )}
                    </div>

                    {editingId !== session.id && (
                      <div ref={menuRef} className="relative">
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-full text-white/35 opacity-0 transition-all hover:bg-white/8 hover:text-white/75 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(
                              menuOpenId === session.id ? null : session.id,
                            );
                          }}
                        >
                          <IconDotsVertical size={16} />
                        </button>

                        {menuOpenId === session.id && (
                          <div className="absolute right-0 top-9 z-10 w-32 overflow-hidden rounded-2xl border border-white/10 bg-[#11141c] py-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.38)]">
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white/78 transition-colors hover:bg-white/8"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartRename(session);
                              }}
                            >
                              <IconPencil size={14} />
                              重命名
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-500/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(session.id);
                              }}
                            >
                              <IconTrash size={14} />
                              删除
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
};
