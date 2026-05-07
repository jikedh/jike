import { EventSourceParserStream } from "eventsource-parser/stream";
import {
  adobe2ApiRequest,
  getAdobe2ApiState,
  jikeingService,
  ximuRequest,
  wuhenRequest,
} from "service/aiRequest";
import {
  createDesktopChatCompletions,
  createDesktopProxyTask,
  queryDesktopProxyTask,
} from "./jikeGo";
import {
  BailianVideoGenerationRequest,
} from "shared/types/detail/Bailian/video";
import { Seedance20Request } from "shared/types/detail/kuaizhi/Seedance-2.0";
import type {
  Adobe2ApiVideoGenerationRequest,
  Adobe2ApiImageGenerationRequest,
  Adobe2ApiImageGenerationResponse,
  Adobe2ApiImage2ImageRequest,
  Adobe2ApiVideoGenerationResponse,
  FireflyGptImageToImageRequest,
  FireflyGptImageToImageResponse,
} from "shared/types/detail/Adobe2API";
import type {
  XimuCardBalanceResponse,
  XimuGptImageRequest,
  XimuNanoBananaRequest,
  XimuTaskResultResponse,
  XimuTaskSubmitResponse,
} from "shared/types/detail/ximu";
import type { ToApiImageGenerationRequest } from "shared/types/detail/ToApi/images";
import type {
  TaskResponse,
  VideoRemovalRequest,
  WuhenAccessTokenResponse,
} from "shared/types/detail/wuhen";
import { getJikeingToken } from "shared/utils/utils";
import { aiVideoTrackingService } from "@/services/aiVideoTracking";

/**
 *
 * 为了兼容同一个接口的不同入参，暂定接口的入参和出参都为 any
 * 不过类型定义文件是有的，位于 src/types 目录下面
 */

function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function extractReferenceImageUrl(data: unknown): string | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }

  const record = data as Record<string, any>;
  const directUrl =
    record.reference_image_url ||
    record.referenceImageUrl ||
    record.image_url ||
    record.imageUrl;
  if (isHttpUrl(directUrl)) {
    return directUrl;
  }

  const imageUrls = record.image_urls || record.imageUrls;
  if (Array.isArray(imageUrls)) {
    const firstUrl = imageUrls.find(isHttpUrl);
    if (firstUrl) {
      return firstUrl;
    }
  }

  const imageItems = record.images || record.input?.images;
  if (Array.isArray(imageItems)) {
    const firstImage = imageItems.find((item) => isHttpUrl(item?.url));
    if (firstImage) {
      return firstImage.url;
    }
  }

  const mediaItems = record.media || record.input?.media;
  if (Array.isArray(mediaItems)) {
    const firstImageMedia = mediaItems.find(
      (item) =>
        isHttpUrl(item?.url) &&
        (item?.type === "image" ||
          item?.type === "image_url" ||
          item?.type === "reference_image" ||
          item?.type === "first_frame" ||
          item?.type === "last_frame"),
    );
    if (firstImageMedia) {
      return firstImageMedia.url;
    }
  }

  return undefined;
}

function extractDurationSeconds(data: unknown): number | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }

  const record = data as Record<string, any>;
  const duration =
    record.duration ??
    record.parameters?.duration ??
    record.input?.duration ??
    record.input?.parameters?.duration;

  if (typeof duration === "number" && Number.isFinite(duration)) {
    return Math.trunc(duration);
  }
  if (typeof duration === "string" && duration.trim()) {
    const parsedDuration = Number(duration);
    return Number.isFinite(parsedDuration) ? Math.trunc(parsedDuration) : undefined;
  }
  return undefined;
}

function extractPrompt(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "";
  }

  const record = data as Record<string, any>;
  const nestedPrompt = record.input?.prompt;
  if (nestedPrompt) {
    return String(nestedPrompt);
  }

  return String(record.prompt || "");
}

function getSeedance20Model(data: Seedance20Request): string {
  const record = data as unknown as Record<string, unknown>;
  const model = String(record.model || "");

  if (model === "seedance-2.0-fast" || model === "seedance-2.0-pro") {
    return model;
  }
  if (model === "doubao-seedance-2.0-fast") {
    return "seedance-2.0-fast";
  }
  if (model === "doubao-seedance-2.0-pro") {
    return "seedance-2.0-pro";
  }

  return data.mode === "fast" ? "seedance-2.0-fast" : "seedance-2.0-pro";
}

function unwrapDesktopProxyData(response: any) {
  return response?.data ?? response;
}

