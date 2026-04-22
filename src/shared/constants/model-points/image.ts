export const IMAGE_MODEL_POINTS: Record<string, number> = {
  "gemini-3-pro-image-preview": 24,
  "doubao-seedream-5-0": 15,
  midjourney: 27,
  "midjourney-niji7": 27,
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
