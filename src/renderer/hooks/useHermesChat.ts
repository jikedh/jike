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

export const useHermesChat = (open: boolean) => {
  const [conversations, setConversations] = useState<HermesConversation[]>([]);
  const [currentConversation, setCurrentConversation] =
    useState<HermesConversation | null>(null);
  const [messages, setMessages] = useState<NoteGenerationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const { error } = useMessage();

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await listHermesConversations());
    } catch (requestError) {
      error(
        "Hermes 对话加载失败",
        requestError instanceof Error ? requestError.message : undefined,
      );
    }
  }, [error]);

  useEffect(() => {
    if (open) void loadConversations();
  }, [loadConversations, open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const newConversation = useCallback(async () => {
    const conversation = await createHermesConversation();
    setCurrentConversation(conversation);
    setMessages([]);
    setConversations((previous) => [conversation, ...previous]);
    return conversation;
  }, []);

  const selectConversation = useCallback(
    async (conversation: HermesConversation) => {
      setIsLoading(true);
      try {
        const nextMessages = await getHermesMessages(conversation.id);
        setCurrentConversation(conversation);
        setMessages(nextMessages);
      } catch (requestError) {
        error(
          "Hermes 消息加载失败",
          requestError instanceof Error ? requestError.message : undefined,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [error],
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
      setMessages((previous) => [
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
            setMessages((previous) => {
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
        setMessages((previous) => {
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
          setMessages((previous) => {
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
        setCurrentConversation((current) =>
          current && String(current.id) === String(updated.id)
            ? updated
            : current,
        );
        return updated;
      } catch (requestError) {
        error(
          "Hermes 对话重命名失败",
          requestError instanceof Error ? requestError.message : undefined,
        );
        return null;
      }
    },
    [error],
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
        if (deletingCurrent) {
          setCurrentConversation(null);
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
    [currentConversation?.id, error, stopMessage],
  );

  const clearConversation = useCallback(() => {
    stopMessage();
    setMessages([]);
  }, [stopMessage]);

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
