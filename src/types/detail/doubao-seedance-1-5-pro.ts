export interface DoubaoSeedance15ProRequest {
  model?: string; // 视频生成模型名称，默认 "doubao-seedance-1-5-pro"
  prompt: string; // 视频内容描述（必填），详细描述场景、动作、风格以获得更好的生成效果
  duration?: number; // 视频时长（秒），支持范围：4 ~ 12 秒，默认 5
  aspect_ratio?: string; // 视频宽高比，可选值："16:9"(横屏) | "9:16"(竖屏) | "1:1"(方形) | "4:3"(传统比例) | "3:4"(竖向传统比例) | "21:9"(超宽屏)，默认 "16:9"
  image_urls?: string[]; // 图片 URL 数组，用于图生视频，自动分配角色规则：1张=首帧，2张=首帧+尾帧，3+=首帧+尾帧+参考图，与 image_with_roles 不能同时使用
  image_with_roles?: {
    // 带角色的图像数组，用于更精确的控制
    url: string; // 图像 URL 地址（必填）
    role: 'first_frame' | 'last_frame' | 'reference_image'; // 图像角色：first_frame-首帧图(仅支持一张)，last_frame-尾帧图(仅支持一张)，reference_image-参考图(支持1-4张)
  }[]; // 与 image_urls 不能同时使用
  metadata?: {
    // 扩展参数
    resolution?: string; // 视频分辨率，可选值："480p"(标清) | "720p"(高清) | "1080p"(超清)
    seed?: number; // 种子整数，用于控制生成内容的随机性，取值范围：-1 ~ 2^32-1
    audio?: boolean; // 是否生成音频，默认 false，1.5 Pro 独有功能
    camerafixed?: boolean; // 是否固定摄像头，默认 false，设置为 true 时摄像头位置保持固定
  };
  audio?: boolean; // 是否生成音频（快捷参数，等同于 metadata.audio）
  camerafixed?: boolean; // 是否固定摄像头（快捷参数，等同于 metadata.camerafixed）
}

export interface DoubaoSeedance15ProResponse {
  id: string; // 任务唯一标识符，用于查询任务状态
  object: string; // 对象类型（如 "video"）
  model: string; // 使用的模型名称（如 "doubao-seedance-1-5-pro"）
  status: 'queued' | 'in_progress' | 'completed' | 'failed'; // 任务状态：queued-排队等待处理，in_progress-处理中，completed-成功完成，failed-失败
  progress: number; // 任务进度百分比（0-100）
  created_at: number; // 任务创建时间戳（Unix 时间戳）
  completed_at?: number; // 任务完成时间戳（Unix 时间戳）
  metadata?: {
    // 任务元数据
    generate_audio?: boolean; // 是否生成音频
    url?: string; // 视频 URL
    seed?: number; // 种子值
  };
}
