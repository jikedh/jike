import {
  IconClock,
  IconEraser,
  IconMessageCircle,
  IconPaperclip,
  IconPencil,
  IconPlayerStop,
  IconPlus,
  IconSend,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import type { HermesAttachment } from "@/api/hermes";
import { cn } from "shared/utils/utils";
import { Textarea } from "@/components/ui/textarea";
import { useHermesChat } from "@/hooks/useHermesChat";
import { ChatMessageList } from "./ChatMessageList";

type HermesDrawerProps = {
  open: boolean;
  onClose: () => void;
};

const formatTime = (value: number) =>
  new Date(value).toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const HermesDrawer = ({ open, onClose }: HermesDrawerProps) => {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<HermesAttachment[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [editingConversationId, setEditingConversationId] = useState<
    string | number | null
  >(null);
  const [editingTitle, setEditingTitle] = useState("");
  const messageListRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    conversations,
    currentConversation,
    messages,
    isLoading,
    isUploading,
    newConversation,
    selectConversation,
    renameConversation,
    deleteConversation,
    sendMessage,
    uploadAttachments,
    stopMessage,
    clearConversation,
  } = useHermesChat(open);

  useEffect(() => {
    messageListRef.current?.scrollTo({
      top: messageListRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, messages.at(-1)?.content]);

  useEffect(() => {
    setAttachments([]);
  }, [currentConversation?.id]);

  const handleSend = () => {
    if (!input.trim() || isLoading || isUploading) return;
    void sendMessage(input, attachments);
    setInput("");
    setAttachments([]);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const remaining = Math.max(0, 6 - attachments.length);
    const uploaded = await uploadAttachments(
      Array.from(files).slice(0, remaining),
    );
    if (uploaded.length > 0) {
      setAttachments((previous) => [...previous, ...uploaded].slice(0, 6));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startRename = (conversation: (typeof conversations)[number]) => {
    setEditingConversationId(conversation.id);
    setEditingTitle(conversation.title || "新对话");
  };

  const submitRename = async (conversation: (typeof conversations)[number]) => {
    const title = editingTitle.trim();
    if (!title) return;
    const updated = await renameConversation(conversation, title);
    if (updated) {
      setEditingConversationId(null);
      setEditingTitle("");
    }
  };

  const handleDelete = async (conversation: (typeof conversations)[number]) => {
    const title = conversation.title || "新对话";
    if (!window.confirm(`确定删除“${title}”吗？此操作无法撤销。`)) return;
    if (await deleteConversation(conversation)) {
      setEditingConversationId((current) =>
        String(current) === String(conversation.id) ? null : current,
      );
    }
  };

  return (
    <div
      className={cn(
        "fixed inset-y-0 right-0 z-[60] flex w-[min(760px,calc(100vw-24px))] border-l border-white/10 bg-[#0a0a0f] text-white shadow-[-24px_0_60px_rgba(0,0,0,0.35)] transition-transform duration-200",
        open ? "translate-x-0" : "pointer-events-none translate-x-full",
      )}
      aria-hidden={!open}
    >
      {showHistory && (
        <aside className="flex w-[220px] shrink-0 flex-col border-r border-white/10 bg-[#0e1017]">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-3">
            <span className="text-sm font-semibold">Hermes 对话</span>
            <button
              type="button"
              title="新建对话"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8b5cf6] text-white hover:bg-[#a78bfa]"
              onClick={() => void newConversation()}
            >
              <IconPlus size={16} />
            </button>
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
            {conversations.map((conversation) => {
              const isCurrent =
                String(currentConversation?.id) === String(conversation.id);
              const isEditing =
                String(editingConversationId) === String(conversation.id);

              return (
                <div
                  key={conversation.id}
                  className={cn(
                    "group flex w-full items-center gap-1 rounded-lg border p-1 transition-colors",
                    isCurrent
                      ? "border-violet-400/50 bg-violet-500/20"
                      : "border-white/5 bg-white/[0.03] hover:bg-white/[0.08]",
                  )}
                >
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editingTitle}
                      maxLength={128}
                      className="min-w-0 flex-1 rounded-md border border-violet-400/50 bg-black/30 px-2 py-1.5 text-xs text-white outline-none"
                      onChange={(event) => setEditingTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void submitRename(conversation);
                        }
                        if (event.key === "Escape") {
                          setEditingConversationId(null);
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="min-w-0 flex-1 px-2 py-1 text-left"
                      onClick={() => void selectConversation(conversation)}
                    >
                      <span className="block truncate text-xs font-medium">
                        {conversation.title || "新对话"}
                      </span>
                      <span className="mt-1 block text-[10px] text-white/40">
                        {formatTime(conversation.updated_at)}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    title={isEditing ? "保存名称" : "重命名对话"}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/45 hover:bg-white/10 hover:text-white"
                    onClick={() =>
                      isEditing
                        ? void submitRename(conversation)
                        : startRename(conversation)
                    }
                  >
                    <IconPencil size={14} />
                  </button>
                  <button
                    type="button"
                    title="删除对话"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/45 hover:bg-red-500/15 hover:text-red-300"
                    onClick={() => void handleDelete(conversation)}
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </aside>
      )}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <IconMessageCircle className="text-violet-300" size={18} />
          <strong className="text-sm">Hermes Agent</strong>
          <span className="min-w-0 flex-1 truncate text-xs text-white/40">
            {currentConversation?.title || "选择或新建一个对话"}
          </span>
          <button
            type="button"
            title="对话列表"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              showHistory ? "bg-violet-500/20 text-violet-200" : "bg-white/5",
            )}
            onClick={() => setShowHistory((previous) => !previous)}
          >
            <IconClock size={16} />
          </button>
          <button
            type="button"
            title="清空当前视图"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            onClick={clearConversation}
          >
            <IconEraser size={16} />
          </button>
          <button
            type="button"
            title="关闭 Hermes Agent"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            <IconX size={16} />
          </button>
        </header>

        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-8 text-center text-sm text-white/45">
            新建一个 Hermes 对话，开始使用云端 Agent 的记忆、技能和工具。
          </div>
        ) : (
          <ChatMessageList
            messages={messages}
            isLoading={isLoading}
            containerRef={messageListRef}
            className="px-5"
          />
        )}

        <div className="border-t border-white/10 p-3">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.key}
                  className="flex max-w-full items-center gap-2 rounded-md border border-violet-400/25 bg-violet-500/10 px-2 py-1 text-xs text-violet-100"
                >
                  <IconPaperclip size={13} className="shrink-0" />
                  <span className="max-w-[260px] truncate">
                    {attachment.filename}
                  </span>
                  <button
                    type="button"
                    title="移除附件"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-white/50 hover:bg-white/10 hover:text-white"
                    onClick={() =>
                      setAttachments((previous) =>
                        previous.filter(
                          (item) => item.key !== attachment.key,
                        ),
                      )
                    }
                  >
                    <IconX size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt,.docx,.pdf,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              multiple
              className="hidden"
              onChange={(event) => void handleFiles(event.target.files)}
            />
            <button
              type="button"
              title="添加附件"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              disabled={isLoading || isUploading || attachments.length >= 6}
              onClick={() => fileInputRef.current?.click()}
            >
              <IconPaperclip
                size={16}
                className={isUploading ? "animate-pulse" : undefined}
              />
            </button>
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder="向 Hermes Agent 提问..."
              className="min-h-[42px] resize-none border-0 bg-transparent text-sm shadow-none"
              disabled={isLoading || isUploading}
            />
            {isLoading ? (
              <button
                type="button"
                title="停止生成"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white"
                onClick={stopMessage}
              >
                <IconPlayerStop size={16} />
              </button>
            ) : (
              <button
                type="button"
                title="发送"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={handleSend}
                disabled={!input.trim() || isUploading}
              >
                <IconSend size={16} />
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
