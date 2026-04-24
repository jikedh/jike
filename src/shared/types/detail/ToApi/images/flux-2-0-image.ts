export interface Flux20ImageRequest {
  model: string; // 图像生成模型名称（必填），可选值："flux-2-flex"(速度较快，适合快速迭代) | "flux-2-pro"(质量更高，细节更好)
  prompt: string; // 图像生成的文本描述（必填）
  size?: string; // 图像宽高比，可选值："1:1"(正方形) | "4:3"(传统显示器比例) | "3:4"(竖向传统比例) | "16:9"(宽屏) | "9:16"(竖屏) | "3:2"(标准照片) | "2:3"(竖向标准照片)，默认 "1:1"
  image_urls?: string[]; // 参考图像 URL 数组，用于图生图，仅支持 URL 格式，最多 8 张参考图
  metadata?: {
    // 元数据参数，用于传递额外的配置选项
    resolution?: string; // 输出图像分辨率，可选值："1K"(标准分辨率，默认) | "2K"(高分辨率)，不同分辨率计费不同
  };
}

export interface Flux20ImageResponse {
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
