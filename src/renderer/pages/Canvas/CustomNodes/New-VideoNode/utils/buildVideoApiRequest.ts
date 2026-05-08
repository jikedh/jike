import type {
  BailianVideoGenerationRequest,
  KlingV3OmniVideoGenerationRequest,
  KlingV3VideoGenerationRequest,
  PixverseI2vRequest,
  PixverseKf2vRequest,
  PixverseR2vRequest,
  PixverseT2vRequest,
  ViduQ2Reference2VideoRequest,
  ViduQ3TurboStartEnd2VideoRequest,
  ViduQ3TurboText2VideoRequest,
  Wan27I2vRequest,
  Wan27R2vRequest,
  Wan27T2vRequest,
} from "shared/types/detail/Bailian/video";
import type { Seedance20Request } from "shared/types/detail/kuaizhi/Seedance-2.0";
import type {
  Adobe2ApiVideoGenerationRequest,
  Sora2ProVideoRequest,
} from "shared/types/detail/Adobe2API";

import type { VideoGenerateRequest } from "../components/BottomParamsBar";
import type { VideoModeKey } from "../constants/videoModelCapabilities";

export type NewVideoApiRequest =
  | Seedance20Request
  | BailianVideoGenerationRequest
  | ViduQ3Image2VideoRequest
  | Adobe2ApiVideoGenerationRequest;

type ViduQ3Image2VideoRequest = {
  model: "vidu/viduq3_turbo_img2video" | "vidu/viduq3-pro_img2video";
  input: {
    prompt?: string;
    media: Array<{
      type: "image";
      url: string;
    }>;
  };
  parameters: {
    resolution?: "540P" | "720P" | "1080P";
    size?: string;
    duration?: number;
    audio?: boolean;
    watermark?: boolean;
  };
};

const isOneOf = <T extends string>(
  value: string | undefined,
  values: readonly T[],
  fallback: T,
): T => (values.includes(value as T) ? (value as T) : fallback);

const clampNumber = (
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
) => {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(Number(value), min), max);
};

const pickDuration = <T extends number>(
  value: number | undefined,
  allowed: readonly T[],
  fallback: T,
): T => (allowed.includes(value as T) ? (value as T) : fallback);

const getPrompt = (prompt: string) => prompt.trim();

const isUrl = (value: string | undefined) =>
  Boolean(value?.match(/^https?:\/\//));

const getReferenceUrl = (
  item: VideoGenerateRequest["referenceItems"][number],
) => {
  const optionalUrl = (item as { url?: string }).url;
  return [item.thumbnail, optionalUrl, item.value].find(isUrl);
};

const getReferenceUrls = (
  request: VideoGenerateRequest,
  type: VideoGenerateRequest["referenceItems"][number]["type"],
) =>
  request.referenceItems
    .filter((item) => item.type === type)
    .map(getReferenceUrl)
    .filter(Boolean);

const getImages = (request: VideoGenerateRequest) =>
  getReferenceUrls(request, "image");

const getVideos = (request: VideoGenerateRequest) =>
  getReferenceUrls(request, "video");

const getAudios = (request: VideoGenerateRequest) =>
  getReferenceUrls(request, "audio");

const getRatio = (request: VideoGenerateRequest) =>
  request.params.aspectRatio ?? "16:9";

const getSquareRatio = (request: VideoGenerateRequest) =>
  isOneOf(getRatio(request), ["16:9", "9:16", "1:1"] as const, "16:9");

const getHappyHorseRatio = (request: VideoGenerateRequest) =>
  isOneOf(
    getRatio(request),
    ["16:9", "9:16", "1:1", "4:3", "3:4"] as const,
    "16:9",
  );

const getHappyHorseResolution = (request: VideoGenerateRequest) =>
  isOneOf(request.params.resolution, ["720P", "1080P"] as const, "1080P");

const getAdobeVideoRatioSuffix = (request: VideoGenerateRequest) =>
  isOneOf(getRatio(request), ["16:9", "9:16"] as const, "16:9") === "9:16"
    ? "9x16"
    : "16x9";

const buildAdobeSora2ProRequest = (
  request: VideoGenerateRequest,
): Sora2ProVideoRequest => {
  const image = getImages(request)[0];
  const duration = pickDuration(request.params.duration, [4, 8, 12] as const, 4);
  const model =
    `firefly-sora2-pro-${duration}s-${getAdobeVideoRatioSuffix(request)}` as const;

  return {
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: getPrompt(request.prompt) },
          ...(image
            ? [{ type: "image_url" as const, image_url: { url: image } }]
            : []),
        ],
      },
    ],
    generate_audio: request.params.generateAudio ?? true,
    ...(image ? { reference_mode: "image" as const } : {}),
  };
};

