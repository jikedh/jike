import { useMemo } from "react";

import {
    type MainModelConfig,
    type ModeState,
    type SubVariant,
    type VideoModeKey,
    ALL_MODE_KEYS,
    MODE_LABELS,
    MODE_REFERENCE_CONSTRAINTS,
    MOCK_MAIN_MODELS,
} from "../constants/videoModelCapabilities";

export interface UseModeAvailabilityResult {
    /** 所有模式的状态（4 个模式，每个包含 enabled 和 disabledReason） */
    modeStates: ModeState[];
    /** 当前模型支持的子模型列表（系统内部使用，后续阶段用于自动调度） */
    activeVariants: SubVariant[];
}

export function useModeAvailability(params: {
    selectedModelId: string;
    referenceCount: number;
    hasAnyReference?: boolean;
    referenceAllImages?: boolean;
}): UseModeAvailabilityResult {
    const { selectedModelId, referenceCount, hasAnyReference = false, referenceAllImages = false } = params;

    return useMemo(() => {
        // 1. 查找主模型配置
        const modelConfig = MOCK_MAIN_MODELS.find(
            (m: MainModelConfig) => m.id === selectedModelId,
        );

        // 2. 收集所有子模型支持的模式并集
        const modelSupportedModes = new Set<VideoModeKey>();
        const activeVariants: SubVariant[] = modelConfig?.variants ?? [];

        for (const variant of activeVariants) {
            for (const mode of variant.supportedModes) {
                modelSupportedModes.add(mode);
            }
        }

        // 3. 对每个模式计算启用/禁用
        const modeStates: ModeState[] = ALL_MODE_KEYS.map((key) => {
            const reasons: string[] = [];

            // 原因 A: 模型不支持
            if (!modelSupportedModes.has(key)) {
                const modelLabel = modelConfig?.label ?? selectedModelId;
                reasons.push(
                    `当前【${modelLabel}】模型不支持「${MODE_LABELS[key]}」模式`,
                );
            }

            // 原因 B: 参考图数量不符合约束（仅在模型支持时才检查）
            if (modelSupportedModes.has(key)) {
                // 首尾帧特殊判断：恰好 2 项且全部为图片
                if (key === "first-last-frame") {
                    if (referenceCount !== 2 || !referenceAllImages) {
                        reasons.push(
                            `「${MODE_LABELS[key]}」需要恰好 2 张参考图，且全部为图片`,
                        );
                    }
                } else {
                    const constraint = MODE_REFERENCE_CONSTRAINTS[key];
                    if (constraint) {
                        if (
                            constraint.maxRefCount === 0 &&
                            referenceCount > 0
                        ) {
                            reasons.push(`「${MODE_LABELS[key]}」不支持上传参考图`);
                        }
                        if (
                            constraint.minRefCount !== undefined &&
                            referenceCount < constraint.minRefCount
                        ) {
                            reasons.push(
                                `「${MODE_LABELS[key]}」需要至少 ${constraint.minRefCount} 张参考图`,
                            );
                        }
                        if (
                            constraint.maxRefCount !== undefined &&
                            constraint.maxRefCount > 0 &&
                            referenceCount > constraint.maxRefCount
                        ) {
                            reasons.push(
                                `参考图超过 ${constraint.maxRefCount} 张时不可用`,
                            );
                        }
                        if (
                            constraint.requiresAnyReference &&
                            !hasAnyReference &&
                            referenceCount === 0
                        ) {
                            reasons.push(
                                `「${MODE_LABELS[key]}」需要至少一个参考素材`,
                            );
                        }
                        if (constraint.requiresAllImages && !referenceAllImages) {
                            reasons.push(`「${MODE_LABELS[key]}」仅支持图片参考`);
                        }
                    }
                }
            }

            return {
                key,
                label: MODE_LABELS[key],
                enabled: reasons.length === 0,
                disabledReason: reasons.length > 0 ? reasons[0] : undefined,
            };
        });

        return { modeStates, activeVariants };
    }, [selectedModelId, referenceCount, hasAnyReference, referenceAllImages]);
}
