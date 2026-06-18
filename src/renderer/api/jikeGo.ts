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

// ===================== 画质增强相关 =====================

export type VideoEnhanceScene = "aigc" | "short_series" | "ugc" | "old_film";
export type VideoEnhanceToolVersion = "standard" | "professional";
export type VideoEnhanceResolution = "720p" | "1080p" | "2k" | "4k";
export type VideoEnhanceStatus = "running" | "succeeded" | "failed";

export type CreateVideoEnhanceTaskRequest = {
  video_url: string;
  video_duration: number;
  scene?: VideoEnhanceScene;
  tool_version?: VideoEnhanceToolVersion;
  resolution?: VideoEnhanceResolution;
  resolution_limit?: number;
  fps?: number;
};

export type QueryVideoEnhanceTaskRequest = {
  task_id: string;
};

export type VideoEnhanceTaskResponse = {
  task_id: string;
  status: VideoEnhanceStatus;
  video_url?: string;
  error?: string;
  duration_ms?: number;
  output_resolution?: string;
  output_fps?: number;
  tool_version?: string;
  score_cost?: number;
  for_score_cost?: number;
  vip_score_cost?: number;
};

export type EstimateEnhanceCostRequest = {
  tool_version?: VideoEnhanceToolVersion;
  resolution?: VideoEnhanceResolution;
  resolution_limit?: number;
  fps?: number;
  video_duration?: number;
};

export type EstimateEnhanceCostResponse = {
  score_cost: number;
  tool_version: string;
  resolution: string;
  video_duration: number;
  score_per_yuan: number;
  effective_fps: number;
};

export type DesktopProxyScoreBizType = "image" | "video" | "runninghub_v2";

export type DesktopProxyRequest = {
  platform: DesktopProxyPlatform;
  upstreamPath: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, any>;
  headers?: Record<string, string>;
  body?: any;
  scoreCost?: number;
  scoreBizType?: DesktopProxyScoreBizType;
  scoreModel?: string;
  scoreSource?: string;
  scoreSourceLabel?: string;
  scoreTaskId?: string;
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

export type UploadOssBlobType = "image" | "video" | "audio";

export type OssPutUrlRequest = {
  blob_type: OssBlobType;
  ext?: string;
};

export type UploadOssPutUrlRequest = {
  blob_type: UploadOssBlobType;
  ext?: string;
  content_type?: string;
  /** 预签名 URL 有效期（秒），默认 3600，最大 86400 */
  ttl?: number;
};

export type UploadOssPutUrlResp = {
  put_url: string;
  headers: Record<string, string>;
  access_url: string;
  key: string;
  /** 实际签名有效期（秒） */
  ttl?: number;
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

export function resetPassword(data: {
  username: string;
  password: string;
  captcha_id: string;
  captcha_answer: string;
}): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/user/reset-password",
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

export type RunningHubNodeInfo = {
  nodeId: string;
  fieldName: string;
  fieldValue: string;
};

export type CreateRunningHubTaskRequest = {
  workflowId: string;
  instanceType?: string;
  nodeInfoList: RunningHubNodeInfo[];
};

export type CreateRunningHubTaskResponse = {
  taskId: string;
  taskStatus: string;
};

export type PollRunningHubTaskRequest = {
  taskId: string;
};

export type RunningHubOutputItem = {
  fileUrl: string;
  fileType: string;
  taskCostTime: string;
  nodeId: string;
};

export type PollRunningHubTaskResponse = {
  taskStatus: string;
  outputs: RunningHubOutputItem[];
};
export type RunningHubTextToImageRequest = {
  prompt: string;
  aspectRatio?: string;
  resolution?: string;
  quality?: string;
  /** 本次操作预计消耗的积分值，传入后将由后端进行积分扣减 */
  scoreCost?: number;
};
export type RunningHubImageToImageRequest = RunningHubTextToImageRequest & {
  imageUrls: string[];
};
export type QueryRunningHubV2TaskRequest = {
  taskId: string;
};

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

// ===================== 画质增强相关 API =====================

/**
 * 发起画质增强任务
 * POST /v1/ai/video-enhance/create-task
 */
export function createVideoEnhanceTask(
  data: CreateVideoEnhanceTaskRequest,
): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/ai/video-enhance/create-task",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}

/**
 * 预估画质增强积分消耗
 * POST /v1/ai/video-enhance/estimate-cost
 */
export function estimateVideoEnhanceCost(
  data: EstimateEnhanceCostRequest,
): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/ai/video-enhance/estimate-cost",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}

/**
 * 查询画质增强任务状态
 * POST /v1/ai/video-enhance/query-task
 */
export function queryVideoEnhanceTask(
  data: QueryVideoEnhanceTaskRequest,
): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/ai/video-enhance/query-task",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}

// ===================== 去字幕相关 =====================

export type WuhenRemovalRect = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type CreateWuhenRemovalRequest = {
  video_url: string;
  upload_url: string;
  upload_headers?: Record<string, string>;
  model?: "video_removal_std" | "video_removal_pro";
  method?: "all_area" | "sel_area";
  rect?: WuhenRemovalRect;
  duration: number; // 视频时长（秒），用于计算积分
};

export type CreateWuhenRemovalResponse = {
  task_id: string;
  score_cost: number;
  for_score_cost?: number;
  vip_score_cost?: number;
};

export type QueryWuhenRemovalRequest = {
  task_id: string;
};

export type WuhenRemovalStatus = "running" | "succeeded" | "failed";

export type QueryWuhenRemovalResponse = {
  task_id: string;
  status: WuhenRemovalStatus;
  progress: number;
  video_url?: string;
  error?: string;
  score_cost?: number;
};

/**
 * 创建去字幕任务
 * POST /v1/ai/wuhen/removal/create
 */
export function createWuhenRemovalTask(
  data: CreateWuhenRemovalRequest,
): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/ai/wuhen/removal/create",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}

/**
 * 查询去字幕任务状态
 * POST /v1/ai/wuhen/removal/query
 */
export function queryWuhenRemovalTask(
  data: QueryWuhenRemovalRequest,
): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/ai/wuhen/removal/query",
    method: "post",
    data,
    headers: getJikeGoAuthHeaders(),
  });
}

// ===================== 公告相关 =====================

export type AnnouncementItem = {
  id: string;
  created_time: string;
  update_time: string;
  title: string;
  content: string;
  publisher_id: number;
  is_pinned: boolean;
  is_valid: number;
};

export type AnnouncementListResponse = {
  total: number;
  list: AnnouncementItem[];
};

/**
 * 获取公告列表（公开接口，无需登录）
 * GET /v1/announcement/list
 */
export function getAnnouncementList(): any {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/announcement/list",
    method: "get",
  });
}
