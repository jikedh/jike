/**
 * HappyHorse 图生视频请求体。
 * 以首帧图片为基础，通过文本描述引导生成视频。
 */
export interface HappyHorse10I2vRequest {
  /** 模型名称 */
  model: "happyhorse-1.0-i2v";
  /** 输入信息 */
  input: {
    /** 文本提示词，中文不超过 2500 字，非中文不超过 5000 字符 */
    prompt?: string;
    /** 首帧图片素材，有且仅有 1 张 */
    media: {
      /** 素材类型：首帧 */
      type: "first_frame";
      /** 首帧图片 URL，支持 HTTP/HTTPS */
      url: string;
    }[];
  };
  /** 视频生成参数 */
  parameters?: {
    /** 分辨率档位，默认 1080P */
    resolution?: "720P" | "1080P";
    /** 视频时长，单位秒，取值范围 3~15，默认 5 */
    duration?: number;
    /** 是否添加 Happy Horse 水印，默认 true */
    watermark?: boolean;
    /** 随机数种子，取值范围 0~2147483647 */
    seed?: number;
  };
}

/**
 * HappyHorse 图生视频创建任务响应。
 */
export interface HappyHorse10I2vCreateResponse {
  output: {
    task_id: string;
    task_status: "PENDING";
  };
  request_id: string;
}

/**
 * HappyHorse 图生视频查询任务响应。
 */
export interface HappyHorse10I2vQueryResponse {
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
  };
}

/**
 * HappyHorse 图生视频异常响应。
 */
export interface HappyHorse10I2vErrorResponse {
  code: string;
  message: string;
  request_id: string;
}
