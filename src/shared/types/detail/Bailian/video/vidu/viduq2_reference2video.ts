/**
 * vidu/viduq2_reference2video 请求体 - Vidu 参考生视频
 * API 文档: https://help.aliyun.com/zh/model-studio/vidu-reference-video-api-reference
 */
export interface ViduQ2Reference2VideoRequest {
  /** 模型名称 */
  model: "vidu/viduq2_reference2video" | "vidu/viduq2-pro_reference2video";
  /** 输入的基本信息 */
  input: {
    /** 文本提示词，用来描述生成视频中期望包含的元素和视觉特点。支持中英文，不超过 5000 个字符 */
    prompt: string;
    /** 媒体素材列表，用于指定视频生成所需的参考图像或视频 */
    // 仅参考图像：图像数量为1～7张。参考图像和视频：图像数量为1～4张。视频数量为1～2个。
    media: Array<{
      /** 媒体类型。vidu/viduq2_reference2video 固定为 image；vidu/viduq2-pro_reference2video 可为 image 或 video */
      type: "image" | "video";
      /** 媒体素材 URL，必须为公网可访问的 URL */
      url: string;
    }>;
  };
  /** 视频生成参数 */
  parameters: {
    /** 生成视频的分辨率档位，影响费用。可选值：540P、720P（默认）、1080P */
    resolution?: "540P" | "720P" | "1080P";
    /** 生成视频的分辨率，格式为 宽*高 的像素值，如 "1280*720" */
    size?: string;
    /** 生成视频的时长，单位秒。vidu/viduq2-pro_reference2video 取值 [0, 10]，0 表示自动规划时长；vidu/viduq2_reference2video 取值 [1, 10] */
    duration: number;
    /** 是否添加水印（默认 false） */
    watermark?: boolean;
    /** 随机数种子，取值范围 [0, 2147483647]，未指定时系统自动生成 */
    seed?: number;
  };
}

/**
 * vidu/viduq2_reference2video 成功响应（创建任务）
 */
export interface ViduQ2Reference2VideoCreateResponse {
  output: {
    task_id: string;
    task_status: "PENDING";
  };
  request_id: string;
}

/**
 * vidu/viduq2_reference2video 查询任务结果成功响应
 */
export interface ViduQ2Reference2VideoQueryResponse {
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
    duration: number;
    size: string;
    fps: number;
    SR: string;
    audio: boolean;
    video_count: number;
    reference_type: string;
    output_video_duration: number;
  };
}

/**
 * vidu/viduq2_reference2video 异常响应
 */
export interface ViduQ2Reference2VideoErrorResponse {
  code: string;
  message: string;
  request_id: string;
}
