/**
 * 聊天历史管理 Hook
 * 提供会话列表加载、创建、切换、重命名、删除等功能
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatSession, ChatSessionMeta } from "service/chatHistoryStorage";
import {
  createSession,
  deleteSession,
  getSession,
  getSessionList,
  renameSession,
  updateSession,
} from "service/chatHistoryStorage";
import type {
  ChatPersonaId,
  NoteGenerationMessage,
} from "shared/types/NoteGeneration";

type UseChatHistoryOptions = {
  projectId?: string; // 可选的项目 ID 关联
  autoLoad?: boolean; // 是否自动加载会话列表
};

type UseChatHistoryReturn = {
  // 状态
  sessionList: ChatSessionMeta[]; // 会话列表
  currentSession: ChatSession | null; // 当前会话
  isLoading: boolean; // 加载状态

  // 操作
  loadSessionList: () => Promise<void>; // 加载会话列表
  createNewSession: (
    personaId?: ChatPersonaId,
    model?: string,
  ) => Promise<ChatSession>; // 创建新会话
  switchSession: (sessionId: string) => Promise<ChatSession | null>; // 切换会话
  saveCurrentSession: (
    messages: NoteGenerationMessage[],
    personaId?: ChatPersonaId,
    model?: string,
  ) => Promise<boolean>; // 保存当前会话
  renameCurrentSession: (newTitle: string) => Promise<boolean>; // 重命名当前会话
  deleteSessionById: (sessionId: string) => Promise<boolean>; // 删除会话
  clearCurrentSession: () => void; // 清空当前会话（不删除）
};

export const useChatHistory = (
  options: UseChatHistoryOptions = {},
): UseChatHistoryReturn => {
  const { projectId, autoLoad = true } = options;

  const [sessionList, setSessionList] = useState<ChatSessionMeta[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const currentSessionRef = useRef<ChatSession | null>(null);

  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  // 加载会话列表
  const loadSessionList = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await getSessionList();
      // 如果有 projectId，则过滤出该项目的会话；否则返回全部
      const filteredList = projectId
        ? list.filter((s) => s.projectId === projectId)
        : list;
      setSessionList(filteredList);
    } catch (error) {
      console.error("加载会话列表失败:", error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // 自动加载
  useEffect(() => {
    if (autoLoad) {
      loadSessionList();
    }
  }, [autoLoad, loadSessionList]);

  // 创建新会话
  const createNewSession = useCallback(
    async (personaId: ChatPersonaId = "none", model?: string) => {
      const session = await createSession(projectId, personaId, model);
      setCurrentSession(session);
      await loadSessionList(); // 刷新列表
      return session;
    },
    [projectId, loadSessionList],
  );

  // 切换会话
  const switchSession = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    try {
      const session = await getSession(sessionId);
      if (session) {
        setCurrentSession(session);
        return session;
      }
      return null;
    } catch (error) {
      console.error("切换会话失败:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 保存当前会话
  const saveCurrentSession = useCallback(
    async (
      messages: NoteGenerationMessage[],
      personaId?: ChatPersonaId,
      model?: string,
    ) => {
      const activeSession = currentSessionRef.current;

      if (!activeSession) {
        // 如果没有当前会话，先创建一个
        const session = await createSession(
          projectId,
          personaId || "none",
          model,
        );
        setCurrentSession(session);
        await updateSession(session.id, messages, personaId, model);
        await loadSessionList();
        return true;
      }

      const success = await updateSession(
        activeSession.id,
        messages,
        personaId,
        model,
      );
      if (success) {
        // 更新本地状态
        setCurrentSession((prev) =>
          prev
            ? {
                ...prev,
                messages,
                title:
                  messages.length > 0
                    ? messages
                        .find((m) => m.role === "user")
                        ?.content.slice(0, 20) || prev.title
                    : prev.title,
                model: model ?? prev.model,
                updatedAt: Date.now(),
              }
            : null,
        );
        await loadSessionList();
      }
      return success;
    },
    [projectId, loadSessionList],
  );

  // 重命名当前会话
  const renameCurrentSession = useCallback(
    async (newTitle: string) => {
      if (!currentSession) return false;

      const success = await renameSession(currentSession.id, newTitle);
      if (success) {
        setCurrentSession((prev) =>
          prev
            ? {
                ...prev,
                title: newTitle,
                updatedAt: Date.now(),
              }
            : null,
        );
        await loadSessionList();
      }
      return success;
    },
    [currentSession, loadSessionList],
  );

  // 删除会话
  const deleteSessionById = useCallback(
    async (sessionId: string) => {
      const success = await deleteSession(sessionId);
      if (success) {
        // 如果删除的是当前会话，清空当前会话
        if (currentSession?.id === sessionId) {
          setCurrentSession(null);
        }
        await loadSessionList();
      }
      return success;
    },
    [currentSession, loadSessionList],
  );

  // 清空当前会话（不删除，只是重置状态）
  const clearCurrentSession = useCallback(() => {
    setCurrentSession(null);
  }, []);

  return {
    sessionList,
    currentSession,
    isLoading,
    loadSessionList,
    createNewSession,
    switchSession,
    saveCurrentSession,
    renameCurrentSession,
    deleteSessionById,
    clearCurrentSession,
  };
};
