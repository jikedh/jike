export interface Seedream5ImageRequest {
  model?: string; // 图像生成模型名称，默认 "doubao-seedream-5-0"
  prompt: string; // 图像生成的文本描述（必填）
  size?: string; // 图像宽高比，可选值："1:1"(正方形) | "4:3"(横向4:3) | "3:4"(竖向3:4) | "16:9"(横向宽屏) | "9:16"(竖向长图) | "3:2"(横向3:2) | "2:3"(竖向2:3) | "21:9"(超宽屏) | "9:21"(超窄屏)，默认 "1:1"
  // n?: number; // 生成图像的数量，范围：1-15，默认 1（注意：必须输入纯数字，不要加引号）
  image_urls?: string[]; // 参考图像 URL 列表，用于图生图或图像编辑，仅支持 URL 格式，最多 10 张图片，支持格式：jpeg、png，宽度和高度 > 14px，大小不超过 10MB，总像素不超过 6000×6000 px
  metadata?: {
    // 渠道特有参数，用于传递 Seedream 5.0 模型的高级配置
    resolution?: string; // 图像分辨率，可选值："2K"(标准分辨率，默认) | "3K"(高清分辨率)
    sequential_image_generation?: string; // 顺序图像生成模式，可选值："disabled"(禁用，默认) | "auto"(启用)，支持文生组图和图生组图
    sequential_image_generation_options?: {
      // 顺序图像生成选项，当 sequential_image_generation 设置为 auto 时可用
      max_images?: number; // 生成的图像数量，范围：1-15
    };
    watermark?: boolean; // 是否为生成的图像添加水印，true-添加水印，false-不添加水印（默认）
  };
}

export interface Seedream5ImageResponse {
  id: string; // 任务唯一标识符，用于查询任务状态
  object: string; // 对象类型，固定为 "generation.task"
  model: string; // 使用的模型名称
  status: 'queued' | 'in_progress' | 'completed' | 'failed'; // 任务状态：queued-排队等待处理，in_progress-处理中，completed-成功完成，failed-失败
  progress: number; // 任务进度百分比（0-100）
  created_at: number; // 任务创建时间戳（Unix 时间戳）
  expire_at?: number; // 任务结果过期时间戳（Unix 时间戳），仅当 status 为 completed 时返回
  result?: {
    type: string; // 结果类型，固定为 "image"
    data: {
      url: string; // 生成的图像 URL
    }[]; // 生成的图像数据列表，可能包含多张图像
  }; // 生成结果，仅当 status 为 completed 时返回

}
