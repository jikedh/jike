export interface Gemini3ProRequest {
}

export interface Gemini3ProResponse {
  id: string; // 任务 ID
  object: string; // 对象类型，固定为 generation.task
  model: string; // 模型名称
  status: 'queued'|'in_progress' | 'completed' | 'failed'; // 任务状态
  progress: number; // 进度百分比 (0-100)
  created_at: number; // 创建时间戳
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