const getAdobeVeo31Resolution = (request: VideoGenerateRequest) =>
  isOneOf(
    request.params.resolution?.toLowerCase(),
    ["720p", "1080p"] as const,
    "720p",
  );

const buildAdobeImageContentParts = (images: string[]) =>
  images.map((url) => ({
    type: "image_url" as const,
    image_url: { url },
  }));

const buildAdobeVeo31Request = (
  request: VideoGenerateRequest,
): Adobe2ApiVideoGenerationRequest => {
  const images = getImages(request);
  const duration = pickDuration(request.params.duration, [4, 6, 8] as const, 4);
  const ratio = getAdobeVideoRatioSuffix(request);
  const resolution = getAdobeVeo31Resolution(request);
  const promptPart = { type: "text" as const, text: getPrompt(request.prompt) };

  if (request.model === "adobe-veo31-fast") {
    const model =
      `firefly-veo31-fast-${duration}s-${ratio}-${resolution}` as const;
    const imageParts = buildAdobeImageContentParts(
      request.mode === "text-to-video" ? [] : images.slice(0, 2),
    );
    return {
      model,
      messages: [
        {
          role: "user",
          content: [promptPart, ...imageParts],
        },
      ],
      generate_audio: request.params.generateAudio ?? true,
      ...(imageParts.length > 0 ? { reference_mode: "frame" as const } : {}),
    };
  }

  const referenceMode = request.mode === "all-reference" ? "image" : "frame";
  const modelPrefix =
    request.mode === "all-reference" ? "firefly-veo31-ref" : "firefly-veo31";
  const model =
    `${modelPrefix}-${duration}s-${ratio}-${resolution}` as Adobe2ApiVideoGenerationRequest["model"];

  return {
    model,
    messages: [
      {
        role: "user",
        content: [
          promptPart,
          ...buildAdobeImageContentParts(
            request.mode === "text-to-video"
              ? []
              : request.mode === "all-reference"
                ? images.slice(0, 3)
                : images.slice(0, 2),
          ),
        ],
      },
    ],
    generate_audio: request.params.generateAudio ?? true,
    ...(request.mode === "text-to-video"
      ? {}
      : { reference_mode: referenceMode }),
  } as Adobe2ApiVideoGenerationRequest;
};

const getSeedanceGenerationMode = (
  request: VideoGenerateRequest,
): "fast" | "pro" => {
  // 新节点现在与旧版一致：Seedance Fast/Pro 是两个模型，接口里的 mode 由模型 ID 固定。
  if (request.model === "seedance-2.0-fast") {
    return "fast";
  }
  if (request.model === "seedance-2.0-pro") {
    return "pro";
  }
  return request.params.generationMode ?? "pro";
};

const isViduQ2ProModel = (model: string) =>
  model === "vidu-reference" ||
  model === "vidu-q2-pro" ||
  model === "vidu-q2-pro-reference" ||
  model === "vidu-q2-pro-image-to-video";

const isViduQ2FastModel = (model: string) => model === "vidu-q2-fast";

const isViduQ3ProModel = (model: string) => model === "vidu-q3-pro";

const buildSize = (
  resolution: string | undefined,
  ratio: string | undefined,
) => {
  const longSide = (() => {
    switch (resolution) {
      case "360P":
        return 640;
      case "540P":
        return 960;
      case "1080P":
        return 1920;
      case "720P":
      default:
        return 1280;
    }
  })();

  const shortSide = Math.round((longSide / 16) * 9);

  switch (ratio) {
    case "9:16":
      return `${shortSide}*${longSide}`;
    case "1:1":
      return `${shortSide}*${shortSide}`;
    case "16:9":
    default:
      return `${longSide}*${shortSide}`;
  }
};

