import { EventSourceParserStream } from "eventsource-parser/stream";
import { jikeingService } from "service/aiRequest";
import { BailianVideoGenerationRequest } from "shared/types/detail/Bailian/video";
import { Seedance20Request } from "shared/types/detail/kuaizhi/Seedance-2.0";
import type { ToApiImageGenerationRequest } from "shared/types/detail/ToApi/images";
import { AGNES_IMAGE_2_FLASH_MODEL } from "shared/constants/ai-models";
import { getJikeingToken } from "shared/utils/utils";
import { aiVideoTrackingService } from "@/services/aiVideoTracking";
import {
  createDesktopChatCompletions,
  createDesktopProxyTask,
  queryDesktopProxyTask
} from "./jikeGo";

/**
 *
 * 为了兼容同一个接口的不同入参，暂定接口的入参和出参都为 any
 * 不过类型定义文件是有的，位于 src/types 目录下面
 */

function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function extractReferenceImageUrls(data: unknown): string[] | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }

  const record = data as Record<string, any>;
  const urls = new Set<string>();
  const addUrl = (value: unknown) => {
    if (isHttpUrl(value)) {
      urls.add(value);
    }
  };
  const addUrls = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(addUrl);
      return;
    }
    addUrl(value);
  };

  addUrls(record.reference_image_url);
  addUrls(record.referenceImageUrl);
  addUrls(record.image_url);
  addUrls(record.imageUrl);
  addUrls(record.image_urls);
  addUrls(record.imageUrls);

  const imageItems = record.images || record.input?.images;
  if (Array.isArray(imageItems)) {
    imageItems.forEach((item) => addUrl(item?.url));
  }

  const mediaItems = record.media || record.input?.media;
  if (Array.isArray(mediaItems)) {
    mediaItems.forEach((item) => {
      if (
        isHttpUrl(item?.url) &&
        (item?.type === "image" ||
          item?.type === "image_url" ||
          item?.type === "reference_image" ||
          item?.type === "first_frame" ||
          item?.type === "last_frame")
      ) {
        urls.add(item.url);
      }
    });
  }

  return urls.size ? [...urls] : undefined;
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
    return Number.isFinite(parsedDuration)
      ? Math.trunc(parsedDuration)
      : undefined;
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

/**
 * 从代理响应中提取 ledgerBizId（积分预扣凭证）
 * 当 scoreCost > 0 时，后端返回 {upstream, ledgerBizId} 结构
 */
