import { useMemo } from "react";

import {
  type MainModelConfig,
  type ModeState,
  type SubVariant,
  type VideoModeKey,
  ALL_MODE_KEYS,
  MODE_LABELS,
  MODE_REFERENCE_CONSTRAINTS,
  MOCK_MAIN_MODELS
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
  videoReferenceCount?: number;
  hasAnyReference?: boolean;
  referenceAllImages?: boolean;
}): UseModeAvailabilityResult {
  const {
    selectedModelId,
    referenceCount,
    videoReferenceCount = 0,
    hasAnyReference = false,
    referenceAllImages = false,
  } = params;

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

      // Seedance 2.5 的视频编辑能力暂未开放。
      if (selectedModelId === "seedance-2.5" && key === "video-edit") {
        reasons.push("Seedance 2.5 的视频编辑暂未开放");
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
            if (constraint.maxRefCount === 0 && hasAnyReference) {
              reasons.push(`「${MODE_LABELS[key]}」不支持参考素材`);
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
              reasons.push(`参考图超过 ${constraint.maxRefCount} 张时不可用`);
            }
            if (
              constraint.requiresAnyReference &&
              !hasAnyReference &&
              referenceCount === 0
            ) {
              reasons.push(`「${MODE_LABELS[key]}」需要至少一个参考素材`);
            }
            if (constraint.requiresAllImages && !referenceAllImages) {
              reasons.push(`「${MODE_LABELS[key]}」仅支持图片参考`);
            }
          }
        }

        if (selectedModelId === "happyhorse") {
          if (key === "all-reference") {
            if (referenceCount < 1) {
              reasons.push("「全能参考」需要至少 1 张参考图");
            } else if (referenceCount > 9) {
              reasons.push("HappyHores 参考生视频最多支持 9 张参考图");
            }
            if (!referenceAllImages) {
              reasons.push("HappyHores 参考生视频仅支持图片参考");
            }
          }

          if (key === "image-to-video") {
            if (referenceCount !== 1 || !referenceAllImages) {
              reasons.push("HappyHores 图生视频需要且仅支持 1 张首帧图");
            }
          }

          if (key === "video-edit") {
            if (videoReferenceCount !== 1) {
              reasons.push("HappyHores 视频编辑需要且仅支持 1 个视频素材");
            } else if (referenceCount > 5) {
              reasons.push("HappyHores 视频编辑最多附加 5 张参考图");
            } else if (
              hasAnyReference &&
              referenceCount + videoReferenceCount === 0
            ) {
              reasons.push("HappyHores 视频编辑需要视频素材");
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
  }, [
    selectedModelId,
    referenceCount,
    videoReferenceCount,
    hasAnyReference,
    referenceAllImages,
  ]);
}
