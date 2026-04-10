export interface SoraRequest {
  model: string; // 视频生成模型名称（必填），固定为 "sora-2-official"
  prompt: string; // 视频生成的自然语言描述（必填），包含镜头类型、主体、动作、场景、光线和相机运动，以减少歧义，保持描述单一目的以获得最佳效果
  duration?: number; // 视频时长（秒），可选值：4 | 8 | 12，默认 4
  aspect_ratio?: string; // 视频宽高比，可选值："16:9"(横屏，1280×720) | "9:16"(竖屏，720×1280)，默认 "9:16"
  image_urls?: string[]; // 用于图生视频的参考图像 URL 数组，仅支持 URL 格式，仅使用第一张图片作为参考，支持格式：JPEG、PNG、WebP，图片尺寸必须为 1280×720（16:9）或 720×1280（9:16）
}

export interface SoraResponse {
  id: string; // 任务唯一标识符，用于查询任务状态
  object: string; // 对象类型，固定为 "generation.task"
  model: string; // 使用的模型名称
  status: "queued" | "in_progress" | "completed" | "failed"; // 任务状态：queued-排队等待处理，in_progress-处理中，completed-成功完成，failed-失败
  progress: number; // 任务进度百分比（0-100）
  created_at: number; // 任务创建时间戳（Unix 时间戳）
  metadata?: {
    // 任务元数据
    aspect_ratio?: string; // 视频宽高比
    duration?: number; // 视频时长
  };
}
