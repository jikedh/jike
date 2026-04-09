export interface GrokVideoRequest {
  model?: string; // 视频生成模型名称，默认 "grok-video-3"
  prompt: string; // 视频生成的文本描述（必填）
  duration?: number; // 视频时长（秒），可选值：10 | 15，默认 10
  aspect_ratio?: string; // 视频宽高比，可选值："16:9"(横屏) | "9:16"(竖屏)
  images?: string[]; // 用于图生视频的参考图像 URL 数组，仅支持 URL 格式
  metadata?: {
    // 任务元数据
    resolution?: string; // 视频分辨率，可选值："720P" | "1080P"
  };
}

export interface GrokVideoResponse {
  id: string; // 任务唯一标识符，用于查询任务状态
  object: string; // 对象类型，固定为 "generation.task"
  model: string; // 使用的模型名称（如 "grok-video-3"）
  status: 'queued' | 'in_progress' | 'completed' | 'failed'; // 任务状态：queued-排队等待处理，in_progress-处理中，completed-成功完成，failed-失败
  progress: number; // 任务进度百分比（0-100）
  created_at: number; // 任务创建时间戳（Unix 时间戳）
  completed_at?: number; // 任务完成时间戳（Unix 时间戳）
  expires_at?: number; // 任务过期时间戳（Unix 时间戳）
  result?: {
    // 任务结果
    type: string; // 结果类型（如 "video"）
    data: Array<{
      // 结果数据
      url: string; // 视频 URL
    }>;
  };
  metadata?: {
    // 任务元数据
    seed?: number; // 种子值
  };
}
