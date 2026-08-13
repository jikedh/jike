import { useCallback, useEffect, useRef, useState } from "react";
import type { NoteGenerationMessage } from "shared/types/NoteGeneration";
import useMessage from "@/hooks/useMessage";
import {
  createHermesConversation,
  deleteHermesConversation,
  getHermesMessages,
  listHermesConversations,
  renameHermesConversation,
  streamHermesChat,
  uploadHermesAttachment,
} from "@/api/hermes";
import type { HermesAttachment, HermesConversation } from "@/api/hermes";

const HERMES_LAST_CONVERSATION_KEY = "hermes:last-conversation-id";

export const useHermesChat = (open: boolean) => {
  const [conversations, setConversations] = useState<HermesConversation[]>([]);
  const [currentConversation, setCurrentConversation] =
    useState<HermesConversation | null>(null);
  const [messages, setMessages] = useState<NoteGenerationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const currentConversationRef = useRef<HermesConversation | null>(null);
  const messagesRef = useRef<NoteGenerationMessage[]>([]);
  const messageCacheRef = useRef(
    new Map<string, NoteGenerationMessage[]>(),
  );
  const loadRequestRef = useRef(0);
  const { error } = useMessage();

  const updateMessages = useCallback(
    (
      next:
        | NoteGenerationMessage[]
        | ((previous: NoteGenerationMessage[]) => NoteGenerationMessage[]),
    ) => {
      setMessages((previous) => {
        const resolved =
          typeof next === "function" ? next(previous) : next;
        messagesRef.current = resolved;
        const conversation = currentConversationRef.current;
        if (conversation) {
          messageCacheRef.current.set(String(conversation.id), resolved);
        }
        return resolved;
      });
    },
    [],
  );

  const setActiveConversation = useCallback(
    (conversation: HermesConversation | null) => {
      currentConversationRef.current = conversation;
      setCurrentConversation(conversation);
      if (conversation) {
        localStorage.setItem(
          HERMES_LAST_CONVERSATION_KEY,
          String(conversation.id),
        );
      } else {
        localStorage.removeItem(HERMES_LAST_CONVERSATION_KEY);
      }
    },
    [],
  );

  const loadConversationMessages = useCallback(
    async (conversation: HermesConversation) => {
      const conversationId = String(conversation.id);
      const requestId = ++loadRequestRef.current;
      const cachedMessages = messageCacheRef.current.get(conversationId);
      setActiveConversation(conversation);
      messagesRef.current = cachedMessages || [];
      setMessages(cachedMessages || []);

      const nextMessages = await getHermesMessages(conversation.id);
      if (
        requestId !== loadRequestRef.current ||
        String(currentConversationRef.current?.id) !== conversationId
      ) {
        return;
      }
      messageCacheRef.current.set(conversationId, nextMessages);
      messagesRef.current = nextMessages;
      setMessages(nextMessages);
    },
    [setActiveConversation],
  );

  const loadConversations = useCallback(async () => {
    try {
      const nextConversations = await listHermesConversations();
      setConversations(nextConversations);

      if (!currentConversationRef.current && nextConversations.length > 0) {
        const savedConversationId = localStorage.getItem(
          HERMES_LAST_CONVERSATION_KEY,
        );
        const conversation =
          nextConversations.find(
            (item) => String(item.id) === savedConversationId,
          ) || nextConversations[0];
        await loadConversationMessages(conversation);
      }
    } catch (requestError) {
      error(
        "Hermes 对话加载失败",
        requestError instanceof Error ? requestError.message : undefined,
      );
    }
  }, [error, loadConversationMessages]);

  useEffect(() => {
    if (open) void loadConversations();
  }, [loadConversations, open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const newConversation = useCallback(async () => {
    const conversation = await createHermesConversation();
    loadRequestRef.current += 1;
    setActiveConversation(conversation);
    messageCacheRef.current.set(String(conversation.id), []);
    messagesRef.current = [];
    setMessages([]);
    setConversations((previous) => [conversation, ...previous]);
    return conversation;
  }, [setActiveConversation]);

  const selectConversation = useCallback(
    async (conversation: HermesConversation) => {
      setIsLoading(true);
      try {
        await loadConversationMessages(conversation);
      } catch (requestError) {
        error(
          "Hermes 消息加载失败",
          requestError instanceof Error ? requestError.message : undefined,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [error, loadConversationMessages],
  );

  const uploadAttachments = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return [];
      const conversation =
        currentConversation || (await newConversation().catch(() => null));
      if (!conversation) return [];

      setIsUploading(true);
      try {
        const uploaded: HermesAttachment[] = [];
        for (const file of files) {
          uploaded.push(await uploadHermesAttachment(conversation.id, file));
        }
        return uploaded;
      } catch (requestError) {
        error(
          "Hermes 附件上传失败",
          requestError instanceof Error ? requestError.message : undefined,
        );
        return [];
      } finally {
        setIsUploading(false);
      }
    },
    [currentConversation, error, newConversation],
  );

  const sendMessage = useCallback(
    async (input: string, attachments: HermesAttachment[] = []) => {
      const content = input.trim();
      if (!content || isLoading || isUploading) return;

      const conversation =
        currentConversation || (await newConversation().catch(() => null));
      if (!conversation) return;

      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      const assistantIndex = messages.length + 1;
      const userContent =
        attachments.length > 0
          ? `${content}\n\n附件：${attachments.map((item) => item.filename).join("、")}`
          : content;
      updateMessages((previous) => [
        ...previous,
        { role: "user", content: userContent },
        { role: "assistant", content: "", status: "generating" },
      ]);
      setIsLoading(true);

      try {
        await streamHermesChat(
          conversation.id,
          content,
          attachments,
          controller.signal,
          (delta) => {
            updateMessages((previous) => {
              const next = [...previous];
              const assistant = next[assistantIndex];
              if (assistant?.role === "assistant") {
                next[assistantIndex] = {
                  ...assistant,
                  content: assistant.content + delta,
                };
              }
              return next;
            });
          },
        );
        updateMessages((previous) => {
          const next = [...previous];
          const assistant = next[assistantIndex];
          if (assistant?.role === "assistant") {
            next[assistantIndex] = { ...assistant, status: "completed" };
          }
          return next;
        });
        await loadConversations();
      } catch (requestError) {
        if ((requestError as Error)?.name !== "AbortError") {
          error(
            "Hermes 对话失败",
            requestError instanceof Error ? requestError.message : undefined,
          );
          updateMessages((previous) => {
            const next = [...previous];
            const assistant = next[assistantIndex];
            if (assistant?.role === "assistant") {
              next[assistantIndex] = { ...assistant, status: "failed" };
            }
            return next;
          });
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setIsLoading(false);
      }
    },
    [
      currentConversation,
      error,
      isLoading,
      isUploading,
      loadConversations,
      messages.length,
      newConversation,
      updateMessages,
    ],
  );

  const stopMessage = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  const renameConversation = useCallback(
    async (conversation: HermesConversation, title: string) => {
      try {
        const updated = await renameHermesConversation(conversation.id, title);
        setConversations((previous) =>
          previous.map((item) =>
            String(item.id) === String(updated.id) ? updated : item,
          ),
        );
        if (
          currentConversationRef.current &&
          String(currentConversationRef.current.id) === String(updated.id)
        ) {
          setActiveConversation(updated);
        }
        return updated;
      } catch (requestError) {
        error(
          "Hermes 对话重命名失败",
          requestError instanceof Error ? requestError.message : undefined,
        );
        return null;
      }
    },
    [error, setActiveConversation],
  );

  const deleteConversation = useCallback(
    async (conversation: HermesConversation) => {
      const deletingCurrent =
        String(currentConversation?.id) === String(conversation.id);
      if (deletingCurrent) stopMessage();

      try {
        await deleteHermesConversation(conversation.id);
        setConversations((previous) =>
          previous.filter(
            (item) => String(item.id) !== String(conversation.id),
          ),
        );
        messageCacheRef.current.delete(String(conversation.id));
        if (deletingCurrent) {
          setActiveConversation(null);
          messagesRef.current = [];
          setMessages([]);
        }
        return true;
      } catch (requestError) {
        error(
          "Hermes 对话删除失败",
          requestError instanceof Error ? requestError.message : undefined,
        );
        return false;
      }
    },
    [currentConversation?.id, error, setActiveConversation, stopMessage],
  );

  const clearConversation = useCallback(() => {
    stopMessage();
    updateMessages([]);
  }, [stopMessage, updateMessages]);

  return {
    conversations,
    currentConversation,
    messages,
    isLoading,
    isUploading,
    loadConversations,
    newConversation,
    selectConversation,
    renameConversation,
    deleteConversation,
    sendMessage,
    uploadAttachments,
    stopMessage,
    clearConversation,
  };
};
