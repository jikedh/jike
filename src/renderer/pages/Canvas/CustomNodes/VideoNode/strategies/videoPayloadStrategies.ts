import type { VideoGenerationNode } from "shared/types/flow";
import {
  getVideoModelCapability,
  pickFirstAvailableVideoMode,
  VideoInputMode,
} from "../constants/videoModelCapabilities";

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
 * 获取当前节点有效模式（非法模式会回退到模型默认模式）
 */
const resolveGenerationMode = (nodeData: VideoGenerationNode, model: string) => {
  const mode = nodeData.metadata?.generation_mode as VideoInputMode | undefined;
  const capability = getVideoModelCapability(model);
  return pickFirstAvailableVideoMode(capability, mode);
};

const getDuration = (nodeData: VideoGenerationNode, fallback: number) => {
  const rawDuration = Number(nodeData.duration ?? fallback);
  if (!Number.isFinite(rawDuration)) {
    return fallback;
  }
  return Math.max(1, rawDuration);
};

const getRatio = (nodeData: VideoGenerationNode) => {
  return nodeData.aspect_ratio ?? "16:9";
};

const toFirstLastFrameMedia = (imageUrls: string[]) => {
  const cleanUrls = imageUrls.filter((url) => Boolean(url));
  const first = cleanUrls[0];
  const last = cleanUrls[1];
  return [
    ...(first
      ? [
        {
          type: "first_frame" as const,
          url: first,
        },
      ]
      : []),
    ...(last
      ? [
        {
          type: "last_frame" as const,
          url: last,
        },
      ]
      : []),
  ];
};

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
    const generationMode = resolveGenerationMode(nodeData, "doubao-seedance-2.0");
    const mode = nodeData.metadata?.mode ?? "fast";
    const minDuration = 4;
    const maxDuration = mode === "pro" ? 15 : 12;
    const rawDuration = nodeData.duration ?? 8;
    const nextDuration = Math.min(
      Math.max(rawDuration, minDuration),
      maxDuration,
    );

    const allImages = buildSeedance20Images(imageUrls);
    const firstLastImages = allImages.slice(0, 2).map((item, index) => ({
      url: item.url,
      role: index === 0 ? "first_frame" : "last_frame",
    }));
    const images =
      generationMode === VideoInputMode.ImageToVideo
        ? allImages.slice(0, 1)
        : generationMode === VideoInputMode.MultiImageReference
          ? allImages
          : generationMode === VideoInputMode.LastFrame
            ? firstLastImages
            : [];
    const videos = buildSeedance20Videos(videoUrls);
    const audios = buildSeedance20Audios(audioUrls);
    const hasImages = images.length > 0;
    const hasVideos = videos.length > 0;
    const hasAudios = audios.length > 0;
    const hasReferenceContent = hasImages || hasVideos || hasAudios;

    const videoInputType =
      generationMode === VideoInputMode.LastFrame
        ? "first_last_frame"
        : "reference";

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
        ? { video_input_type: videoInputType }
        : {}),
      ...(hasImages ? { images } : {}),
      ...(hasVideos ? { videos } : {}),
      ...(hasAudios ? { audios } : {}),
    };
  },
};

/**
 * 策略注册表（仅豆包 Seedance 2.0）
 */
export const videoPayloadStrategies: Record<string, VideoPayloadStrategy> = {
  "doubao-seedance-2.0": doubaoSeedance20Strategy,
};

/**
 * 获取指定模型的 payload 构建策略
 */
export const getVideoPayloadStrategy = (
  model: string,
): VideoPayloadStrategy => {
  const strategy = videoPayloadStrategies[model];
  if (!strategy) {
    // 降级为 Seedance 2.0
    return doubaoSeedance20Strategy;
  }
  return strategy;
};
