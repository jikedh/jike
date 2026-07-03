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
  Wan27T2vRequest
} from "shared/types/detail/Bailian/video";
import type { Seedance20Request } from "shared/types/detail/kuaizhi/Seedance-2.0";
import type { VideoGenerateRequest } from "../components/BottomParamsBar";
import type { VideoModeKey } from "../constants/videoModelCapabilities";

export type NewVideoApiRequest =
  | Seedance20Request
  | OverseasSeedance20Request
  | BailianVideoGenerationRequest
  | ViduQ3Image2VideoRequest
  | AgnesVideoRequest;

type OverseasSeedance20ContentItem =
  | {
    type: "text";
    text: string;
  }
  | {
    type: "image_url";
    role: "reference_image" | "first_frame" | "last_frame";
    image_url: { url: string };
  }
  | {
    type: "video_url";
    role: "reference_video";
    video_url: { url: string };
  }
  | {
    type: "audio_url";
    role: "reference_audio";
    audio_url: { url: string };
  };

export type OverseasSeedance20Request = {
  model: "dreamina-seedance-2-0-260128";
  content: OverseasSeedance20ContentItem[];
  resolution: "480p" | "720p" | "1080p" | "4k";
  ratio: "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "21:9" | "adaptive";
  duration: number;
  generate_audio: boolean;
  watermark: false;
  seed: -1;
};

// Agnes-Video-V2.0 请求体：完全对齐 apihub.agnes-ai.com 的 POST /v1/videos 入参。
type AgnesVideoRequest = {
  model: "agnes-video-v2.0";
  prompt: string;
  // 图生视频（单张图片动画化）：传单个图片 URL。
  image?: string;
  // 多图视频生成 / 关键帧动画：传图片 URL 数组，必要时附带 mode。
  extra_body?: {
    image?: string[];
    mode?: "keyframes";
  };
  width?: number;
  height?: number;
  num_frames?: number;
  frame_rate?: number;
  num_inference_steps?: number;
  seed?: number;
  negative_prompt?: string;
};
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

export const isOverseasSeedanceModel = (model: string) =>
  model === "dreamina-seedance-2-0-260128";

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
    duration: request.params.autoDuration
      ? -1
      : clampNumber(request.params.duration, 4, 15, 8),
    generate_audio: request.params.generateAudio,
    seed: -1,
    web_search: request.params.webSearch ?? false,
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

const buildOverseasSeedanceImages = (
  mode: VideoModeKey,
  images: string[],
): OverseasSeedance20ContentItem[] => {
  if (mode === "text-to-video") {
    return [];
  }

  if (mode === "first-last-frame") {
    return images.slice(0, 2).map((url, index) => ({
      type: "image_url" as const,
      role: index === 0 ? ("first_frame" as const) : ("last_frame" as const),
      image_url: { url },
    }));
  }

  return images.slice(0, 9).map((url) => ({
    type: "image_url" as const,
    role: "reference_image" as const,
    image_url: { url },
  }));
};

const buildOverseasSeedanceRequest = (
  request: VideoGenerateRequest,
): OverseasSeedance20Request => {
  const supportsReferenceMedia =
    request.mode !== "text-to-video" && request.mode !== "first-last-frame";
  const content: OverseasSeedance20ContentItem[] = [
    {
      type: "text",
      text: getPrompt(request.prompt),
    },
    ...buildOverseasSeedanceImages(request.mode, getImages(request)),
    ...(supportsReferenceMedia
      ? getVideos(request).slice(0, 3).map((url) => ({
        type: "video_url" as const,
        role: "reference_video" as const,
        video_url: { url },
      }))
      : []),
    ...(supportsReferenceMedia
      ? getAudios(request).slice(0, 3).map((url) => ({
        type: "audio_url" as const,
        role: "reference_audio" as const,
        audio_url: { url },
      }))
      : []),
  ];

  return {
    model: "dreamina-seedance-2-0-260128",
    content,
    resolution: isOneOf(
      request.params.resolution?.toLowerCase(),
      ["480p", "720p", "1080p", "4k"] as const,
      "720p",
    ),
    ratio: isOneOf(
      getRatio(request),
      ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"] as const,
      "16:9",
    ),
    duration: clampNumber(request.params.duration, 4, 15, 5),
    generate_audio: request.params.generateAudio,
    watermark: false,
    seed: -1,
  };
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
    case "dreamina-seedance-2-0-260128":
      return buildOverseasSeedanceRequest(request);
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
    case "keling":
      return buildKelingRequest(request);
    case "agnes-video-v2.0":
      return buildAgnesRequest(request);
    default:
      return buildSeedanceRequest(request);
  }
};

// ============ Agnes-Video-V2.0 ============
// 宽高比 → width / height 标准化映射
const AGNES_RATIO_SIZES: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1152, height: 768 },
  "9:16": { width: 768, height: 1152 },
  "1:1": { width: 960, height: 960 },
  "4:3": { width: 1024, height: 768 },
  "3:4": { width: 768, height: 1024 },
};

