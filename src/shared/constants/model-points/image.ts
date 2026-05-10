import {
  ADOBE_GPT_IMAGE2_MODEL,
  ADOBE_NANO_BANANA_PRO_MODEL,
  GROK_IMAGE_EDIT_MODEL,
  GROK_IMAGE_LITE_MODEL,
  GROK_IMAGE_MODEL,
  GROK_IMAGE_PRO_MODEL,
  NANO_BANANA_LOCAL_MODEL,
  XIMU_GPT_IMAGE2_VIP_MODEL,
  XIMU_GPT_IMAGE2_MODEL,
  XIMU_NANO_BANANA2_MODEL,
  XIMU_NANO_BANANA_PRO_MODEL,
} from "../ai-models";

export const IMAGE_MODEL_POINTS: Record<string, number> = {
  "gemini-3-pro-image-preview": 24,
  [NANO_BANANA_LOCAL_MODEL]: 0,
  "doubao-seedream-5-0": 15,
  midjourney: 27,
  "midjourney-niji7": 27,
  [ADOBE_GPT_IMAGE2_MODEL]: 0,
  [ADOBE_NANO_BANANA_PRO_MODEL]: 0,
  [XIMU_GPT_IMAGE2_MODEL]: 0,
  [XIMU_GPT_IMAGE2_VIP_MODEL]: 0,
  [XIMU_NANO_BANANA2_MODEL]: 0,
  [XIMU_NANO_BANANA_PRO_MODEL]: 0,
  [GROK_IMAGE_LITE_MODEL]: 0,
  [GROK_IMAGE_MODEL]: 0,
  [GROK_IMAGE_PRO_MODEL]: 0,
  [GROK_IMAGE_EDIT_MODEL]: 0,
};

export const IMAGE_PLATFORM_POINTS: Record<string, number> = {
  // google_pro2: 22,
};

export const DEFAULT_IMAGE_GENERATION_POINTS = 12;

export const getImageGenerationPoints = ({
  model,
  platform,
  count = 1,
  fallback = DEFAULT_IMAGE_GENERATION_POINTS,
}: {
  model?: string;
  platform?: string;
  count?: number;
  fallback?: number;
}) => {
  const basePoints =
    (platform ? IMAGE_PLATFORM_POINTS[platform] : undefined) ??
    (model ? IMAGE_MODEL_POINTS[model] : undefined) ??
    fallback;

  return basePoints * Math.max(count, 1);
};
