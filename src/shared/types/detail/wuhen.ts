// ===================== 无痕 AI Access Token 相关 =====================

/**
 * 获取 Access Token 响应体
 * API 端点: https://api.wuhenai.com/v2/user/access_token
 */
export interface WuhenAccessTokenResponse {
  code: number;
  message: string;
  data: {
    access_token: string;
    expired: number; // 过期时间戳（秒）
  };
}

// ===================== 无痕 AI 视频消除相关 =====================

/**
 * 视频消除接口请求体
 * 用于消除视频中的路人或不需要的元素
 * API 端点: https://api.wuhenai.com/v2/video_removal
 */
export interface VideoRemovalRequest {
  video_url: string;
  upload_url?: string;
  model?: "video_removal_std" | "video_removal_pro";
  /** 可选：处理方式 */
  method?: "all_area" | "sel_area";
  /** 选区（仅当 method=sel_area 时生效） */
  rect?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };

  /** 上传时附带 headers（当 upload_url 存在时必须传递） */
  upload_headers?: Record<string, string>;

  /** 可选：跟踪模式 */
  track_mode?: string;

  /** 可选：提示词（比如指定去除什么） */
  prompt?: string;

  /** 可选：时间掩码（单位：毫秒） */
  time_mask?: number;

  /** 可选：自定义掩码（Base64 编码） */
  custom_mask?: string;
}


/**
 * 视频消除接口响应体
 */
export interface VideoRemovalResponse {
  // 根据实际 API 响应补充
}


export interface TaskResponse {
  code: number;
  message: string;
  data: {
    task_id: string;
    status: 'success' | 'failed' | 'processing';
    progress: number;
  };
};

