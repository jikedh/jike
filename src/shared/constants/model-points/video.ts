export const VIDEO_MODEL_POINTS: Record<string, number> = {
  "doubao-seedance-2.0": 60, // 默认 720p 基础分
  "doubao-seedance-2.0-fast": 48, // 默认 720p 基础分
  "doubao-seedance-2.0-pro": 60, // 默认 720p 基础分
  "seedance-2.0-fast": 48, // 新版视频节点 Seedance 2.0 Fast
  "seedance-2.0-mini": 30, // 新版视频节点 Seedance 2.0 Mini，按 Pro 半价计费
  "seedance-2.0-pro": 60, // 新版视频节点 Seedance 2.0 Pro
  "seedance-2.5": 60,
  "dreamina-seedance-2-0-260128": 72, // 海外 Seedance 2.0 Pro 默认 720p 基础分
  "wan2.7-r2v": 36, // 默认 720p 基础分
  "wan3.0-video": 36,
  "wan3.0-video-prime": 36,
  "pixverse-i2v": 60,
  "agnes-video-v2.0": 0, // Agnes-Video-V2.0 当前为免费模型，固定 0 积分
  "MiniMax-H3": 30,
};

export const DEFAULT_VIDEO_GENERATION_POINTS = 60;

const POINTS_PER_YUAN = 60;
const MAX_SEEDANCE_REFERENCE_VIDEO_DURATION = 15;

const SEEDANCE_YUAN_RATES: Record<
  string,
  Record<string, { noReference: number; reference: [number, number] }>
> = {
  "seedance-2.0-mini": {
    "480p": { noReference: 0.23, reference: [0.25, 0.28] },
    "720p": { noReference: 0.5, reference: [0.53, 0.6] },
  },
  "seedance-2.0-fast": {
    "480p": { noReference: 0.37, reference: [0.38, 0.44] },
    "720p": { noReference: 0.8, reference: [0.83, 0.95] },
  },
  "seedance-2.0-pro": {
    "480p": { noReference: 0.46, reference: [0.49, 0.56] },
    "720p": { noReference: 0.99, reference: [1.05, 1.2] },
    "1080p": { noReference: 2.47, reference: [2.63, 3.01] },
    "4k": { noReference: 5.05, reference: [5.44, 6.22] },
  },
  "seedance-2.5": {
    "480p": { noReference: 0.67, reference: [0.72, 2.82] },
    "720p": { noReference: 1.51, reference: [1.63, 6.35] },
    "1080p": { noReference: 3.74, reference: [4, 15.65] },
  },
};

export const getSeedanceVideoGenerationPointsBreakdown = ({
  model,
  duration = 5,
  resolution = "720p",
  hasVideoInput = false,
  videoReferenceDuration = 0,
}: {
  model?: string;
  duration?: number;
  resolution?: string;
  hasVideoInput?: boolean;
  videoReferenceDuration?: number;
}) => {
  const modelRates = model ? SEEDANCE_YUAN_RATES[model] : undefined;
  if (!modelRates) return null;

  const rate =
    modelRates[resolution.toLowerCase()] ?? modelRates["720p"];
  const generationDuration = Math.max(0, duration);
  const referenceDuration = hasVideoInput
    ? Math.max(0, Math.ceil(videoReferenceDuration))
    : 0;
  const isReferenceDurationOverLimit =
    referenceDuration > MAX_SEEDANCE_REFERENCE_VIDEO_DURATION;
  const billedReferenceDuration = Math.min(
    referenceDuration,
    MAX_SEEDANCE_REFERENCE_VIDEO_DURATION,
  );
  const yuanPerSecond = hasVideoInput
    ? rate.reference[isReferenceDurationOverLimit ? 1 : 0]
    : rate.noReference;
  const generationPoints = yuanPerSecond * generationDuration * POINTS_PER_YUAN;
  const referenceVideoPoints =
    yuanPerSecond * billedReferenceDuration * POINTS_PER_YUAN;

  return {
    totalPoints: Math.ceil(generationPoints + referenceVideoPoints),
    generationPoints: Math.ceil(generationPoints),
    referenceVideoPoints: Math.ceil(referenceVideoPoints),
    referenceDuration,
    billedReferenceDuration,
    isReferenceDurationOverLimit,
  };
};