async function createDesktopChatStream(data: any, signal?: AbortSignal) {
  const baseURL =
    (import.meta as any).env?.VITE_JIKE_GO_BASE_URL || "http://localhost:9181";
  const url = `${baseURL}/desktop/v1/ai/chat/completions`;

  const token = getJikeingToken();
  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: "POST",
    signal,
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(
      await response.text().catch(() => `请求失败：${response.status}`),
    );
  }

  const reader = response
    .body!.pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream())
    .getReader();

  return (async function* () {
    while (true) {
      const { done, value } = await reader.read();
      if (done || value?.data === "[DONE]") return;
      const content = JSON.parse(value.data)?.choices?.[0]?.delta?.content;
      if (content) yield content;
    }
  })();
}

// ===================== 图片生成相关 =====================

// 创建图片生成任务
export async function createImageGeneration(data: ToApiImageGenerationRequest) {
  const response = await createDesktopProxyTask({
    platform: "toapi",
    upstreamPath: "/v1/images/generations",
    method: "POST",
    body: data,
  });

  return unwrapDesktopProxyData(response);
}

export function createAdobe2ApiImageGeneration(
  data: Adobe2ApiImageGenerationRequest,
) {
  return adobe2ApiRequest<Adobe2ApiImageGenerationResponse>({
    url: "/v1/images/generations",
    method: "post",
    data,
  });
}

export function createAdobe2ApiChatImageGeneration(
  data: Adobe2ApiImage2ImageRequest,
) {
  return adobe2ApiRequest<Adobe2ApiImageGenerationResponse>({
    url: "/v1/chat/completions",
    method: "post",
    data,
  });
}

export function createAdobe2ApiGptImageToImageGeneration(
  data: FireflyGptImageToImageRequest,
) {
  return adobe2ApiRequest<FireflyGptImageToImageResponse>({
    url: "/v1/chat/completions",
    method: "post",
    data,
  });
}

export function createAdobe2ApiVideoGeneration(
  data: Adobe2ApiVideoGenerationRequest,
) {
  return adobe2ApiRequest<Adobe2ApiVideoGenerationResponse>({
    url: "/v1/chat/completions",
    method: "post",
    data,
    timeout: 900000,
  });
}

export function createXimuGptImageGeneration(data: XimuGptImageRequest) {
  return ximuRequest<XimuTaskSubmitResponse>({
    url: "/api/draw/completions",
    method: "post",
    data,
    timeout: 900000,
  });
}

export function createXimuNanoBananaGeneration(
  data: XimuNanoBananaRequest,
) {
  return ximuRequest<XimuTaskSubmitResponse>({
    url: "/api/draw/nano-banana",
    method: "post",
    data,
    timeout: 900000,
  });
}

export function getXimuImageResult(id: string) {
  return ximuRequest<XimuTaskResultResponse>({
    url: "/api/draw/result",
    method: "post",
    data: { id },
    timeout: 900000,
  });
}

export function getXimuCardBalance(code: string) {
  return ximuRequest<XimuCardBalanceResponse>({
    url: "/api/credits/card",
    method: "post",
    data: { code },
  });
}

// 获取图片生成任务状态
export async function getImageTaskStatus(id: string) {
  const response = await queryDesktopProxyTask({
    platform: "toapi",
    upstreamPath: `/v1/images/generations/${id}`,
    method: "GET",
  });

  return unwrapDesktopProxyData(response);
}

// ===================== 聊天相关 =====================

// 兼容 OpenAI 格式的文字对话接口，支持全部文字模型
// - stream: false 或不传 → 返回完整响应
// - stream: true → 返回 async generator，逐块 yield 文本内容

export async function createChatCompletion(data: any, signal?: AbortSignal) {
  const desktopData = {
    platform: "toapi" as const,
    upstreamPath: "/v1/chat/completions",
    ...data,
  };

  if (data.stream) {
    return createDesktopChatStream(desktopData, signal);
  }

  const response = await createDesktopChatCompletions(desktopData, signal);
  return unwrapDesktopProxyData(response);
}

// ===================== Midjourney 相关 =====================

// 提交 Midjourney imagine 任务
export async function submitMjImagine(data: { prompt: string }) {
  const response = await createDesktopProxyTask({
    platform: "zeakai",
    upstreamPath: "/mj/submit/imagine",
    method: "POST",
    body: data,
  });

  return unwrapDesktopProxyData(response);
}

// 获取 Midjourney 任务状态
export async function fetchMjTask(id: string) {
  const response = await queryDesktopProxyTask({
    platform: "zeakai",
    upstreamPath: `/mj/task/${id}/fetch`,
    method: "GET",
  });

  return unwrapDesktopProxyData(response);
}

// ===================== 快手 AI 视频相关 =====================

