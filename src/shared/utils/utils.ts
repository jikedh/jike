import { computePosition, flip, shift } from "@floating-ui/dom";
import { posToDOMRect } from "@tiptap/react";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 中文数字常量 */
const CHINESE_DIGITS = [
  "零",
  "一",
  "二",
  "三",
  "四",
  "五",
  "六",
  "七",
  "八",
  "九",
];

/**
 * 将数字转成中文数字（支持 1~99），用于"图片一/图片二"标签
 * @param num 要转换的数字（支持 1~99）
 * @returns 中文数字字符串，如 1 -> "一"，15 -> "十五"
 */
export const toChineseNumber = (num: number): string => {
  if (num <= 10) {
    return num === 10 ? "十" : CHINESE_DIGITS[num];
  }

  if (num < 20) {
    return `十${CHINESE_DIGITS[num % 10]}`;
  }

  if (num < 100) {
    const ten = Math.floor(num / 10);
    const one = num % 10;
    return `${CHINESE_DIGITS[ten]}十${one === 0 ? "" : CHINESE_DIGITS[one]}`;
  }

  return `${num}`;
};

/**
 * 从 mention 节点属性中获取标签文本
 * @param attrs mention 节点属性，包含 id、label、value
 * @returns 标签文本，优先返回 label，其次 value，最后 id
 */
export const getMentionLabel = (attrs: {
  id?: string;
  label?: string;
  value?: string;
}): string => {
  return attrs.label || attrs.value || attrs.id || "";
};

/**
 * 使用 Floating UI 更新 suggestion 下拉列表位置
 * @param editor Tiptap 编辑器实例
 * @param element 需要定位的 DOM 元素
 */
export const updateSuggestionPosition = (
  editor: { view: any; state: { selection: { from: number; to: number } } },
  element: HTMLElement,
) => {
  // 创建虚拟元素（光标位置）
  const virtualElement = {
    getBoundingClientRect: () =>
      posToDOMRect(
        editor.view,
        editor.state.selection.from,
        editor.state.selection.to,
      ),
  };

  // 计算位置
  computePosition(virtualElement, element, {
    placement: "bottom-start",
    strategy: "absolute",
    middleware: [shift(), flip()],
  }).then(({ x, y, strategy }) => {
    element.style.width = "max-content";
    element.style.minWidth = "240px";
    element.style.maxWidth = "320px";
    element.style.position = strategy;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  });
};

/**
 * Seedance 2.0 时长裁剪工具函数。
 * fast 模式：4-12 秒；pro 模式：4-15 秒。
 */
export const clampSeedance20Duration = (
  value: number,
  mode: "fast" | "pro",
) => {
  const min = 4;
  const max = mode === "pro" ? 15 : 12;
  return Math.min(Math.max(value, min), max);
};

/**
 * 从网络 URL 下载图片
 * @param imageUrl 图片 URL
 * @param filename 可选的文件名，如果不提供则从 URL 自动提取或使用时间戳生成
 * @throws 网络错误或下载失败时抛出错误
 */
export async function downloadImageFromUrl(
  imageUrl: string,
  filename?: string,
): Promise<void> {
  try {
    const response = await fetch(imageUrl, { mode: "cors" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const blob = await response.blob();

    let finalFilename = filename;

    if (!finalFilename) {
      try {
        const url = new URL(imageUrl);
        const pathname = url.pathname;
        const basename = pathname.split("/").pop();

        if (basename && basename.includes(".")) {
          finalFilename = basename;
        }
      } catch { }

      if (!finalFilename) {
        const ext = blob.type.split("/")[1] || "jpg";
        finalFilename = `image-${Date.now()}.${ext}`;
      }
    }

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = finalFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(objectUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    throw new Error(`下载失败: ${message}`);
  }
}

const videoThumbnailCache = new Map<string, string>();

export const getVideoThumbnail = (videoUrl: string): Promise<string> => {
  if (videoThumbnailCache.has(videoUrl)) {
    return Promise.resolve(videoThumbnailCache.get(videoUrl)!);
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.currentTime = 0.1;

    const cleanup = () => {
      video.src = "";
      video.load();
      video.remove();
    };

    video.onloadeddata = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnail = canvas.toDataURL("image/jpeg", 0.7);
          videoThumbnailCache.set(videoUrl, thumbnail);
          resolve(thumbnail);
        } else {
          reject(new Error("无法创建 canvas 上下文"));
        }
      } catch (err) {
        reject(err);
      } finally {
        cleanup();
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("视频加载失败"));
    };

    video.onabort = () => {
      cleanup();
      reject(new Error("视频加载被中止"));
    };

    video.src = videoUrl;
    video.load();
  });
};

// ===================== 写死的 API 密钥 =====================

// AI 服务密钥
const DEFAULT_AI_TOKEN = "sk-Bml1blU1ls8acOmj7kOdHIs4ZHQViS1asg1teky509zbTdrx";

// ZeakAI 服务密钥
const DEFAULT_ZEAKAI_TOKEN = "df3ddeb9-45da-4eb7-b49a-8ab32c8e4ebb";

// 快手 AI 服务密钥
const DEFAULT_KUAIZI_TOKEN = "kz-XyWCfLd8q784ybb6PVo6OuDb2rkRJ8ShiCZNcvnus0";

// Yunwu AI 服务密钥
const DEFAULT_YUNWU_TOKEN =
  "sk-BNkrD8Sfje36v0dbgVQDIVmfE8F4NV9A06zG9btQx9I1fwf5";

// 阿里云百炼 API 密钥
const DEFAULT_DASHSCOPE_TOKEN = "sk-d0f8647ea2c64c789ceef1c4a50ddf95";

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

/**
 * 获取阿里云百炼服务密钥
 */
export const getDashscopeToken = () => DEFAULT_DASHSCOPE_TOKEN;

// ===================== Jikeing Token 管理 =====================
const JIKEING_TOKEN_KEY = "jikeing_token";
const JIKEING_USER_ID_KEY = "jikeing_user_id";
const JIKEING_USER_INFO_KEY = "jikeing_user_info";

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

/**
 * 获取完整的用户信息对象
 */
export function getJikeingUserInfo(): Record<string, any> | null {
  const info = localStorage.getItem(JIKEING_USER_INFO_KEY);
  if (!info) return null;
  try {
    return JSON.parse(info);
  } catch {
    return null;
  }
}

/**
 * 存储完整的用户信息对象
 */
export function setJikeingUserInfo(userInfo: Record<string, any>): void {
  localStorage.setItem(JIKEING_USER_INFO_KEY, JSON.stringify(userInfo));
  // 同步展示用用户标识，优先使用 uuid，兼容只有 id 的登录响应
  const userId = userInfo.uuid ?? userInfo.id;
  if (userId) {
    localStorage.setItem(JIKEING_USER_ID_KEY, String(userId));
  }
}

/**
 * 清除用户信息
 */
export function clearJikeingUserInfo(): void {
  localStorage.removeItem(JIKEING_USER_INFO_KEY);
}

// ===================== 环境检测与基础URL配置 =====================

/**
 * 检测是否在 Electron 环境中运行
 */
export const isElectron = (): boolean => {
  if (typeof window !== "undefined" && (window as any).electron) {
    return true;
  }
  if (
    typeof navigator !== "undefined" &&
    navigator.userAgent.toLowerCase().includes("electron")
  ) {
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
