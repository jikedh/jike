/**
 * kling-v3-video-generation 请求体。
 * API 文档: https://help.aliyun.com/zh/model-studio/kling-video-generation
 *
 * 支持文生视频、基于首帧的图生视频以及基于首尾帧的图生视频。
 */

export interface KlingV3VideoGenerationRequest {
  model: "kling/kling-v3-video-generation";
  input: {
    /**
     * 文本 prompt。
     *
     * 当 shot_type 为 intelligence 时必填。当 shot_type 为 customize 时此参数不生效
     * 此时使用 multi_prompt。
     */
    prompt?: string;
    /** 媒体资源。文生视频不需要此字段。 */
    media?: Array<{
      /**
       * 标准 Kling v3 仅支持首帧和尾帧图片。
       *
       * 有效组合:
       * - first_frame
       * - first_frame + last_frame
       */
      type: "first_frame" | "last_frame";
      /** HTTP 或 HTTPS 图片 URL。 */
      url: string;
    }>;
    /** 是否启用多镜头生成。 */
    multi_shot?: boolean;
    /** 当 multi_shot 为 true 时必填。 */
    shot_type?: "intelligence" | "customize";
    /** 当 shot_type 为 customize 时必填。 */
    multi_prompt?: Array<{
      /** 镜头索引。从 1 开始。 */
      index: number;
      /** 该镜头的 prompt。 */
      prompt: string;
      /** 镜头持续时间（秒）。 */
      duration: number;
    }>;
    /** 视频中引用元素的的主体列表。 */
    element_list?: Array<{
      /** Kling 对象 ID 列表中的主体 ID。 */
      element_id: number;
    }>;
  };
  parameters?: {
    /** 视频生成模式。pro 输出 1080P；std 输出 720P。默认为 pro。 */
    mode?: "pro" | "std";
    /**
     * 输出宽高比。
     *
     * 文生视频需要此字段。图生视频默认使用首帧图片的宽高比。
     */
    aspect_ratio?: "16:9" | "9:16" | "1:1";
    /** 视频持续时间（秒）。有效范围为 3 到 15。默认为 5。 */
    duration?: number;
    /** 是否生成音频。默认为 false。 */
    audio?: boolean;
    /** 是否添加水印。默认为 false。 */
    watermark?: boolean;
  };
}

/**
 * kling-v3-video-generation 创建任务成功响应。
 */
export interface KlingV3VideoGenerationCreateResponse {
  output: {
    task_id: string;
    task_status: "PENDING";
  };
  request_id: string;
}

/**
 * kling-v3-video-generation 任务查询响应。
 */
export interface KlingV3VideoGenerationQueryResponse {
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
    video_url?: string;
    watermark_video_url?: string;
    code?: string;
    message?: string;
  };
  usage?: {
    duration: number;
    size: string;
    fps: number;
    SR: string;
    audio: boolean;
    video_count: number;
  };
}

/**
 * kling-v3-video-generation 错误响应。
 */
export interface KlingV3VideoGenerationErrorResponse {
  code: string;
  message: string;
  request_id: string;
}
