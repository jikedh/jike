/**
 * Copyright (c) 2026.
 *
 * 文件说明：
 * - 提供画布聊天能力的 React Hook。
 * - 负责消息收发、人格提示词注入与错误提示。
 * - 对外暴露消息列表、加载态及发送/清空方法，供 Canvas 页面复用。
 * - 支持聊天历史自动保存到 IndexedDB。
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { createChatCompletion } from "@/api/ai";
import {
  DEFAULT_CANVAS_CHAT_MODEL,
  isCanvasChatImageModel,
} from "shared/constants/ai-models";
import {
  CANVAS_CHAT_PERSONAS,
  NO_CHAT_PERSONA_ID,
} from "shared/constants/chat-personas";
import useMessage from "@/hooks/useMessage";
import { generateCanvasChatImages } from "@/services/canvasChatImageGeneration";
import type {
  ChatPersonaId,
  NoteGenerationMessage,
  NoteGenerationRequest,
} from "shared/types/NoteGeneration";

/**
 * 根据人格 ID 查找人格配置。
 *
 * @param personaId 人格标识。传入「无人格」标识时直接返回 null。
 * @returns 匹配到的人格对象；未匹配或为无人格时返回 null。
 */
const getPersonaById = (personaId: ChatPersonaId) => {
  if (personaId === NO_CHAT_PERSONA_ID) {
    return null;
  }

  return CANVAS_CHAT_PERSONAS.find((item) => item.id === personaId) ?? null;
};

/**
 * 组装发送给模型的消息数组。
 *
 * 实现思路：
 * - 若选择了人格，则将人格内容作为 system 消息插入到消息首位；
 * - 若未选择人格，则直接返回当前对话消息。
 *
 * @param personaId 当前使用的人格 ID。
 * @param chatMessages 当前会话消息（不包含动态注入的 system 消息）。
 * @returns 最终请求消息数组（可能包含 system + 历史消息）。
 */
const buildRequestMessages = (
  personaId: ChatPersonaId,
  chatMessages: NoteGenerationMessage[],
): NoteGenerationRequest["messages"] => {
  const persona = getPersonaById(personaId);
  const plainMessages = chatMessages.map(({ role, content, name }) => ({
    role,
    content,
    name,
  }));

  if (!persona) {
    return plainMessages;
  }

  return [
    {
      role: "system",
      content: persona.content,
    },
    ...plainMessages,
  ];
};

/**
 * 画布聊天 Hook。
 *
 * @returns 提供消息列表、加载态及操作方法：
 * - `sendMessage`：发送用户消息并接收模型回复；
 * - `clearLocalMessages`：清空当前内存态。
 */
