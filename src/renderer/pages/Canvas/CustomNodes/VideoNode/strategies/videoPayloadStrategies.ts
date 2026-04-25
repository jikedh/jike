import type { VideoGenerationNode } from "shared/types/flow";

/**
 * 视频生成 Payload 构建策略接口
 * 每个视频模型实现自己的 payload 构建逻辑
 */
export interface VideoPayloadStrategy {
  model: string;
  buildPayload: (
    nodeData: VideoGenerationNode,
    inputs: {
      prompt: string;
      imageUrls: string[];
      videoUrls?: string[];
      audioUrls?: string[];
    },
  ) => Record<string, unknown>;
}

/**
 * Seedance 2.0 图像角色映射
 * 约定：按产品要求，所有参考图 role 统一使用 reference_image
 */
const buildSeedance20Images = (imageUrls: string[]) => {
  return imageUrls
    .filter((url) => Boolean(url))
    .slice(0, 9)
    .map((url) => ({
      url,
      role: "reference_image",
    }));
};

/**
 * Seedance 2.0 视频角色映射
 * 约定：所有参考视频 role 固定为 reference_video
 */
const buildSeedance20Videos = (videoUrls: string[]) => {
  return videoUrls
    .filter((url) => Boolean(url))
    .slice(0, 3)
    .map((url) => ({
      url,
      role: "reference_video" as const,
    }));
};

/**
 * Seedance 2.0 音频角色映射
 * 约定：所有参考音频 role 固定为 reference_audio
 */
const buildSeedance20Audios = (audioUrls: string[]) => {
  return audioUrls
    .filter((url) => Boolean(url))
    .slice(0, 3)
    .map((url) => ({
      url,
      role: "reference_audio" as const,
    }));
};

/**
 * Doubao Seedance 2.0 策略
 * 字段映射：使用 images（对象数组），并固定 generation_type=video
 * 支持视频和音频输入（仅 pro 模式）
 * 注意：input_type、seed、web_search 固定为默认值，不暴露给用户手动填写
 */
const doubaoSeedance20Strategy: VideoPayloadStrategy = {
  model: "doubao-seedance-2.0",
  buildPayload: (
    nodeData,
    { prompt, imageUrls, videoUrls = [], audioUrls = [] },
  ) => {
    const mode = nodeData.metadata?.mode ?? "fast";
    const minDuration = 4;
    const maxDuration = mode === "pro" ? 15 : 12;
    const rawDuration = nodeData.duration ?? 8;
    const nextDuration = Math.min(
      Math.max(rawDuration, minDuration),
      maxDuration,
    );

    const images = buildSeedance20Images(imageUrls);
    const videos = buildSeedance20Videos(videoUrls);
    const audios = buildSeedance20Audios(audioUrls);
    const hasImages = images.length > 0;
    const hasVideos = videos.length > 0;
    const hasAudios = audios.length > 0;
    const hasReferenceContent = hasImages || hasVideos || hasAudios;

    return {
      model: "doubao-seedance-2.0",
      prompt,
      generation_type: "video",
      mode,
      resolution: nodeData.metadata?.resolution ?? "720p",
      ratio: nodeData.aspect_ratio ?? "16:9",
      duration: nextDuration,
      generate_audio: nodeData.metadata?.generate_audio ?? true,
      seed: -1,
      web_search: false,
      ...(hasReferenceContent
        ? { video_input_type: "reference" as const }
        : {}),
      ...(hasImages ? { images } : {}),
      ...(hasVideos ? { videos } : {}),
      ...(hasAudios ? { audios } : {}),
    };
  },
};

/**
 * Wan 2.7 I2V 策略
 * 图生视频模型，输入一张参考图和提示词生成视频
 * 参考图映射为 input.media 数组，类型固定为 "image"
 */
const wan27I2vStrategy: VideoPayloadStrategy = {
  model: "wan2.7-i2v",
  buildPayload: (nodeData, { prompt, imageUrls }) => {
    const media = imageUrls
      .filter((url) => Boolean(url))
      .map((url) => ({
        type: "first_frame",
        url,
      }));

    return {
      model: "wan2.7-i2v",
      input: {
        prompt,
        ...(media.length > 0 ? { media } : {}),
      },
      parameters: {
        resolution: nodeData.metadata?.resolution ?? "720P",
        duration: nodeData.duration ?? 4,
      },
    };
  },
};

/**
 * Wan 2.7 R2V 策略
 * 参考生视频模型，以图片/视频为参考生成新视频
 * 支持多张参考图和多个参考视频作为输入
 * 参考图 type 为 "reference_video"，参考视频 type 为 "reference_video"
 */
const wan27R2vStrategy: VideoPayloadStrategy = {
  model: "wan2.7-r2v",
  buildPayload: (
    nodeData,
    { prompt, imageUrls, videoUrls = [] },
  ) => {
    const imageMedia = imageUrls
      .filter((url) => Boolean(url))
      .slice(0, 9)
      .map((url) => ({
        type: "reference_image" as const,
        url,
      }));

    const videoMedia = videoUrls
      .filter((url) => Boolean(url))
      .slice(0, 3)
      .map((url) => ({
        type: "reference_video" as const,
        url,
      }));

    const media = [...imageMedia, ...videoMedia];

    return {
      model: "wan2.7-r2v",
      input: {
        prompt,
        ...(media.length > 0 ? { media } : {}),
      },
      parameters: {
        resolution: nodeData.metadata?.resolution ?? "1080P",
        ratio: nodeData.aspect_ratio ?? "16:9",
        duration: nodeData.duration ?? 5,
        prompt_extend: false,
        watermark: false,
      },
    };
  },
};

/**
 * Wan 2.7 T2V 策略
 * 文生视频模型，基于文本提示词生成视频
 * 不支持参考图片或视频输入
 * 支持可选的背景音频和反向提示词
 */
const wan27T2vStrategy: VideoPayloadStrategy = {
  model: "wan2.7-t2v",
  buildPayload: (
    nodeData,
    { prompt, audioUrls = [] },
  ) => {
    const audioUrl = audioUrls.find((url) => Boolean(url));

    return {
      model: "wan2.7-t2v",
      input: {
        prompt,
      },
      parameters: {
        resolution: nodeData.metadata?.resolution ?? "1080P",
        ratio: nodeData.aspect_ratio ?? "16:9",
        duration: nodeData.duration ?? 5,
        prompt_extend: false,
        watermark: false,
        ...(audioUrl ? { audio_url: audioUrl } : {}),
      },
    };
  },
};

/**
 * 策略注册表
 */
export const videoPayloadStrategies: Record<string, VideoPayloadStrategy> = {
  "doubao-seedance-2.0": doubaoSeedance20Strategy,
  "wan2.7-i2v": wan27I2vStrategy,
  "wan2.7-t2v": wan27T2vStrategy,
  "wan2.7-r2v": wan27R2vStrategy,
};

/**
 * 获取指定模型的 payload 构建策略
 */
export const getVideoPayloadStrategy = (
  model: string,
): VideoPayloadStrategy => {
  const strategy = videoPayloadStrategies[model];
  if (!strategy) {
    throw new Error(`不支持的视频模型: ${model}`);
  }
  return strategy;
};