const buildSeedanceImages = (mode: VideoModeKey, images: string[]) => {
  if (mode === "text-to-video") {
    return [];
  }

  if (mode === "first-last-frame") {
    return images.slice(0, 2).map((url, index) => ({
      url,
      role: index === 0 ? ("first_frame" as const) : ("last_frame" as const),
    }));
  }

  if (mode === "image-to-video") {
    return images.slice(0, 9).map((url) => ({
      url,
      role: "reference_image" as const,
    }));
  }

  return images.slice(0, 9).map((url) => ({
    url,
    role: "reference_image" as const,
  }));
};

const buildSeedanceRequest = (
  request: VideoGenerateRequest,
): Seedance20Request => {
  const images = buildSeedanceImages(request.mode, getImages(request));
  const supportsReferenceMedia =
    request.mode !== "text-to-video" && request.mode !== "first-last-frame";
  const videos = supportsReferenceMedia
    ? getVideos(request)
        .slice(0, 3)
        .map((url) => ({
          url,
          role: "reference_video" as const,
        }))
    : [];
  const audios = supportsReferenceMedia
    ? getAudios(request)
        .slice(0, 3)
        .map((url) => ({
          url,
          role: "reference_audio" as const,
        }))
    : [];
  const body: Seedance20Request = {
    model: request.model,
    prompt: getPrompt(request.prompt),
    generation_type: "video",
    mode: getSeedanceGenerationMode(request),
    // Seedance 2.0 接口类型使用小写 p，前端历史配置可能仍是大写，传参前统一归一化。
    resolution: isOneOf(
      request.params.resolution?.toLowerCase(),
      ["480p", "720p"] as const,
      "720p",
    ),
    ratio: isOneOf(
      getRatio(request),
      ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"] as const,
      "16:9",
    ),
    duration: clampNumber(request.params.duration, 4, 15, 8),
    generate_audio: request.params.generateAudio,
    seed: -1,
    web_search: false,
  };

  if (request.mode === "first-last-frame" && images.length > 0) {
    body.input_type = "first_last_frame";
    body.images = images;
  } else if (images.length > 0 || videos.length > 0 || audios.length > 0) {
    body.input_type = "reference";
    if (images.length > 0) {
      body.images = images;
    }
    if (videos.length > 0) {
      body.videos = videos;
    }
    if (audios.length > 0) {
      body.audios = audios;
    }
  }

  return body;
};

const buildWanxiangRequest = (request: VideoGenerateRequest) => {
  const images = getImages(request);
  const videos = getVideos(request);
  const firstAudio = getAudios(request)[0];
  const resolution = isOneOf(
    request.params.resolution,
    ["720P", "1080P"] as const,
    "1080P",
  );
  const promptExtend = request.params.promptExtend ?? false;

  if (request.mode === "text-to-video") {
    const body: Wan27T2vRequest = {
      model: "wan2.7-t2v",
      input: {
        prompt: getPrompt(request.prompt),
      },
      parameters: {
        resolution,
        ratio: getSquareRatio(request),
        duration: request.params.duration,
        prompt_extend: promptExtend,
        watermark: false,
      },
    };
    return body;
  }

  if (
    request.mode === "image-to-video" ||
    request.mode === "first-last-frame"
  ) {
    const media: Wan27I2vRequest["input"]["media"] =
      request.mode === "first-last-frame"
        ? images.slice(0, 2).map((url, index) => ({
            type: index === 0 ? "first_frame" : "last_frame",
            url,
          }))
        : images.slice(0, 1).map((url) => ({
            type: "first_frame",
            url,
          }));

    const body: Wan27I2vRequest = {
      model: "wan2.7-i2v",
      input: {
        prompt: getPrompt(request.prompt) || undefined,
        media,
      },
      parameters: {
        resolution,
        duration: pickDuration(request.params.duration, [4, 5, 10] as const, 5),
        prompt_extend: promptExtend,
        watermark: false,
      },
    };
    return body;
  }

  const media: NonNullable<Wan27R2vRequest["input"]["media"]> = [
    ...images.map((url) => ({
      type: "reference_image" as const,
      url,
      ...(firstAudio ? { reference_voice: firstAudio } : {}),
    })),
    ...videos.map((url) => ({
      type: "reference_video" as const,
      url,
      ...(firstAudio ? { reference_voice: firstAudio } : {}),
    })),
  ].slice(0, 9);

  const body: Wan27R2vRequest = {
    model: "wan2.7-r2v",
    input: {
      prompt: getPrompt(request.prompt),
      media,
    },
    parameters: {
      resolution,
      ratio: getSquareRatio(request),
      duration: request.params.duration,
      prompt_extend: promptExtend,
      watermark: false,
    },
  };
  return body;
};

