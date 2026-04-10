// import aiService, { zeakaiRequest, getAiToken } from '@/utils/aiRequest'
import { EventSourceParserStream } from "eventsource-parser/stream";
import {
  aiService,
  zeakaiRequest,
  kuaiziRequest,
  jikeingService,
  yunwuRequest,
} from "@/utils/aiRequest";
import { getAiToken, getBaseURL } from "@/utils/utils";
/**
 *
 * 为了兼容同一个接口的不同入参，暂定接口的入参和出参都为 any
 * 不过类型定义文件是有的，位于 src/types 目录下面
 */

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
export function createImageGeneration(data) {
  return aiService({
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

// ===================== 视频生成相关 =====================

// 创建视频生成任务
export function createVideoGeneration(data: any) {
  return aiService({
    url: "/v1/videos/generations",
    method: "post",
    data,
  });
}

// 获取视频生成任务状态
export function getVideoTaskStatus(id: string) {
  return aiService({
    url: `/v1/videos/generations/${id}`,
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
export function createLzVideoTask(data: any) {
  return kuaiziRequest({
    url: "/lz/video/task/create",
    method: "post",
    data,
  });
}

// 查询快手视频生成任务状态
export function getLzVideoTaskStatus(taskId: string) {
  return kuaiziRequest({
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

// 获取用户积分余额
export function getUserScoreBalance(): any {
  return jikeingService({
    url: "/userscore/v2/balance-info",
    method: "get",
  });
}

// 获取用户会员信息
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
export function generateGeminiContent(
  modeName: string,
  data: any,
  signal?: AbortSignal,
) {
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
export function generateGeminiContentStream(
  modeName: string,
  data: any,
  signal?: AbortSignal,
) {
  return yunwuRequest({
    url: `/v1beta/models/${modeName}:generateContent`,
    method: "post",
    data: { ...data, stream: true },
    signal,
    responseType: "stream",
  });
}
