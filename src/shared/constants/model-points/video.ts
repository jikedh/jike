export const VIDEO_MODEL_POINTS: Record<string, number> = {
  "doubao-seedance-2.0": 60, // 默认 720p 基础分
  "doubao-seedance-2.0-fast": 48, // 默认 720p 基础分
  "doubao-seedance-2.0-pro": 60, // 默认 720p 基础分
  "seedance-2.0-fast": 48, // 新版视频节点 Seedance 2.0 Fast
  "seedance-2.0-pro": 60, // 新版视频节点 Seedance 2.0 Pro
  "wan2.7-r2v": 36, // 默认 720p 基础分
  "pixverse-i2v": 60,
  "agnes-video-v2.0": 0, // Agnes-Video-V2.0 当前为免费模型，固定 0 积分
};

export const DEFAULT_VIDEO_GENERATION_POINTS = 60;

export const getVideoGenerationPoints = ({
  model,
  duration = 5, // 默认通常是 5 秒
  resolution = "720p",
  hasVideoInput = false,
  hasAudio = false,
  fallback = DEFAULT_VIDEO_GENERATION_POINTS,
}: {
  model?: string;
  duration?: number;
  resolution?: string;
  hasVideoInput?: boolean;
  hasAudio?: boolean;
  fallback?: number;
}) => {
  let basePointsPerSecond =
    (model ? VIDEO_MODEL_POINTS[model] : undefined) ?? fallback;

  // 特殊逻辑：Seedance 2.0 系列
  if (
    model?.startsWith("doubao-seedance-2.0") ||
    model?.startsWith("seedance-2.0")
  ) {
    const isFast = model.includes("-fast");
    const res = resolution.toLowerCase();

    if (isFast) {
      // Seedance 2.0 Fast: 720p -> 48, 480p -> 24
      basePointsPerSecond = res === "480p" ? 24 : 48;
    } else {
      // Seedance 2.0 (Standard/Pro): 720p -> 60, 480p -> 30
      basePointsPerSecond = res === "480p" ? 30 : 60;
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
