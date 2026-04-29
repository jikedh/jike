/**
 * AI 对话抽屉组件
 * 支持聊天消息发送、历史记录管理等功能
 */
import {
  IconClock,
  IconPlayerStop,
  IconPlus,
  IconSend,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CANVAS_CHAT_MODELS,
  DEFAULT_CANVAS_CHAT_MODEL,
} from "shared/constants/ai-models";
import {
  CANVAS_CHAT_PERSONAS,
  NO_CHAT_PERSONA_ID,
} from "shared/constants/chat-personas";
import type {
  ChatPersonaId,
  NoteGenerationMessage,
} from "shared/types/NoteGeneration";
import { cn } from "shared/utils/utils";
import { ModelSelector } from "@/components/ModelSelector";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useChatHistory } from "@/hooks/useChatHistory";
import { useResizableWidth } from "@/hooks/useResizableWidth";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";
import { ChatHistoryPanel } from "./ChatHistoryPanel";
import { ChatMessageList } from "./ChatMessageList";

type ChatDrawerProps = {
  open: boolean;
  onClose: () => void;
  messages: NoteGenerationMessage[];
  isLoading: boolean;
  sendMessage: (payload: {
    content: string;
    personaId: ChatPersonaId;
    model?: string;
  }) => void;
  stopMessage: () => void;
  clearLocalMessages: () => void;
  setMessages: (messages: NoteGenerationMessage[]) => void;
};

type SkillSuggestion = {
  title: string;
  prompt: string;
  badge: string;
  badgeClassName: string;
};

const SKILL_SUGGESTIONS: SkillSuggestion[] = [
  {
    title: "Seedance 2.0 视频创作",
    prompt:
      "帮我策划一支 Seedance 2.0 视频，从创意方向、分镜结构到生成提示词都给我。",
    badge: "V",
    badgeClassName: "from-violet-500 to-indigo-500",
  },
  {
    title: "一镜到底视频",
    prompt: "帮我设计一个一镜到底短视频，给出镜头运动、节奏节点和画面重点。",
    badge: "1",
    badgeClassName: "from-violet-500 to-pink-500",
  },
  {
    title: "Instagram Post",
    prompt:
      "帮我写一条适合 Instagram 发布的内容，包含标题、正文、标签和配图建议。",
    badge: "IG",
    badgeClassName: "from-sky-500 to-blue-500",
  },
  {
    title: "一键跨平台适配",
    prompt: "把同一条内容改写成适合小红书、抖音和 Instagram 的三个版本。",
    badge: "↗",
    badgeClassName: "from-cyan-500 to-blue-500",
  },
  {
    title: "Logo 生成",
    prompt: "根据品牌定位帮我生成 Logo 创意方向、关键词和设计提示词。",
    badge: "L",
    badgeClassName: "from-amber-400 to-orange-500",
  },
  {
    title: "AI 时尚博主：高点击 UGC 内容",
    prompt: "帮我规划一组高点击率的 AI 时尚博主 UGC 内容选题和文案结构。",
    badge: "UGC",
    badgeClassName: "from-rose-500 to-pink-500",
  },
  {
    title: "AI 造型师：高转化模特图",
    prompt:
      "帮我设计一套更适合转化的模特图方案，包含风格、姿态、构图和提示词。",
    badge: "AI",
    badgeClassName: "from-fuchsia-500 to-pink-500",
  },
  {
    title: "所有 Skills",
    prompt: "你都能帮我做什么？请按视频、内容、品牌和运营几个方向整理给我。",
    badge: "S",
    badgeClassName: "from-slate-400 to-slate-600",
  },
];

const ACTION_BUTTON_CLASSNAME =
  "flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 shadow-[0_6px_18px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-all hover:bg-white/10 hover:text-white";

const resolveCanvasChatModel = (model?: string) => {
  if (model && CANVAS_CHAT_MODELS.some((item) => item.model === model)) {
    return model;
  }

  return DEFAULT_CANVAS_CHAT_MODEL;
};

