import type { VideoModeKey } from "./videoModelCapabilities";

export type VideoParamOption = {
  label: string;
  value: string | number;
};

export type VideoDurationConfig =
  | {
    type: "slider";
    min: number;
    max: number;
    step?: number;
  }
  | {
    type: "buttons";
    options: VideoParamOption[];
  };

export type VideoParamState = {
  aspectRatio?: string;
  resolution?: string;
  quality?: string;
  generationMode?: "fast" | "pro";
  duration: number;
  generateAudio: boolean;
  promptExtend?: boolean;
};

export type VideoParamConfig = {
  modelId: string;
  mode?: VideoModeKey;
  aspectRatios?: VideoParamOption[];
  qualityGroup?: {
    key: "resolution" | "quality";
    label: string;
    options: VideoParamOption[];
  };
  generationMode?: {
    label: string;
    options: VideoParamOption[];
  };
  duration: VideoDurationConfig;
  audio?: {
    label: string;
  };
  promptExtend?: {
    label: string;
  };
  defaults: VideoParamState;
};

const RATIO = {
  auto: { label: "Auto", value: "adaptive" },
  wide: { label: "16:9", value: "16:9" },
  classic: { label: "4:3", value: "4:3" },
  square: { label: "1:1", value: "1:1" },
  portrait: { label: "3:4", value: "3:4" },
  vertical: { label: "9:16", value: "9:16" },
  cinema: { label: "21:9", value: "21:9" },
};

const seedanceRatios = [
  RATIO.auto,
  RATIO.wide,
  RATIO.classic,
  RATIO.square,
  RATIO.portrait,
  RATIO.vertical,
  RATIO.cinema,
];

const squareRatios = [RATIO.wide, RATIO.vertical, RATIO.square];
const audio = { label: "生成音频" };
const promptExtend = { label: "智能改写 Prompt" };

// vidu 的分辨率选项（支持 audio 和 seed）
const viduResolutions = [
  { label: "540P", value: "540P" },
  { label: "720P", value: "720P" },
  { label: "1080P", value: "1080P" },
];

// vidu-reference 的分辨率选项
const viduReferenceResolutions = viduResolutions;

const resolution480720 = [
  { label: "480P", value: "480P" },
  { label: "720P", value: "720P" },
];

const resolution7201080 = resolution480720.concat([
  { label: "1080P", value: "1080P" },
]);

const pixverseResolutions = resolution7201080.concat([
  { label: "360P", value: "360P" },
]);

const duration4_5_8 = {
  type: "buttons" as const,
  options: [
    { label: "4s", value: 4 },
    { label: "5s", value: 5 },
    { label: "8s", value: 8 },
  ],
};

const duration4_5_10 = {
  type: "buttons" as const,
  options: [
    { label: "4s", value: 4 },
    { label: "5s", value: 5 },
    { label: "10s", value: 10 },
  ],
};

const byModeKey = (modelId: string, mode: VideoModeKey) => `${modelId}:${mode}`;

const wanxiangReferenceConfig = (mode: VideoModeKey): VideoParamConfig => ({
  modelId: "wanxiang",
  mode,
  aspectRatios: squareRatios,
  qualityGroup: {
    key: "resolution",
    label: "分辨率",
    options: resolution7201080,
  },
  duration: { type: "slider", min: 2, max: 15, step: 1 },
  promptExtend,
  defaults: {
    aspectRatio: "16:9",
    resolution: "1080P",
    duration: 5,
    generateAudio: false,
    promptExtend: false,
  },
});

const pixverseSizeConfig = (mode: VideoModeKey): VideoParamConfig => ({
  modelId: "pixverse",
  mode,
  aspectRatios: squareRatios,
  qualityGroup: {
    key: "resolution",
    label: "分辨率",
    options: pixverseResolutions,
  },
  duration: duration4_5_8,
  audio,
  defaults: {
    aspectRatio: "16:9",
    resolution: "720P",
    duration: 5,
    generateAudio: false,
  },
});