function extractLedgerBizId(data: any): {
  responseData: any;
  ledgerBizId: string | undefined;
} {
  if (data?.upstream && data?.ledgerBizId) {
    return {
      responseData: data.upstream,
      ledgerBizId: String(data.ledgerBizId),
    };
  }
  return { responseData: data, ledgerBizId: undefined };
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

const AGNES_IMAGE_SIZE_BY_RATIO: Record<string, string> = {
  "1:1": "1024x1024",
  "3:2": "1024x682",
  "2:3": "682x1024",
  "4:3": "1024x768",
  "3:4": "768x1024",
  "16:9": "1024x576",
  "9:16": "576x1024",
  "21:9": "1344x576",
  "9:21": "576x1344",
  "2:1": "1024x512",
  "1:2": "512x1024",
  "5:4": "1024x819",
  "4:5": "819x1024",
};

const getAgnesImageApiBaseUrl = () =>
  String(
    (import.meta as any).env?.VITE_AGNES_API_BASE_URL ||
    "https://apihub.agnes-ai.com",
  ).replace(/\/+$/, "");

const getAgnesImageApiKey = () =>
  String((import.meta as any).env?.VITE_AGNES_API_KEY || "").trim();

const normalizeAgnesImageSize = (size: unknown) => {
  const rawSize = typeof size === "string" ? size.trim() : "";
  if (/^\d{2,5}x\d{2,5}$/i.test(rawSize)) {
    return rawSize.toLowerCase();
  }
  return AGNES_IMAGE_SIZE_BY_RATIO[rawSize] ?? AGNES_IMAGE_SIZE_BY_RATIO["1:1"];
};

const normalizeAgnesImageInput = (value: unknown): string[] => {
  const rawItems = Array.isArray(value) ? value : value ? [value] : [];
  return rawItems
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
};

export const extractAgnesImageUrls = (response: any): string[] => {
  const rawItems =
    response?.data?.data ??
    response?.result?.data ??
    response?.data ??
    response?.images ??
    response?.imageUrls ??
    [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  return items
    .map((item: any) => {
      const candidate =
        typeof item === "string"
          ? item
          : item?.url ?? item?.image_url ?? item?.imageUrl ?? item?.b64_json;
      if (typeof candidate !== "string") return "";
      const trimmed = candidate.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("data:image/") || /^https?:\/\//i.test(trimmed)) {
        return trimmed;
      }
      if (/^[a-z0-9+/]+=*$/i.test(trimmed) && trimmed.length > 120) {
        return `data:image/png;base64,${trimmed}`;
      }
      return trimmed;
    })
    .filter(Boolean);
};

// 创建图片生成任务
export async function createImageGeneration(
  data: ToApiImageGenerationRequest,
  scoreCost?: number,
  signal?: AbortSignal,
) {
  const response = await createDesktopProxyTask({
    platform: "toapi",
    upstreamPath: "/v1/images/generations",
    method: "POST",
    body: data,
    scoreCost,
    scoreBizType: "image",
    scoreModel: data.model,
    scoreSource: "toapi",
    // scoreSourceLabel: "ToAPI 图片生成",
    scoreSourceLabel: data.model,
  }, signal);

  const rawData = unwrapDesktopProxyData(response);
  const { responseData, ledgerBizId } = extractLedgerBizId(rawData);
  return ledgerBizId ? { ...responseData, ledgerBizId } : responseData;
}

export async function createAgnesImageGeneration(
  data: Record<string, any>,
  scoreCost?: number,
  signal?: AbortSignal,
) {
  void scoreCost;

  const imageUrls = normalizeAgnesImageInput(
    data.image ?? data.image_urls ?? data.images,
  );
  const extraBody: Record<string, any> = {
    response_format: "url",
  };
  const body: Record<string, any> = {
    model: AGNES_IMAGE_2_FLASH_MODEL,
    prompt: String(data.prompt ?? ""),
    size: normalizeAgnesImageSize(data.size),
    extra_body: extraBody,
  };

  if (imageUrls.length > 0) {
    body.image = imageUrls;
    extraBody.image = imageUrls;
  }

  const apiKey = getAgnesImageApiKey();
  if (!apiKey) {
    throw new Error("缺少 Agnes API Key，请配置 VITE_AGNES_API_KEY");
  }

  const response = await fetch(`${getAgnesImageApiBaseUrl()}/v1/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  const responseText = await response.text();
  let responseData: any = null;
  try {
    responseData = responseText ? JSON.parse(responseText) : {};
  } catch {
    responseData = { message: responseText };
  }

  if (!response.ok) {
    const message =
      responseData?.error?.message ||
      responseData?.message ||
      `Agnes 图片生成失败（HTTP ${response.status}）`;
    throw new Error(message);
  }

  return responseData;
}

// 获取图片生成任务状态
export async function getImageTaskStatus(id: string, signal?: AbortSignal) {
  const response = await queryDesktopProxyTask({
    platform: "toapi",
    upstreamPath: `/v1/images/generations/${id}`,
    method: "GET",
  }, signal);

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

function extractChatCompletionText(response: any): string {
  const messageContent = response?.choices?.[0]?.message?.content;
  if (typeof messageContent === "string") {
    return messageContent.trim();
  }

  if (Array.isArray(messageContent)) {
    return messageContent
      .map((item) => item?.text || item?.content || "")
      .filter(Boolean)
      .join("")
      .trim();
  }

  const outputText = response?.output_text;
  if (typeof outputText === "string") {
    return outputText.trim();
  }

  return "";
}

export async function analyzeLightingReferenceImage(
  imageUrl: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await createChatCompletion(
    {
      model: "deepseek-v4-flash",
      stream: false,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "你是专业摄影灯光分析师，只输出中文灯光描述，不评价图片主体。",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "分析这张参考图的灯光特征，输出一段可直接用于 AI 图像重绘 prompt 的中文描述。",
                "重点包含：主光方向、色温/色调、明暗对比、阴影硬度、轮廓光、高光、整体氛围。",
                "不要描述人物身份、服装、构图细节，不要要求复刻参考图主体。",
                "控制在 80 字以内。",
              ].join("\n"),
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
    },
    signal,
  );

  const description = extractChatCompletionText(response);
  if (!description) {
    throw new Error("未能提取参考图灯光描述");
  }

  return description;
}

// ===================== Midjourney 相关 =====================

// 提交 Midjourney imagine 任务
export async function submitMjImagine(
  data: { prompt: string },
  scoreCost?: number,
  signal?: AbortSignal,
) {
  const response = await createDesktopProxyTask({
    platform: "zeakai",
    upstreamPath: "/mj/submit/imagine",
    method: "POST",
    body: data,
    scoreCost,
    scoreBizType: "image",
    scoreModel: "midjourney",
    scoreSource: "zeakai",
    scoreSourceLabel: "Midjourney",
  }, signal);

  const rawData = unwrapDesktopProxyData(response);
  const { responseData, ledgerBizId } = extractLedgerBizId(rawData);
  return ledgerBizId ? { ...responseData, ledgerBizId } : responseData;
}

// 获取 Midjourney 任务状态
export async function fetchMjTask(id: string, signal?: AbortSignal) {
  const response = await queryDesktopProxyTask({
    platform: "zeakai",
    upstreamPath: `/mj/task/${id}/fetch`,
    method: "GET",
  }, signal);

  return unwrapDesktopProxyData(response);
}

// ===================== 快手 AI 视频相关 =====================

// 创建快手视频生成任务
export async function createLzVideoTask(
  data: Seedance20Request,
  scoreCost?: number,
) {
  const response = await createDesktopProxyTask({
    platform: "kuaizi",
    upstreamPath: "/v1/lz/video/task/create",
    method: "POST",
    body: data,
    scoreCost,
    scoreBizType: "video",
    scoreModel: getSeedance20Model(data),
    scoreSource: "kuaizi",
    scoreSourceLabel: "快手可灵",
  });
  const rawData = unwrapDesktopProxyData(response);
  const { responseData, ledgerBizId } = extractLedgerBizId(rawData);
  const taskId =
    responseData?.data?.task_id ??
    responseData?.task_id ??
    responseData?.data?.taskId ??
    responseData?.taskId ??
    "";

  await aiVideoTrackingService.track({
    apiName: "/v1/lz/video/task/create",
    model: getSeedance20Model(data),
    taskId,
    prompt: data.prompt,
    duration: extractDurationSeconds(data),
    referenceImageUrls: extractReferenceImageUrls(data),
    provider: "kuaizi",
    requestParams: data as unknown as Record<string, unknown>,
    status: taskId ? "PENDING" : "FAIL",
    scoreCost,
  });

  return { ...responseData, ledgerBizId };
}

// 查询快手视频生成任务状态
export async function getLzVideoTaskStatus(taskId: string) {
  const response = await queryDesktopProxyTask({
    platform: "kuaizi",
    upstreamPath: "/v1/lz/video/task/status",
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
  scoreCost?: number,
) {
  const response = await createDesktopProxyTask(
    {
      platform: "yunwu",
      upstreamPath: `/v1beta/models/${modeName}:generateContent`,
      method: "POST",
      body: data,
      scoreCost,
      scoreBizType: "image",
      scoreModel: modeName,
      scoreSource: "yunwu",
      scoreSourceLabel: "Gemini",
    },
    signal,
  );

  const rawData = unwrapDesktopProxyData(response);
  const { responseData, ledgerBizId } = extractLedgerBizId(rawData);
  return ledgerBizId ? { ...responseData, ledgerBizId } : responseData;
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
  scoreCost?: number,
) {
  const response = await createDesktopProxyTask({
    platform: "dashscope",
    upstreamPath: "/api/v1/services/aigc/video-generation/video-synthesis",
    method: "POST",
    headers: {
      "X-DashScope-Async": "enable",
    },
    body: data,
    scoreCost,
    scoreBizType: "video",
    scoreModel: data.model,
    scoreSource: "dashscope",
    scoreSourceLabel: "阿里云百炼",
  });
  const rawData = unwrapDesktopProxyData(response);
  const { responseData, ledgerBizId } = extractLedgerBizId(rawData);

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
    referenceImageUrls: extractReferenceImageUrls(data),
    provider: "dashscope",
    requestParams: trackData,
    status: taskStatus === "FAILED" || !taskId ? "FAIL" : "PENDING",
    scoreCost,
  });

  return { ...responseData, ledgerBizId };
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

// ===================== Agnes-Video-V2.0 相关 =====================
//
// 与 /pages/Video Demo 页面保持完全一致的请求路径与字段：
// 创建: POST /desktop/v1/ai/generation/proxy -> platform=agnes -> /v1/videos
// 查询: POST /desktop/v1/ai/task/query      -> platform=agnes -> /agnesapi?video_id=...

/**
 * 创建 Agnes-Video-V2.0 视频生成任务
 */
export async function createAgnesVideoTask(
  data: Record<string, any>,
  scoreCost?: number,
) {
  const response = await createDesktopProxyTask({
    platform: "agnes",
    upstreamPath: "/v1/videos",
    method: "POST",
    body: data,
    scoreCost,
    scoreBizType: "agnes",
    scoreModel: data.model,
    scoreSource: "agnes",
    scoreSourceLabel: "Agnes 视频生成",
  });

  const rawData = unwrapDesktopProxyData(response);
  const { responseData, ledgerBizId } = extractLedgerBizId(rawData);

  await aiVideoTrackingService.track({
    apiName: "/v1/videos",
    model: String(data.model || ""),
    taskId:
      responseData?.video_id ||
      responseData?.id ||
      responseData?.task_id ||
      "",
    prompt: extractPrompt(data),
    duration: extractDurationSeconds(data),
    referenceImageUrls: extractReferenceImageUrls(data),
    provider: "agnes",
    requestParams: data,
    status: responseData?.video_id || responseData?.id ? "PENDING" : "FAIL",
    scoreCost,
  });

  return { ...responseData, ledgerBizId };
}

/**
 * 查询 Agnes-Video-V2.0 任务状态（推荐使用 video_id）
 * @param videoId 视频 ID（也兼容旧版 task_id）
 */
export async function getAgnesVideoTaskStatus(videoId: string) {
  const response = await queryDesktopProxyTask({
    platform: "agnes",
    upstreamPath: "/agnesapi",
    method: "GET",
    query: { video_id: videoId, model_name: "agnes-video-v2.0" },
  });

  return unwrapDesktopProxyData(response);
}

async function createKuaiziOpenPlatformVideoTask({
  data,
  upstreamPath,
  scoreCost,
  scoreModel,
  scoreSourceLabel,
}: {
  data: BailianVideoGenerationRequest;
  upstreamPath: string;
  scoreCost?: number;
  scoreModel: string;
  scoreSourceLabel: string;
}) {
  const response = await createDesktopProxyTask({
    platform: "kuaizi",
    upstreamPath,
    method: "POST",
    body: data,
    scoreCost,
    scoreBizType: "video",
    scoreModel,
    scoreSource: "kuaizi",
    scoreSourceLabel,
  });
  const rawData = unwrapDesktopProxyData(response);
  const { responseData, ledgerBizId } = extractLedgerBizId(rawData);
  const taskId =
    responseData?.data?.task_id ??
    responseData?.output?.task_id ??
    responseData?.task_id ??
    "";
  const taskStatus =
    responseData?.data?.task_status ??
    responseData?.output?.task_status ??
    responseData?.task_status;

  await aiVideoTrackingService.track({
    apiName: upstreamPath,
    model: scoreModel,
    taskId,
    prompt: extractPrompt(data),
    duration: extractDurationSeconds(data),
    referenceImageUrls: extractReferenceImageUrls(data),
    provider: "kuaizi",
    requestParams: data as unknown as Record<string, unknown>,
    status: taskStatus === "FAILED" || !taskId ? "FAIL" : "PENDING",
    scoreCost,
  });

  return { ...responseData, ledgerBizId };
}