export const ChatDrawer = ({
  open,
  onClose,
  messages,
  isLoading,
  sendMessage,
  stopMessage,
  clearLocalMessages,
  setMessages,
}: ChatDrawerProps) => {
  const { width, isResizing, handlePointerDown } = useResizableWidth({
    defaultWidth: 460,
    minWidth: 380,
  });
  const { defaultModel, defaultPersonaId } = useChatSettingsStore();

  const [inputValue, setInputValue] = useState("");
  const [selectedPersonaId, setSelectedPersonaId] =
    useState<ChatPersonaId>(defaultPersonaId);
  const [selectedModel, setSelectedModel] = useState(
    resolveCanvasChatModel(defaultModel),
  );
  const [showHistory, setShowHistory] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);

  const {
    sessionList,
    currentSession,
    createNewSession,
    switchSession,
    saveCurrentSession,
    renameCurrentSession,
    deleteSessionById,
  } = useChatHistory({ autoLoad: open });

  useEffect(() => {
    setSelectedPersonaId(defaultPersonaId);
  }, [defaultPersonaId]);

  useEffect(() => {
    if (!currentSession) {
      setSelectedModel(resolveCanvasChatModel(defaultModel));
    }
  }, [currentSession, defaultModel]);

  useEffect(() => {
    if (currentSession) {
      setSelectedPersonaId(currentSession.personaId);
      setSelectedModel(resolveCanvasChatModel(currentSession.model));
    }
  }, [currentSession]);

  useEffect(() => {
    if (messages.length > 0 && !isLoading) {
      saveCurrentSession(messages, selectedPersonaId, selectedModel);
    }
  }, [
    messages,
    isLoading,
    saveCurrentSession,
    selectedPersonaId,
    selectedModel,
  ]);

  useEffect(() => {
    const listElement = messageListRef.current;
    if (listElement) {
      listElement.scrollTop = listElement.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setShowHistory(false);
    }
  }, [open]);

  const handleSend = useCallback(() => {
    const content = inputValue.trim();
    if (!content || isLoading) return;
    sendMessage({
      content,
      personaId: selectedPersonaId,
      model: selectedModel,
    });
    setInputValue("");
  }, [inputValue, isLoading, sendMessage, selectedPersonaId, selectedModel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleClear = useCallback(() => {
    clearLocalMessages();
    setInputValue("");
  }, [clearLocalMessages]);

  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      const session = await switchSession(sessionId);
      if (session) {
        setMessages(session.messages);
        setSelectedModel(resolveCanvasChatModel(session.model));
        setShowHistory(false);
      }
    },
    [switchSession, setMessages],
  );

  const handleRenameSession = useCallback(
    async (sessionId: string, newTitle: string) => {
      if (currentSession?.id === sessionId) {
        return renameCurrentSession(newTitle);
      }
      const { renameSession } = await import("service/chatHistoryStorage");
      return renameSession(sessionId, newTitle);
    },
    [currentSession, renameCurrentSession],
  );

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      const success = await deleteSessionById(sessionId);
      if (success && currentSession?.id === sessionId) {
        clearLocalMessages();
      }
      return success;
    },
    [deleteSessionById, currentSession, clearLocalMessages],
  );

  const handleNewChat = useCallback(async () => {
    await createNewSession(selectedPersonaId, selectedModel);
    clearLocalMessages();
    setShowHistory(false);
  }, [createNewSession, selectedPersonaId, selectedModel, clearLocalMessages]);

  const handleSelectSkill = useCallback((prompt: string) => {
    setInputValue(prompt);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const selectedPersonaLabel =
    selectedPersonaId === NO_CHAT_PERSONA_ID
      ? "自由对话"
      : (CANVAS_CHAT_PERSONAS.find(
          (persona) => persona.id === selectedPersonaId,
        )?.label ?? "自由对话");

  const selectedModelLabel =
    CANVAS_CHAT_MODELS.find((item) => item.model === selectedModel)?.name ??
    selectedModel;

  const userMessageCount = messages.filter(
    (message) => message.role === "user",
  ).length;

  return (
    <Drawer
      open={open}
      modal={false}
      onOpenChange={(nextOpen) => !nextOpen && onClose()}
    >
      <DrawerContent
        aria-label="AI 对话抽屉"
        withOverlay={false}
        onInteractOutside={(event) => event.preventDefault()}
        className={cn(
          "overflow-hidden border-l border-white/10 bg-[#0a0a0f] text-white transition-none",
          isResizing && "select-none",
        )}
        style={{ width: `${width + (showHistory ? 304 : 0)}px` }}
      >
        <div
          className={cn(
            "absolute top-0 left-0 z-50 h-full w-1 cursor-col-resize transition-colors hover:bg-[#b43feb]/60",
            isResizing && "bg-[#b43feb]/60",
          )}
          onPointerDown={handlePointerDown}
        />

        <div className="relative flex h-full bg-[linear-gradient(180deg,#090a0f_0%,#11131b_100%)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-[radial-gradient(circle_at_top,_rgba(180,63,235,0.22),_rgba(9,10,15,0)_62%)]" />

          <div
            className={cn(
              "relative flex h-full min-w-0 flex-1 flex-col",
              showHistory && "border-r border-white/10",
            )}
          >
            <header className="px-4 pt-3 pb-1.5">
              <div className="flex items-center gap-2.5">
                <DrawerTitle className="shrink-0 text-[15px] font-semibold tracking-[-0.01em] text-white/90">
                  AI 对话
                </DrawerTitle>

                <div className="min-w-0 flex-1" />

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    title="新建聊天"
                    className={ACTION_BUTTON_CLASSNAME}
                    onClick={handleNewChat}
                  >
                    <IconPlus size={18} />
                  </button>
                  <button
                    type="button"
                    title="历史记录"
                    className={cn(
                      ACTION_BUTTON_CLASSNAME,
                      showHistory &&
                        "border-[#b43feb]/40 bg-[#b43feb]/18 text-[#d793ff]",
                    )}
                    onClick={() => setShowHistory(!showHistory)}
                  >
                    <IconClock size={18} />
                  </button>
                  <button
                    type="button"
                    title="清空对话"
                    className={ACTION_BUTTON_CLASSNAME}
                    onClick={handleClear}
                  >
                    <IconTrash size={18} />
                  </button>
                  <button
                    type="button"
                    title="关闭"
                    className={ACTION_BUTTON_CLASSNAME}
                    onClick={onClose}
                  >
                    <IconX size={18} />
                  </button>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] gap-2">
                <Select
                  value={selectedPersonaId}
                  onValueChange={(value) =>
                    setSelectedPersonaId(value as ChatPersonaId)
                  }
                >
                  <SelectTrigger className="h-9 w-full rounded-[14px] border border-white/10 bg-white/[0.04] px-3 text-sm text-white/85 shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
                    <SelectValue placeholder="选择对话模式" />
                  </SelectTrigger>
                  <SelectContent
                    align="start"
                    className="border-white/10 bg-[#14161d] text-white shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
                  >
                    <SelectItem
                      value={NO_CHAT_PERSONA_ID}
                      className="text-white/80 focus:bg-white/10 focus:text-white"
                    >
                      自由对话
                    </SelectItem>
                    {CANVAS_CHAT_PERSONAS.map((persona) => (
                      <SelectItem
                        key={persona.id}
                        value={persona.id}
                        className="text-white/80 focus:bg-white/10 focus:text-white"
                      >
                        {persona.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <ModelSelector
                  value={selectedModel}
                  onChange={setSelectedModel}
                  models={CANVAS_CHAT_MODELS}
                />
              </div>
            </header>

            {messages.length === 0 ? (
              <div className="flex flex-1 items-center justify-center px-4 pb-2 pt-1">
                <div className="mx-auto w-full max-w-[470px]">
                  <h2 className="text-center text-[14px] font-semibold text-white">
                    试试这些 AI Skills
                  </h2>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    {SKILL_SUGGESTIONS.map((skill) => (
                      <button
                        key={skill.title}
                        type="button"
                        className="group inline-flex items-center gap-3 rounded-full border border-white/10 bg-[#151821] px-3.5 py-2.5 text-left shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition-colors hover:border-[#b43feb]/35 hover:bg-[#181c26]"
                        onClick={() => handleSelectSkill(skill.prompt)}
                      >
                        <span
                          className={cn(
                            "flex h-8 min-w-8 items-center justify-center rounded-full bg-gradient-to-br px-2 text-[11px] font-semibold text-white",
                            skill.badgeClassName,
                          )}
                        >
                          {skill.badge}
                        </span>
                        <span className="text-[13px] font-medium text-white/85 transition-colors group-hover:text-white">
                          {skill.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <ChatMessageList
                className="px-5 pb-6"
                containerRef={messageListRef}
                isLoading={isLoading}
                messages={messages}
              />
            )}

            <div className="px-4 pb-3 pt-0.5">
              <div className="overflow-hidden rounded-[22px] border border-white/10 bg-[#10131b] shadow-[0_14px_36px_rgba(0,0,0,0.26)]">
                <div className="px-3 pt-2">
                  <Textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入你的想法，或直接从上面的 Skills 开始"
                    rows={1}
                    className="min-h-[38px] max-h-[84px] resize-none border-transparent bg-transparent px-0.5 py-0 text-[15px] leading-[1.35] text-white shadow-none placeholder:text-white/30"
                    disabled={isLoading}
                  />
                </div>

                <div className="flex items-center justify-between gap-2.5 border-t border-white/8 px-3 py-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-white/40">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/70">
                      {selectedPersonaLabel}
                    </span>
                    <span className="max-w-[180px] truncate rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/70">
                      {selectedModelLabel}
                    </span>

                  </div>

                  {isLoading ? (
                    <button
                      type="button"
                      title="停止生成"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ef4444] text-white shadow-[0_8px_20px_rgba(239,68,68,0.26)] transition-transform hover:scale-[1.03]"
                      onClick={stopMessage}
                    >
                      <IconPlayerStop size={17} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      title="发送"
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-all",
                        inputValue.trim()
                          ? "bg-[#b43feb] shadow-[0_12px_26px_rgba(180,63,235,0.35)] hover:scale-[1.03] hover:bg-[#c155ff]"
                          : "bg-white/10 text-white/40",
                      )}
                      onClick={handleSend}
                      disabled={!inputValue.trim()}
                    >
                      <IconSend size={17} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {showHistory && (
            <ChatHistoryPanel
              sessionList={sessionList}
              currentSessionId={currentSession?.id}
              onSelectSession={handleSelectSession}
              onRenameSession={handleRenameSession}
              onDeleteSession={handleDeleteSession}
              onClose={() => setShowHistory(false)}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