const buildViduRequest = (
  request: VideoGenerateRequest,
): ViduQ3TurboText2VideoRequest => {
  const resolution = isOneOf(
    request.params.resolution,
    ["540P", "720P", "1080P"] as const,
    "720P",
  );

  return {
    // Vidu Q3 Pro/Turbo 在 UI 上是两个模型，底层按同一任务模式切换模型名。
    model: isViduQ3ProModel(request.model)
      ? "vidu/viduq3-pro_text2video"
      : "vidu/viduq3_turbo_text2video",
    input: {
      prompt: getPrompt(request.prompt),
    },
    parameters: {
      resolution,
      size: buildSize(resolution, getSquareRatio(request)),
      duration: request.params.duration,
      audio: request.params.generateAudio,
      watermark: false,
    },
  };
};

// 构建 Vidu Q3 图生视频请求
const buildViduImageRequest = (
  request: VideoGenerateRequest,
): ViduQ3Image2VideoRequest => {
  const images = getImages(request);
  const resolution = isOneOf(
    request.params.resolution,
    ["540P", "720P", "1080P"] as const,
    "720P",
  );

  return {
    model: isViduQ3ProModel(request.model)
      ? "vidu/viduq3-pro_img2video"
      : "vidu/viduq3_turbo_img2video",
    input: {
      prompt: getPrompt(request.prompt) || undefined,
      media: images.slice(0, 1).map((url) => ({
        type: "image" as const,
        url,
      })),
    },
    parameters: {
      resolution,
      size: buildSize(resolution, getSquareRatio(request)),
      duration: clampNumber(request.params.duration, 1, 16, 5),
      audio: request.params.generateAudio,
      watermark: false,
    },
  };
};

// 构建 vidu 首尾帧请求
const buildViduStartEndRequest = (
  request: VideoGenerateRequest,
): ViduQ3TurboStartEnd2VideoRequest => {
  const images = getImages(request);
  const resolution = isOneOf(
    request.params.resolution,
    ["540P", "720P", "1080P"] as const,
    "720P",
  );
  const audio = request.params.generateAudio;

  // 确保有至少 2 张图片才能使用首尾帧模式
  const firstImage = images[0] ?? "";
  const secondImage = images[1] ?? images[0] ?? "";

  return {
    model: isViduQ3ProModel(request.model)
      ? "vidu/viduq3-pro_start-end2video"
      : "vidu/viduq3_turbo_start-end2video",
    input: {
      prompt: getPrompt(request.prompt),
      media: [
        { type: "image" as const, url: firstImage },
        { type: "image" as const, url: secondImage },
      ],
    },
    parameters: {
      resolution,
      duration: clampNumber(request.params.duration, 1, 16, 5),
      audio,
      watermark: false,
    },
  };
};

// 构建 vidu-reference 请求（全能参考 / 图生视频）
const buildViduReferenceRequest = (
  request: VideoGenerateRequest,
): ViduQ2Reference2VideoRequest => {
  const images = getImages(request);
  const videos = getVideos(request);
  const resolution = isOneOf(
    request.params.resolution,
    ["540P", "720P", "1080P"] as const,
    "720P",
  );

  return {
    // Vidu Q2 Fast/Pro 使用不同底层模型名；旧 vidu-reference 兼容为 Pro。
    model: isViduQ2FastModel(request.model)
      ? "vidu/viduq2_reference2video"
      : "vidu/viduq2-pro_reference2video",
    input: {
      prompt: getPrompt(request.prompt),
      media: [
        ...images.slice(0, 7).map((url) => ({
          type: "image" as const,
          url,
        })),
        ...(isViduQ2FastModel(request.model) ? [] : videos.slice(0, 1)).map(
          (url) => ({
            type: "video" as const,
            url,
          }),
        ),
      ],
    },
    parameters: {
      resolution,
      size: buildSize(resolution, getSquareRatio(request)),
      duration: request.params.duration,
      watermark: false,
    },
  };
};

