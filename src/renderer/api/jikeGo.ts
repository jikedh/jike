import { jikeingService } from "service/aiRequest";
import { getJikeingToken } from "shared/utils/utils";

const JIKE_GO_BASE_URL =
  import.meta.env.VITE_JIKE_GO_BASE_URL || "http://localhost:9181";

const getJikeGoAuthHeaders = () => {
  const token = getJikeingToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export type DesktopProxyPlatform =
  | "kuaizi"
  | "dashscope"
  | "toapi"
  | "zeakai"
  | "yunwu";

export type DesktopProxyRequest = {
  platform: DesktopProxyPlatform;
  upstreamPath: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, any>;
  headers?: Record<string, string>;
  body?: any;
};

export type DesktopChatCompletionsRequest = {
  platform: Extract<DesktopProxyPlatform, "dashscope" | "toapi">;
  upstreamPath?: string;
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  [key: string]: any;
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
export function createDesktopProxyTask(data: DesktopProxyRequest): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/desktop/v1/ai/generation/proxy",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}

// 查询桌面代理任务状态
export function queryDesktopProxyTask(data: DesktopProxyRequest): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/desktop/v1/ai/task/query",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}

// 聊天用的接口
export function createDesktopChatCompletions(
  data: DesktopChatCompletionsRequest,
): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/desktop/v1/ai/chat/completions",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
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
