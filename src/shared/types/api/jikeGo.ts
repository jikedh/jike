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
};

export type RunningHubImageToImageRequest = RunningHubTextToImageRequest & {
  imageUrls: string[];
};

export type QueryRunningHubV2TaskRequest = {
  taskId: string;
};