// 创建快手视频生成任务
export async function createLzVideoTask(data: Seedance20Request) {
  const response = await createDesktopProxyTask({
    platform: "kuaizi",
    upstreamPath: "/lz/video/task/create",
    method: "POST",
    body: data,
  });
  const responseData = unwrapDesktopProxyData(response);
  const taskId =
    responseData?.data?.task_id ??
    responseData?.task_id ??
    responseData?.data?.taskId ??
    responseData?.taskId ??
    "";

  await aiVideoTrackingService.track({
    apiName: "/lz/video/task/create",
    model: getSeedance20Model(data),
    taskId,
    prompt: data.prompt,
    duration: extractDurationSeconds(data),
    referenceImageUrl: extractReferenceImageUrl(data),
    provider: "kuaizi",
    requestParams: data as unknown as Record<string, unknown>,
    status: taskId ? "PENDING" : "FAIL",
  });

  return responseData;
}

// 查询快手视频生成任务状态
export async function getLzVideoTaskStatus(taskId: string) {
  const response = await queryDesktopProxyTask({
    platform: "kuaizi",
    upstreamPath: "/lz/video/task/status",
    method: "POST",
    body: { task_id: taskId },
  });

  return unwrapDesktopProxyData(response);
}

// ===================== 极景二维码登录相关 =====================

// 获取场景二维码
export function getSceneQrcode(data?: any): any {
  return jikeingService({
    // 仅该接口走旧域名，避免受 jikeingService 全局 baseURL 影响
    baseURL: "https://api.jikeing.com",
    url: "/v1/user/get-scene-qrcode",
    method: "get",
    params: data,
  });
}

// 查询场景状态
export function querySceneStatus(sceneId: any): any {
  return jikeingService({
    // 仅该接口走旧域名，避免受 jikeingService 全局 baseURL 影响
    baseURL: "https://api.jikeing.com",
    url: "/v1/user/query-scene-status",
    method: "get",
    params: { scene_id: sceneId },
  });
}

// 获取用户信息（包含会员等级）
export function getUserInfo(): any {
  return jikeingService({
    url: "/v1/user/info",
    method: "get",
  });
}

// ===================== Gemini 多模型内容生成相关 =====================

/**
 * Gemini 多模型内容生成接口
 * 支持文本和图片输入，生成文本或图片内容
 * API 端点: /v1beta/models/{modeName}:generateContent
 * @param modeName 模型名称，如 gemini-2.5-flash-image、gemini-2.0-flash 等
 * @param data 请求数据，包含 contents 等字段
 * @param signal 可选的 AbortSignal 用于取消请求
 */
export async function generateGeminiContent(
  modeName: string,
  data: any,
  signal?: AbortSignal,
) {
  const adobe2ApiState = await getAdobe2ApiState();
  if (adobe2ApiState?.status === "running" && adobe2ApiState.baseUrl) {
    return adobe2ApiRequest({
      url: "/v1/images/generations",
      method: "post",
      data: {
        model: modeName,
        ...data,
      },
      signal,
    });
  }

  const response = await createDesktopProxyTask(
    {
      platform: "yunwu",
      upstreamPath: `/v1beta/models/${modeName}:generateContent`,
      method: "POST",
      body: data,
    },
    signal,
  );

  return unwrapDesktopProxyData(response);
}

// ===================== 阿里云百炼相关 =====================

/**
 * 阿里云百炼 API 对话接口（支持深度思考）这个接口是 openAI 兼容接口，入参和出参都和 OpenAI 一样
 * @param data 请求数据，包含 messages、model 等字段
 * @param signal 可选的 AbortSignal 用于取消请求
 */
export async function createDashscopeChatCompletion(
  data: any,
  signal?: AbortSignal,
) {
  // 处理 extra_body 参数
  const requestBody = {
    ...data,
    ...(data.extra_body ? data.extra_body : {}),
  };

  if (data.stream) {
    const stream = await createDesktopChatStream(
      {
        platform: "dashscope",
        upstreamPath: "/compatible-mode/v1/chat/completions",
        ...requestBody,
      },
      signal,
    );

    return (async function* () {
      for await (const content of stream) {
        yield { content };
      }
    })();
  }

  const response = await createDesktopChatCompletions(
    {
      platform: "dashscope",
      upstreamPath: "/compatible-mode/v1/chat/completions",
      ...requestBody,
    },
    signal,
  );

  return unwrapDesktopProxyData(response);
}

// ===================== 阿里云百炼视频生成相关 =====================

/**
 * 阿里云百炼视频生成接口
 * 用于提交视频生成任务
 * API 端点: /api/v1/services/aigc/video-generation/video-synthesis
 * @param data 请求数据
 */
