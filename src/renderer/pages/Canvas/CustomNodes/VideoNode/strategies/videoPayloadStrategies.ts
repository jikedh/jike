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

const getResolution720 = (nodeData: VideoGenerationNode) => {
  return nodeData.metadata?.resolution ?? "720P";
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
 * Wan 2.7 I2V 策略
 * 图生视频模型，输入一张参考图和提示词生成视频
 * 参考图映射为 input.media 数组，类型固定为 "image"
 */
const wan27I2vStrategy: VideoPayloadStrategy = {
  model: "wan2.7-i2v",
  buildPayload: (nodeData, { prompt, imageUrls }) => {
    const generationMode = resolveGenerationMode(nodeData, "wan2.7-i2v");
    const media =
      generationMode === VideoInputMode.LastFrame
        ? toFirstLastFrameMedia(imageUrls)
        : imageUrls.filter((url) => Boolean(url)).slice(0, 1).map((url) => ({
          type: "first_frame" as const,
          url,
        }));

    return {
      model: "wan2.7-i2v",
      input: {
        prompt,
        ...(media.length > 0 ? { media } : {}),
      },
      parameters: {
        resolution: getResolution720(nodeData),
        duration: getDuration(nodeData, 4),
      },
    };
  },
};

/**
 * Wan 2.7 T2V 策略
 */
const wan27T2vStrategy: VideoPayloadStrategy = {
  model: "wan2.7-t2v",
  buildPayload: (nodeData, { prompt, audioUrls = [] }) => {
    const firstAudioUrl = audioUrls.find((url) => Boolean(url));
    return {
      model: "wan2.7-t2v",
      input: {
        prompt,
      },
      parameters: {
        resolution: getResolution720(nodeData),
        ratio: getRatio(nodeData),
        duration: getDuration(nodeData, 4),
        ...(firstAudioUrl ? { audio_url: firstAudioUrl } : {}),
      },
    };
  },
};

/**
 * Wan 2.7 R2V 策略
 */
const wan27R2vStrategy: VideoPayloadStrategy = {
  model: "wan2.7-r2v",
  buildPayload: (nodeData, { prompt, imageUrls, videoUrls = [] }) => {
    const generationMode = resolveGenerationMode(nodeData, "wan2.7-r2v");
    const cleanImages = imageUrls.filter((url) => Boolean(url));
    const cleanVideos = videoUrls.filter((url) => Boolean(url));

    const imageMedia =
      generationMode === VideoInputMode.MultiImageReference
        ? cleanImages.map((url) => ({
          type: "reference_image" as const,
          url,
        }))
        : cleanImages.slice(0, 1).map((url) => ({
          type: "reference_image" as const,
          url,
        }));

    const videoMedia = cleanVideos.slice(0, 1).map((url) => ({
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
        resolution: getResolution720(nodeData),
        ratio: getRatio(nodeData),
        duration: getDuration(nodeData, 4),
      },
    };
  },
};

/**
 * PixVerse 文生视频策略
 */
const createPixverseT2vStrategy = (model: string): VideoPayloadStrategy => {
  return {
    model,
    buildPayload: (nodeData, { prompt }) => {
      return {
        model,
        input: {
          prompt,
        },
        parameters: {
          size: nodeData.metadata?.size ?? "1280*720",
          duration: getDuration(nodeData, 5),
          watermark: nodeData.metadata?.watermark ?? false,
        },
      };
    },
  };
};

/**
 * PixVerse 图生视频策略
 */
const createPixverseI2vStrategy = (model: string): VideoPayloadStrategy => {
  return {
    model,
    buildPayload: (nodeData, { prompt, imageUrls }) => {
      const firstImage = imageUrls.find((url) => Boolean(url));
      return {
        model,
        input: {
          ...(prompt ? { prompt } : {}),
          media: firstImage
            ? [
              {
                type: "image_url",
                url: firstImage,
              },
            ]
            : [],
        },
        parameters: {
          resolution: getResolution720(nodeData),
          duration: getDuration(nodeData, 5),
          watermark: nodeData.metadata?.watermark ?? false,
        },
      };
    },
  };
};

/**
 * PixVerse 首尾帧策略
 */
const createPixverseKf2vStrategy = (model: string): VideoPayloadStrategy => {
  return {
    model,
    buildPayload: (nodeData, { prompt, imageUrls }) => {
      const media = toFirstLastFrameMedia(imageUrls);
      return {
        model,
        input: {
          prompt,
          media,
        },
        parameters: {
          resolution: getResolution720(nodeData),
          duration: getDuration(nodeData, 5),
          watermark: nodeData.metadata?.watermark ?? false,
        },
      };
    },
  };
};

/**
 * PixVerse 多图参考策略
 */
const createPixverseR2vStrategy = (model: string): VideoPayloadStrategy => {
  return {
    model,
    buildPayload: (nodeData, { prompt, imageUrls }) => {
      const generationMode = resolveGenerationMode(nodeData, model);
      const cleanImages = imageUrls.filter((url) => Boolean(url));
      const media =
        generationMode === VideoInputMode.MultiImageReference
          ? cleanImages
          : cleanImages.slice(0, 1);

      return {
        model,
        input: {
          prompt,
          media: media.map((url, index) => ({
            type: "image_url",
            url,
            ref_name: `ref_${index + 1}`,
          })),
        },
        parameters: {
          size: nodeData.metadata?.size ?? "1280*720",
          duration: getDuration(nodeData, 5),
          watermark: nodeData.metadata?.watermark ?? false,
        },
      };
    },
  };
};

/**
 * 可灵策略
 */
const createKlingStrategy = (model: string): VideoPayloadStrategy => {
  return {
    model,
    buildPayload: (nodeData, { prompt, imageUrls, videoUrls = [], audioUrls = [] }) => {
      const generationMode = resolveGenerationMode(nodeData, model);
      const firstImage = imageUrls.find((url) => Boolean(url));
      const secondImage = imageUrls.filter((url) => Boolean(url))[1];
      const firstVideo = videoUrls.find((url) => Boolean(url));
      const secondVideo = videoUrls.filter((url) => Boolean(url))[1];
      const firstAudio = audioUrls.find((url) => Boolean(url));

      return {
        model,
        input: {
          ...(prompt ? { prompt } : {}),
          ...(generationMode === VideoInputMode.ImageToVideo && firstImage
            ? { first_frame_image: firstImage }
            : {}),
          ...(generationMode === VideoInputMode.LastFrame && firstVideo
            ? { first_clip_video: firstVideo }
            : {}),
          ...(generationMode === VideoInputMode.LastFrame && secondVideo
            ? { last_clip_video: secondVideo }
            : {}),
          ...(generationMode === VideoInputMode.LastFrame && !firstVideo && firstImage
            ? { first_frame_image: firstImage }
            : {}),
          ...(generationMode === VideoInputMode.LastFrame && !secondVideo && secondImage
            ? { reference_image: secondImage }
            : {}),
          ...(firstAudio ? { source_audio: firstAudio } : {}),
        },
        parameters: {
          mode: (nodeData.metadata?.mode as "pro" | "std" | undefined) ?? "pro",
          aspect_ratio: getRatio(nodeData),
          duration: Math.min(10, getDuration(nodeData, 5)),
          watermark: nodeData.metadata?.watermark ?? false,
        },
      };
    },
  };
};

/**
 * Vidu 文生视频策略
 */
const viduQ3TurboT2vStrategy: VideoPayloadStrategy = {
  model: "vidu/viduq3-turbo_text2video",
  buildPayload: (nodeData, { prompt }) => {
    return {
      model: "vidu/viduq3-turbo_text2video",
      input: {
        prompt,
      },
      parameters: {
        resolution: getResolution720(nodeData),
        size: nodeData.metadata?.size,
        duration: getDuration(nodeData, 4),
        watermark: nodeData.metadata?.watermark ?? false,
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
  "wan2.7-i2v": wan27I2vStrategy,
  "wan2.7-r2v": wan27R2vStrategy,

  "pixverse/pixverse-c1-t2v": createPixverseT2vStrategy(
    "pixverse/pixverse-c1-t2v",
  ),
  "pixverse/pixverse-v6-t2v": createPixverseT2vStrategy(
    "pixverse/pixverse-v6-t2v",
  ),
  "pixverse/pixverse-v5.6-t2v": createPixverseT2vStrategy(
    "pixverse/pixverse-v5.6-t2v",
  ),

  "pixverse/pixverse-c1-it2v": createPixverseI2vStrategy(
    "pixverse/pixverse-c1-it2v",
  ),
  "pixverse/pixverse-v6-it2v": createPixverseI2vStrategy(
    "pixverse/pixverse-v6-it2v",
  ),
  "pixverse/pixverse-v5.6-it2v": createPixverseI2vStrategy(
    "pixverse/pixverse-v5.6-it2v",
  ),

  "pixverse/pixverse-c1-kf2v": createPixverseKf2vStrategy(
    "pixverse/pixverse-c1-kf2v",
  ),
  "pixverse/pixverse-v6-kf2v": createPixverseKf2vStrategy(
    "pixverse/pixverse-v6-kf2v",
  ),
  "pixverse/pixverse-v5.6-kf2v": createPixverseKf2vStrategy(
    "pixverse/pixverse-v5.6-kf2v",
  ),

  "pixverse/pixverse-c1-r2v": createPixverseR2vStrategy(
    "pixverse/pixverse-c1-r2v",
  ),
  "pixverse/pixverse-v5.6-r2v": createPixverseR2vStrategy(
    "pixverse/pixverse-v5.6-r2v",
  ),

  "kling/kling-v3-video-generation": createKlingStrategy(
    "kling/kling-v3-video-generation",
  ),
  "kling/kling-v3-omni-video-generation": createKlingStrategy(
    "kling/kling-v3-omni-video-generation",
  ),

  "vidu/viduq3-turbo_text2video": viduQ3TurboT2vStrategy,
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
