/**
 * HappyHorse 文生视频请求体。
 * 使用文本提示词生成物理真实、运动流畅的视频内容。
 */
export interface HappyHorse10T2vRequest {
  /** 模型名称 */
  model: "happyhorse-1.0-t2v";
  /** 输入信息 */
  input: {
    /** 文本提示词，中文不超过 2500 字，非中文不超过 5000 字符 */
    prompt: string;
  };
  /** 视频生成参数 */
  parameters?: {
    /** 分辨率档位，默认 1080P */
    resolution?: "720P" | "1080P";
    /** 生成视频宽高比，默认 16:9 */
    ratio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
    /** 视频时长，单位秒，取值范围 3~15，默认 5 */
    duration?: number;
    /** 是否添加 Happy Horse 水印，默认 true */
    watermark?: boolean;
    /** 随机数种子，取值范围 0~2147483647 */
    seed?: number;
  };
}

/**
 * HappyHorse 文生视频创建任务响应。
 */
export interface HappyHorse10T2vCreateResponse {
  output: {
    task_id: string;
    task_status: "PENDING";
  };
  request_id: string;
}

/**
 * HappyHorse 文生视频查询任务响应。
 */
export interface HappyHorse10T2vQueryResponse {
  request_id: string;
  output: {
    task_id: string;
    task_status:
      | "PENDING"
      | "RUNNING"
      | "SUCCEEDED"
      | "FAILED"
      | "CANCELED"
      | "UNKNOWN";
    submit_time?: string;
    scheduled_time?: string;
    end_time?: string;
    orig_prompt?: string;
    video_url?: string;
    code?: string;
    message?: string;
  };
  usage?: {
    duration: number;
    input_video_duration: number;
    output_video_duration: number;
    video_count: number;
    SR: number;
    ratio: string;
  };
}

/**
 * HappyHorse 文生视频异常响应。
 */
export interface HappyHorse10T2vErrorResponse {
  code: string;
  message: string;
  request_id: string;
}
