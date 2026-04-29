/**
 * pixverse-r2v 请求体 - PixVerse 参考生视频
 * API 文档: https://help.aliyun.com/zh/model-studio/pixverse-reference-to-video-api-reference
 *
 * 支持模型：
 * - pixverse/pixverse-c1-r2v：针对打斗、法术特效、高速运动及多宫格场景
 * - pixverse/pixverse-v5.6-r2v：通用场景
 *
 * 通过 media 传入参考图像，prompt 中可通过 @ref_name 引用参考图主体
 */
export interface PixverseR2vRequest {
  /** 模型名称 */
  model: "pixverse/pixverse-c1-r2v" | "pixverse/pixverse-v5.6-r2v";
  /** 输入的基本信息 */
  input: {
    /**
     * 文本提示词，用来描述生成视频中期望包含的元素和视觉特点。
     * 支持中英文，每个汉字/字母占一个字符，字符编码为UTF-8。
     * - pixverse/pixverse-c1-r2v：不超过 5000 个字符
     * - pixverse/pixverse-v5.6-r2v：不超过 2048 个字符
     * 可通过 @ref_name 引用 media 中的参考图主体，如 @小猫 表示引用 ref_name="小猫" 的图片
     */
    prompt: string;
    /** 参考图片数组，通过 type 指定素材类型 */
    media: {
      /** 素材类型：image_url（参考图片） */
      type: "image_url";
      /** 素材 URL */
      url: string;
      /** 参考图名称（可选），用于在 prompt 中通过 @ref_name 引用该图片主体 */
      ref_name?: string;
    }[];
  };
  /** 视频处理参数 */
  parameters: {
    /** 生成视频的分辨率，格式为 宽*高 的像素值，如 "1280*720" */
    size: string;
    /** 生成视频的时长，单位秒 */
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
 * pixverse-r2v 成功响应（创建任务）
 */
export interface PixverseR2vCreateResponse {
  output: {
    task_id: string;
    task_status: "PENDING";
  };
  request_id: string;
}

/**
 * pixverse-r2v 查询任务结果成功响应
 */
export interface PixverseR2vQueryResponse {
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
 * pixverse-r2v 异常响应
 */
export interface PixverseR2vErrorResponse {
  code: string;
  message: string;
  request_id: string;
}
