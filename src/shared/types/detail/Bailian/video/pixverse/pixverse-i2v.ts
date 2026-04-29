/**
 * pixverse-i2v 请求体 - PixVerse 图生视频（基于首帧图像生成视频）
 * API 文档: https://help.aliyun.com/zh/model-studio/pixverse-image-to-video-api-reference
 *
 * 支持模型：
 * - pixverse/pixverse-c1-it2v：针对打斗、法术特效及高速运动等动态场景
 * - pixverse/pixverse-v6-it2v：通用场景推荐
 * - pixverse/pixverse-v5.6-it2v：建议直接升级至 v6
 */
export interface PixverseI2vRequest {
  /** 模型名称 */
  model:
    | "pixverse/pixverse-c1-it2v"
    | "pixverse/pixverse-v6-it2v"
    | "pixverse/pixverse-v5.6-it2v";
  /** 输入的基本信息 */
  input: {
    /**
     * 文本提示词（可选），用来描述生成视频中期望包含的元素和视觉特点。
     * 支持中英文，每个汉字/字母占一个字符，字符编码为UTF-8。
     * - pixverse/pixverse-c1-it2v、pixverse/pixverse-v6-it2v：不超过 5000 个字符
     * - pixverse/pixverse-v5.6-it2v：不超过 2048 个字符
     */
    prompt?: string;
    /** 媒体素材列表（必填），包含参考图像 */
    media: {
      /** 素材类型：image_url（参考图片） */
      type: "image_url";
      /** 素材 URL */
      url: string;
    }[];
  };
  /** 视频处理参数 */
  parameters?: {
    /** 生成视频的分辨率档位（必填），可选值：360P、540P、720P、1080P */
    resolution: "360P" | "540P" | "720P" | "1080P";
    /** 生成视频的时长，单位秒（必填） */
    duration: number;
    /** 是否生成音频，默认 false */
    audio?: boolean;
    /** 是否添加水印，默认 false */
    watermark?: boolean;
    /** 随机种子（可选），用于生成可复现的视频 */
    seed?: number;
  };
}

/**
 * pixverse-i2v 成功响应（创建任务）
 */
export interface PixverseI2vCreateResponse {
  output: {
    task_id: string;
    task_status: "PENDING";
  };
  request_id: string;
}

/**
 * pixverse-i2v 查询任务结果成功响应
 */
export interface PixverseI2vQueryResponse {
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
    size: string;
    fps: number;
    SR: string;
    audio: boolean;
  };
}

/**
 * pixverse-i2v 异常响应
 */
export interface PixverseI2vErrorResponse {
  code: string;
  message: string;
  request_id: string;
}
