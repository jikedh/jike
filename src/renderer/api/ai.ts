// import aiService, { zeakaiRequest, getAiToken } from 'service/aiRequest'
import { EventSourceParserStream } from "eventsource-parser/stream";
import {
  aiService,
  dashscopeRequest,
  flow2ApiRequest,
  getFlow2ApiState,
  jikeingService,
  kuaiziRequest,
  wuhenRequest,
  yunwuRequest,
  zeakaiRequest,
} from "service/aiRequest";
import {
  BailianVideoGenerationCreateResponse,
  BailianVideoGenerationQueryResponse,
  BailianVideoGenerationRequest,
} from "shared/types/detail/Bailian/video";
import {
  Seedance20Request,
  Seedance20Response,
  Seedance20StatusResponse,
} from "shared/types/detail/kuaizhi/Seedance-2.0";
import type {
  ToApiImageGenerationRequest,
  ToApiImageGenerationResponse,
} from "shared/types/detail/ToApi/images";
import type {
  TaskResponse,
  VideoRemovalRequest,
  WuhenAccessTokenResponse,
} from "shared/types/detail/wuhen";
import { getAiToken, getBaseURL } from "shared/utils/utils";
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

// ===================== 账户余额相关 =====================

// 查询令牌余额
export function getBalance() {
  return aiService({
    url: "/v1/balance",
    method: "get",
  });
}

// ===================== 图片生成相关 =====================

// 创建图片生成任务
export function createImageGeneration(data: ToApiImageGenerationRequest) {
  return aiService<ToApiImageGenerationResponse>({
    url: "/v1/images/generations",
    method: "post",
    data,
  });
}

// 获取图片生成任务状态
export function getImageTaskStatus(id: string) {
  return aiService({
    url: `/v1/images/generations/${id}`,
    method: "get",
  });
}

// ===================== 聊天相关 =====================

// 兼容 OpenAI 格式的文字对话接口，支持全部文字模型
// - stream: false 或不传 → 返回完整响应
// - stream: true → 返回 async generator，逐块 yield 文本内容

