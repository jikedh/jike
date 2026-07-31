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
  CANVAS_CHAT_MAX_INPUT_LENGTH,
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

const MAX_AUTO_RETRY_ATTEMPTS = 2;
const AUTO_RETRY_DELAYS_MS = [800, 1600] as const;

type ChatRequestError = Error & {
  partialContent?: string;
  status?: number;
};

const isRetryableChatError = (chatError: unknown) => {
  const status =
    chatError && typeof chatError === "object"
      ? (chatError as { status?: unknown }).status
      : undefined;

  if (typeof status === "number") {
    return status === 408 || status === 425 || status === 429 || status >= 500;
  }

  if (chatError instanceof TypeError) {
    return true;
  }

  const message =
    chatError instanceof Error ? chatError.message : String(chatError ?? "");
  return /network|fetch|timeout|timed out|empty response|未获取到有效内容|超时|网络|连接|服务暂时不可用/i.test(
    message,
  );
};

const attachPartialContent = (
  chatError: unknown,
  partialContent: string,
): ChatRequestError => {
  const requestError =
    chatError instanceof Error
      ? (chatError as ChatRequestError)
      : (new Error(
          String(chatError ?? "生成出现了点问题，请稍后再试"),
        ) as ChatRequestError);
  requestError.partialContent = partialContent;
  return requestError;
};

