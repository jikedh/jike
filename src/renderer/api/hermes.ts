import { jikeingService } from "service/aiRequest";
import { getJikeingToken } from "shared/utils/utils";
import type { NoteGenerationMessage } from "shared/types/NoteGeneration";

const JIKE_GO_BASE_URL =
  import.meta.env.VITE_JIKE_GO_BASE_URL || "http://localhost:9181";

type ApiEnvelope<T> = {
  code: number;
  msg?: string;
  data: T;
};

export type HermesConversation = {
  id: string | number;
  title: string;
  created_at: number;
  updated_at: number;
};

export type HermesAttachment = {
  key: string;
  filename: string;
  size: number;
  content_type: string;
};

type HermesConversationList = {
  list: HermesConversation[];
  total: number;
  page: number;
  page_size: number;
};

const unwrap = <T>(response: ApiEnvelope<T>): T => {
  if (!response || ![0, 200, 10000].includes(response.code)) {
    throw new Error(response?.msg || "Hermes 请求失败");
  }
  return response.data;
};

const request = async <T>(
  config: Parameters<typeof jikeingService.request>[0],
): Promise<T> => {
  const response = (await jikeingService.request({
    baseURL: JIKE_GO_BASE_URL,
    ...config,
  })) as unknown as ApiEnvelope<T>;
  return unwrap(response);
};

export const listHermesConversations = async (): Promise<
  HermesConversation[]
> => {
  const response = await request<HermesConversationList>({
    method: "GET",
    url: "/v1/ai/hermes/conversations",
    params: { page: 1, page_size: 100 },
  });
  return response.list;
};

export const createHermesConversation = async (
  title?: string,
): Promise<HermesConversation> =>
  request<HermesConversation>({
    method: "POST",
    url: "/v1/ai/hermes/conversations",
    data: title?.trim() ? { title: title.trim() } : {},
  });

export const renameHermesConversation = async (
  conversationId: string | number,
  title: string,
): Promise<HermesConversation> =>
  request<HermesConversation>({
    method: "PATCH",
    url: `/v1/ai/hermes/conversations/${encodeURIComponent(String(conversationId))}`,
    data: { title: title.trim() },
  });

export const deleteHermesConversation = async (
  conversationId: string | number,
): Promise<void> => {
  await request<{ deleted: boolean }>({
    method: "DELETE",
    url: `/v1/ai/hermes/conversations/${encodeURIComponent(String(conversationId))}`,
  });
};

export const uploadHermesAttachment = async (
  conversationId: string | number,
  file: File,
): Promise<HermesAttachment> => {
  const formData = new FormData();
  formData.append("file", file);
  return request<HermesAttachment>({
    method: "POST",
    url: `/v1/ai/hermes/conversations/${encodeURIComponent(String(conversationId))}/attachments`,
    data: formData,
  });
};

const toMessage = (value: unknown): NoteGenerationMessage | null => {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const role =
    item.role === "user" || item.role === "assistant" ? item.role : null;
  const content = typeof item.content === "string" ? item.content : "";
  if (!role || !content) return null;
  return { role, content, status: "completed" };
};

export const getHermesMessages = async (
  conversationId: string | number,
): Promise<NoteGenerationMessage[]> => {
  const response = await request<unknown>({
    method: "GET",
    url: `/v1/ai/hermes/conversations/${encodeURIComponent(String(conversationId))}/messages`,
  });
  const raw = Array.isArray(response)
    ? response
    : (response as { messages?: unknown[] })?.messages || [];
  return raw.map(toMessage).filter(Boolean) as NoteGenerationMessage[];
};

const extractDelta = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";

  const item = value as Record<string, unknown>;
  if (typeof item.content === "string") return item.content;
  if (typeof item.text === "string") return item.text;
  if (typeof item.delta === "string") return item.delta;

  const choices = Array.isArray(item.choices) ? item.choices : [];
  const first = choices[0] as Record<string, unknown> | undefined;
  const delta = first?.delta as Record<string, unknown> | undefined;
  if (typeof delta?.content === "string") return delta.content;
  const message = first?.message as Record<string, unknown> | undefined;
  return typeof message?.content === "string" ? message.content : "";
};

const parseSseBlock = (block: string): string => {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
  if (!data || data === "[DONE]") return "";

  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    const eventType = String(parsed.type || parsed.event || "").toLowerCase();
    if (["done", "complete", "completed", "error"].includes(eventType)) {
      return eventType === "error"
        ? String(parsed.message || parsed.error || "Hermes 流式请求失败")
        : "";
    }
    return extractDelta(parsed) || extractDelta(parsed.data);
  } catch {
    return data;
  }
};

const getSseEventName = (block: string): string =>
  block
    .split(/\r?\n/)
    .find((line) => line.startsWith("event:"))
    ?.slice(6)
    .trim()
    .toLowerCase() || "";

export const streamHermesChat = async (
  conversationId: string | number,
  input: string,
  attachments: HermesAttachment[],
  signal: AbortSignal,
  onDelta: (delta: string) => void,
): Promise<void> => {
  const token = getJikeingToken();
  const response = await fetch(
    `${JIKE_GO_BASE_URL}/v1/ai/hermes/conversations/${encodeURIComponent(String(conversationId))}/chat/stream`,
    {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ input, attachments }),
      signal,
    },
  );

  if (!response.ok || !response.body) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Hermes 请求失败（${response.status}）`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let receivedAssistantDelta = false;

  const handleBlock = (block: string) => {
    const event = getSseEventName(block);
    if (event === "assistant.delta") {
      const delta = parseSseBlock(block);
      if (delta) {
        receivedAssistantDelta = true;
        onDelta(delta);
      }
      return;
    }
    if (event === "assistant.completed") {
      if (!receivedAssistantDelta) {
        const content = parseSseBlock(block);
        if (content) onDelta(content);
      }
      return;
    }
    if (!event) {
      const delta = parseSseBlock(block);
      if (delta) onDelta(delta);
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || "";
      for (const block of blocks) {
        handleBlock(block);
      }
      if (done) break;
    }

    if (buffer.trim()) handleBlock(buffer);
  } finally {
    reader.releaseLock();
  }
};