// num_frames 必须满足 8n+1 且 ≤ 441
const sanitizeAgnesNumFrames = (value: number | undefined, fallback: number) => {
  if (!Number.isFinite(value)) return fallback;
  const v = Math.max(1, Math.min(441, Math.round(Number(value))));
  return v - ((v - 1) % 8);
};

// frame_rate 限制在 1-60
const sanitizeAgnesFrameRate = (value: number | undefined, fallback: number) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(60, Math.round(Number(value))));
};

// 把通用 duration（秒）按 frame_rate 推算 num_frames，作为缺省值兜底
const estimateAgnesNumFrames = (seconds: number, frameRate: number) => {
  const frames = Math.round(seconds * frameRate);
  return sanitizeAgnesNumFrames(frames, 121);
};

// 中文数字 → 阿拉伯数字
const CHINESE_NUMERALS: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

const chineseToNumber = (text: string): number | null => {
  // 简单支持 1-19：一二三四五六七八九十 十一 十二 ... 十九
  if (text.length === 1) {
    const direct = CHINESE_NUMERALS[text];
    return typeof direct === "number" ? direct : null;
  }
  if (text.length === 2 && text[0] === "十") {
    return 10 + (CHINESE_NUMERALS[text[1]] ?? 0);
  }
  if (text.length === 2 && text[1] === "十") {
    return (CHINESE_NUMERALS[text[0]] ?? 0) * 10;
  }
  return null;
};

// 把 prompt 中 "图片N"（N 是中文或阿拉伯数字）替换为对应的图片名称。
// 仅 image-to-video 模式生效；imageNames 与 getImages() 顺序一致。
const replaceImageMentions = (
  prompt: string,
  imageNames: string[],
): string => {
  if (!prompt || imageNames.length === 0) return prompt;
  return prompt.replace(/图片([0-9〇零一二三四五六七八九十]{1,3})/g, (_, token) => {
    let index: number | null = null;
    if (/^\d+$/.test(token)) {
      index = Number.parseInt(token, 10);
    } else {
      index = chineseToNumber(token);
    }
    if (index === null || index < 1 || index > imageNames.length) {
      return token; // 保持原样，避免误替换
    }
    return imageNames[index - 1] ?? token;
  });
};

// 按图片参考顺序提取名称，与 getImages() 顺序保持一致。
const getImageNames = (request: VideoGenerateRequest): string[] =>
  request.referenceItems
    .filter((item) => item.type === "image")
    .map((item) => item.label);

const buildAgnesRequest = (request: VideoGenerateRequest): AgnesVideoRequest => {
  const images = getImages(request);
  const ratio = isOneOf(
    getRatio(request),
    ["16:9", "9:16", "1:1", "4:3", "3:4"] as const,
    "16:9",
  );
  const size = AGNES_RATIO_SIZES[ratio] ?? AGNES_RATIO_SIZES["16:9"]!;

  const frameRate = sanitizeAgnesFrameRate(
    request.params.agnesFrameRate,
    24,
  );
  const numFrames =
    request.params.agnesNumFrames && request.params.agnesNumFrames > 0
      ? sanitizeAgnesNumFrames(request.params.agnesNumFrames, 121)
      : estimateAgnesNumFrames(request.params.duration, frameRate);

  const body: AgnesVideoRequest = {
    model: "agnes-video-v2.0",
    prompt: getPrompt(request.prompt),
    width: size.width,
    height: size.height,
    num_frames: numFrames,
    frame_rate: frameRate,
  };

  const negativePrompt = request.params.agnesNegativePrompt?.trim();
  if (negativePrompt) {
    body.negative_prompt = negativePrompt;
  }

  if (
    typeof request.params.agnesSeed === "number" &&
    Number.isFinite(request.params.agnesSeed)
  ) {
    body.seed = Math.trunc(request.params.agnesSeed);
  }

  if (request.mode === "image-to-video") {
    // Agnes-Video-V2.0 图生视频：
    //   1 张 → 走顶层 image（单图动画化，apihub 要求 string）
    //   多张 → 走 extra_body.image（多图视频生成 / 关键帧动画）
    const referenceImages = images.slice(0, 10);
    if (referenceImages.length === 1) {
      body.image = referenceImages[0];
    } else if (referenceImages.length > 1) {
      body.extra_body = {
        ...(body.extra_body ?? {}),
        image: referenceImages,
      };
    }
    if (referenceImages.length > 0) {
      // 用户在输入框中 @ 提及 "图片1" / "图片二" 时，需要把字面量替换为对应图片名称
      // 再发送给上游；其它模式不涉及参考图，跳过此步。
      body.prompt = replaceImageMentions(body.prompt, getImageNames(request));
    }
  }

  return body;
};