const buildPixverseRequest = (request: VideoGenerateRequest) => {
  const images = getImages(request);
  const resolution = isOneOf(
    request.params.resolution,
    ["360P", "540P", "720P", "1080P"] as const,
    "720P",
  );
  const duration = request.params.duration;
  const audio = request.params.generateAudio;

  if (request.mode === "text-to-video") {
    const body: PixverseT2vRequest = {
      model: "pixverse/pixverse-v6-t2v",
      input: {
        prompt: getPrompt(request.prompt),
      },
      parameters: {
        size: buildSize(resolution, getSquareRatio(request)),
        duration,
        audio,
        watermark: false,
      },
    };
    return body;
  }

  if (request.mode === "first-last-frame") {
    const body: PixverseKf2vRequest = {
      model: "pixverse/pixverse-v6-kf2v",
      input: {
        prompt: getPrompt(request.prompt),
        media: images.slice(0, 2).map((url, index) => ({
          type: index === 0 ? "first_frame" : "last_frame",
          url,
        })),
      },
      parameters: {
        resolution,
        duration,
        audio,
        watermark: false,
      },
    };
    return body;
  }

  if (request.mode === "all-reference") {
    const body: PixverseR2vRequest = {
      model: "pixverse/pixverse-c1-r2v",
      input: {
        prompt: getPrompt(request.prompt),
        media: images.slice(0, 9).map((url) => ({
          type: "image_url",
          url,
        })),
      },
      parameters: {
        size: buildSize(resolution, getSquareRatio(request)),
        duration,
        audio,
        watermark: false,
      },
    };
    return body;
  }

  const body: PixverseI2vRequest = {
    model: "pixverse/pixverse-v6-it2v",
    input: {
      prompt: getPrompt(request.prompt) || undefined,
      media: images.slice(0, 1).map((url) => ({
        type: "image_url",
        url,
      })),
    },
    parameters: {
      resolution,
      duration,
      audio,
      watermark: false,
    },
  };
  return body;
};

const buildKelingVideoInput = (
  request: VideoGenerateRequest,
): KlingV3VideoGenerationRequest["input"] => {
  const images = getImages(request);
  const input: KlingV3VideoGenerationRequest["input"] = {
    prompt: getPrompt(request.prompt) || undefined,
  };

  if (request.mode === "image-to-video" && images.length > 0) {
    input.media = [{ type: "first_frame", url: images[0] }];
  }

  if (request.mode === "first-last-frame" && images.length > 0) {
    input.media = images.slice(0, 2).map((url, index) => ({
      type: index === 0 ? "first_frame" : "last_frame",
      url,
    }));
  }

  return input;
};

const buildKelingOmniInput = (
  request: VideoGenerateRequest,
): KlingV3OmniVideoGenerationRequest["input"] => {
  const images = getImages(request);
  const videos = getVideos(request);
  const input: KlingV3OmniVideoGenerationRequest["input"] = {
    prompt: getPrompt(request.prompt) || undefined,
  };

  if (request.mode === "image-to-video" && images.length > 0) {
    input.media = [{ type: "first_frame", url: images[0] }];
  }

  if (request.mode === "first-last-frame" && images.length > 0) {
    input.media = images.slice(0, 2).map((url, index) => ({
      type: index === 0 ? "first_frame" : "last_frame",
      url,
    }));
  }

  if (
    request.mode === "all-reference" &&
    (images.length > 0 || videos.length > 0)
  ) {
    input.media = [
      ...images.map((url) => ({
        type: "refer" as const,
        url,
      })),
      ...videos.map((url) => ({
        type: "feature" as const,
        url,
      })),
    ].slice(0, 7);
  }

  return input;
};

