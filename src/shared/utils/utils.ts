import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ===================== 写死的 API 密钥 =====================

// AI 服务密钥
const DEFAULT_AI_TOKEN = "sk-8ngj8WD671ZFioHc2qypEJFQwhWeims435RtteF28IPxgHWR";

// ZeakAI 服务密钥
const DEFAULT_ZEAKAI_TOKEN = "df3ddeb9-45da-4eb7-b49a-8ab32c8e4ebb";

// 快手 AI 服务密钥
const DEFAULT_KUAIZI_TOKEN = "kz-XyWCfLd8q784ybb6PVo6OuDb2rkRJ8ShiCZNcvnus0";

// Yunwu AI 服务密钥
const DEFAULT_YUNWU_TOKEN =
  "sk-BNkrD8Sfje36v0dbgVQDIVmfE8F4NV9A06zG9btQx9I1fwf5";

/**
 * 获取 AI 服务密钥
 */
export const getAiToken = () => DEFAULT_AI_TOKEN;

/**
 * 获取 ZeakAI 服务密钥
 */
export const getZeakaiToken = () => DEFAULT_ZEAKAI_TOKEN;

/**
 * 获取快手 AI 服务密钥
 */
export const getKuaiziToken = () => DEFAULT_KUAIZI_TOKEN;

/**
 * 获取 Yunwu AI 服务密钥
 */
export const getYunwuToken = () => DEFAULT_YUNWU_TOKEN;

// ===================== Jikeing Token 管理 =====================
const JIKEING_TOKEN_KEY = "jikeing_token";
const JIKEING_USER_ID_KEY = "jikeing_user_id";

export function getJikeingToken(): string {
  return localStorage.getItem(JIKEING_TOKEN_KEY) || "";
}

export function setJikeingToken(token: string): void {
  localStorage.setItem(JIKEING_TOKEN_KEY, token);
}

export function clearJikeingToken(): void {
  localStorage.removeItem(JIKEING_TOKEN_KEY);
}

export function getJikeingUserId(): string {
  return localStorage.getItem(JIKEING_USER_ID_KEY) || "";
}

export function setJikeingUserId(userId: string | number): void {
  localStorage.setItem(JIKEING_USER_ID_KEY, String(userId));
}

export function clearJikeingUserId(): void {
  localStorage.removeItem(JIKEING_USER_ID_KEY);
}

// ===================== 环境检测与基础URL配置 =====================

/**
 * 检测是否在 Electron 环境中运行
 */
export const isElectron = (): boolean => {
  if (typeof window !== "undefined" && (window as any).electron) {
    console.log("[isElectron] detected via window.electron");
    return true;
  }
  if (
    typeof navigator !== "undefined" &&
    navigator.userAgent.toLowerCase().includes("electron")
  ) {
    console.log("[isElectron] detected via userAgent");
    return true;
  }
  return false;
};

/**
 * 获取基础 URL
 * - Electron 环境：使用完整的 API 地址
 * - Web 环境：使用相对路径（由 Vite 代理或 Nginx 代理处理）
 */
export const getBaseURL = (apiPath: string): string => {
  const electronMode = isElectron();
  console.log("[getBaseURL] apiPath:", apiPath, "| isElectron:", electronMode);

  if (electronMode) {
    const apiServers: Record<string, string> = {
      ai: "https://toapis.com",
      zeakai: "https://zeakai-api.api4midjourney.com",
      kuaizi: "https://aiopenapi.kuaizi.cn/ai-open-platform-api/v1",
    };
    return apiServers[apiPath] || "/";
  }
  return "/";
};

// ===================== Gemini 请求体类型 =====================

// Gemini 请求体类型定义
export interface GeminiYwRequestBody {
  contents: {
    parts: {
      text?: string;
      inline_data?: {
        mime_type: string;
        data: string;
      };
    }[];
  }[];
  generationConfig: {
    responseModalities: string[];
  };
}

/**
 * 构造 Gemini 3 Pro 渠道二 请求体
 * @param imageBase64s 参考图 Base64 字符串列表（支持带 data URI 前缀）
 * @param prompt 文本提示词
 * @returns GeminiYwRequestBody
 */
export function buildGeminiYwRequestBody(
  imageBase64s: string[],
  prompt: string,
): GeminiYwRequestBody {
  const parts: any[] = imageBase64s.map((base64) => {
    let mimeType = "image/jpeg";
    let data = base64;

    const dataUriMatch = base64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (dataUriMatch) {
      mimeType = dataUriMatch[1];
      data = dataUriMatch[2];
    }

    return {
      inline_data: {
        mime_type: mimeType,
        data: data,
      },
      text: prompt,
    };
  });

  if (parts.length === 0) {
    parts.push({
      text: prompt,
    });
  }

  return {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["IMAGE"],
    },
  };
}
