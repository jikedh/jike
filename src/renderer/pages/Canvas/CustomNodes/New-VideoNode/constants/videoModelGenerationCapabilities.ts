import type { MentionItem } from "./mockData";
import {
    MODE_LABELS,
    MOCK_MAIN_MODELS,
    type VideoModeKey,
} from "./videoModelCapabilities";
import type { VideoParamState } from "./videoParamConfigs";
export type VideoReferenceType = MentionItem["type"];
export interface ReferenceCountCapability {
    min?: number;
    max?: number;
}
export interface VideoReferenceCapability {
    image?: ReferenceCountCapability;
    video?: ReferenceCountCapability;
    audio?: ReferenceCountCapability;
    requireAnyReference?: boolean;
    requireOnlyImages?: boolean;
    audioRequiresVisualReference?: boolean;
}
export interface VideoModeGenerationCapability {
    references?: VideoReferenceCapability;
    params?: {
        duration?: number[];
        resolution?: string[];
        ratio?: string[];
        generateAudio?: boolean;
    };
    disabledReason?: string;
}
export interface VideoModelGenerationCapability {
    modes: Partial<Record<VideoModeKey, VideoModeGenerationCapability>>;
}
export interface VideoGenerationCapabilityInput {
    modelId: string;
    mode: VideoModeKey;
    referenceItems: MentionItem[];
    params?: VideoParamState;
}
export interface VideoGenerationCapabilityResult {
    canGenerate: boolean;
    reasons: string[];
    summaryReason?: string;
}
const emptyReferences = {
    image: { max: 0 },
    video: { max: 0 },
    audio: { max: 0 },
} satisfies VideoReferenceCapability;
const onlyImages = (min: number, max: number): VideoReferenceCapability => ({
    image: { min, max },
    video: { max: 0 },
    audio: { max: 0 },
    requireOnlyImages: true,
});
const firstLastFrame = onlyImages(2, 2);
export const VIDEO_MODEL_GENERATION_CAPABILITIES: Record<
    string,
    VideoModelGenerationCapability
> = {
    "seedance-2.0-fast": {
        modes: {
            "text-to-video": { references: emptyReferences },
            "all-reference": {
                references: {
                    image: { max: 9 },
                    video: { max: 0 },
                    audio: { max: 0 },
                    requireAnyReference: true,
                    requireOnlyImages: true,
                },
            },
            "image-to-video": { references: onlyImages(1, 9) },
            "first-last-frame": { references: firstLastFrame },
        },
    },
    "seedance-2.0-pro": {
        modes: {
            "text-to-video": { references: emptyReferences },
            "all-reference": {
                references: {
                    image: { max: 9 },
                    video: { max: 3 },
                    audio: { max: 3 },
                    requireAnyReference: true,
                    audioRequiresVisualReference: true,
                },
            },
            "image-to-video": { references: onlyImages(1, 9) },
            "first-last-frame": { references: firstLastFrame },
        },
    },
    wanxiang: {
        modes: {
            "text-to-video": { references: emptyReferences },
            "all-reference": {
                references: {
                    image: { max: 9 },
                    video: { max: 9 },
                    audio: { max: 1 },
                    requireAnyReference: true,
                },
            },
            "image-to-video": { references: onlyImages(1, 1) },
            "first-last-frame": { references: firstLastFrame },
        },
    },
    "vidu-q3-pro": {
        modes: {
            "text-to-video": { references: emptyReferences },
            "image-to-video": { references: onlyImages(1, 1) },
            "first-last-frame": { references: firstLastFrame },
        },
    },
    vidu: {
        modes: {
            "text-to-video": { references: emptyReferences },
            "image-to-video": { references: onlyImages(1, 1) },
            "first-last-frame": { references: firstLastFrame },
        },
    },
    pixverse: {
        modes: {
            "text-to-video": { references: emptyReferences },
            "all-reference": {
                references: {
                    image: { min: 1, max: 9 },
                    video: { max: 0 },
                    audio: { max: 0 },
                    requireOnlyImages: true,
                },
            },
            "image-to-video": { references: onlyImages(1, 1) },
            "first-last-frame": { references: firstLastFrame },
        },
    },
    happyhorse: {
        modes: {
            "text-to-video": { references: emptyReferences },
            "all-reference": {
                references: {
                    image: { min: 1, max: 9 },
                    video: { max: 0 },
                    audio: { max: 0 },
                    requireOnlyImages: true,
                },
            },
            "image-to-video": { references: onlyImages(1, 1) },
            "video-edit": {
                references: {
                    image: { max: 5 },
                    video: { min: 1, max: 1 },
                    audio: { max: 0 },
                },
            },
        },
    },
    "adobe-sora2-pro": {
        modes: {
            "text-to-video": { references: emptyReferences },
            "image-to-video": { references: onlyImages(1, 1) },
        },
    },
    "grok-imagine-video": {
        modes: {
            "text-to-video": { references: emptyReferences },
            "image-to-video": { references: onlyImages(1, 7) },
        },
    },
    keling: {
        modes: {
            "text-to-video": { references: emptyReferences },
            "all-reference": {
                references: {
                    image: { max: 7 },
                    video: { max: 7 },
                    audio: { max: 0 },
                    requireAnyReference: true,
                },
            },
            "image-to-video": { references: onlyImages(1, 1) },
            "first-last-frame": { references: firstLastFrame },
        },
    },
};
const getModelLabel = (modelId: string) =>
    MOCK_MAIN_MODELS.find((model) => model.id === modelId)?.label ?? modelId;
