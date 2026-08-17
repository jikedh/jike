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
  generationMode?: "fast" | "mini" | "pro" | "seedance2.5";
  duration: number;
  generateAudio: boolean;
  promptExtend?: boolean;
  /** 自动选择时长（勾选后传 duration: -1 给后端） */
  autoDuration?: boolean;
  /** 联网搜索增强（仅 Pro 模式可用） */
  webSearch?: boolean;
  // ===================== Agnes-Video-V2.0 专属字段 =====================
  /** 视频总帧数（num_frames：必须 ≤ 441 且满足 8n + 1） */
  agnesNumFrames?: number;
  /** 视频帧率（frame_rate：1-60） */
  agnesFrameRate?: number;
  /** 随机种子（保证结果可复现） */
  agnesSeed?: number;
  /** 负向提示词 */
  agnesNegativePrompt?: string;
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
  /** 自动选择时长复选框（Seedance 等模型专用） */
  autoDuration?: {
    label: string;
  };
  /** 联网搜索增强开关（Seedance Pro 专用） */
  webSearch?: {
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
const happyHorseRatios = [
  RATIO.wide,
  RATIO.vertical,
  RATIO.square,
  RATIO.classic,
  RATIO.portrait,
];
const audio = { label: "生成音频" };
const promptExtend = { label: "智能改写 Prompt" };

// vidu 的分辨率选项（支持 audio 和 seed）
const viduResolutions = [
  { label: "540p", value: "540P" },
  { label: "720p", value: "720P" },
  { label: "1080p", value: "1080P" },
];

// vidu-reference 的分辨率选项
const viduReferenceResolutions = viduResolutions;

const resolution480720 = [
  { label: "480p", value: "480P" },
  { label: "720p", value: "720P" },
];

const seedanceProResolutions = resolution480720.concat([
  { label: "1080p", value: "1080P" },
  { label: "4K", value: "4K" },
]);

const overseasSeedanceResolutions = seedanceProResolutions;

const resolution7201080 = resolution480720.concat([
  { label: "1080p", value: "1080P" },
]);

const wanxiangResolutions = [
  { label: "720p", value: "720P" },
  { label: "1080p", value: "1080P" },
];

const happyHorseResolutions = [
  { label: "720p", value: "720P" },
  { label: "1080p", value: "1080P" },
];

const pixverseResolutions = resolution7201080.concat([
  { label: "360p", value: "360P" },
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

// Agnes-Video-V2.0 常用的目标时长（以秒为单位），背后会按 frame_rate 24 推算 num_frames。
const agnesDurationPresets = [
  { label: "3s", value: 3 },
  { label: "5s", value: 5 },
  { label: "10s", value: 10 },
  { label: "18s", value: 18 },
];

const byModeKey = (modelId: string, mode: VideoModeKey) => `${modelId}:${mode}`;

const wanxiangReferenceConfig = (mode: VideoModeKey): VideoParamConfig => ({
  modelId: "wanxiang",
  mode,
  aspectRatios: squareRatios,
  qualityGroup: {
    key: "resolution",
    label: "分辨率",
    options: wanxiangResolutions,
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

const seedance20Config = (
  modelId:
    | "seedance-2.0-fast"
    | "seedance-2.0-mini"
    | "seedance-2.0-pro",
  generationMode: "fast" | "mini" | "pro",
): VideoParamConfig => ({
  modelId,
  aspectRatios: seedanceRatios,
  qualityGroup: {
    key: "resolution",
    label: "分辨率",
    options:
      generationMode === "pro" ? seedanceProResolutions : resolution480720,
  },
  duration: { type: "slider", min: 4, max: 15, step: 1 },
  audio,
  ...(generationMode === "pro"
    ? { webSearch: { label: "联网搜索增强" } }
    : {}),
  defaults: {
    aspectRatio: "16:9",
    resolution: "720P",
    // Fast/Pro 已经拆成两个模型，参数里只保留固定值给请求层使用，不再暴露成二级开关。
    generationMode,
    duration: 8,
    generateAudio: true,
    autoDuration: false,
    webSearch: false,
  },
});

const seedance25Config = (mode?: VideoModeKey): VideoParamConfig => {
  const requiresAdaptiveRatio =
    mode === "first-last-frame" || mode === "video-edit";

  return {
    modelId: "seedance-2.5",
    mode,
    aspectRatios: requiresAdaptiveRatio ? [RATIO.auto] : seedanceRatios,
    qualityGroup: {
      key: "resolution",
      label: "分辨率",
      options: resolution480720,
    },
    duration: { type: "slider", min: 4, max: 30, step: 1 },
    audio,
    defaults: {
      aspectRatio: requiresAdaptiveRatio ? "adaptive" : "16:9",
      resolution: "720P",
      generationMode: "seedance2.5",
      duration: 8,
      generateAudio: true,
      autoDuration: mode === "video-edit",
    },
  };
};

const overseasSeedance20Config = (): VideoParamConfig => ({
  modelId: "dreamina-seedance-2-0-260128",
  aspectRatios: seedanceRatios,
  qualityGroup: {
    key: "resolution",
    label: "分辨率",
    options: overseasSeedanceResolutions,
  },
  duration: { type: "slider", min: 4, max: 15, step: 1 },
  audio,
  defaults: {
    aspectRatio: "16:9",
    resolution: "720P",
    generationMode: "pro",
    duration: 5,
    generateAudio: true,
    autoDuration: false,
  },
});

const viduQ3Config = (
  modelId: "vidu" | "vidu-q3-pro",
  mode: VideoModeKey,
): VideoParamConfig => ({
  modelId,
  mode,
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
});

const happyHorseConfig = (mode: VideoModeKey): VideoParamConfig => ({
  modelId: "happyhorse",
  mode,
  aspectRatios:
    mode === "image-to-video" || mode === "video-edit"
      ? undefined
      : happyHorseRatios,
  qualityGroup: {
    key: "resolution",
    label: "分辨率",
    options: happyHorseResolutions,
  },
  duration:
    mode === "video-edit"
      ? { type: "buttons", options: [{ label: "原视频", value: 0 }] }
      : { type: "slider", min: 3, max: 15, step: 1 },
  defaults: {
    aspectRatio:
      mode === "image-to-video" || mode === "video-edit" ? undefined : "16:9",
    resolution: "1080P",
    duration: mode === "video-edit" ? 0 : 5,
    generateAudio: false,
  },
});

export const VIDEO_PARAM_CONFIGS: Record<string, VideoParamConfig> = {
  "seedance-2.5": seedance25Config(),
  [byModeKey("seedance-2.5", "text-to-video")]:
    seedance25Config("text-to-video"),
  [byModeKey("seedance-2.5", "all-reference")]:
    seedance25Config("all-reference"),
  [byModeKey("seedance-2.5", "image-to-video")]:
    seedance25Config("image-to-video"),
  [byModeKey("seedance-2.5", "video-edit")]:
    seedance25Config("video-edit"),
  [byModeKey("seedance-2.5", "first-last-frame")]:
    seedance25Config("first-last-frame"),
  "seedance-2.0-fast": seedance20Config("seedance-2.0-fast", "fast"),
  "seedance-2.0-mini": seedance20Config("seedance-2.0-mini", "mini"),
  "seedance-2.0-pro": seedance20Config("seedance-2.0-pro", "pro"),
  "dreamina-seedance-2-0-260128": overseasSeedance20Config(),
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
      options: wanxiangResolutions,
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
      options: wanxiangResolutions,
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
  vidu: viduQ3Config("vidu", "text-to-video"),
  [byModeKey("vidu", "image-to-video")]: viduQ3Config("vidu", "image-to-video"),
  // vidu 首尾帧模式
  [byModeKey("vidu", "first-last-frame")]: viduQ3Config(
    "vidu",
    "first-last-frame",
  ),
  "vidu-q3-pro": viduQ3Config("vidu-q3-pro", "text-to-video"),
  [byModeKey("vidu-q3-pro", "image-to-video")]: viduQ3Config(
    "vidu-q3-pro",
    "image-to-video",
  ),
  [byModeKey("vidu-q3-pro", "first-last-frame")]: viduQ3Config(
    "vidu-q3-pro",
    "first-last-frame",
  ),
  [byModeKey("happyhorse", "text-to-video")]: happyHorseConfig("text-to-video"),
  [byModeKey("happyhorse", "all-reference")]: happyHorseConfig("all-reference"),
  [byModeKey("happyhorse", "image-to-video")]:
    happyHorseConfig("image-to-video"),
  [byModeKey("happyhorse", "video-edit")]: happyHorseConfig("video-edit"),
  // Vidu Q2 仅保留历史兼容配置，新 UI 不再展示。
  [byModeKey("vidu-q2-fast", "image-to-video")]: {
    modelId: "vidu-q2-fast",
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
  [byModeKey("vidu-q2-pro", "image-to-video")]: {
    modelId: "vidu-q2-pro",
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
  [byModeKey("vidu-q2-pro", "all-reference")]: {
    modelId: "vidu-q2-pro",
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
  // vidu-reference 是旧数据兼容入口，新 UI 不再展示。
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
  // ===================== Agnes-Video-V2.0 =====================
  // Agnes 把宽高比、分辨率、帧数、帧率都暴露给前端。分辨率/帧率交给专门的 Agnes 面板控件；
  // 这里保留宽高比与通用时长以便与现有 VideoParamsPopover 共存。
  [byModeKey("agnes-video-v2.0", "text-to-video")]: {
    modelId: "agnes-video-v2.0",
    mode: "text-to-video",
    aspectRatios: [
      RATIO.wide,
      RATIO.vertical,
      RATIO.square,
      RATIO.classic,
      RATIO.portrait,
    ],
    duration: { type: "buttons", options: agnesDurationPresets },
    defaults: {
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: false,
      agnesNumFrames: 121,
      agnesFrameRate: 24,
    },
  },
  [byModeKey("agnes-video-v2.0", "image-to-video")]: {
    modelId: "agnes-video-v2.0",
    mode: "image-to-video",
    aspectRatios: [
      RATIO.wide,
      RATIO.vertical,
      RATIO.square,
      RATIO.classic,
      RATIO.portrait,
    ],
    duration: { type: "buttons", options: agnesDurationPresets },
    defaults: {
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: false,
      agnesNumFrames: 121,
      agnesFrameRate: 24,
    },
  },
  [byModeKey("MiniMax-H3", "text-to-video")]: {
    modelId: "MiniMax-H3",
    mode: "text-to-video",
    aspectRatios: [
      RATIO.cinema,
      RATIO.wide,
      RATIO.classic,
      RATIO.square,
      RATIO.portrait,
      RATIO.vertical,
    ],
    qualityGroup: {
      key: "resolution",
      label: "分辨率",
      options: [
        { label: "768P", value: "768P" },
        { label: "2K", value: "2K" },
      ],
    },
    duration: { type: "slider", min: 4, max: 15, step: 1 },
    audio,
    defaults: {
      aspectRatio: "16:9",
      resolution: "768P",
      duration: 5,
      generateAudio: true,
    },
  },
  [byModeKey("MiniMax-H3", "all-reference")]: {
    modelId: "MiniMax-H3",
    mode: "all-reference",
    aspectRatios: [
      RATIO.auto,
      RATIO.cinema,
      RATIO.wide,
      RATIO.classic,
      RATIO.square,
      RATIO.portrait,
      RATIO.vertical,
    ],
    qualityGroup: {
      key: "resolution",
      label: "分辨率",
      options: [
        { label: "768P", value: "768P" },
        { label: "2K", value: "2K" },
      ],
    },
    duration: { type: "slider", min: 4, max: 15, step: 1 },
    audio,
    defaults: {
      aspectRatio: "adaptive",
      resolution: "768P",
      duration: 5,
      generateAudio: true,
    },
  },
  [byModeKey("MiniMax-H3", "image-to-video")]: {
    modelId: "MiniMax-H3",
    mode: "image-to-video",
    qualityGroup: {
      key: "resolution",
      label: "分辨率",
      options: [
        { label: "768P", value: "768P" },
        { label: "2K", value: "2K" },
      ],
    },
    duration: { type: "slider", min: 4, max: 15, step: 1 },
    audio,
    defaults: {
      resolution: "768P",
      duration: 5,
      generateAudio: true,
    },
  },
  [byModeKey("MiniMax-H3", "first-last-frame")]: {
    modelId: "MiniMax-H3",
    mode: "first-last-frame",
    qualityGroup: {
      key: "resolution",
      label: "分辨率",
      options: [
        { label: "768P", value: "768P" },
        { label: "2K", value: "2K" },
      ],
    },
    duration: { type: "slider", min: 4, max: 15, step: 1 },
    audio,
    defaults: {
      resolution: "768P",
      duration: 5,
      generateAudio: true,
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

  if (modelId === "seedance-2.5" && mode === "video-edit") {
    next.autoDuration = true;
  }

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

  if (!config.generationMode) {
    // Fast/Pro 拆成独立模型后，历史参数里残留的 generationMode 不能覆盖当前模型的固定档位。
    next.generationMode = config.defaults.generationMode;
  }

  return next;
};