export const VIDEO_PARAM_CONFIGS: Record<string, VideoParamConfig> = {
  "seedance-2.0-pro": {
    modelId: "seedance-2.0-pro",
    aspectRatios: seedanceRatios,
    qualityGroup: {
      key: "resolution",
      label: "分辨率",
      options: resolution480720,
    },
    generationMode: {
      label: "生成模式",
      options: [
        { label: "Fast", value: "fast" },
        { label: "Pro", value: "pro" },
      ],
    },
    duration: { type: "slider", min: 4, max: 15, step: 1 },
    audio,
    defaults: {
      aspectRatio: "16:9",
      resolution: "720P",
      generationMode: "pro",
      duration: 8,
      generateAudio: true,
    },
  },
  [byModeKey("wanxiang", "text-to-video")]:
    wanxiangReferenceConfig("text-to-video"),
  [byModeKey("wanxiang", "all-reference")]:
    wanxiangReferenceConfig("all-reference"),
  [byModeKey("wanxiang", "image-to-video")]: {
    modelId: "wanxiang",
    mode: "image-to-video",
    qualityGroup: {
      key: "resolution",
      label: "分辨率",
      options: resolution7201080,
    },
    duration: duration4_5_10,
    promptExtend,
    defaults: {
      resolution: "1080P",
      duration: 5,
      generateAudio: false,
      promptExtend: false,
    },
  },
  [byModeKey("wanxiang", "first-last-frame")]: {
    modelId: "wanxiang",
    mode: "first-last-frame",
    qualityGroup: {
      key: "resolution",
      label: "分辨率",
      options: resolution7201080,
    },
    duration: duration4_5_10,
    promptExtend,
    defaults: {
      resolution: "1080P",
      duration: 5,
      generateAudio: false,
      promptExtend: false,
    },
  },
  vidu: {
    modelId: "vidu",
    mode: "text-to-video",
    aspectRatios: squareRatios,
    qualityGroup: {
      key: "resolution",
      label: "分辨率",
      options: viduResolutions,
    },
    duration: { type: "slider", min: 1, max: 16, step: 1 },
    audio,
    defaults: {
      aspectRatio: "16:9",
      resolution: "720P",
      duration: 5,
      generateAudio: false,
    },
  },
  // vidu 首尾帧模式
  [byModeKey("vidu", "first-last-frame")]: {
    modelId: "vidu",
    mode: "first-last-frame",
    aspectRatios: squareRatios,
    qualityGroup: {
      key: "resolution",
      label: "分辨率",
      options: viduResolutions,
    },
    duration: { type: "slider", min: 1, max: 16, step: 1 },
    audio,
    defaults: {
      aspectRatio: "16:9",
      resolution: "720P",
      duration: 5,
      generateAudio: false,
    },
  },
  // vidu-reference 全能参考模式
  [byModeKey("vidu-reference", "all-reference")]: {
    modelId: "vidu-reference",
    mode: "all-reference",
    aspectRatios: squareRatios,
    qualityGroup: {
      key: "resolution",
      label: "分辨率",
      options: viduReferenceResolutions,
    },
    duration: { type: "slider", min: 1, max: 10, step: 1 },
    audio,
    defaults: {
      aspectRatio: "16:9",
      resolution: "720P",
      duration: 5,
      generateAudio: false,
    },
  },
  // vidu-reference 图生视频模式
  [byModeKey("vidu-reference", "image-to-video")]: {
    modelId: "vidu-reference",
    mode: "image-to-video",
    aspectRatios: squareRatios,
    qualityGroup: {
      key: "resolution",
      label: "分辨率",
      options: viduReferenceResolutions,
    },
    duration: { type: "slider", min: 1, max: 10, step: 1 },
    audio,
    defaults: {
      aspectRatio: "16:9",
      resolution: "720P",
      duration: 5,
      generateAudio: false,
    },
  },
  [byModeKey("pixverse", "text-to-video")]: pixverseSizeConfig("text-to-video"),
  [byModeKey("pixverse", "all-reference")]: pixverseSizeConfig("all-reference"),
  [byModeKey("pixverse", "image-to-video")]: {
    modelId: "pixverse",
    mode: "image-to-video",
    qualityGroup: {
      key: "resolution",
      label: "分辨率",
      options: pixverseResolutions,
    },
    duration: duration4_5_8,
    audio,
    defaults: {
      resolution: "720P",
      duration: 5,
      generateAudio: false,
    },
  },
  [byModeKey("pixverse", "first-last-frame")]: {
    modelId: "pixverse",
    mode: "first-last-frame",
    qualityGroup: {
      key: "resolution",
      label: "分辨率",
      options: pixverseResolutions,
    },
    duration: duration4_5_8,
    audio,
    defaults: {
      resolution: "720P",
      duration: 5,
      generateAudio: false,
    },
  },
  keling: {
    modelId: "keling",
    aspectRatios: [RATIO.wide, RATIO.vertical, RATIO.square],
    qualityGroup: {
      key: "quality",
      label: "生成模式",
      options: [
        { label: "Std", value: "std" },
        { label: "Pro", value: "pro" },
      ],
    },
    duration: { type: "slider", min: 3, max: 15, step: 1 },
    audio,
    defaults: {
      aspectRatio: "16:9",
      quality: "std",
      duration: 5,
      generateAudio: false,
    },
  },
};

