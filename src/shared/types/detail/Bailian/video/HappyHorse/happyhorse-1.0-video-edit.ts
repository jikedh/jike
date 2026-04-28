/**
 * HappyHorse 视频编辑请求体。
 * 输入 1 个待编辑视频，可选 0~5 张参考图，通过文本指令完成编辑。
 */
export interface HappyHorse10VideoEditRequest {
  /** 模型名称 */
  model: "happyhorse-1.0-video-edit";
  /** 输入信息 */
  input: {
    /** 视频编辑指令提示词 */
    prompt: string;
    /** 媒体素材列表：必须包含 1 个 video，可选 0~5 个 reference_image */
    media: {
      /** 素材类型：待编辑视频或参考图像 */
      type: "video" | "reference_image";
      /** 素材 URL，必须公网可访问 */
      url: string;
    }[];
  };
  /** 视频编辑参数 */
  parameters?: {
    /** 分辨率档位，默认 1080P */
    resolution?: "720P" | "1080P";
    /** 是否添加 Happy Horse 水印，默认 true */
    watermark?: boolean;
    /** 声音控制，默认 auto；origin 表示保留输入视频原声 */
    audio_setting?: "auto" | "origin";
    /** 随机数种子，取值范围 0~2147483647 */
    seed?: number;
  };
}

/**
 * HappyHorse 视频编辑创建任务响应。
 */
export interface HappyHorse10VideoEditCreateResponse {
  output: {
    task_id: string;
    task_status: "PENDING";
  };
  request_id: string;
}

/**
 * HappyHorse 视频编辑查询任务响应。
 */
export interface HappyHorse10VideoEditQueryResponse {
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
 * HappyHorse 视频编辑异常响应。
 */
export interface HappyHorse10VideoEditErrorResponse {
  code: string;
  message: string;
  request_id: string;
}