const buildKelingRequest = (
  request: VideoGenerateRequest,
): KlingV3VideoGenerationRequest | KlingV3OmniVideoGenerationRequest => {
  const isOmni = request.mode === "all-reference";
  const parameters = {
    mode: isOneOf(request.params.quality, ["std", "pro"] as const, "std"),
    aspect_ratio: getSquareRatio(request),
    duration: clampNumber(request.params.duration, 3, 15, 5),
    audio: request.params.generateAudio,
    watermark: false,
  };

  if (isOmni) {
    return {
      model: "kling/kling-v3-omni-video-generation",
      input: buildKelingOmniInput(request),
      parameters,
    };
  }

  return {
    model: "kling/kling-v3-video-generation",
    input: buildKelingVideoInput(request),
    parameters,
  };
};

const buildHappyHorseRequest = (request: VideoGenerateRequest) => {
  const images = getImages(request);
  const videos = getVideos(request);
  const resolution = getHappyHorseResolution(request);
  const duration = clampNumber(request.params.duration, 3, 15, 5);

  if (request.mode === "text-to-video") {
    return {
      model: "happyhorse-1.0-t2v",
      input: {
        prompt: getPrompt(request.prompt),
      },
      parameters: {
        resolution,
        ratio: getHappyHorseRatio(request),
        duration,
        watermark: false,
      },
    } satisfies BailianVideoGenerationRequest;
  }

  if (request.mode === "image-to-video") {
    return {
      model: "happyhorse-1.0-i2v",
      input: {
        prompt: getPrompt(request.prompt) || undefined,
        media: images.slice(0, 1).map((url) => ({
          type: "first_frame" as const,
          url,
        })),
      },
      parameters: {
        resolution,
        duration,
        watermark: false,
      },
    } satisfies BailianVideoGenerationRequest;
  }

  if (request.mode === "video-edit") {
    return {
      model: "happyhorse-1.0-video-edit",
      input: {
        prompt: getPrompt(request.prompt),
        media: [
          ...videos.slice(0, 1).map((url) => ({
            type: "video" as const,
            url,
          })),
          ...images.slice(0, 5).map((url) => ({
            type: "reference_image" as const,
            url,
          })),
        ],
      },
      parameters: {
        resolution,
        watermark: false,
        audio_setting: "auto",
      },
    } satisfies BailianVideoGenerationRequest;
  }

  return {
    model: "happyhorse-1.0-r2v",
    input: {
      prompt: getPrompt(request.prompt),
      media: images.slice(0, 9).map((url) => ({
        type: "reference_image" as const,
        url,
      })),
    },
    parameters: {
      resolution,
      ratio: getHappyHorseRatio(request),
      duration,
      watermark: false,
    },
  } satisfies BailianVideoGenerationRequest;
};

export const buildVideoApiRequest = (
  request: VideoGenerateRequest,
): NewVideoApiRequest => {
  // Vidu Q2 Fast/Pro 在 UI 上拆成两个模型，底层走对应的 reference2video 请求。
  if (isViduQ2FastModel(request.model) || isViduQ2ProModel(request.model)) {
    return buildViduReferenceRequest(request);
  }

  switch (request.model) {
    case "seedance-2.0-fast":
    case "seedance-2.0-pro":
      return buildSeedanceRequest(request);
    case "wanxiang":
      return buildWanxiangRequest(request);
    case "vidu":
    case "vidu-q3-pro":
      // vidu 首尾帧模式
      if (request.mode === "first-last-frame") {
        return buildViduStartEndRequest(request);
      }
      if (request.mode === "image-to-video") {
        return buildViduImageRequest(request);
      }
      // 默认文生视频模式
      return buildViduRequest(request);
    case "pixverse":
      return buildPixverseRequest(request);
    case "happyhorse":
      return buildHappyHorseRequest(request);
    case "adobe-sora2-pro":
      return buildAdobeSora2ProRequest(request);
    case "adobe-veo31":
    case "adobe-veo31-fast":
      return buildAdobeVeo31Request(request);
    case "keling":
      return buildKelingRequest(request);
    default:
      return buildSeedanceRequest(request);
  }
};
