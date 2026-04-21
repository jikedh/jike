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
 * 模型族默认能力（第一层映射）
 */
const MODEL_FAMILY_CAPABILITIES: Record<string, VideoModelCapability> = {
    seedance: {
        callable: true,
        supportedModes: [
            VideoInputMode.TextToVideo,
            VideoInputMode.ImageToVideo,
            VideoInputMode.MultiImageReference,
        ],
        defaultMode: VideoInputMode.TextToVideo,
    },
    wanxiang: {
        callable: true,
        supportedModes: [
            VideoInputMode.TextToVideo,
            VideoInputMode.ImageToVideo,
            VideoInputMode.LastFrame,
            VideoInputMode.MultiImageReference,
        ],
        defaultMode: VideoInputMode.TextToVideo,
    },
    pixverse: {
        callable: true,
        supportedModes: [
            VideoInputMode.TextToVideo,
            VideoInputMode.ImageToVideo,
            VideoInputMode.LastFrame,
            VideoInputMode.MultiImageReference,
        ],
        defaultMode: VideoInputMode.TextToVideo,
    },
    keling: {
        callable: true,
        supportedModes: [
            VideoInputMode.TextToVideo,
            VideoInputMode.ImageToVideo,
            VideoInputMode.LastFrame,
        ],
        defaultMode: VideoInputMode.TextToVideo,
    },
    vidu: {
        callable: true,
        supportedModes: [VideoInputMode.TextToVideo],
        defaultMode: VideoInputMode.TextToVideo,
    },
    unknown: {
        callable: false,
        supportedModes: [VideoInputMode.TextToVideo],
        defaultMode: VideoInputMode.TextToVideo,
    },
};

/**
 * 模型级覆盖能力（第二层映射）
 */
const MODEL_CAPABILITY_OVERRIDES: Record<string, Partial<VideoModelCapability>> = {
    "doubao-seedance-2.0": {
        supportedModes: [
            VideoInputMode.TextToVideo,
            VideoInputMode.ImageToVideo,
            VideoInputMode.MultiImageReference,
        ],
        defaultMode: VideoInputMode.TextToVideo,
    },

    "wan2.7-t2v": {
        supportedModes: [VideoInputMode.TextToVideo],
        defaultMode: VideoInputMode.TextToVideo,
    },
    "wan2.7-i2v": {
        supportedModes: [VideoInputMode.ImageToVideo, VideoInputMode.LastFrame],
        defaultMode: VideoInputMode.ImageToVideo,
    },
    "wan2.7-r2v": {
        supportedModes: [VideoInputMode.ImageToVideo, VideoInputMode.MultiImageReference],
        defaultMode: VideoInputMode.MultiImageReference,
    },

    "pixverse/pixverse-c1-t2v": {
        supportedModes: [VideoInputMode.TextToVideo],
        defaultMode: VideoInputMode.TextToVideo,
    },
    "pixverse/pixverse-v6-t2v": {
        supportedModes: [VideoInputMode.TextToVideo],
        defaultMode: VideoInputMode.TextToVideo,
    },
    "pixverse/pixverse-v5.6-t2v": {
        supportedModes: [VideoInputMode.TextToVideo],
        defaultMode: VideoInputMode.TextToVideo,
    },
    "pixverse/pixverse-c1-it2v": {
        supportedModes: [VideoInputMode.ImageToVideo],
        defaultMode: VideoInputMode.ImageToVideo,
    },
    "pixverse/pixverse-v6-it2v": {
        supportedModes: [VideoInputMode.ImageToVideo],
        defaultMode: VideoInputMode.ImageToVideo,
    },
    "pixverse/pixverse-v5.6-it2v": {
        supportedModes: [VideoInputMode.ImageToVideo],
        defaultMode: VideoInputMode.ImageToVideo,
    },
    "pixverse/pixverse-c1-kf2v": {
        supportedModes: [VideoInputMode.LastFrame],
        defaultMode: VideoInputMode.LastFrame,
    },
    "pixverse/pixverse-v6-kf2v": {
        supportedModes: [VideoInputMode.LastFrame],
        defaultMode: VideoInputMode.LastFrame,
    },
    "pixverse/pixverse-v5.6-kf2v": {
        supportedModes: [VideoInputMode.LastFrame],
        defaultMode: VideoInputMode.LastFrame,
    },
    "pixverse/pixverse-c1-r2v": {
        supportedModes: [VideoInputMode.ImageToVideo, VideoInputMode.MultiImageReference],
        defaultMode: VideoInputMode.MultiImageReference,
    },
    "pixverse/pixverse-v5.6-r2v": {
        supportedModes: [VideoInputMode.ImageToVideo, VideoInputMode.MultiImageReference],
        defaultMode: VideoInputMode.MultiImageReference,
    },

    "kling/kling-v3-video-generation": {
        supportedModes: [
            VideoInputMode.TextToVideo,
            VideoInputMode.ImageToVideo,
            VideoInputMode.LastFrame,
        ],
        defaultMode: VideoInputMode.TextToVideo,
    },
    "kling/kling-v3-omni-video-generation": {
        supportedModes: [
            VideoInputMode.TextToVideo,
            VideoInputMode.ImageToVideo,
            VideoInputMode.LastFrame,
        ],
        defaultMode: VideoInputMode.TextToVideo,
    },

    "vidu/viduq3-turbo_text2video": {
        supportedModes: [VideoInputMode.TextToVideo],
        defaultMode: VideoInputMode.TextToVideo,
    },
};

