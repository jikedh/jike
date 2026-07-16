export interface Seedance20Request {
  // 模型 ID：快子异步任务创建接口需要明确模型，避免落到不支持的同步调用。
  model?: string; // 可选，默认为 "seedance-2.0"，目前仅支持该模型
  prompt: string; // 文本提示词：文生素材时条件必填；可在提示词中引用 images 素材
  generation_type: "video"; // 生成类型：视频任务可填写 "video"（条件必填）
  input_type?: "reference" | "first_last_frame"; // 输入类型："reference"（全能参考）| "first_last_frame"（首尾帧）
  mode?: "fast" | "mini" | "pro"; // 生成模式："fast"（默认）| "mini" | "pro"

  images?: {
    url: string; // 图片参考图 URL（必填）
    role?: "first_frame" | "last_frame" | "reference_image"; // 图片角色：首帧/尾帧/参考图
  }[]; // 图片输入列表，最多 9 张

  videos?: {
    url: string; // 视频 URL（必填）
    role?: "reference_video"; // 固定为参考视频角色
  }[]; // 视频输入列表（mini/pro），最多 3 段，总时长 <= 15s

  audios?: {
    url: string; // 音频 URL（必填）
    role?: "reference_audio"; // 固定为参考音频角色
  }[]; // 音频输入列表（mini/pro），最多 3 段，总时长 <= 15s，不能单独输入，需要搭配图片或视频

  resolution?: "480p" | "720p"; // 分辨率："480P" | "720P"（默认 "720P"）
  ratio?: "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "21:9" | "adaptive"; // 宽高比（默认 "adaptive"）
  duration?: number; // 生成时长（秒）：fast 建议 4-12，pro 建议 4-15，传 -1 由系统自动选择
  generate_audio?: boolean; // 是否生成同步音频（默认 true）
  seed?: number; // 随机种子：相同种子可复现相近结果
  web_search?: boolean; // 是否启用联网搜索增强（仅 pro，默认 false）
}

export interface Seedance20Response {
  code: number; // 状态码，200 表示成功，其他值表示失败
  message: string; // 响应消息，成功时通常为 "success"，失败时包含错误信息
  data?: {
    task_id: string; // 任务唯一标识符，用于查询任务状态
  };
}

// 轮询结果的响应
export interface Seedance20StatusResponse {
  code: number; // 状态码，示例为 0 表示成功，其他值表示失败
  message: string; // 响应消息，失败时通常包含错误信息
  trace_id?: string; // 请求链路追踪 ID，用于排查问题
  data?: {
    task_id: string; // 任务唯一标识符，用于查询任务状态
    status:
      | "queued"
      | "processing"
      | "running"
      | "succeeded"
      | "failed"
      | "canceled"; // 任务状态
    duration?: number; // 视频时长（秒）
    error?: string; // 错误信息，成功时通常为空字符串
    tos_key?: string; // 对象存储中的资源 Key
    video_url?: string; // 生成视频 URL
    progress?: number; // 任务进度百分比（0-100），部分状态会返回
    usage?: {
      completion_tokens?: number; // 输出 token 数
      total_tokens?: number; // 总 token 数
    };
  };
}
