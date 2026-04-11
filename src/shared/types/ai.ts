export interface ChatMessage {
  role: "user" | "assistant" | "system"; // 角色
  content: string; // 内容
}

export interface ChatCompletionsRequest {
  model: string; // 必填，模型名，如 gpt-3.5-turbo
  messages: ChatMessage[]; // 必填，对话历史
  temperature?: number; // 0~2，越高越随机
  max_tokens?: number; // 最大生成token
  top_p?: number; // 核采样，默认1
  stream?: boolean; // 是否流式输出 true/false
  stop?: string | string[]; // 停止词
  frequency_penalty?: number; // 频率惩罚
  presence_penalty?: number; // 存在惩罚
}

// 图片生成需要用到的入参
export interface ImageGenerationRequest {
  model: string; // 模型
  prompt: string; // 提示词
  n?: number; // 生成几张图，默认 1
  size?: string; // 图片尺寸，如 1024x1024
  quality?: string; // 画质
  response_format?: string; // 返回格式 url / b64_json
  style?: string; // 风格
  user?: string; // 用户ID（透传）
}

// 图片生成的出参
export interface ImageGenerationsResponse {
  created: number; // 时间戳
  // 直接内联定义嵌套对象
  data: {
    url?: string; // 图片链接（二选一）
    b64_json?: string; // base64 图片（二选一）
    revised_prompt?: string; // 优化后的提示词
  }[]; // 生成的图片数组
}

// 图像生成 - 请求体类型
export interface GeminiImageGenerationRequest {
  prompt: string; // 必选：提示词
  negative_prompt?: string; // 可选：负面提示词（不希望生成的内容）
  width?: number; // 可选：生成图片宽度，默认 1024
  height?: number; // 可选：生成图片高度，默认 1024
  image_num?: number; // 可选：生成数量 1~4，默认 1
  steps?: number; // 可选：推理步数，默认 20
  cfg_scale?: number; // 可选：引导系数（提示词遵循度），默认 7
  sampler?:
    | "DDIM"
    | "Euler"
    | "EulerA"
    | "DPM++ 2M"
    | "DPM++ 2M Karras"
    | "DPM++ SDE"; // 可选：采样器
  seed?: number; // 可选：随机种子
  image_base64?: string; // 可选：输入图生图的 base64（图生图时使用）
  denoising_strength?: number; // 可选：图生图时的重绘强度 0~1，默认 0.7
}

// 图像生成 - 响应体类型
export interface GeminiImageGenerationResponse {
  code: number; // 状态码：0=成功
  message: string; // 提示信息
  // 直接内联定义嵌套对象
  data: {
    task_id: string; // 任务 ID
    status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED"; // 生成状态
    images: string[]; // 生成的图片列表（base64 或 URL）
    seed: number; // 实际使用的种子
    cost_time?: number; // 耗时（秒）
  }; // 任务/结果数据
}

// 错误响应
export interface GeminiImageGenerationErrorResponse {
  code: number; // 状态码
  message: string; // 错误信息
  data?: null; // 数据
}
