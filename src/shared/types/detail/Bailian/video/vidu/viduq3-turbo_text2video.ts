/**
 * vidu/viduq3-turbo_text2video 请求体 - Vidu 文生视频
 * API 文档: https://help.aliyun.com/zh/model-studio/vidu-text-to-video-api-reference
 */
export interface ViduQ3TurboText2VideoRequest {
  /** 模型名称 */
  model: "vidu/viduq3-turbo_text2video";
  /** 输入的基本信息 */
  input: {
    /** 文本提示词，用来描述生成视频中期望包含的元素和视觉特点。支持中英文，不超过 5000 个字符 */
    prompt: string;
  };
  /** 视频处理参数（可选） */
  parameters?: {
    /** 分辨率档位，影响费用。可选值：540P、720P（默认）、1080P */
    resolution?: "540P" | "720P" | "1080P";
    /** 生成视频的分辨率，格式为 宽*高 的像素值，如 "960*528"，默认值根据resolution而定 */
    size?: string;
    /** 生成视频的时长，单位秒，1到16的整数，默认值为5 */
    duration?: number;
    /** 是否生成有声视频（默认false） */
    audio?: boolean;
    /** 是否添加水印（默认false） */
    watermark?: boolean;
    /** 随机数种子，取值范围[0, 2147483647]，未指定时系统自动生成 */
    seed?: number;
  };
}

/**
 * vidu/viduq3-turbo_text2video 成功响应（创建任务）
 */
export interface ViduQ3TurboText2VideoCreateResponse {
  output: {
    task_id: string;
    task_status: "PENDING";
  };
  request_id: string;
}

/**
 * vidu/viduq3-turbo_text2video 查询任务结果成功响应
 */
export interface ViduQ3TurboText2VideoQueryResponse {
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
    size: string;
    fps: number;
    SR: string;
    audio: boolean;
    output_video_duration: number;
  };
}

/**
 * vidu/viduq3-turbo_text2video 异常响应
 */
export interface ViduQ3TurboText2VideoErrorResponse {
  code: string;
  message: string;
  request_id: string;
}
