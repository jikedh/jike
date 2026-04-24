/**
 * wan2.7-t2v 请求体 - 文生视频（基于文本提示词生成视频）
 * API 文档: https://help.aliyun.com/zh/model-studio/text-to-video-api-reference
 */
export interface Wan27T2vRequest {
  /** 模型名称 */
  model: "wan2.7-t2v";
  /** 输入的基本信息 */
  input: {
    /** 文本提示词，用来描述生成视频中期望包含的元素和视觉特点。支持中英文，不超过 5000 个字符 */
    prompt: string;
    /** 反向提示词（可选），用来描述不希望在视频画面中看到的内容 */
    negative_prompt?: string;
  };
  /** 视频处理参数（可选） */
  parameters?: {
    /** 生成视频的分辨率档位，可选值：720P、1080P，默认 1080P */
    resolution?: "720P" | "1080P";
    /** 生成视频的宽高比，默认 16:9，可选 16:9、9:16、1:1 */
    ratio?: "16:9" | "9:16" | "1:1";
    /** 生成视频的时长，单位秒 */
    duration?: number;
    /** 是否开启 prompt 智能改写 */
    prompt_extend?: boolean;
    /** 是否添加水印 */
    watermark?: boolean;
    /** 音频 URL（可选），传入音频文件作为视频的背景音 */
    audio_url?: string;
  };
}

/**
 * wan2.7-t2v 成功响应（创建任务）
 */
export interface Wan27T2vCreateResponse {
  output: {
    task_id: string;
    task_status: "PENDING";
  };
  request_id: string;
}

/**
 * wan2.7-t2v 查询任务结果成功响应
 */
export interface Wan27T2vQueryResponse {
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
    duration: number;
    input_video_duration: number;
    output_video_duration: number;
    SR: number;
    ratio: string;
  };
}

/**
 * wan2.7-t2v 异常响应
 */
export interface Wan27T2vErrorResponse {
  code: string;
  message: string;
  request_id: string;
}
