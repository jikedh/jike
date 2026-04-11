/**
 * 聊天历史存储工具
 * 使用 idb-keyval 将聊天会话持久化到 IndexedDB
 */
import { get, set, del } from "idb-keyval";
import type {
  ChatPersonaId,
  NoteGenerationMessage,
} from "shared/types/NoteGeneration";

// 存储前缀
const CHAT_HISTORY_PREFIX = "chat-session-";
const CHAT_SESSION_LIST_KEY = "chat-session-list";

// 聊天会话类型
export type ChatSession = {
  id: string; // 会话唯一标识
  title: string; // 会话标题
  projectId?: string; // 关联的项目 ID（可选）
  personaId: ChatPersonaId; // 使用的 persona
  messages: NoteGenerationMessage[]; // 消息列表
  createdAt: number; // 创建时间戳
  updatedAt: number; // 更新时间戳
};

// 会话列表项类型（用于列表展示，不含完整消息）
export type ChatSessionMeta = {
  id: string;
  title: string;
  projectId?: string;
  personaId: ChatPersonaId;
  createdAt: number;
  updatedAt: number;
  messageCount: number; // 消息数量
};

// 会话列表存储类型
type SessionListData = {
  version: number;
  sessions: ChatSessionMeta[];
};

const STORAGE_VERSION = 1;

/**
 * 获取会话列表（按更新时间倒序）
 */
export const getSessionList = async (): Promise<ChatSessionMeta[]> => {
  try {
    const raw = await get<string>(CHAT_SESSION_LIST_KEY);
    if (!raw) return [];

    const data = JSON.parse(raw) as SessionListData;
    if (data.version !== STORAGE_VERSION) return [];

    // 按更新时间倒序排列
    return data.sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
};

/**
 * 保存会话列表
 */
const saveSessionList = async (sessions: ChatSessionMeta[]): Promise<void> => {
  const data: SessionListData = {
    version: STORAGE_VERSION,
    sessions,
  };
  await set(CHAT_SESSION_LIST_KEY, JSON.stringify(data));
};

/**
 * 生成新会话 ID
 */
const generateSessionId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

/**
 * 根据消息生成会话标题（取第一条用户消息的前 20 个字符）
 */
const generateTitle = (messages: NoteGenerationMessage[]): string => {
  const firstUserMessage = messages.find((m) => m.role === "user");
  if (!firstUserMessage) return "新对话";

  const content = firstUserMessage.content.trim();
  return content.length > 20 ? `${content.slice(0, 20)}…` : content;
};

/**
 * 创建新会话
 */
export const createSession = async (
  projectId?: string,
  personaId: ChatPersonaId = "none",
): Promise<ChatSession> => {
  const now = Date.now();
  const session: ChatSession = {
    id: generateSessionId(),
    title: "新对话",
    projectId,
    personaId,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };

  // 保存会话
  await set(`${CHAT_HISTORY_PREFIX}${session.id}`, JSON.stringify(session));

  // 更新会话列表
  const sessionList = await getSessionList();
  const meta: ChatSessionMeta = {
    id: session.id,
    title: session.title,
    projectId: session.projectId,
    personaId: session.personaId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messageCount: 0,
  };
  await saveSessionList([meta, ...sessionList]);

  return session;
};

/**
 * 获取会话详情
 */
export const getSession = async (
  sessionId: string,
): Promise<ChatSession | null> => {
  try {
    const raw = await get<string>(`${CHAT_HISTORY_PREFIX}${sessionId}`);
    if (!raw) return null;

    return JSON.parse(raw) as ChatSession;
  } catch {
    return null;
  }
};

/**
 * 更新会话（保存消息）
 */
export const updateSession = async (
  sessionId: string,
  messages: NoteGenerationMessage[],
  personaId?: ChatPersonaId,
): Promise<boolean> => {
  try {
    const session = await getSession(sessionId);
    if (!session) return false;

    const now = Date.now();
    const updatedSession: ChatSession = {
      ...session,
      messages,
      title: messages.length > 0 ? generateTitle(messages) : session.title,
      personaId: personaId ?? session.personaId,
      updatedAt: now,
    };

    // 保存会话
    await set(
      `${CHAT_HISTORY_PREFIX}${sessionId}`,
      JSON.stringify(updatedSession),
    );

    // 更新会话列表
    const sessionList = await getSessionList();
    const index = sessionList.findIndex((s) => s.id === sessionId);
    if (index !== -1) {
      sessionList[index] = {
        id: updatedSession.id,
        title: updatedSession.title,
        projectId: updatedSession.projectId,
        personaId: updatedSession.personaId,
        createdAt: updatedSession.createdAt,
        updatedAt: updatedSession.updatedAt,
        messageCount: messages.length,
      };
      await saveSessionList(sessionList);
    }

    return true;
  } catch {
    return false;
  }
};

/**
 * 重命名会话
 */
export const renameSession = async (
  sessionId: string,
  newTitle: string,
): Promise<boolean> => {
  try {
    const session = await getSession(sessionId);
    if (!session) return false;

    const updatedSession: ChatSession = {
      ...session,
      title: newTitle,
      updatedAt: Date.now(),
    };

    // 保存会话
    await set(
      `${CHAT_HISTORY_PREFIX}${sessionId}`,
      JSON.stringify(updatedSession),
    );

    // 更新会话列表
    const sessionList = await getSessionList();
    const index = sessionList.findIndex((s) => s.id === sessionId);
    if (index !== -1) {
      sessionList[index].title = newTitle;
      sessionList[index].updatedAt = updatedSession.updatedAt;
      await saveSessionList(sessionList);
    }

    return true;
  } catch {
    return false;
  }
};

/**
 * 删除会话
 */
export const deleteSession = async (sessionId: string): Promise<boolean> => {
  try {
    // 删除会话数据
    await del(`${CHAT_HISTORY_PREFIX}${sessionId}`);

    // 从列表中移除
    const sessionList = await getSessionList();
    const filteredList = sessionList.filter((s) => s.id !== sessionId);
    await saveSessionList(filteredList);

    return true;
  } catch {
    return false;
  }
};

/**
 * 清空所有会话
 */
export const clearAllSessions = async (): Promise<boolean> => {
  try {
    const sessionList = await getSessionList();
    // 删除所有会话数据
    for (const session of sessionList) {
      await del(`${CHAT_HISTORY_PREFIX}${session.id}`);
    }
    // 清空列表
    await del(CHAT_SESSION_LIST_KEY);
    return true;
  } catch {
    return false;
  }
};

/**
 * 获取项目关联的会话列表
 */
export const getSessionsByProjectId = async (
  projectId: string,
): Promise<ChatSessionMeta[]> => {
  const sessionList = await getSessionList();
  return sessionList.filter((s) => s.projectId === projectId);
};
