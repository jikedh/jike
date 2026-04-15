/**
 * 图片比例计算工具函数
 */

// 支持的标准比例列表
export const STANDARD_ASPECT_RATIOS = [
  { label: "1:1", value: "1:1", width: 1, height: 1 },
  { label: "2:3", value: "2:3", width: 2, height: 3 },
  { label: "3:2", value: "3:2", width: 3, height: 2 },
  { label: "3:4", value: "3:4", width: 3, height: 4 },
  { label: "4:3", value: "4:3", width: 4, height: 3 },
  { label: "4:5", value: "4:5", width: 4, height: 5 },
  { label: "5:4", value: "5:4", width: 5, height: 4 },
  { label: "9:16", value: "9:16", width: 9, height: 16 },
  { label: "16:9", value: "16:9", width: 16, height: 9 },
  { label: "21:9", value: "21:9", width: 21, height: 9 },
];

/**
 * 根据图片宽高计算最接近的标准比例
 * @param imageWidth 图片宽度
 * @param imageHeight 图片高度
 * @returns 最接近的标准比例值
 */
export function getClosestAspectRatio(
  imageWidth: number,
  imageHeight: number,
): string {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return "1:1";
  }

  const imageRatio = imageWidth / imageHeight;

  let closestRatio = STANDARD_ASPECT_RATIOS[0];
  let minDifference = Infinity;

  for (const ratio of STANDARD_ASPECT_RATIOS) {
    const standardRatio = ratio.width / ratio.height;
    const difference = Math.abs(imageRatio - standardRatio);

    if (difference < minDifference) {
      minDifference = difference;
      closestRatio = ratio;
    }
  }

  return closestRatio.value;
}

/**
 * 根据比例计算节点尺寸（基于基准高度）
 * @param aspectRatio 比例值，如 '16:9'
 * @param baseHeight 基准高度（默认 250px）
 * @returns 节点宽度和高度
 */
export function getNodeSizeByAspectRatio(
  aspectRatio: string,
  baseHeight: number = 250,
): { width: number; height: number } {
  const [widthRatio, heightRatio] = aspectRatio.split(":").map(Number);

  if (!widthRatio || !heightRatio) {
    return { width: 350, height: 250 }; // 默认尺寸
  }

  const ratio = widthRatio / heightRatio;

  // 根据比例类型调整基准高度
  let adjustedHeight = baseHeight;

  // 竖向图片（高度大于宽度）
  if (ratio < 1) {
    adjustedHeight = baseHeight * 1.2; // 稍微增加高度
  }
  // 超宽图片
  else if (ratio > 2) {
    adjustedHeight = baseHeight * 0.8; // 稍微减少高度
  }

  const width = adjustedHeight * ratio;

  return {
    width: Math.round(width),
    height: Math.round(adjustedHeight),
  };
}

/**
 * 获取图片的实际尺寸
 * @param imageUrl 图片 URL
 * @returns Promise<{width: number, height: number}>
 */
export function getImageDimensions(
  imageUrl: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
}

/**
 * 获取视频的实际尺寸
 * @param videoUrl 视频 URL（支持 blob URL）
 * @returns Promise<{width: number, height: number}>
 */
export function getVideoDimensions(
  videoUrl: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
      });
      // 释放资源
      video.src = "";
      video.load();
    };
    video.onerror = reject;
    video.src = videoUrl;
  });
}