export async function createChatCompletion(data: any, signal?: AbortSignal) {
  if (data.stream) {
    // 构建请求头 - 动态从 localStorage 获取 API 密钥
    const token = getAiToken();
    const headers: any = {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // 获取基础 URL（Electron 环境使用完整地址，Web 环境使用相对路径）
    const baseURL = getBaseURL("ai");
    const url =
      baseURL === "/"
        ? "/v1/chat/completions"
        : `${baseURL}/v1/chat/completions`;

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

  return aiService({
    url: "/v1/chat/completions",
    method: "post",
    data,
    signal,
  });
}

// 兼容 Anthropic 格式的文字对话接口
export function createMessages(data: any) {
  return aiService({
    url: "/v1/messages",
    method: "post",
    data,
  });
}

// ===================== 文件上传相关 =====================

// 上传图片
export function uploadImage(data: any) {
  return aiService({
    url: "/v1/uploads/images",
    method: "post",
    data,
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
}

/**
 * 上传图片并获取 URL
 * @param file 要上传的文件
 * @returns 上传成功后的图片 URL，失败返回 undefined
 */
export async function uploadImageFile(file: File): Promise<string | undefined> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await uploadImage(formData);
    return response.data.url;
  } catch (error) {
    console.error("上传图片失败:", error);
    return undefined;
  }
}

// ===================== Midjourney 相关 =====================

// 提交 Midjourney imagine 任务
export function submitMjImagine(data: { prompt: string }) {
  return zeakaiRequest({
    url: "/mj/submit/imagine",
    method: "post",
    data,
  });
}

// 获取 Midjourney 任务状态
export function fetchMjTask(id: string) {
  return zeakaiRequest({
    url: `/mj/task/${id}/fetch`,
    method: "get",
  });
}

// ===================== 快手 AI 视频相关 =====================

// 创建快手视频生成任务
export async function createLzVideoTask(data: Seedance20Request) {
  const response = await kuaiziRequest<Seedance20Response>({
    url: "/lz/video/task/create",
    method: "post",
    data,
  });
  const taskId = response.data?.task_id || "";

  await aiVideoTrackingService.track({
    apiName: "/lz/video/task/create",
    model: getSeedance20Model(data),
    taskId,
    prompt: data.prompt,
    referenceImageUrl: extractReferenceImageUrl(data),
    provider: "kuaizi",
    requestParams: data as unknown as Record<string, unknown>,
    status: taskId ? "PENDING" : "FAIL",
  });

  return response;
}

// 查询快手视频生成任务状态
// Seedance20StatusResponse
export function getLzVideoTaskStatus(taskId: string) {
  return kuaiziRequest<Seedance20StatusResponse>({
    url: "/lz/video/task/status",
    method: "post",
    data: { task_id: taskId },
  });
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

// 获取用户信息（包含会员等级）
export function getMemberInfoByUUId(id: string): any {
  return jikeingService({
    url: `/get-member-info-by-uuid/${id}`,
    method: "get",
    // params: { uuid: data.uuid || data }
    // params: 1933128037681942528
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
  const flow2ApiState = await getFlow2ApiState();
  if (flow2ApiState?.status === "running" && flow2ApiState.baseUrl) {
    return flow2ApiRequest({
      url: `/v1beta/models/${modeName}:generateContent`,
      method: "post",
      data,
      signal,
    });
  }

  return yunwuRequest({
    url: `/v1beta/models/${modeName}:generateContent`,
    method: "post",
    data,
    signal,
  });
}

/**
 * Gemini 多模型内容生成接口（流式响应版本）
 * @param modeName 模型名称
 * @param data 请求数据
 * @param signal 可选的 AbortSignal
 */
export async function generateGeminiContentStream(
  modeName: string,
  data: any,
  signal?: AbortSignal,
) {
  const flow2ApiState = await getFlow2ApiState();
  if (flow2ApiState?.status === "running" && flow2ApiState.baseUrl) {
    return flow2ApiRequest({
      url: `/v1beta/models/${modeName}:generateContent`,
      method: "post",
      data: { ...data, stream: true },
      signal,
      responseType: "stream",
    });
  }

  return yunwuRequest({
    url: `/v1beta/models/${modeName}:generateContent`,
    method: "post",
    data: { ...data, stream: true },
    signal,
    responseType: "stream",
  });
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
    return dashscopeRequest({
      url: "/compatible-mode/v1/chat/completions",
      method: "post",
      data: requestBody,
      signal,
      responseType: "stream",
    });
  }

  return dashscopeRequest({
    url: "/compatible-mode/v1/chat/completions",
    method: "post",
    data: requestBody,
    signal,
  });
}

// ===================== 阿里云百炼视频生成相关 =====================

/**
 * 阿里云百炼视频生成接口
 * 用于提交视频生成任务
 * API 端点: /api/v1/services/aigc/video-generation/video-synthesis
 * @param data 请求数据
 */
// BailianVideoGenerationCreateResponse
export async function createDashscopeVideoSynthesis(
  data: BailianVideoGenerationRequest,
) {
  const response = await dashscopeRequest<BailianVideoGenerationCreateResponse>(
    {
      url: "/api/v1/services/aigc/video-generation/video-synthesis",
      method: "post",
      data,
      headers: {
        "X-DashScope-Async": "enable",
      },
    },
  );

  const trackData = data as unknown as Record<string, unknown>;
  const trackResponse = response as {
    output?: { task_id?: string; task_status?: string };
  };

  await aiVideoTrackingService.track({
    apiName: "/api/v1/services/aigc/video-generation/video-synthesis",
    model: String(trackData.model || ""),
    taskId: trackResponse.output?.task_id || "",
    prompt: extractPrompt(data),
    referenceImageUrl: extractReferenceImageUrl(data),
    provider: "dashscope",
    requestParams: trackData,
    status: trackResponse.output?.task_status === "FAILED" ? "FAIL" : "PENDING",
  });

  return response;
}
// 响应体的格式如下
// {
//     "request_id": "d40eb92c-179f-9e15-ae48-deddc63e1a5a",
//     "output": {
//         "task_id": "b2b03f03-432e-4d0f-84c7-3dd0dfbb8489",
//         "task_status": "PENDING"
//     }
// }

/**
 * 阿里云百炼视频生成任务状态查询接口
 * 用于轮询视频生成任务状态
 * API 端点: /api/v1/tasks/{task_id}
 * @param taskId 任务 ID
 */
// BailianVideoGenerationQueryResponse
export function getDashscopeVideoTaskStatus(taskId: string) {
  return dashscopeRequest<BailianVideoGenerationQueryResponse>({
    url: `/api/v1/tasks/${taskId}`,
    method: "get",
  });
}

// {
//     "request_id": "7e75c1d7-f4a7-9064-bfcf-e7bc69fa15d8",
//     "output": {
//         "task_id": "b2b03f03-432e-4d0f-84c7-3dd0dfbb8489",
//         "task_status": "SUCCEEDED",
//         "submit_time": "2026-04-21 00:09:06.534",
//         "scheduled_time": "2026-04-21 00:09:15.225",
//         "end_time": "2026-04-21 00:10:50.287",
//         "orig_prompt": "一幅都市奇幻艺术的场景。一个充满动感的涂鸦艺术角色。一个由喷漆所画成的少年，正从一面混凝土墙上活过来。他一边用极快的语速演唱一首英文rap，一边摆着一个经典的、充满活力的说唱歌手姿势。场景设定在夜晚一个充满都市感的铁路桥下。灯光来自一盏孤零零的街灯，营造出电影般的氛围，充满高能量和惊人的细节。视频的音频部分完全由rap构成，没有其他对话或杂音。",
//         "video_url": "https://dashscope-a717.oss-accelerate.aliyuncs.com/1d/02/20260421/2b319361/8947677-metadata_user_c270fb9129168390_watermark.mp4?Expires=1776787839&OSSAccessKeyId=LTAI5tPxpiCM2hjmWrFXrym1&Signature=V%2FR40Jz%2FD21KQiPEzs0kAtyRoyY%3D"
//     },
//     "usage": {
//         "duration": 10,
//         "input_video_duration": 0,
//         "output_video_duration": 10,
//         "video_count": 1,
//         "SR": 720
//     }
// }

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
