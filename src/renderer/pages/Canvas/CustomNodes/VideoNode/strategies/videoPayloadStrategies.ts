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
    // 根据模型名称推断 mode：fast/pro 后缀决定 mode 值，兜底走 metadata
    const modelName = nodeData.model ?? "";
    let mode: string;
    if (modelName.endsWith("-fast")) {
      mode = "fast";
    } else if (modelName.endsWith("-pro")) {
      mode = "pro";
    } else {
      mode = (nodeData.metadata as any)?.mode ?? "fast";
    }
    const minDuration = 4;
    const maxDuration = mode === "pro" ? 15 : 12;
    const rawDuration = nodeData.duration ?? 8;
    const nextDuration = Math.min(
      Math.max(rawDuration, minDuration),
      maxDuration,
    );

    const allImages = buildSeedance20Images(imageUrls);
    const effectiveGenerationMode =
      allImages.length > 0 && generationMode === VideoInputMode.TextToVideo
        ? VideoInputMode.MultiImageReference
        : generationMode;
    const firstLastImages = allImages.slice(0, 2).map((item, index) => ({
      url: item.url,
      role: index === 0 ? "first_frame" : "last_frame",
    }));
    const images =
      effectiveGenerationMode === VideoInputMode.ImageToVideo
        ? allImages.slice(0, 1)
        : effectiveGenerationMode === VideoInputMode.MultiImageReference
          ? allImages
          : effectiveGenerationMode === VideoInputMode.LastFrame
            ? firstLastImages
            : [];
    const videos = buildSeedance20Videos(videoUrls);
    const audios = buildSeedance20Audios(audioUrls);
    const hasImages = images.length > 0;
    const hasVideos = videos.length > 0;
    const hasAudios = audios.length > 0;
    const hasReferenceContent = hasImages || hasVideos || hasAudios;

    const videoInputType =
      effectiveGenerationMode === VideoInputMode.LastFrame
        ? "first_last_frame"
        : "reference";

    return {
      model: modelName, // 使用实际的模型名称（包含 -fast/-pro 后缀）
      prompt,
      generation_type: "video",
      mode,
      resolution: nodeData.metadata?.resolution ?? "720P",
      ratio: nodeData.aspect_ratio ?? "16:9",
      duration: nextDuration,
      generate_audio: nodeData.metadata?.generate_audio ?? true,
      seed: -1,
      web_search: false,
      ...(hasReferenceContent
        ? { input_type: videoInputType }
        : {}),
      ...(hasImages ? { images } : {}),
      ...(hasVideos ? { videos } : {}),
      ...(hasAudios ? { audios } : {}),
    };
  },
};

/**
 * Wan 2.7 r2v (万象) 策略
 * 参考 wan2.7-r2v API 文档构建请求体
 * 使用 input.prompt 和 input.media 构建输入，parameters 构建处理参数
 * 注意：watermark 不暴露给用户，保持 API 默认值
 */
const wan27R2vStrategy: VideoPayloadStrategy = {
  model: "wan2.7-r2v",
  buildPayload: (
    nodeData,
    { prompt, imageUrls, videoUrls = [] },
  ) => {
    const generationMode = resolveGenerationMode(nodeData, "wan2.7-r2v");

    // 构建 media 数组
    const media: Array<{ type: "reference_image" | "reference_video"; url: string }> = [];

    // 添加参考图片（图生视频或多图参考模式）
    if (generationMode === VideoInputMode.ImageToVideo || generationMode === VideoInputMode.MultiImageReference) {
      imageUrls
        .filter((url) => Boolean(url))
        .slice(0, 9)
        .forEach((url) => {
          media.push({ type: "reference_image", url });
        });
    }

    // 添加参考视频
    videoUrls
      .filter((url) => Boolean(url))
      .slice(0, 3)
      .forEach((url) => {
        media.push({ type: "reference_video", url });
      });

    // 构建 parameters
    const parameters: Record<string, unknown> = {
      resolution: nodeData.metadata?.resolution ?? "1080P",
      ratio: nodeData.aspect_ratio ?? "16:9",
      duration: nodeData.duration ?? 5,
      prompt_extend: (nodeData.metadata as any)?.prompt_extend ?? false,
      // watermark 保持 API 默认值，不暴露给用户
    };

    return {
      model: "wan2.7-r2v",
      input: {
        prompt,
        ...(media.length > 0 ? { media } : {}),
      },
      parameters,
    };
  },
};

/**
 * PixVerse (万象秒创) 策略
 * 参考 pixverse-i2v API 文档构建请求体
 * 使用 input.prompt 和 input.media 构建输入，parameters 构建处理参数
 */
const pixverseStrategy: VideoPayloadStrategy = {
  model: "pixverse-i2v",
  buildPayload: (
    nodeData,
    { prompt, imageUrls },
  ) => {
    // 构建 media 数组
    const media: Array<{ type: "image_url"; url: string }> = [];

    // 添加参考图片
    imageUrls
      .filter((url) => Boolean(url))
      .slice(0, 1) // PixVerse 通常只支持单张参考图
      .forEach((url) => {
        media.push({ type: "image_url", url });
      });

    // 获取子模型
    const subModel = (nodeData.metadata as any)?.subModel ?? "pixverse/pixverse-v6-it2v";

    return {
      model: subModel,
      input: {
        prompt: prompt || undefined,
        media,
      },
      parameters: {
        resolution: nodeData.metadata?.resolution ?? "720P",
        duration: nodeData.duration ?? 5,
        audio: (nodeData.metadata as any)?.audio ?? false,
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
  "wan2.7-t2v": wan27T2vStrategy,
  "wan2.7-r2v": wan27R2vStrategy,
  "pixverse-i2v": pixverseStrategy,
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
