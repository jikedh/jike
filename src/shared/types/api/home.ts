/**
 * 首页模块类型定义
 */

// ===================== 微信扫码登录 =====================

/** 获取场景二维码响应 */
export interface GetSceneQrcodeResponse {
  scene_id: string;
  qrcode_image: string;
}

/** 查询扫码状态请求 */
export interface QuerySceneStatusRequest {
  scene_id: string;
}

/** 查询扫码状态响应 */
export interface QuerySceneStatusResponse {
  status: "pending" | "scanned" | "confirmed" | "expired";
  token?: string;
  userInfo?: {
    id: string;
    nickname: string;
    avatar: string;
  };
}

// ===================== 学员信息 =====================

/** 绑定学员信息请求 */
export interface StudentInfoRequest {
  realName: string;
  studentNo: string;
  school: string;
}

// ===================== AI 任务相关 =====================

/** 提交 AI 生成任务请求 */
export interface CommitAiTaskRequest {
  type: string;
  model: string;
  prompt: string;
  params?: Record<string, any>;
}

/** AI 任务列表项 */
export interface AiTaskListItem {
  id: string;
  type: string;
  model: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  result?: any;
  createTime: number;
}

/** AI 任务列表响应 */
export interface AiTaskListResponse {
  list: AiTaskListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** 批量任务详情请求 */
export interface AiBatTaskDetailRequest {
  taskIds: string[];
}

/** 图片拆分任务列表项 */
export interface UploadSplitListItem {
  id: string;
  imageUrl: string;
  splitImages?: string[];
  status: "pending" | "processing" | "completed" | "failed";
  createTime: number;
}

/** 积分配置 */
export interface ScoreConfigResponse {
  dailySignReward: number;
  aiGenPrice: number;
  imageSplitPrice: number;
}

/** AI 任务高清处理请求 */
export interface CommitAiHpRequest {
  taskId: string;
  type?: string;
}

/** 多场景提交请求 */
export interface CommitAiMultiSceneRequest {
  taskId: string;
  scenes: string[];
}

// ===================== 视频任务相关 =====================

/** 提交 Sora 视频任务请求 */
export interface CommitSoraTaskRequest {
  prompt: string;
  model: string;
  aspect_ratio?: string;
  duration?: number;
  resolution?: string;
}

/** Sora 视频任务列表项 */
export interface SoraTaskListItem {
  id: string;
  prompt: string;
  model: string;
  status: "pending" | "processing" | "completed" | "failed";
  videoUrl?: string;
  progress?: number;
  createTime: number;
}

/** 视频高清任务列表项 */
export interface VideoHpTaskListItem {
  id: string;
  originalTaskId: string;
  status: "pending" | "processing" | "completed" | "failed";
  videoUrl?: string;
  progress?: number;
  createTime: number;
}

/** 提交视频高清处理请求 */
export interface CommitVideoHpTaskRequest {
  videoUrl: string;
  type?: string;
}

/** 对已有视频任务做高清处理请求 */
export interface CommitVideoTaskHpRequest {
  taskId: string;
  type?: string;
}

// ===================== 系统配置 =====================

/** 系统配置响应 */
export interface GetSysConfigResponse {
  [key: string]: any;
}
