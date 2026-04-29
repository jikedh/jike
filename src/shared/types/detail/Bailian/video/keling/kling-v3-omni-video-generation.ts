/**
 * kling-v3-omni-video-generation 请求体。
 * API 文档: https://help.aliyun.com/zh/model-studio/kling-video-generation
 *
 * Omni 支持通过 prompt、媒体和主体引用进行文生视频、图生视频、参考视频生成
 * 以及视频编辑。
 */

export interface KlingV3OmniVideoGenerationRequest {
  model: "kling/kling-v3-omni-video-generation";
  input: {
    /**
     * 文本 prompt。
     *
     * 当 shot_type 为 intelligence 时必填。当 shot_type 为 customize 时忽略，
     * 此时使用 multi_prompt。对于参考生成，prompt 可以通过占位符引用媒体和主体，
     * 如 <<<image_1>>>、<<<video_1>>> 和 <<<element_1>>>。
     */
    prompt?: string;
    /**
     * 媒体资源。
     *
     * 支持的组合包括:
     * - first_frame
     * - first_frame + last_frame
     * - feature
     * - refer
     * - feature + refer
     * - feature + first_frame
     * - base
     * - base + refer
     */
    media?: Array<
      | {
        /** 首帧图片。 */
        type: "first_frame";
        /** HTTP 或 HTTPS 图片 URL。 */
        url: string;
      }
      | {
        /** 尾帧图片。 */
        type: "last_frame";
        /** HTTP 或 HTTPS 图片 URL。 */
        url: string;
      }
      | {
        /** 参考图片。 */
        type: "refer";
        /** HTTP 或 HTTPS 图片 URL。 */
        url: string;
      }
      | {
        /** 待编辑的源视频。 */
        type: "base";
        /** HTTP 或 HTTPS 视频 URL。 */
        url: string;
        /** 是否保留原视频声音。默认为 no。 */
        keep_original_sound?: "yes" | "no";
      }
      | {
        /** 特征参考视频。 */
        type: "feature";
        /** HTTP 或 HTTPS 视频 URL。 */
        url: string;
        /** 是否保留原视频声音。默认为 no。 */
        keep_original_sound?: "yes" | "no";
      }
    >;
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
    /** 视频中引用元素的的主体列表。这个不用管 */
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
     * 默认是 16:9 
     */
    aspect_ratio?: "16:9" | "9:16" | "1:1";
    /**
     * 视频持续时间（秒）。
     *
     * 有效范围为 3 到 15。当提供 base 或 feature 视频时，有效范围为 3 到 10。
     * 默认为 5。
     */
    duration?: number;
    /** 是否生成音频。默认为 false。 */
    audio?: boolean;
    /** 是否添加水印。默认为 false。 */
    watermark?: boolean;
  };
}

/**
 * kling-v3-omni-video-generation 创建任务成功响应。
 */
export interface KlingV3OmniVideoGenerationCreateResponse {
  output: {
    task_id: string;
    task_status: "PENDING";
  };
  request_id: string;
}

/**
 * kling-v3-omni-video-generation 任务查询响应。
 */
export interface KlingV3OmniVideoGenerationQueryResponse {
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
    orig_prompt?: string;
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
 * kling-v3-omni-video-generation 错误响应。
 */
export interface KlingV3OmniVideoGenerationErrorResponse {
  code: string;
  message: string;
  request_id: string;
}
