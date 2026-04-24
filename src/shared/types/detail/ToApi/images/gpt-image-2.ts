/**
 * GPT-Image-2 图像生成 API 类型定义
 * @see https://docs.toapis.com/docs/cn/api-reference/images/gpt-image-2/generation
 */

/** 请求体 */
export interface GptImage2GenerationRequest {
  /** 图像生成模型名称，默认 "gpt-image-2" */
  model?: string
  /** 图像生成的文本描述，最长 4000 个字符 */
  prompt: string
  /** 输出图像比例，默认 "1:1"，有效值取决于 resolution */
  size?:
  | '1:1' | '3:2' | '2:3'
  | '4:3' | '3:4' | '5:4' | '4:5' | '16:9' | '9:16' | '2:1' | '1:2' | '21:9' | '9:21'
  /** 输出分辨率档位，默认 "1K" */
  resolution?: '1K' | '2K' | '4K'
  /** 生成图像的数量，默认 1 */
  n?: number
  /** 返回格式，默认 "url" */
  response_format?: 'url'
  /** 参考图 URL 列表，用于图生图（仅支持 URL，不再支持 base64） */
  reference_images?: string[]
  /** 向后兼容的参考图字段 */
  image_urls?: string[]
}

/** 响应体 */
export interface GptImage2GenerationResponse {
  /** 任务唯一标识符，用于查询任务状态 */
  id: string
  /** 对象类型，固定为 "generation.task" */
  object: 'generation.task'
  /** 使用的模型名称 */
  model: string
  /** 任务状态: queued - 排队等待处理, in_progress - 处理中, completed - 成功完成, failed - 失败 */
  status: 'queued' | 'in_progress' | 'completed' | 'failed'
  /** 任务进度百分比（0-100） */
  progress: number
  /** 任务创建时间戳（Unix 时间戳） */
  created_at: number
  /** 元数据 */
  metadata?: Record<string, unknown>
}
