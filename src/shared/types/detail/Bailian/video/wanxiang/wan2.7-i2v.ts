/**
 * wan2.7-i2v 请求体 - 图生视频（基于首帧/首尾帧图像或视频片段生成视频）
 * API 文档: https://help.aliyun.com/zh/model-studio/image-to-video-general-api-reference
 */
export interface Wan27I2vRequest {
  /** 模型名称 */
  model: "wan2.7-i2v";
  /** 输入的基本信息 */
  input: {
    /** 文本提示词（可选），用来描述生成视频中期望包含的元素和视觉特点。支持中英文，不超过 5000 个字符 */
    prompt?: string;
    /** 反向提示词（可选），用来描述不希望在视频画面中看到的内容 */
    negative_prompt?: string;
    /** 媒体素材数组，通过 type 指定素材类型 */
    media: {
      /** 素材类型：first_frame（首帧）、last_frame（尾帧）、driving_audio（驱动音频）、first_clip（首视频片段） */
      type: "first_frame" | "last_frame" | "driving_audio" | "first_clip";
      /** 素材 URL */
      url: string;
    }[];
  };
  /** 视频处理参数（可选） */
  parameters?: {
    /** 生成视频的分辨率档位，可选值：720P、1080P，默认 1080P */
    resolution?: "720P" | "1080P";
    /** 生成视频的时长，单位秒，可选值：4、5、10，默认 4 */
    duration?: 4 | 5 | 10;
    /** 是否开启 prompt 智能改写 */
    prompt_extend?: boolean;
    /** 是否添加水印 */
    watermark?: boolean;
  };
}

/**
 * wan2.7-i2v 成功响应（创建任务）
 */
export interface Wan27I2vCreateResponse {
  output: {
    task_id: string;
    task_status: "PENDING";
  };
  request_id: string;
}

/**
 * wan2.7-i2v 查询任务结果成功响应
 */
export interface Wan27I2vQueryResponse {
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
    submit_time: string;
    scheduled_time?: string;
    end_time?: string;
    orig_prompt?: string;
    video_url?: string;
  };
  usage?: {
    video_count: number;
    duration: number;
    input_video_duration: number;
    output_video_duration: number;
    SR: number;
  };
}

/**
 * wan2.7-i2v 异常响应
 */
export interface Wan27I2vErrorResponse {
  code: string;
  message: string;
  request_id: string;
}