export const useCanvasChat = () => {
  /** 当前会话消息列表（仅前端内存态）。 */
  const [messages, setMessages] = useState<NoteGenerationMessage[]>([]);
  /** 消息发送中的加载状态，避免重复提交。 */
  const [isLoading, setIsLoading] = useState(false);
  /** 当前请求控制器（用于中断流式生成）。 */
  const abortControllerRef = useRef<AbortController | null>(null);
  /** 统一消息提示能力（toast/snackbar）。 */
  const { error } = useMessage();

  const stopMessage = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  };

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  /**
   * 发送一条用户消息并处理模型回复。
   *
   * @param payload 发送参数。
   * @param payload.content 用户输入内容。
   * @param payload.personaId 当前选择的人格 ID。
   * @param payload.model 可选模型名，未传时使用默认模型。
   * @returns Promise<void>
   *
   * 实现思路：
   * 1) 先做输入裁剪与并发保护（空消息或加载中直接返回）；
   * 2) 先将用户消息追加到本地状态并置为 loading；
   * 3) 组装请求（含可选 system 人格）并调用聊天接口；
   * 4) 解析助手回复并写回本地状态；
   * 5) 捕获异常并给出统一错误提示，最后重置 loading。
   *
   * 潜在风险：
   * - 当前基于闭包中的 `messages` 追加，极端高频并发下可能出现竞态；
   *   若后续支持并发发送，建议改为函数式 setState 或请求队列。
   */
  const sendMessage = async (payload: {
    content: string;
    personaId: ChatPersonaId;
    model?: string;
  }) => {
    const content = payload.content.trim();
    if (!content || isLoading) {
      return;
    }

    const model = payload.model || DEFAULT_CANVAS_CHAT_MODEL;
    const userMessage: NoteGenerationMessage = {
      role: "user",
      content,
    };

    const nextMessages = [...messages, userMessage];
    const assistantMessageIndex = nextMessages.length;
    setMessages([
      ...nextMessages,
      {
        role: "assistant",
        content: "",
      },
    ]);
    setIsLoading(true);

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const isImageGeneration = isCanvasChatImageModel(model);

      if (isImageGeneration) {
        setMessages((prev) => {
          const assistantMessage = prev[assistantMessageIndex];
          if (!assistantMessage || assistantMessage.role !== "assistant") {
            return prev;
          }

          const updatedMessages = [...prev];
          updatedMessages[assistantMessageIndex] = {
            ...assistantMessage,
            content: "正在生成图片...",
            status: "generating",
          };
          return updatedMessages;
        });

        const result = await generateCanvasChatImages({
          model,
          prompt: content,
          signal: controller.signal,
          onProgress: (progressMessage) => {
            setMessages((prev) => {
              const assistantMessage = prev[assistantMessageIndex];
              if (!assistantMessage || assistantMessage.role !== "assistant") {
                return prev;
              }

              const updatedMessages = [...prev];
              updatedMessages[assistantMessageIndex] = {
                ...assistantMessage,
                content: progressMessage,
                status: "generating",
              };
              return updatedMessages;
            });
          },
        });

        setMessages((prev) => {
          const assistantMessage = prev[assistantMessageIndex];
          if (!assistantMessage || assistantMessage.role !== "assistant") {
            return prev;
          }

          const imageCount = result.images.length;
          const updatedMessages = [...prev];
          updatedMessages[assistantMessageIndex] = {
            ...assistantMessage,
            content: `${result.label} 已生成 ${imageCount} 张图片`,
            images: result.images,
            status: "completed",
          };
          return updatedMessages;
        });
        return;
      }

      const requestPayload: NoteGenerationRequest = {
        model,
        messages: buildRequestMessages(payload.personaId, nextMessages),
      };

      const stream = await createChatCompletion(
        {
          ...requestPayload,
          stream: true,
        },
        controller.signal,
      );

      for await (const content of stream) {
        setMessages((prev) => {
          const assistantMessage = prev[assistantMessageIndex];
          if (!assistantMessage || assistantMessage.role !== "assistant") {
            return prev;
          }

          const updatedMessages = [...prev];
          updatedMessages[assistantMessageIndex] = {
            ...assistantMessage,
            content: `${assistantMessage.content}${content}`,
          };
          return updatedMessages;
        });
      }

      setMessages((prev) => {
        const assistantMessage = prev[assistantMessageIndex];
        if (!assistantMessage || assistantMessage.role !== "assistant") {
          return prev;
        }

        if (assistantMessage.content.trim()) {
          return prev;
        }

        const updatedMessages = [...prev];
        updatedMessages[assistantMessageIndex] = {
          ...assistantMessage,
          content: "生成出现了点问题，未能获取到有效内容，请稍后再试~",
          status: "failed",
        };
        return updatedMessages;
      });
    } catch (chatError: any) {
      if (chatError?.name === "AbortError") {
        setMessages((prev) => {
          const assistantMessage = prev[assistantMessageIndex];
          if (!assistantMessage || assistantMessage.role !== "assistant") {
            return prev;
          }

          const updatedMessages = [...prev];
          updatedMessages[assistantMessageIndex] = {
            ...assistantMessage,
            content: assistantMessage.content.trim()
              ? `${assistantMessage.content}\n\n（已停止生成）`
              : "已停止生成。",
            status: "stopped",
          };
          return updatedMessages;
        });
        return;
      }

      console.error("聊天请求失败:", chatError);
      error(
        isCanvasChatImageModel(model)
          ? "图片生成失败，请稍后重试"
          : "对话失败，请稍后重试",
      );

      setMessages((prev) => {
        const assistantMessage = prev[assistantMessageIndex];
        if (!assistantMessage || assistantMessage.role !== "assistant") {
          return prev;
        }

        const updatedMessages = [...prev];
        updatedMessages[assistantMessageIndex] = {
          ...assistantMessage,
          content:
            chatError instanceof Error
              ? chatError.message
              : "生成出现了点问题，未能获取到有效内容，请稍后再试~",
          status: "failed",
        };
        return updatedMessages;
      });
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsLoading(false);
    }
  };

  /**
   * 清空当前 Hook 的本地会话状态。
   *
   * @returns void
   */
  const clearLocalMessages = () => {
    stopMessage();
    setMessages([]);
  };

  /**
   * 设置消息列表（用于从历史记录加载）。
   */
  const setMessagesDirectly = useCallback(
    (newMessages: NoteGenerationMessage[]) => {
      setMessages(newMessages);
    },
    [],
  );

  return {
    messages,
    isLoading,
    sendMessage,
    stopMessage,
    clearLocalMessages,
    setMessages: setMessagesDirectly,
  };
};
