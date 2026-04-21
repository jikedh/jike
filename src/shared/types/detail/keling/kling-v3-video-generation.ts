/**
 * kling-v3-video-generation 请求体 - 可灵视频生成（标准版）
 * API 文档: https://help.aliyun.com/zh/model-studio/kling-video-generation
 *
 * 支持文生视频、图生视频-基于首帧、图生视频-基于首尾帧、参考生视频
 */
export interface KlingV3VideoGenerationRequest {
  /** 模型名称 */
  model: "kling/kling-v3-video-generation";
  /** 输入的基本信息 */
  input: {
    /** 文本提示词，用来描述生成视频中期望包含的元素和视觉特点。支持中英文，不超过 2500 个字符 */
    prompt?: string;
    /** 多提示词（可选），当 shot_type=customize 时以此为准 */
    multi_prompt?: string;
    /** 首帧图片 URL（图生视频-基于首帧时使用） */
    first_frame_image?: string;
    /** 首视频片段 URL（图生视频-基于首尾帧时使用） */
    first_clip_video?: string;
    /** 尾视频片段 URL（图生视频-基于首尾帧时使用） */
    last_clip_video?: string;
    /** 参考图片 URL（参考生视频时使用） */
    reference_image?: string;
    /** 参考视频 URL（参考生视频时使用） */
    reference_video?: string;
    /** 源音频 URL（可选），传入音频文件作为视频的背景音 */
    source_audio?: string;
  };
  /** 视频处理参数（可选） */
  parameters?: {
    /** 视频生成模式：pro（专业模式，1080P）/ std（标准模式，720P），默认 pro */
    mode?: "pro" | "std";
    /** 生成视频的宽高比例，默认 16:9，可选 16:9、9:16、1:1 */
    aspect_ratio?: "16:9" | "9:16" | "1:1";
    /** 生成视频的时长，单位秒，默认 5，可选 5、10 */
    duration?: 5 | 10;
    /** 镜头类型：intelligence（智能分镜）/ customize（自定义），默认 customize */
    shot_type?: "intelligence" | "customize";
    /** 是否开启 prompt 智能改写 */
    prompt_extend?: boolean;
    /** 是否添加水印 */
    watermark?: boolean;
  };
}

/**
 * kling-v3-video-generation 成功响应（创建任务）
 */
export interface KlingV3VideoGenerationCreateResponse {
  output: {
    task_id: string;
    task_status: "PENDING";
  };
  request_id: string;
}

/**
 * kling-v3-video-generation 查询任务结果成功响应
 */
export interface KlingV3VideoGenerationQueryResponse {
  request_id: string;
  output: {
    task_id: string;
    task_status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED" | "UNKNOWN";
    submit_time: string;
    scheduled_time?: string;
    end_time?: string;
    video_url?: string;
    watermark_video_url?: string;
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
 * kling-v3-video-generation 异常响应
 */
export interface KlingV3VideoGenerationErrorResponse {
  code: string;
  message: string;
  request_id: string;
}
