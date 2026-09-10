import {
  AGNES_IMAGE_2_FLASH_MODEL,
  AGNES_IMAGE_21_FLASH_MODEL,
  APIMART_FLUX_2_PRO_MODEL,
  APIMART_GPT_IMAGE_25_MODEL,
  APIMART_QWEN_IMAGE_30_MODEL,
  NANO_BANANA_LOCAL_MODEL,
  RUNNINGHUB_GPT_IMAGE2_MODEL,
  RUNNINGHUB_MIDJOURNEY_V81_MODEL,
  RUNNINGHUB_NANO_BANANA_PRO_MODEL
} from "../ai-models";

// APIMart 的积分按模型参数分档，与服务端预扣规则保持一致。
const APIMART_FLUX_2_PRO_POINTS: Record<string, number> = {
  "1MP": 10,
  "2MP": 15,
  "3MP": 20,
  "4MP": 25,
};

const APIMART_GPT_IMAGE_25_POINTS: Record<string, Record<string, number>> = {
  "1K": { auto: 14, low: 11, medium: 14, high: 19, xhigh: 25, max: 32 },
  "2K": { auto: 24, low: 18, medium: 24, high: 32, xhigh: 42, max: 54 },
  "4K": { auto: 33, low: 25, medium: 33, high: 43, xhigh: 55, max: 69 },
};

const getAPIMartImagePoints = ({
  model,
  resolution,
  quality,
}: {
  model?: string;
  resolution?: string;
  quality?: string;
}) => {
  const normalizedResolution = String(resolution ?? "").trim().toUpperCase();
  const normalizedQuality = String(quality ?? "").trim().toLowerCase();

  if (model === APIMART_FLUX_2_PRO_MODEL) {
    return APIMART_FLUX_2_PRO_POINTS[normalizedResolution || "2MP"];
  }
  if (model === APIMART_GPT_IMAGE_25_MODEL) {
    return APIMART_GPT_IMAGE_25_POINTS[normalizedResolution || "1K"]?.[
      normalizedQuality || "medium"
    ];
  }
  if (model === APIMART_QWEN_IMAGE_30_MODEL) {
    return 9;
  }
};

export const IMAGE_MODEL_POINTS: Record<string, number> = {
  "gemini-3-pro-image-preview": 24,
  [NANO_BANANA_LOCAL_MODEL]: 0,
  "doubao-seedream-5-0": 15,
  [RUNNINGHUB_GPT_IMAGE2_MODEL]: 24,
  [RUNNINGHUB_NANO_BANANA_PRO_MODEL]: 24,
  [RUNNINGHUB_MIDJOURNEY_V81_MODEL]: 24,
  [AGNES_IMAGE_2_FLASH_MODEL]: 0,
  [AGNES_IMAGE_21_FLASH_MODEL]: 0,
};

export const IMAGE_PLATFORM_POINTS: Record<string, number> = {
  // google_pro2: 22,
};

export const DEFAULT_IMAGE_GENERATION_POINTS = 12;

export const getImageGenerationPoints = ({
  model,
  platform,
  resolution,
  quality,
  count = 1,
  fallback = DEFAULT_IMAGE_GENERATION_POINTS,
}: {
  model?: string;
  platform?: string;
  resolution?: string;
  quality?: string;
  count?: number;
  fallback?: number;
}) => {
  const basePoints =
    getAPIMartImagePoints({ model, resolution, quality }) ??
    (platform ? IMAGE_PLATFORM_POINTS[platform] : undefined) ??
    (model ? IMAGE_MODEL_POINTS[model] : undefined) ??
    fallback;

  return basePoints * Math.max(count, 1);
};
