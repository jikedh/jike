import { jikeingService } from "service/aiRequest";
import type {
  CreateRunningHubTaskRequest,
  DesktopChatCompletionsRequest,
  DesktopProxyRequest,
  DesktopProxyScoreBizType,
  OssPutUrlRequest,
  PollRunningHubTaskRequest,
  QueryRunningHubV2TaskRequest,
  RunningHubImageToImageRequest,
  RunningHubTextToImageRequest,
  UploadOssPutUrlRequest,
} from "shared/types/api/jikeGo";
import {
  getJikeGoAiProxyHeaders,
  getJikeGoAuthHeaders,
  JIKE_GO_BASE_URL,
} from "shared/utils/jikeGo";
export type {
  CreateRunningHubTaskRequest,
  CreateRunningHubTaskResponse,
  DesktopChatCompletionsRequest,
  DesktopProxyPlatform,
  DesktopProxyRequest,
  DesktopProxyScoreBizType,
  OssBlobType,
  OssPutUrlRequest,
  OssUploadResp,
  PollRunningHubTaskRequest,
  PollRunningHubTaskResponse,
  QueryRunningHubV2TaskRequest,
  RunningHubImageToImageRequest,
  RunningHubNodeInfo,
  RunningHubOutputItem,
  RunningHubTextToImageRequest,
  UploadOssBlobType,
  UploadOssPutUrlRequest,
  UploadOssPutUrlResp,
} from "shared/types/api/jikeGo";

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
  meta?: {
    scoreModel?: string;
    scoreSource?: string;
    scoreSourceLabel?: string;
    scoreTaskId?: string;
    generateTime?: number;
  },
): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/desktop/v1/ai/score/confirm",
    method: "post",
    data: { ledgerBizId, scoreBizType, ...meta },
    headers: getJikeGoAiProxyHeaders(),
  });
}

// 退还积分
export function refundDesktopProxyScore(
  ledgerBizId: string,
  reason?: string,
  scoreBizType: DesktopProxyScoreBizType = "video",
  meta?: {
    scoreModel?: string;
    scoreSource?: string;
    scoreSourceLabel?: string;
    scoreTaskId?: string;
  },
): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/desktop/v1/ai/score/refund",
    method: "post",
    data: { ledgerBizId, reason, scoreBizType, ...meta },
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

export function getJikeGoScoreRecords(params?: {
  page?: number;
  pageSize?: number;
}): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/score/records",
    method: "get",
    params,
    headers: getJikeGoAuthHeaders(),
  });
}

export function getJikeGoScoreTransactions(params?: {
  page?: number;
  pageSize?: number;
}): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/score/transactions",
    method: "get",
    params,
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

// UploadOss 预签名上传：获取预签名 PUT URL
export function getUploadOssPutUrl(data: UploadOssPutUrlRequest): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/oss/upload-put-url",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}

// ============== RunningHub 视频工作流 ==============

// 创建 RunningHub 工作流任务
export function createRunningHubTask(data: CreateRunningHubTaskRequest): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/runninghub/create",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}

// 轮询 RunningHub 任务状态和输出
export function pollRunningHubTask(data: PollRunningHubTaskRequest): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/runninghub/poll",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}

export function createRhartImageG2TextToImage(data: RunningHubTextToImageRequest): any {
  return createRunningHubV2TextToImage("/v1/runninghub/rhart-image-g-2/text-to-image", data);
}
export function createRhartImageG2OfficialTextToImage(data: RunningHubTextToImageRequest): any {
  return createRunningHubV2TextToImage("/v1/runninghub/rhart-image-g-2-official/text-to-image", data);
}
export function createRhartImageNProTextToImage(data: RunningHubTextToImageRequest): any {
  return createRunningHubV2TextToImage("/v1/runninghub/rhart-image-n-pro/text-to-image", data);
}
export function createRhartImageNProOfficialTextToImage(data: RunningHubTextToImageRequest): any {
  return createRunningHubV2TextToImage("/v1/runninghub/rhart-image-n-pro-official/text-to-image", data);
}
export function createRhartImageG2ImageToImage(data: RunningHubImageToImageRequest): any {
  return createRunningHubV2ImageToImage("/v1/runninghub/rhart-image-g-2/image-to-image", data);
}
export function createRhartImageG2OfficialImageToImage(data: RunningHubImageToImageRequest): any {
  return createRunningHubV2ImageToImage("/v1/runninghub/rhart-image-g-2-official/image-to-image", data);
}
export function createRhartImageNProImageToImage(data: RunningHubImageToImageRequest): any {
  return createRunningHubV2ImageToImage("/v1/runninghub/rhart-image-n-pro/image-to-image", data);
}
export function createRhartImageNProOfficialImageToImage(data: RunningHubImageToImageRequest): any {
  return createRunningHubV2ImageToImage("/v1/runninghub/rhart-image-n-pro-official/image-to-image", data);
}
export function createRhartImageNProEdit(data: RunningHubImageToImageRequest): any {
  return createRunningHubV2ImageToImage("/v1/runninghub/rhart-image-n-pro/edit", data);
}
export function createRhartImageNProOfficialEdit(data: RunningHubImageToImageRequest): any {
  return createRunningHubV2ImageToImage("/v1/runninghub/rhart-image-n-pro-official/edit", data);
}
export function queryRunningHubV2Task(data: QueryRunningHubV2TaskRequest): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/runninghub/query",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}
function createRunningHubV2TextToImage(url: string, data: RunningHubTextToImageRequest): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url,
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}
function createRunningHubV2ImageToImage(url: string, data: RunningHubImageToImageRequest): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url,
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}
