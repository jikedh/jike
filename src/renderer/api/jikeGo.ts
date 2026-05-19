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

// 健康检查
export function healthCheck(): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/health",
    method: "get",
  });
}

// 桌面代理健康检查
export function desktopProxyHealthCheck(): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/desktop/v1/health",
    method: "get",
  });
}

// 创建桌面代理任务
export async function createDesktopProxyTask(
  data: DesktopProxyRequest,
  signal?: AbortSignal,
): Promise<any> {
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
export async function queryDesktopProxyTask(data: DesktopProxyRequest): Promise<any> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/desktop/v1/ai/task/query",
    method: "post",
    data,
    headers: getJikeGoAiProxyHeaders(),
  });
}

// 桌面聊天
export async function createDesktopChatCompletions(
  data: DesktopChatCompletionsRequest,
  signal?: AbortSignal,
): Promise<any> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/desktop/v1/ai/chat/completions",
    method: "post",
    data,
    signal,
    headers: getJikeGoAiProxyHeaders(),
  });
}

// 获取数字验证码
export function getDigitalCaptcha(): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/captcha/digital",
    method: "post",
    data: {},
  });
}

// 注册（用户名密码）
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

// 登录（用户名密码）
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

// 获取场景二维码
export function getSceneQrcode(): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/user/get-scene-qrcode",
    method: "get",
  });
}

// 查询场景状态
export function querySceneStatus(sceneId: string): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/user/query-scene-status",
    method: "get",
    params: { scene_id: sceneId },
  });
}

// 获取用户信息
export function getJikeGoUserInfo(): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/user/info",
    method: "get",
    headers: getJikeGoAuthHeaders(),
  });
}

// 更新用户信息
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

// 获取积分余额
export function getJikeGoScoreBalance(): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/score/balance-info",
    method: "get",
    headers: getJikeGoAuthHeaders(),
  });
}

// 获取积分记录
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

// 获取积分交易记录
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

// 获取 OSS 上传地址
export function getOssPutUrl(data: OssPutUrlRequest): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/oss/put-url",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}

// 上传文件到 OSS
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

// 获取 OSS 预签名上传地址
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

// Rhart Image G2 文生图
export function createRhartImageG2TextToImage(data: RunningHubTextToImageRequest): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/runninghub/rhart-image-g-2/text-to-image",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}

// Rhart Image G2 官方文生图
export function createRhartImageG2OfficialTextToImage(data: RunningHubTextToImageRequest): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/runninghub/rhart-image-g-2-official/text-to-image",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}

// Rhart Image N Pro 文生图
export function createRhartImageNProTextToImage(data: RunningHubTextToImageRequest): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/runninghub/rhart-image-n-pro/text-to-image",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}

// Rhart Image N Pro 官方文生图
export function createRhartImageNProOfficialTextToImage(data: RunningHubTextToImageRequest): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/runninghub/rhart-image-n-pro-official/text-to-image",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}

// Rhart Image G2 图生图
export function createRhartImageG2ImageToImage(data: RunningHubImageToImageRequest): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/runninghub/rhart-image-g-2/image-to-image",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}

// Rhart Image G2 官方图生图
export function createRhartImageG2OfficialImageToImage(data: RunningHubImageToImageRequest): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/runninghub/rhart-image-g-2-official/image-to-image",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}

// Rhart Image N Pro 图生图
export function createRhartImageNProImageToImage(data: RunningHubImageToImageRequest): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/runninghub/rhart-image-n-pro/image-to-image",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}

// Rhart Image N Pro 官方图生图
export function createRhartImageNProOfficialImageToImage(data: RunningHubImageToImageRequest): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/runninghub/rhart-image-n-pro-official/image-to-image",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}

// Rhart Image N Pro 编辑
export function createRhartImageNProEdit(data: RunningHubImageToImageRequest): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/runninghub/rhart-image-n-pro/edit",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}

// Rhart Image N Pro 官方编辑
export function createRhartImageNProOfficialEdit(data: RunningHubImageToImageRequest): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/runninghub/rhart-image-n-pro-official/edit",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}

// 查询 RunningHub V2 任务状态
export function queryRunningHubV2Task(data: QueryRunningHubV2TaskRequest): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/runninghub/query",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}