const getReferenceCount = (
    referenceItems: MentionItem[],
    type: VideoReferenceType,
) => referenceItems.filter((item) => item.type === type).length;
const validateCount = ({
    reasons,
    modelLabel,
    modeLabel,
    assetLabel,
    count,
    capability,
}: {
    reasons: string[];
    modelLabel: string;
    modeLabel: string;
    assetLabel: string;
    count: number;
    capability?: ReferenceCountCapability;
}) => {
    if (!capability) {
        return;
    }
    if (capability.min !== undefined && count < capability.min) {
        reasons.push(
            `${modelLabel}「${modeLabel}」至少需要 ${capability.min} 个${assetLabel}，当前已选择 ${count} 个`,
        );
    }
    if (capability.max !== undefined && count > capability.max) {
        reasons.push(
            `${modelLabel}「${modeLabel}」最多支持 ${capability.max} 个${assetLabel}，当前已选择 ${count} 个`,
        );
    }
};
export const validateVideoGenerationCapability = ({
    modelId,
    mode,
    referenceItems,
}: VideoGenerationCapabilityInput): VideoGenerationCapabilityResult => {
    const modelCapability = VIDEO_MODEL_GENERATION_CAPABILITIES[modelId];
    if (!modelCapability) {
        return { canGenerate: true, reasons: [] };
    }
    const modeCapability = modelCapability.modes[mode];
    const modelLabel = getModelLabel(modelId);
    const modeLabel = MODE_LABELS[mode];
    if (!modeCapability) {
        const reason = `${modelLabel} 不支持「${modeLabel}」模式`;
        return { canGenerate: false, reasons: [reason], summaryReason: reason };
    }
    if (modeCapability.disabledReason) {
        return {
            canGenerate: false,
            reasons: [modeCapability.disabledReason],
            summaryReason: modeCapability.disabledReason,
        };
    }
    const reasons: string[] = [];
    const references = modeCapability.references;
    if (references) {
        const imageCount = getReferenceCount(referenceItems, "image");
        const videoCount = getReferenceCount(referenceItems, "video");
        const audioCount = getReferenceCount(referenceItems, "audio");
        const totalReferenceCount = referenceItems.length;
        if (references.requireAnyReference && totalReferenceCount === 0) {
            reasons.push(`${modelLabel}「${modeLabel}」需要至少一个参考素材`);
        }
        if (references.requireOnlyImages && imageCount !== totalReferenceCount) {
            reasons.push(`${modelLabel}「${modeLabel}」仅支持图片参考素材`);
        }
        if (
            references.audioRequiresVisualReference &&
            audioCount > 0 &&
            imageCount + videoCount === 0
        ) {
            reasons.push(`${modelLabel}「${modeLabel}」参考音频不能单独使用，请同时添加参考图片或参考视频`);
        }
        validateCount({
            reasons,
            modelLabel,
            modeLabel,
            assetLabel: "参考图",
            count: imageCount,
            capability: references.image,
        });
        validateCount({
            reasons,
            modelLabel,
            modeLabel,
            assetLabel: "参考视频",
            count: videoCount,
            capability: references.video,
        });
        validateCount({
            reasons,
            modelLabel,
            modeLabel,
            assetLabel: "参考音频",
            count: audioCount,
            capability: references.audio,
        });
    }
    return {
        canGenerate: reasons.length === 0,
        reasons,
        summaryReason: reasons[0],
    };
};
