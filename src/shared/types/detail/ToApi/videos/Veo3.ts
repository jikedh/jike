export interface Veo3Request {
  model?: string; // 视频生成模型名称，可选值："Veo3.1-quality-official"(高质量生成模型) | "Veo3.1-fast-official"(快速生成模型)，默认 "Veo3.1-quality-official"
  prompt: string; // 视频生成的文本描述（必填）
  duration?: number; // 视频时长（秒），可选值：4 | 6 | 8，默认 8
  size?: string; // 视频宽高比，可选值："16:9"(横屏，默认) | "9:16"(竖屏)
  resolution?: string; // 视频分辨率，可选值："720p"(默认) | "1080p"
  image_urls?: string[]; // 图生视频的首帧参考图，仅使用数组中的第一个 URL，支持 .jpeg、.jpg、.png、.webp，最大 10MB，与 referenceImages 不能同时使用
  metadata?: {
    // Veo3 Official 特有扩展参数
    generateAudio?: boolean; // 是否生成音频，默认 false，启用后视频将包含 AI 生成的音效和环境音
    negativePrompt?: string; // 负面提示词，描述不希望在视频中出现的内容
    personGeneration?: string; // 人物生成安全设置，可选值："allow_adult"(允许生成成年人) | "dont_allow"(不允许生成人物)
    lastFrame?: string; // 尾帧图片 URL，用于首尾帧插值生成视频，必须与 image_urls（首帧）配合使用
    referenceImages?: string[]; // 素材/风格参考图 URL 数组，最多 3 张，不可与 image_urls 同时使用
    compressionQuality?: string; // 视频压缩质量，可选值："optimized"(优化压缩，默认) | "lossless"(无损压缩)
    resizeMode?: string; // 图生视频时的图片调整模式，可选值："pad"(填充模式，保持原始比例) | "crop"(裁剪模式，填满画面)
  };
}

export interface Veo3Response {
  id: string; // 任务唯一标识符，用于查询任务状态
  object: string; // 对象类型（如 "video"）
  model: string; // 使用的模型名称（如 "Veo3.1-quality-official"）
  status: "queued" | "in_progress" | "completed" | "failed"; // 任务状态：queued-排队等待处理，in_progress-处理中，completed-成功完成，failed-失败
  progress: number; // 任务进度百分比（0-100）
  created_at: number; // 任务创建时间戳（Unix 时间戳）
  completed_at?: number; // 任务完成时间戳（Unix 时间戳）
  metadata?: {
    // 任务元数据
    url?: string; // 视频 URL
    seed?: number; // 种子值
  };
}
