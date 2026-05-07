export type XimuTaskStatus =
  | "pending"
  | "running"
  | "processing"
  | "succeeded"
  | "failed"
  | string;

export interface XimuBaseImageRequest {
  cardCode: string;
  prompt: string;
  urls: string[];
  shutProgress: boolean;
}

export interface XimuTaskSubmitPayload {
  id?: string;
  status?: XimuTaskStatus;
  [key: string]: unknown;
}

export interface XimuTaskSubmitResponse {
  data?: XimuTaskSubmitPayload;
  id?: string;
  status?: XimuTaskStatus;
  message?: string;
  msg?: string;
  error?: string;
  [key: string]: unknown;
}

export interface XimuTaskResultPayload {
  id?: string;
  status?: XimuTaskStatus;
  url?: string;
  imageUrl?: string;
  image_url?: string;
  output?: string | string[] | { url?: string; imageUrl?: string };
  images?: Array<string | { url?: string; imageUrl?: string }>;
  results?: Array<string | { url?: string; imageUrl?: string }>;
  urls?: string[];
  result?: unknown;
  data?: unknown;
  error?: string;
  failure_reason?: string;
  message?: string;
  msg?: string;
  [key: string]: unknown;
}

export interface XimuTaskResultResponse {
  code?: number;
  data?: XimuTaskResultPayload;
  status?: XimuTaskStatus;
  url?: string;
  imageUrl?: string;
  image_url?: string;
  output?: XimuTaskResultPayload["output"];
  images?: XimuTaskResultPayload["images"];
  results?: XimuTaskResultPayload["results"];
  urls?: string[];
  result?: unknown;
  error?: string;
  failure_reason?: string;
  message?: string;
  msg?: string;
  [key: string]: unknown;
}

export interface XimuCardBalanceResponse {
  data?: {
    balanceCredits?: number | string;
    [key: string]: unknown;
  };
  balanceCredits?: number | string;
  message?: string;
  msg?: string;
  error?: string;
  [key: string]: unknown;
}

export const XIMU_TASK_SUCCESS_STATUSES = ["succeeded"] as const;
export const XIMU_TASK_FAILED_STATUSES = ["failed"] as const;

export const normalizeXimuUrls = (urls?: readonly string[]) =>
  Array.from(new Set((urls ?? []).map((url) => url.trim()).filter(Boolean)));

export const extractXimuTaskId = (response: XimuTaskSubmitResponse) => {
  const payload = response?.data ?? response;
  return String(payload?.id || response?.id || "");
};

export const getXimuResultPayload = (response: XimuTaskResultResponse) =>
  (response?.data ?? response) as Record<string, unknown>;

export const getXimuMessage = (response: unknown) => {
  if (!response || typeof response !== "object") {
    return "";
  }

  const record = response as Record<string, any>;
  const payload =
    record.data && typeof record.data === "object" ? record.data : undefined;
  return String(
    payload?.error ||
      payload?.failure_reason ||
      payload?.message ||
      payload?.msg ||
      record.error ||
      record.failure_reason ||
      record.message ||
      record.msg ||
      "",
  );
};

export const collectXimuImageUrls = (source: unknown): string[] => {
  if (!source) {
    return [];
  }
  if (typeof source === "string") {
    return /^https?:\/\//i.test(source) || /^data:image\//i.test(source)
      ? [source]
      : [];
  }
  if (Array.isArray(source)) {
    return source.flatMap(collectXimuImageUrls);
  }
  if (typeof source !== "object") {
    return [];
  }

  const record = source as Record<string, unknown>;
  return [
    record.url,
    record.imageUrl,
    record.image_url,
    record.output,
    record.images,
    record.results,
    record.urls,
    record.result,
    record.data,
  ].flatMap(collectXimuImageUrls);
};
