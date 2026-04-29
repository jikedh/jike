export interface GrokImageRequest {
  model: string; // 图像生成模型名称（必填），可选值："grok-4-1-image" | "grok-4-2-image"
  prompt: string; // 图像生成的文本描述（必填），最长 1000 个字符
  size?: string; // 图像生成的尺寸比例，可选值："1:1"(正方形，默认) | "2:3"(竖版) | "3:2"(横版) | "16:9"(宽屏横版) | "9:16"(宽屏竖版)，默认 "1:1"
  n?: number; // 生成图像的数量，支持 1、2、4，默认 1（注意：必须输入纯数字，不要加引号）
  image_urls?: string[]; // 参考图像 URL 列表，用于图生图，仅支持 URL 格式，最多 5 张图片，单张不超过 10MB，支持格式：jpeg、jpg、png、webp
}

export interface GrokImageResponse {
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
