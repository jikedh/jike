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

import { cn } from "@/lib/utils";
import type { ChatSessionMeta } from "@/utils/chatHistoryStorage";

type ChatHistoryPanelProps = {
  sessionList: ChatSessionMeta[]; // 会话列表
  currentSessionId?: string; // 当前会话 ID
  onSelectSession: (sessionId: string) => void; // 选择会话
  onRenameSession: (sessionId: string, newTitle: string) => Promise<boolean>; // 重命名会话
  onDeleteSession: (sessionId: string) => Promise<boolean>; // 删除会话
  onClose: () => void; // 关闭面板
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

  // 编辑模式时聚焦输入框
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 开始重命名
  const handleStartRename = useCallback((session: ChatSessionMeta) => {
    setEditingId(session.id);
    setEditingTitle(session.title);
    setMenuOpenId(null);
  }, []);

  // 确认重命名
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

  // 取消重命名
  const handleCancelRename = useCallback(() => {
    setEditingId(null);
    setEditingTitle("");
  }, []);

  // 删除会话
  const handleDelete = useCallback(
    async (sessionId: string) => {
      await onDeleteSession(sessionId);
      setMenuOpenId(null);
    },
    [onDeleteSession],
  );

  // 格式化时间
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
    <div className="flex h-full w-72 flex-col border-l border-neutral-700 bg-neutral-900">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-neutral-700 px-4 py-3">
        <h3 className="text-sm font-medium text-neutral-100">历史记录</h3>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
          onClick={onClose}
        >
          <IconX size={16} />
        </button>
      </header>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto">
        {sessionList.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center text-neutral-500">
            <IconClock size={32} className="mb-2 opacity-50" />
            <p className="text-xs">暂无历史记录</p>
          </div>
        ) : (
          <ul className="py-1">
            {sessionList.map((session) => (
              <li
                key={session.id}
                className={cn(
                  "group relative flex items-center px-3 py-2 cursor-pointer transition-colors hover:bg-neutral-800",
                  currentSessionId === session.id && "bg-neutral-800",
                )}
                onClick={() => {
                  if (editingId !== session.id) {
                    onSelectSession(session.id);
                  }
                }}
              >
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
                      className="w-full rounded border border-blue-500 bg-neutral-700 px-2 py-1 text-sm text-neutral-100 outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <p className="truncate text-sm text-neutral-200">
                        {session.title}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {formatTime(session.updatedAt)} · {session.messageCount}{" "}
                        条消息
                      </p>
                    </>
                  )}
                </div>

                {/* 菜单按钮 */}
                {editingId !== session.id && (
                  <div ref={menuRef} className="relative">
                    <button
                      type="button"
                      className="flex h-6 w-6 items-center justify-center rounded text-neutral-500 opacity-0 transition-colors hover:bg-neutral-700 hover:text-neutral-300 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(
                          menuOpenId === session.id ? null : session.id,
                        );
                      }}
                    >
                      <IconDotsVertical size={14} />
                    </button>

                    {/* 下拉菜单 */}
                    {menuOpenId === session.id && (
                      <div className="absolute right-0 top-6 z-10 w-28 rounded-md border border-neutral-700 bg-neutral-800 py-1 shadow-lg">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-neutral-300 transition-colors hover:bg-neutral-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartRename(session);
                          }}
                        >
                          <IconPencil size={12} />
                          重命名
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-400 transition-colors hover:bg-neutral-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(session.id);
                          }}
                        >
                          <IconTrash size={12} />
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
