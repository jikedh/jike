import { isAxiosError } from "axios";

const LOCAL_GEMINI_FATAL_ERROR_PATTERNS = [
  /没有可用的Token进行图片生成/i,
  /Failed to obtain reCAPTCHA token/i,
  /reCAPTCHA evaluation failed/i,
  /\b503\b/i,
  /\bUNAVAILABLE\b/i,
  /Flow2API exited with code/i,
];

const LOCAL_GEMINI_FALLBACK_PATTERNS = [
  /共享标签页池不可用/i,
  /fallback 到传统模式/i,
  /fallback to legacy mode/i,
];

const normalizeString = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (value == null) {
    return "";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const getLocalGeminiErrorText = (error: unknown): string => {
  if (isAxiosError(error)) {
    const responseData = error.response?.data;
    const serverMessage =
      responseData?.message ??
      responseData?.msg ??
      responseData?.error ??
      responseData?.detail;
    const combined = [error.message, normalizeString(serverMessage)]
      .filter(Boolean)
      .join("\n");

    if (combined) {
      return combined;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return normalizeString(error);
};

export const isLocalGeminiFallbackModeMessage = (message: string): boolean =>
  LOCAL_GEMINI_FALLBACK_PATTERNS.some((pattern) => pattern.test(message));

export const isLocalGeminiFatalBatchError = (error: unknown): boolean => {
  const message = getLocalGeminiErrorText(error);
  return LOCAL_GEMINI_FATAL_ERROR_PATTERNS.some((pattern) => pattern.test(message));
};

export const normalizeLocalGeminiErrorDetail = (message: string): string => {
  if (!message) {
    return "本地 Gemini 生成失败，请稍后重试。";
  }

  if (isLocalGeminiFallbackModeMessage(message)) {
    return "Flow2API 的内置浏览器共享池当前不可用，已退回临时标签页模式。出现浏览器弹窗属于降级行为，请降低生成频率后重试。";
  }

  if (/没有可用的Token进行图片生成/i.test(message)) {
    return "Flow2API 当前没有可用的图片 Token。请检查 Token 是否处于禁用、冷却、锁定或过期状态。";
  }

  if (/Failed to obtain reCAPTCHA token/i.test(message)) {
    return "Flow2API 获取 reCAPTCHA token 失败。请检查内置浏览器、代理和 Google 风控状态后重试。";
  }

  if (/reCAPTCHA evaluation failed/i.test(message)) {
    return "Google 风控校验未通过。请降低提交频率，并检查代理、账号和内置浏览器状态。";
  }

  if (/Flow2API exited with code/i.test(message)) {
    return "Flow2API 本地服务意外退出，请先重启本地 Gemini 服务后再试。";
  }

  return message;
};
