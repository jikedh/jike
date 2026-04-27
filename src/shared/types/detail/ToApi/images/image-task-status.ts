/**
 * ToAPI 图片生成任务状态查询响应类型定义
 */

export interface ImageTaskStatus {
  /** 图片生成任务状态 */
  status: "queued" | "in_progress" | "completed" | "failed";
  /** 任务唯一标识符 */
  id: string;
  /** 对象类型，通常为 generation.task */
  object: string;
  /** 模型名称 */
  model: string;
  /** 任务进度百分比 */
  progress: number;
  /** 任务创建时间戳 */
  created_at: number;
  /** 任务结果过期时间戳 */
  expire_at?: number;
  /** 任务元数据 */
  metadata?: Record<string, unknown>;
  /** 任务结果，完成后返回 */
  result?: {
    /** 结果类型，通常为 image */
    type: string;
    /** 图片结果列表 */
    data: Array<{
      /** 图片 URL */
      url?: string;
      /** 兼容部分接口返回的图片 URL 字段 */
      image_url?: string;
    }>;
  };
}

export type ImageTaskStatusResponse = ImageTaskStatus;
