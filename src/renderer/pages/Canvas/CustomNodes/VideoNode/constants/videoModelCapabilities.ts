/**
 * 视频输入模式（底部四按钮）
 */
export enum VideoInputMode {
  TextToVideo = "text-to-video",
  ImageToVideo = "image-to-video",
  LastFrame = "first-last-frame",
  MultiImageReference = "multi-image-reference",
}

/**
 * 单个模型能力描述
 */
export type VideoModelCapability = {
  callable: boolean;
  supportedModes: VideoInputMode[];
  defaultMode: VideoInputMode;
};

/**
 * 模型能力（仅豆包 Seedance 2.0）
 */
const MODEL_CAPABILITY_OVERRIDES: Record<string, Partial<VideoModelCapability>> = {
  "doubao-seedance-2.0": {
    supportedModes: [
      VideoInputMode.TextToVideo,
      VideoInputMode.ImageToVideo,
      VideoInputMode.MultiImageReference,
    ],
    defaultMode: VideoInputMode.TextToVideo,
    callable: true,
  },
};

/**
 * 获取模型能力（仅豆包 Seedance 2.0）
 */
export const getVideoModelCapability = (model: string): VideoModelCapability => {
  const override = MODEL_CAPABILITY_OVERRIDES[model] ?? MODEL_CAPABILITY_OVERRIDES["doubao-seedance-2.0"];
  return {
    callable: override.callable ?? true,
    supportedModes: override.supportedModes ?? [
      VideoInputMode.TextToVideo,
      VideoInputMode.ImageToVideo,
      VideoInputMode.MultiImageReference,
    ],
    defaultMode: override.defaultMode ?? VideoInputMode.TextToVideo,
  };
};

/**
 * 从候选模式中选择第一个可用模式
 */
export const pickFirstAvailableVideoMode = (
  capability: VideoModelCapability,
  preferred?: VideoInputMode,
) => {
  if (preferred && capability.supportedModes.includes(preferred)) {
    return preferred;
  }

  if (capability.supportedModes.includes(capability.defaultMode)) {
    return capability.defaultMode;
  }

  return capability.supportedModes[0] ?? VideoInputMode.TextToVideo;
};

/**
 * 视频模式按钮定义
 */
export const VIDEO_MODE_BUTTONS = [
  {
    key: VideoInputMode.TextToVideo,
    label: "文生视频",
  },
  {
    key: VideoInputMode.ImageToVideo,
    label: "图生视频",
  },
  {
    key: VideoInputMode.LastFrame,
    label: "首尾帧",
  },
  {
    key: VideoInputMode.MultiImageReference,
    label: "多图参考",
  },
] as const;

/**
 * 模型族标识（仅豆包 Seedance 2.0）
 */
export type VideoModelFamily = "doubao-seedance-2.0";

/**
 * 模型族选项（仅一个）
 */
export const VIDEO_MODEL_FAMILY_OPTIONS = [
  { value: "doubao-seedance-2.0" as const, label: "豆包 Seedance 2.0" },
];

/**
 * 获取指定族在指定模式下的最佳子模型（写死为 Seedance 2.0）
 */
export const getBestSubmodelForMode = (
  family: VideoModelFamily,
  mode: VideoInputMode,
): string => {
  // 所有模式均返回豆包 Seedance 2.0
  return "doubao-seedance-2.0";
};

/**
 * 将模型字符串解析为族标识（写死为 Seedance 2.0）
 */
export const resolveModelToFamily = (model: string): VideoModelFamily => {
  return "doubao-seedance-2.0";
};
