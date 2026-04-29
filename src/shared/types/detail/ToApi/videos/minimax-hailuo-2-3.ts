export interface MinimaxHailuo23Request {
  model: string; // 视频生成模型名称（必填），固定为 "MiniMax-Hailuo-2.3"
  prompt: string; // 视频内容描述（必填），最多 2000 字符，建议详细描述场景、动作、风格等，支持运镜指令（如 [推进]、[拉远] 等）
  duration?: number; // 视频时长（秒），可选值：6 | 10，默认 6
  metadata?: {
    // 扩展参数
    resolution?: string; // 视频分辨率，可选值："768p"(高清，默认) | "1080p"(全高清，仅支持 6 秒时长)
    first_frame_image?: string; // 首帧图片 URL 或 base64，用于图生视频，传入后将以该图片作为视频的起始画面，建议使用 URL
    prompt_optimizer?: boolean; // 是否自动优化 prompt，默认 true
    fast_pretreatment?: boolean; // 是否缩短 prompt 优化耗时，默认 false
    watermark?: boolean; // 是否添加水印，默认 false
  };
}

export interface MinimaxHailuo23Response {
  id: string; // 任务唯一标识符，用于查询任务状态
  object: string; // 对象类型，固定为 "generation.task"
  model: string; // 使用的模型名称（如 "MiniMax-Hailuo-2.3"）
  status: "queued" | "in_progress" | "completed" | "failed"; // 任务状态：queued-排队等待处理，in_progress-处理中，completed-成功完成，failed-失败
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
      format: string; // 视频格式（如 "mp4"）
    }>;
  };
  metadata?: {
    // 任务元数据
    seed?: number; // 种子值
  };
}
