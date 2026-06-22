/**
 * Agnes Video V2.0 API 封装
 *
 * 通过 jike-go 后端的桌面代理 `/desktop/v1/ai/generation/proxy` 与
 * `/desktop/v1/ai/task/query` 接入 https://apihub.agnes-ai.com 的视频生成能力。
 *
 * 全部走桌面代理，API Key 与上游域名由后端从数据库读取，前端不感知凭据。
 */
import {
  confirmDesktopProxyScore,
  createDesktopProxyTask,
  queryDesktopProxyTask,
  refundDesktopProxyScore,
} from "@/api/jikeGo";

/** Agnes-Video-V2.0 模型名 */
export const AGNES_VIDEO_MODEL = "agnes-video-v2.0";

/** 创建视频任务的生成模式 */
export type AgnesVideoMode = "text" | "image" | "multi" | "keyframes";

export type AgnesCreateVideoRequest = {
  /** 视频内容描述 */
  prompt: string;
  /** 负向提示词 */
  negative_prompt?: string;
  /** 视频宽度，默认 1152 */
  width?: number;
  /** 视频高度，默认 768 */
  height?: number;
  /** 视频总帧数（必须 ≤ 441 且满足 8n + 1） */
  num_frames?: number;
  /** 视频帧率，1-60 */
  frame_rate?: number;
  /** 推理步数 */
  num_inference_steps?: number;
  /** 随机种子 */
  seed?: number;
  /** 单图（图生视频时使用） */
  image?: string;
  /** 多图（多图视频 / 关键帧动画时使用） */
  extra_images?: string[];
  /** 当 mode === 'keyframes' 时设置 extra_body.mode 为 keyframes */
  mode?: AgnesVideoMode;
};

/** Agnes 任务状态 */
export type AgnesTaskStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "failed";

/** 创建任务响应（透传上游字段） */
export type AgnesCreateVideoResponse = {
  id: string;
  task_id: string;
  video_id: string;
  object: string;
  model: string;
  status: AgnesTaskStatus;
  progress: number;
  created_at: number;
  seconds: string;
  size: string;
  /** 后端附加：积分预扣凭证 */
  ledgerBizId?: string;
};

/** 查询任务响应 */
export type AgnesQueryVideoResponse = {
  id: string;
  video_id: string;
  model: string;
  object: string;
  status: AgnesTaskStatus;
  progress: number;
  seconds: string;
  size: string;
  /** 完成时为视频 URL */
  remixed_from_video_id?: string | null;
  error?: { message?: string; code?: string | number } | null;
};

/** 解包桌面代理响应：兼容 {upstream, ledgerBizId} 与裸响应两种形态 */
function unwrap(response: any): {
  data: any;
  ledgerBizId?: string;
} {
  const raw = response?.data ?? response;
  if (raw?.upstream && raw?.ledgerBizId) {
    return { data: raw.upstream, ledgerBizId: String(raw.ledgerBizId) };
  }
  return { data: raw };
}

/** 根据帧数和帧率推算预计时长（秒） */
export function estimateAgnesSeconds(
  numFrames: number,
  frameRate: number,
): number {
  if (!numFrames || !frameRate) return 0;
  return Number((numFrames / frameRate).toFixed(2));
}

/** 简单的积分估算策略：按视频秒数计 30 分/秒，保持与 nano 任务接近的体感 */
export function estimateAgnesScoreCost(seconds: number): number {
  const s = Math.max(1, Math.ceil(seconds));
  return s * 30;
}

/**
 * 创建 agnes-video-v2.0 视频任务
 *
 * @param req 业务参数
 * @param scoreCost 本次预扣积分（>0 时后端会扣减积分并返回 ledgerBizId）
 */
export async function createAgnesVideoTask(
  req: AgnesCreateVideoRequest,
  scoreCost?: number,
): Promise<AgnesCreateVideoResponse> {
  const body: Record<string, any> = {
    model: AGNES_VIDEO_MODEL,
    prompt: req.prompt,
  };

  if (req.negative_prompt) body.negative_prompt = req.negative_prompt;
  if (req.width) body.width = req.width;
  if (req.height) body.height = req.height;
  if (req.num_frames) body.num_frames = req.num_frames;
  if (req.frame_rate) body.frame_rate = req.frame_rate;
  if (req.num_inference_steps)
    body.num_inference_steps = req.num_inference_steps;
  if (typeof req.seed === "number") body.seed = req.seed;

  // 模式分发：单图、多图、关键帧
  if (req.mode === "image" && req.image) {
    body.image = req.image;
  } else if (
    (req.mode === "multi" || req.mode === "keyframes") &&
    req.extra_images &&
    req.extra_images.length > 0
  ) {
    body.extra_body = {
      image: req.extra_images,
      ...(req.mode === "keyframes" ? { mode: "keyframes" } : {}),
    };
  }

  const response = await createDesktopProxyTask({
    platform: "agnes",
    upstreamPath: "/v1/videos",
    method: "POST",
    body,
    scoreCost,
    scoreBizType: "agnes",
    scoreModel: AGNES_VIDEO_MODEL,
    scoreSource: "agnes",
    scoreSourceLabel: "Agnes 视频生成",
  });

  const { data, ledgerBizId } = unwrap(response);
  return { ...(data as AgnesCreateVideoResponse), ledgerBizId };
}

/**
 * 查询 agnes 视频任务结果（推荐使用 video_id）
 */
export async function queryAgnesVideoTask(
  videoId: string,
): Promise<AgnesQueryVideoResponse> {
  const response = await queryDesktopProxyTask({
    platform: "agnes",
    upstreamPath: "/agnesapi",
    method: "GET",
    query: { video_id: videoId, model_name: AGNES_VIDEO_MODEL },
  });
  const { data } = unwrap(response);
  return data as AgnesQueryVideoResponse;
}

/** 任务成功后确认积分扣减 */
export function confirmAgnesScore(ledgerBizId: string, taskId?: string) {
  return confirmDesktopProxyScore(ledgerBizId, "agnes", {
    scoreModel: AGNES_VIDEO_MODEL,
    scoreSource: "agnes",
    scoreSourceLabel: "Agnes 视频生成",
    scoreTaskId: taskId,
    generateTime: Math.floor(Date.now() / 1000),
  });
}

/** 任务失败时退款 */
export function refundAgnesScore(
  ledgerBizId: string,
  reason?: string,
  taskId?: string,
) {
  return refundDesktopProxyScore(ledgerBizId, reason, "agnes", {
    scoreModel: AGNES_VIDEO_MODEL,
    scoreSource: "agnes",
    scoreSourceLabel: "Agnes 视频生成",
    scoreTaskId: taskId,
  });
}
