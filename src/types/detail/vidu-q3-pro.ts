export interface ViduQ3ProRequest {
  model: string; // 视频生成模型名称（必填），固定为 "viduq3-pro"
  prompt: string; // 文字提示词（必填），最多 2000 字符，文生视频模式下必填；图生视频和首尾帧模式下可选
  duration?: number; // 视频时长（秒），范围：1 到 16，默认 5
  resolution?: string; // 视频分辨率，可选值："540p"(标清) | "720p"(高清，默认) | "1080p"(全高清)
  aspect_ratio?: string; // 视频宽高比（仅文生视频模式有效），可选值："16:9"(横屏) | "9:16"(竖屏) | "4:3"(传统横屏) | "3:4"(传统竖屏) | "1:1"(方形)
  image_urls?: string[]; // 图片 URL 数组，用于图生视频，系统根据图片数量自动判断生成模式：0张=文生视频，1张=图生视频，2张=首尾帧模式
  audio?: boolean; // 是否生成音频（对话、音效），默认 true，设为 false 可生成静音视频
  seed?: number; // 随机种子，用于复现结果，相同种子和相同参数将产生相同的视频输出
}

export interface ViduQ3ProResponse {
  id: string; // 任务唯一标识符，用于查询任务状态
  object: string; // 对象类型，固定为 "generation.task"
  model: string; // 使用的模型名称
  status: "queued" | "in_progress" | "completed" | "failed"; // 任务状态：queued-排队等待处理，in_progress-处理中，completed-成功完成，failed-失败
  progress: number; // 任务进度百分比（0-100）
  created_at: number; // 任务创建时间戳（Unix 时间戳）
  metadata?: {
    // 任务元数据
    seed?: number; // 种子值
  };
}
