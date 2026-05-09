import { jikeingService, SKIP_AUTH_HEADER } from "service/aiRequest";
import { getJikeingToken } from "shared/utils/utils";

const JIKE_GO_BASE_URL =
  import.meta.env.VITE_JIKE_GO_BASE_URL || "http://localhost:9181";

const getJikeGoAuthHeaders = () => {
  const token = getJikeingToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const getJikeGoAiProxyHeaders = () => ({
  ...getJikeGoAuthHeaders(),
  [SKIP_AUTH_HEADER]: "true",
});

export type DesktopProxyPlatform =
  | "kuaizi"
  | "dashscope"
  | "toapi"
  | "zeakai"
  | "yunwu";

export type DesktopProxyScoreBizType = "image" | "video";

export type DesktopProxyRequest = {
  platform: DesktopProxyPlatform;
  upstreamPath: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, any>;
  headers?: Record<string, string>;
  body?: any;
  scoreCost?: number;
  scoreBizType?: DesktopProxyScoreBizType;
};

export type DesktopChatCompletionsRequest = {
  platform: Extract<DesktopProxyPlatform, "dashscope" | "toapi">;
  upstreamPath?: string;
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    name?: string;
  }>;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  [key: string]: any;
};

export type OssBlobType = "avatar" | "image" | "video";

export type OssPutUrlRequest = {
  blob_type: OssBlobType;
  ext?: string;
};

export type OssUploadResp = {
  url: string;
  key: string;
  filename: string;
  size: number;
  content_type: string;
};

export function healthCheck(): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/health",
    method: "get",
  });
}

// 健康检查
export function desktopProxyHealthCheck(): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/desktop/v1/health",
    method: "get",
  });
}

// 创建桌面代理任务
export function createDesktopProxyTask(
  data: DesktopProxyRequest,
  signal?: AbortSignal,
): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/desktop/v1/ai/generation/proxy",
    method: "post",
    data,
    signal,
    headers: getJikeGoAiProxyHeaders(),
  });
}

// 确认积分扣减
export function confirmDesktopProxyScore(
  ledgerBizId: string,
  scoreBizType: DesktopProxyScoreBizType = "video",
): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/desktop/v1/ai/score/confirm",
    method: "post",
    data: { ledgerBizId, scoreBizType },
    headers: getJikeGoAiProxyHeaders(),
  });
}

// 退还积分
export function refundDesktopProxyScore(
  ledgerBizId: string,
  reason?: string,
  scoreBizType: DesktopProxyScoreBizType = "video",
): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/desktop/v1/ai/score/refund",
    method: "post",
    data: { ledgerBizId, reason, scoreBizType },
    headers: getJikeGoAiProxyHeaders(),
  });
}

// 查询桌面代理任务状态
export function queryDesktopProxyTask(data: DesktopProxyRequest): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/desktop/v1/ai/task/query",
    method: "post",
    data,
    headers: getJikeGoAiProxyHeaders(),
  });
}

// 聊天用的接口
export function createDesktopChatCompletions(
  data: DesktopChatCompletionsRequest,
  signal?: AbortSignal,
): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/desktop/v1/ai/chat/completions",
    method: "post",
    data,
    signal,
    headers: getJikeGoAiProxyHeaders(),
  });
}

export function getDigitalCaptcha(): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/captcha/digital",
    method: "post",
    data: {},
  });
}

export function registerByUsername(data: {
  username: string;
  password: string;
  captcha_id: string;
  captcha_answer: string;
}): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/user/register",
    method: "post",
    data,
  });
}

export function loginByUsername(data: {
  username: string;
  password: string;
  captcha_id: string;
  captcha_answer: string;
}): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/user/login/byUsername",
    method: "post",
    data,
  });
}

export function getSceneQrcode(): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/user/get-scene-qrcode",
    method: "get",
  });
}

export function querySceneStatus(sceneId: string): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/user/query-scene-status",
    method: "get",
    params: { scene_id: sceneId },
  });
}

export function getJikeGoUserInfo(): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/user/info",
    method: "get",
    headers: getJikeGoAuthHeaders(),
  });
}

export function updateJikeGoUserInfo(data: {
  nickname: string;
  avatar: string;
}): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/user/info",
    method: "put",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}

export function getJikeGoScoreBalance(): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/score/balance-info",
    method: "get",
    headers: getJikeGoAuthHeaders(),
  });
}

export function getOssPutUrl(data: OssPutUrlRequest): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/oss/put-url",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}

export function uploadOssFile(file: File): any {
  const formData = new FormData();
  formData.append("file", file);

  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/oss/upload",
    method: "post",
    data: formData,
    headers: getJikeGoAuthHeaders(),
  });
}
