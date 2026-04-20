export const IMAGE_MODEL_POINTS: Record<string, number> = {
  "gemini-3-pro-image-preview": 20,
  "doubao-seedream-5-0": 16,
  midjourney: 24,
  "midjourney-niji7": 24,
};

export const IMAGE_PLATFORM_POINTS: Record<string, number> = {
  google_pro2: 22,
};

export const VIDEO_MODEL_POINTS: Record<string, number> = {
  "Veo3.1-quality-official": 120,
  "Veo3.1-fast-official": 80,
  "doubao-seedance-1-5-pro": 60,
  "doubao-seedance-2.0": 90,
  "grok-video-3": 100,
  "kling-video-o1": 88,
  "MiniMax-Hailuo-2.3": 76,
  "wan2.7-i2v": 60,
};

export const DEFAULT_IMAGE_GENERATION_POINTS = 12;
export const DEFAULT_VIDEO_GENERATION_POINTS = 60;

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

export const getVideoGenerationPoints = ({
  model,
  fallback = DEFAULT_VIDEO_GENERATION_POINTS,
}: {
  model?: string;
  fallback?: number;
}) => {
  return (model ? VIDEO_MODEL_POINTS[model] : undefined) ?? fallback;
};