export const getVideoParamConfig = (modelId: string, mode?: VideoModeKey) =>
  (mode ? VIDEO_PARAM_CONFIGS[byModeKey(modelId, mode)] : undefined) ??
  VIDEO_PARAM_CONFIGS[modelId] ??
  VIDEO_PARAM_CONFIGS["seedance-2.0-pro"];

const optionContains = (
  options: VideoParamOption[] | undefined,
  value: string | number | undefined,
) => options?.some((option) => option.value === value) ?? false;

const normalizeDuration = (
  duration: number | undefined,
  config: VideoDurationConfig,
  fallback: number,
) => {
  if (!Number.isFinite(duration)) {
    return fallback;
  }

  if (config.type === "buttons") {
    return optionContains(config.options, duration)
      ? Number(duration)
      : fallback;
  }

  const min = config.min;
  const max = config.max;
  const step = config.step ?? 1;
  const clamped = Math.min(Math.max(Number(duration), min), max);
  return Math.round(clamped / step) * step;
};

export const normalizeVideoParams = (
  modelId: string,
  current?: Partial<VideoParamState>,
  mode?: VideoModeKey,
): VideoParamState => {
  const config = getVideoParamConfig(modelId, mode);
  const next: VideoParamState = {
    ...config.defaults,
    ...current,
  };

  if (!optionContains(config.aspectRatios, next.aspectRatio)) {
    next.aspectRatio = config.defaults.aspectRatio;
  }

  if (config.qualityGroup?.key === "resolution") {
    if (!optionContains(config.qualityGroup.options, next.resolution)) {
      next.resolution = config.defaults.resolution;
    }
    next.quality = undefined;
  } else if (config.qualityGroup?.key === "quality") {
    if (!optionContains(config.qualityGroup.options, next.quality)) {
      next.quality = config.defaults.quality;
    }
    next.resolution = undefined;
  } else {
    next.resolution = undefined;
    next.quality = undefined;
  }

  next.duration = normalizeDuration(
    next.duration,
    config.duration,
    config.defaults.duration,
  );

  if (!config.audio) {
    next.generateAudio = config.defaults.generateAudio;
  }

  if (!config.promptExtend) {
    next.promptExtend = undefined;
  } else {
    next.promptExtend = Boolean(next.promptExtend);
  }

  return next;
};