/**
 * 识别模型族
 */
const resolveModelFamily = (model: string) => {
    if (!model) {
        return "unknown";
    }

    if (model === "doubao-seedance-2.0") {
        return "seedance";
    }

    if (model.startsWith("wan2.7-")) {
        return "wanxiang";
    }

    if (model.startsWith("pixverse/")) {
        return "pixverse";
    }

    if (model.startsWith("kling/")) {
        return "keling";
    }

    if (model.startsWith("vidu/")) {
        return "vidu";
    }

    return "unknown";
};

/**
 * 获取模型能力（族默认 + 模型覆盖）
 */
export const getVideoModelCapability = (model: string): VideoModelCapability => {
    const family = resolveModelFamily(model);
    const familyCapability =
        MODEL_FAMILY_CAPABILITIES[family] ?? MODEL_FAMILY_CAPABILITIES.unknown;
    const override = MODEL_CAPABILITY_OVERRIDES[model] ?? {};

    return {
        callable: override.callable ?? familyCapability.callable,
        supportedModes: override.supportedModes ?? familyCapability.supportedModes,
        defaultMode: override.defaultMode ?? familyCapability.defaultMode,
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
 * 模型族枚举（用于 Select UI）
 */
export type VideoModelFamily =
    | "doubao-seedance-2.0"
    | "keling"
    | "pixverse"
    | "wanxiang"
    | "vidu";

/**
 * 模型族选项（5 个族）
 */
export const VIDEO_MODEL_FAMILY_OPTIONS = [
    { value: "doubao-seedance-2.0" as const, label: "Doubao Seedance 2.0" },
    { value: "keling" as const, label: "Keling" },
    { value: "pixverse" as const, label: "PixVerse" },
    { value: "wanxiang" as const, label: "Wanxiang" },
    { value: "vidu" as const, label: "Vidu" },
];

/**
 * 模式 → 最佳子模型映射表
 * 每个族在每个模式下的默认使用的子模型
 */
const MODE_TO_BEST_SUBMODEL: Record<
    VideoInputMode,
    Partial<Record<VideoModelFamily, string>>
> = {
    [VideoInputMode.TextToVideo]: {
        "doubao-seedance-2.0": "doubao-seedance-2.0",
        keling: "kling/kling-v3-video-generation",
        pixverse: "pixverse/pixverse-v6-t2v",
        wanxiang: "wan2.7-t2v",
        vidu: "vidu/viduq3-turbo_text2video",
    },
    [VideoInputMode.ImageToVideo]: {
        "doubao-seedance-2.0": "doubao-seedance-2.0",
        keling: "kling/kling-v3-video-generation",
        pixverse: "pixverse/pixverse-v6-it2v",
        wanxiang: "wan2.7-i2v",
        vidu: "vidu/viduq3-turbo_text2video",
    },
    [VideoInputMode.LastFrame]: {
        "doubao-seedance-2.0": "doubao-seedance-2.0",
        keling: "kling/kling-v3-video-generation",
        pixverse: "pixverse/pixverse-v6-kf2v",
        wanxiang: "wan2.7-i2v",
        vidu: "vidu/viduq3-turbo_text2video",
    },
    [VideoInputMode.MultiImageReference]: {
        "doubao-seedance-2.0": "doubao-seedance-2.0",
        keling: "kling/kling-v3-video-generation",
        pixverse: "pixverse/pixverse-v5.6-r2v",
        wanxiang: "wan2.7-r2v",
        vidu: "vidu/viduq3-turbo_text2video",
    },
};

/**
 * 获取指定族在指定模式下的最佳子模型
 */
export const getBestSubmodelForMode = (
    family: VideoModelFamily,
    mode: VideoInputMode,
): string | undefined => {
    return MODE_TO_BEST_SUBMODEL[mode]?.[family];
};

/**
 * 将模型字符串解析为族标识（用于 Select 高亮）
 */
export const resolveModelToFamily = (model: string): VideoModelFamily => {
    if (model === "doubao-seedance-2.0") {
        return "doubao-seedance-2.0";
    }
    if (model.startsWith("wan2.7-")) {
        return "wanxiang";
    }
    if (model.startsWith("pixverse/")) {
        return "pixverse";
    }
    if (model.startsWith("kling/")) {
        return "keling";
    }
    if (model.startsWith("vidu/")) {
        return "vidu";
    }
    return "doubao-seedance-2.0";
};
