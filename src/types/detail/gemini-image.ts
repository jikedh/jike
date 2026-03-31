export interface Gemini3ProRequest {
  model?: string; // 模型名称，默认为 "gemini-3-pro-image-preview"
  prompt: string; // 图像生成的文本描述（必填）最大1000字符
  size?: string; // 图像尺寸，可选值：1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9
  // n?: number; // 生成图像的数量，范围：1-10，默认 1 （已失效）
  image_urls?: string[]; // 参考图像 URL 列表，用于图生图或图像编辑，仅支持 URL 格式，最多 14 张图片，支持格式：jpeg、png，宽度和高度 > 14px，大小不超过 10MB，总像素不超过 6000×6000 px
  metadata?: {
    // 渠道特有参数，用于传递 Gemini 3 Pro 模型的高级配置
    resolution?: string; // 图像分辨率，可选值：""1K 默认分辨率", "2K"(标准分辨率) | "3K"(高清分辨率)
    orientation?: string; // 图像方向，可选值："landscape"(横向), "portrait"(竖向)，默认 "landscape"
  };
}

export interface Gemini3ProResponse {
  id: string; // 任务 ID
  object: string; // 对象类型，固定为 generation.task
  model: string; // 模型名称
  status: 'queued'|'in_progress' | 'completed' | 'failed'; // 任务状态
  progress: number; // 进度百分比 (0-100)
  created_at: number; // 创建时间戳
  expire_at?: number; // 任务结果过期时间戳，仅当 status 为 completed 时返回
  // metadata?: Record<string, any>; // 任务相关的元信息
  // 直接内联定义嵌套对象
  result?: {
    type: string; // 结果类型
    data: {
      url: string; // 图片 URL
    }[]; // 图片数据列表
  }; // 生成结果
  // 直接内联定义嵌套对象
}


