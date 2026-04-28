/**
 * HappyHorse 参考生视频请求体。
 * 支持 1~9 张参考图，通过 prompt 中的 character1、character2 等指代。
 */
export interface HappyHorse10R2vRequest {
  /** 模型名称 */
  model: "happyhorse-1.0-r2v";
  /** 输入信息 */
  input: {
    /** 文本提示词，可通过 character1、character2 指代 media 顺序中的参考图 */
    prompt: string;
    /** 参考图像素材列表，数量 1~9 张 */
    media: {
      /** 素材类型：参考图像 */
      type: "reference_image";
      /** 图像 URL，必须公网可访问 */
      url: string;
    }[];
  };
  /** 视频生成参数 */
  parameters?: {
    /** 分辨率档位，默认 1080P */
    resolution?: "720P" | "1080P";
    /** 生成视频宽高比，默认 16:9 */
    ratio?: "16:9" | "9:16" | "3:4" | "4:3" | "1:1";
    /** 视频时长，单位秒，取值范围 3~15，默认 5 */
    duration?: number;
    /** 是否添加 Happy Horse 水印，默认 true */
    watermark?: boolean;
    /** 随机数种子，取值范围 0~2147483647 */
    seed?: number;
  };
}

/**
 * HappyHorse 参考生视频创建任务响应。
 */
export interface HappyHorse10R2vCreateResponse {
  output: {
    task_id: string;
    task_status: "PENDING";
  };
  request_id: string;
}

/**
 * HappyHorse 参考生视频查询任务响应。
 */
export interface HappyHorse10R2vQueryResponse {
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
 * HappyHorse 参考生视频异常响应。
 */
export interface HappyHorse10R2vErrorResponse {
  code: string;
  message: string;
  request_id: string;
}