export async function createDashscopeVideoSynthesis(
  data: BailianVideoGenerationRequest,
) {
  const response = await createDesktopProxyTask({
    platform: "dashscope",
    upstreamPath: "/api/v1/services/aigc/video-generation/video-synthesis",
    method: "POST",
    headers: {
      "X-DashScope-Async": "enable",
    },
    body: data,
  });
  const responseData = unwrapDesktopProxyData(response);

  const trackData = data as unknown as Record<string, unknown>;
  const trackResponse = responseData as {
    data?: { task_id?: string; task_status?: string };
    task_id?: string;
    task_status?: string;
    output?: { task_id?: string; task_status?: string };
  };
  const taskId =
    trackResponse.output?.task_id ??
    trackResponse.data?.task_id ??
    trackResponse.task_id ??
    "";
  const taskStatus =
    trackResponse.output?.task_status ??
    trackResponse.data?.task_status ??
    trackResponse.task_status;

  await aiVideoTrackingService.track({
    apiName: "/api/v1/services/aigc/video-generation/video-synthesis",
    model: String(trackData.model || ""),
    taskId,
    prompt: extractPrompt(data),
    duration: extractDurationSeconds(data),
    referenceImageUrl: extractReferenceImageUrl(data),
    provider: "dashscope",
    requestParams: trackData,
    status: taskStatus === "FAILED" || !taskId ? "FAIL" : "PENDING",
  });

  return responseData;
}
/**
 * 阿里云百炼视频生成任务状态查询接口
 * 用于轮询视频生成任务状态
 * API 端点: /api/v1/tasks/{task_id}
 * @param taskId 任务 ID
 */
export async function getDashscopeVideoTaskStatus(taskId: string) {
  const response = await queryDesktopProxyTask({
    platform: "dashscope",
    upstreamPath: `/api/v1/tasks/${taskId}`,
    method: "GET",
  });

  return unwrapDesktopProxyData(response);
}

// ===================== 无痕 AI 视频消除相关 =====================

// Access Token 缓存（localStorage 持久化）
const WUHEN_TOKEN_KEY = "wuhen_access_token";
const WUHEN_TOKEN_EXPIRED_KEY = "wuhen_access_token_expired";

/**
 * 从 .env 读取无痕 AI 的 api_key
 */
function getWuhenApiKey(): string {
  return (import.meta as any).env?.VITE_WUHEI_API_KEY || "";
}

/**
 * 确保拥有有效的 access_token（自动刷新，过期后更新 localStorage）
 * @param forceRefresh 是否强制重新获取
 */
async function ensureWuhenAccessToken(forceRefresh = false): Promise<string> {
  const now = Date.now();
  // 提前 60 秒过期预留缓冲
  const bufferMs = 60_000;

  if (!forceRefresh) {
    const cached = localStorage.getItem(WUHEN_TOKEN_KEY);
    const expired = Number(localStorage.getItem(WUHEN_TOKEN_EXPIRED_KEY) || 0);
    if (cached && now < expired - bufferMs) {
      return cached;
    }
  }

  const nonce = crypto.randomUUID();
  const t = now;
  const apiKey = getWuhenApiKey();

  const res = await wuhenRequest<WuhenAccessTokenResponse>({
    url: "/v2/user/access_token",
    method: "get",
    params: { nonce, t, api_key: apiKey },
  });
  localStorage.setItem(WUHEN_TOKEN_KEY, res.data.access_token);
  // expired 为秒级时间戳，转毫秒后存储
  localStorage.setItem(
    WUHEN_TOKEN_EXPIRED_KEY,
    String((res.data.expired ?? 0) * 1000),
  );
  return res.data.access_token;
}

/**
 * 视频消除接口
 * 用于消除视频中的路人或不需要的元素
 * API 端点: https://api.wuhenai.com/v2/video_removal
 * @param data 请求体，直接对齐共享的 VideoRemovalRequest
 */
export async function videoRemoval(data: VideoRemovalRequest): Promise<any> {
  const nonce = crypto.randomUUID();
  const t = Date.now();
  const token = await ensureWuhenAccessToken();

  return wuhenRequest({
    url: "/v2/video_removal",
    method: "post",
    params: { nonce, t },
    data,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * 无痕 AI 视频消除任务状态查询接口
 * 用于轮询视频消除任务状态
 * API 端点: https://api.wuhenai.com/v2/status
 * @param taskId 任务 ID
 */
export async function getVideoRemovalStatus(
  taskId: string,
): Promise<TaskResponse> {
  const nonce = crypto.randomUUID();
  const t = Date.now();
  const token = await ensureWuhenAccessToken();

  return wuhenRequest<TaskResponse>({
    url: "/v2/status",
    method: "get",
    params: { nonce, t, task_id: taskId },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