export const getVideoGenerationPoints = ({
  model,
  duration = 5, // 默认通常是 5 秒
  resolution = "720p",
  hasVideoInput = false,
  videoReferenceDuration = 0,
  hasAudio = false,
  fallback = DEFAULT_VIDEO_GENERATION_POINTS,
}: {
  model?: string;
  duration?: number;
  resolution?: string;
  hasVideoInput?: boolean;
  videoReferenceDuration?: number;
  hasAudio?: boolean;
  fallback?: number;
}) => {
  let basePointsPerSecond =
    (model ? VIDEO_MODEL_POINTS[model] : undefined) ?? fallback;

  const seedanceBreakdown = getSeedanceVideoGenerationPointsBreakdown({
    model,
    duration,
    resolution,
    hasVideoInput,
    videoReferenceDuration,
  });
  if (seedanceBreakdown) {
    return seedanceBreakdown.totalPoints;
  }

  // 特殊逻辑：海外 Seedance 2.0 Pro。只有视频参考触发复刻价格，并把参考视频秒数计入总计费秒数。
  if (model === "dreamina-seedance-2-0-260128") {
    const res = resolution.toLowerCase();
    const noReferenceRates: Record<string, number> = {
      "480p": 36,
      "720p": 72,
      "1080p": 180,
      "4k": 372,
    };
    const videoReferenceRates: Record<string, number> = {
      "480p": 23,
      "720p": 45,
      "1080p": 108,
      "4k": 222,
    };
    const rate = hasVideoInput
      ? videoReferenceRates[res] ?? videoReferenceRates["720p"]
      : noReferenceRates[res] ?? noReferenceRates["720p"];
    const referenceDuration = hasVideoInput
      ? Math.max(0, Math.ceil(videoReferenceDuration))
      : 0;
    const billableDuration = Math.max(0, duration) + referenceDuration;

    return Math.ceil(rate * billableDuration);
  }

  if (model === "wan3.0-video" || model === "wan3.0-video-prime") {
    const pointsMap: Record<string, number> = {
      "480p": 18,
      "720p": 36,
      "1080p": 72,
    };
    const rate = pointsMap[resolution.toLowerCase()] ?? pointsMap["1080p"];
    return Math.max(rate * duration, 1);
  }

  // 特殊逻辑：旧版豆包 Seedance 2.0 系列
  if (model?.startsWith("doubao-seedance-2.0")) {
    const isFast = model.includes("-fast");
    const isMini = model.includes("-mini");
    const res = resolution.toLowerCase();

    if (isMini) {
      // Seedance 2.0 Mini 为 Pro 半价：720p -> 30, 480p -> 15
      basePointsPerSecond = res === "480p" ? 15 : 30;
    } else if (isFast) {
      // Seedance 2.0 Fast: 720p -> 48, 480p -> 24
      basePointsPerSecond = res === "480p" ? 24 : 48;
    } else {
      // Seedance 2.0 Standard/Pro 按分辨率计费。
      const proRates: Record<string, number> = {
        "480p": 30,
        "720p": 60,
        "1080p": 150,
        "4k": 306,
      };
      basePointsPerSecond = proRates[res] ?? proRates["720p"];
    }

    // 按秒计算
    let totalPoints = basePointsPerSecond * duration;

    // 如果有视频输入，积分翻倍
    if (hasVideoInput) {
      totalPoints *= 2;
    }

    return totalPoints;
  }

  // 特殊逻辑：HappyHorse 系列
  if (model === "happyhorse") {
    // 720p -> 54/秒, 1080p -> 96/秒
    const res = resolution.toLowerCase();
    basePointsPerSecond = res === "1080p" ? 96 : 54;

    let totalPoints = basePointsPerSecond * duration;

    // 如果有视频输入，积分翻倍
    if (hasVideoInput) {
      totalPoints *= 2;
    }

    return totalPoints;
  }

  // 特殊逻辑：万相模型 (wanxiang / wan2.7-r2v)
  if (model === "wanxiang" || model === "wan2.7-r2v") {
    // 480p -> 20, 720p -> 36, 1080p -> 60 (不区分大小写)
    const res = resolution.toLowerCase();
    const pointsMap: Record<string, number> = {
      "480p": 20,
      "720p": 36,
      "1080p": 60,
    };
    basePointsPerSecond = pointsMap[res] ?? 36;

    let totalPoints = basePointsPerSecond * duration;

    // 如果有视频输入，积分翻倍
    if (hasVideoInput) {
      totalPoints *= 2;
    }

    return totalPoints;
  }

  // 特殊逻辑：Vidu Q3 Pro
  if (model === "vidu-q3-pro") {
    // 720p -> 42/秒, 1080p -> 72/秒
    const res = resolution.toLowerCase();
    basePointsPerSecond = res === "1080p" ? 72 : 42;

    let totalPoints = basePointsPerSecond * duration;

    if (hasVideoInput) {
      totalPoints *= 2;
    }

    return totalPoints;
  }

  // 特殊逻辑：Vidu Q3 Turbo
  if (model === "vidu") {
    // 720p -> 30/秒, 1080p -> 48/秒
    const res = resolution.toLowerCase();
    basePointsPerSecond = res === "1080p" ? 48 : 30;

    let totalPoints = basePointsPerSecond * duration;

    if (hasVideoInput) {
      totalPoints *= 2;
    }

    return totalPoints;
  }

  // 特殊逻辑：PixVerse C1
  if (model === "pixverse") {
    // 540p -> 18, 720p -> 28, 1080p -> 44
    const res = resolution.toLowerCase();
    const pointsMap: Record<string, number> = {
      "540p": 18,
      "720p": 28,
      "1080p": 44,
    };
    basePointsPerSecond = pointsMap[res] ?? 28;

    let totalPoints = basePointsPerSecond * duration;

    if (hasVideoInput) {
      totalPoints *= 2;
    }

    return totalPoints;
  }

  // 特殊逻辑：Keling V3
  if (model === "keling") {
    // 480p -> 22, 720p -> 40, 1080p -> 66
    const res = resolution.toLowerCase();
    const pointsMap: Record<string, number> = {
      "480p": 22,
      "720p": 40,
      "1080p": 66,
    };
    basePointsPerSecond = pointsMap[res] ?? 40;

    let totalPoints = basePointsPerSecond * duration;

    if (hasVideoInput) {
      totalPoints *= 2;
    }

    return totalPoints;
  }

  // Agnes-Video-V2.0：当前为免费模型，固定消耗 0 积分。
  if (model === "agnes-video-v2.0") {
    return 0;
  }

  if (model === "MiniMax-H3") {
    const rate = resolution.toLowerCase() === "2k" ? 48 : 30;
    return Math.max(rate * duration, 1);
  }

  // 特殊逻辑：PixVerse (pixverse-i2v)
  if (model === "pixverse-i2v") {
    const res = resolution.toLowerCase();
    let rate = 16; // 默认无声 720p

    if (hasAudio) {
      // 有声积分消耗
      const pointsMap: Record<string, number> = {
        "360p": 13,
        "540p": 16,
        "720p": 22,
        "1080p": 40,
      };
      rate = pointsMap[res] ?? 22;
    } else {
      // 无声积分消耗
      const pointsMap: Record<string, number> = {
        "360p": 9,
        "540p": 13,
        "720p": 16,
        "1080p": 32,
      };
      rate = pointsMap[res] ?? 16;
    }

    return rate * duration;
  }

  // 其他模型目前保持原样或默认逻辑
  return basePointsPerSecond;
};