const waitForRetry = (delayMs: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    let timer: number | undefined;

    const handleAbort = () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
      reject(new DOMException("The operation was aborted", "AbortError"));
    };

    if (signal.aborted) {
      handleAbort();
      return;
    }

    timer = window.setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, delayMs);
    signal.addEventListener("abort", handleAbort, { once: true });
  });

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

  const updateAssistantMessage = useCallback(
    (
      assistantMessageIndex: number,
      update: (message: NoteGenerationMessage) => NoteGenerationMessage,
    ) => {
      setMessages((prev) => {
        const assistantMessage = prev[assistantMessageIndex];
        if (!assistantMessage || assistantMessage.role !== "assistant") {
          return prev;
        }

        const updatedMessages = [...prev];
        updatedMessages[assistantMessageIndex] = update(assistantMessage);
        return updatedMessages;
      });
    },
    [],
  );

  const executeRequest = async ({
    content,
    personaId,
    model,
    nextMessages,
    assistantMessageIndex,
    controller,
  }: {
    content: string;
    personaId: ChatPersonaId;
    model: string;
    nextMessages: NoteGenerationMessage[];
    assistantMessageIndex: number;
    controller: AbortController;
  }) => {
    if (isCanvasChatImageModel(model)) {
      updateAssistantMessage(assistantMessageIndex, (assistantMessage) => ({
        ...assistantMessage,
        content: "正在生成图片...",
        status: "generating",
      }));

      const result = await generateCanvasChatImages({
        model,
        prompt: content,
        signal: controller.signal,
        onProgress: (progressMessage) => {
          updateAssistantMessage(assistantMessageIndex, (assistantMessage) => ({
            ...assistantMessage,
            content: progressMessage,
            status: "generating",
          }));
        },
      });

      updateAssistantMessage(assistantMessageIndex, (assistantMessage) => ({
        ...assistantMessage,
        content: `${result.label} 已生成 ${result.images.length} 张图片`,
        images: result.images,
        status: "completed",
      }));
      return;
    }

    const requestPayload: NoteGenerationRequest = {
      model,
      messages: buildRequestMessages(personaId, nextMessages),
    };

    for (let attempt = 0; attempt <= MAX_AUTO_RETRY_ATTEMPTS; attempt += 1) {
      let streamedContent = "";

      if (attempt > 0) {
        updateAssistantMessage(assistantMessageIndex, (assistantMessage) => ({
          ...assistantMessage,
          content: `请求失败，正在重试（第 ${attempt}/${MAX_AUTO_RETRY_ATTEMPTS} 次）...`,
          status: "generating",
        }));
        await waitForRetry(
          AUTO_RETRY_DELAYS_MS[attempt - 1],
          controller.signal,
        );
      } else {
        updateAssistantMessage(assistantMessageIndex, (assistantMessage) => ({
          ...assistantMessage,
          content: "",
          status: "generating",
        }));
      }

      try {
        const stream = await createChatCompletion(
          {
            ...requestPayload,
            stream: true,
          },
          controller.signal,
        );

        for await (const chunk of stream) {
          streamedContent += chunk;
          updateAssistantMessage(assistantMessageIndex, (assistantMessage) => ({
            ...assistantMessage,
            content: streamedContent,
            status: "generating",
          }));
        }

        if (!streamedContent.trim()) {
          throw new Error("未获取到有效内容");
        }

        updateAssistantMessage(assistantMessageIndex, (assistantMessage) => ({
          ...assistantMessage,
          content: streamedContent,
          status: "completed",
        }));
        return;
      } catch (chatError) {
        if (chatError instanceof Error && chatError.name === "AbortError") {
          throw chatError;
        }

        const errorWithPartialContent = attachPartialContent(
          chatError,
          streamedContent,
        );
        if (
          attempt < MAX_AUTO_RETRY_ATTEMPTS &&
          !streamedContent.trim() &&
          isRetryableChatError(chatError)
        ) {
          continue;
        }

        throw errorWithPartialContent;
      }
    }
  };

  const runRequest = async (request: {
    content: string;
    personaId: ChatPersonaId;
    model: string;
    nextMessages: NoteGenerationMessage[];
    assistantMessageIndex: number;
  }) => {
    setIsLoading(true);

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await executeRequest({
        ...request,
        controller,
      });
    } catch (chatError: any) {
      if (chatError?.name === "AbortError") {
        updateAssistantMessage(
          request.assistantMessageIndex,
          (assistantMessage) => ({
            ...assistantMessage,
            content: assistantMessage.content.trim()
              ? `${assistantMessage.content}\n\n（已停止生成）`
              : "已停止生成。",
            status: "stopped",
          }),
        );
      } else {
        console.error("聊天请求失败:", chatError);
        error(
          isCanvasChatImageModel(request.model)
            ? "图片生成失败，请稍后重试"
            : "对话失败，请稍后重试",
        );

        const partialContent = (
          chatError as ChatRequestError
        )?.partialContent?.trim();
        const errorMessage =
          chatError instanceof Error
            ? chatError.message
            : "生成出现了点问题，未能获取到有效内容，请稍后再试~";

        updateAssistantMessage(
          request.assistantMessageIndex,
          (assistantMessage) => ({
            ...assistantMessage,
            content: partialContent
              ? `${partialContent}\n\n（生成中断，请点击“重试”继续）`
              : errorMessage,
            status: "failed",
          }),
        );
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsLoading(false);
    }
  };

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
    const content = payload.content
      .trim()
      .slice(0, CANVAS_CHAT_MAX_INPUT_LENGTH);
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
        status: "pending",
      },
    ]);
    await runRequest({
      content,
      personaId: payload.personaId,
      model,
      nextMessages,
      assistantMessageIndex,
    });
  };

  const retryMessage = async (
    assistantMessageIndex: number,
    payload: {
      personaId: ChatPersonaId;
      model?: string;
    },
  ) => {
    if (isLoading || assistantMessageIndex !== messages.length - 1) {
      return;
    }

    const assistantMessage = messages[assistantMessageIndex];
    const userMessage = messages[assistantMessageIndex - 1];
    if (
      !assistantMessage ||
      assistantMessage.role !== "assistant" ||
      assistantMessage.status !== "failed" ||
      !userMessage ||
      userMessage.role !== "user"
    ) {
      return;
    }

    const model = payload.model || DEFAULT_CANVAS_CHAT_MODEL;
    const nextMessages = messages.slice(0, assistantMessageIndex);
    setMessages([
      ...nextMessages,
      {
        ...assistantMessage,
        content: "",
        images: undefined,
        status: "pending",
      },
    ]);

    await runRequest({
      content: userMessage.content.slice(0, CANVAS_CHAT_MAX_INPUT_LENGTH),
      personaId: payload.personaId,
      model,
      nextMessages,
      assistantMessageIndex,
    });
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
    retryMessage,
    stopMessage,
    clearLocalMessages,
    setMessages: setMessagesDirectly,
  };
};
