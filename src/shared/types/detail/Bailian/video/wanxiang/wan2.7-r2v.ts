/**
 * wan2.7-r2v 请求体 - 参考生视频（以图/视频为参考生成视频）
 * API 文档: https://help.aliyun.com/zh/model-studio/wan-video-to-video-api-reference
 */
export interface Wan27R2vRequest {
  /** 模型名称 */
  model: "wan2.7-r2v";
  /** 输入的基本信息 */
  input: {
    /** 文本提示词，用来描述生成视频中期望包含的元素和视觉特点。支持中英文，不超过 5000 个字符 */
    prompt: string;
    /** 参考素材列表（可选），通过 type 和 url 传入图像或视频 URL */
    media?: {
      /** 素材类型 */
      type: "reference_image" | "reference_video";
      /** 素材 URL（支持图像或视频 URL） */
      url: string;
      /** 音色参考 URL（可选），仅 wan2.7 支持，可为参考图像或视频指定参考音色 */
      reference_voice?: string;
    }[];
  };
  /** 视频处理参数（可选） */
  parameters?: {
    /** 生成视频的分辨率档位，可选值：720P、1080P，默认 1080P */
    resolution?: "720P" | "1080P";
    /** 生成视频的宽高比，如 "16:9"、"9:16"、"1:1" */
    ratio?: string;
    /** 生成视频的时长，单位秒 */
    duration?: number;
    /** 是否开启 prompt 智能改写 */
    prompt_extend?: boolean;
    /** 是否添加水印 */
    watermark?: boolean;
  };
}


/**
 * wan2.7-r2v 成功响应（创建任务）
 */
export interface Wan27R2vCreateResponse {
  output: {
    task_id: string;
    task_status: "PENDING";
  };
  request_id: string;
}

/**
 * wan2.7-r2v 查询任务结果成功响应
 */
export interface Wan27R2vQueryResponse {
  request_id: string;
  output: {
    task_id: string;
    task_status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED" | "UNKNOWN";
    submit_time: string;
    scheduled_time?: string;
    end_time?: string;
    orig_prompt?: string;
    video_url?: string;
  };
  usage?: {
    video_count: number;
    video_duration: number;
    duration: number;
    input_video_duration: number;
    output_video_duration: number;
    SR: number;
    ratio: string;
  };
}

/**
 * wan2.7-r2v 异常响应
 */
export interface Wan27R2vErrorResponse {
  code: string;
  message: string;
  request_id: string;
}
