import type { XimuBaseImageRequest } from "../../common";
import { normalizeXimuImages } from "../../common";

export type XimuGptImageModel = "gpt-image-2" | "gpt-image-2-vip";

export type XimuGptImageAspectRatio = `${number}x${number}`;

export interface XimuGptImageRequest extends XimuBaseImageRequest {
  model: XimuGptImageModel;
  aspectRatio: XimuGptImageAspectRatio;
}

export interface BuildXimuGptImageRequestOptions {
  model?: XimuGptImageModel;
  cardCode: string;
  prompt?: string;
  aspectRatio?: XimuGptImageAspectRatio;
  urls?: readonly string[];
  images?: readonly string[];
  replyType?: XimuGptImageRequest["replyType"];
}

const XIMU_GPT_IMAGE_RATIO_SIZE_MAP: Record<string, [number, number]> = {
  auto: [1024, 1024],
  "1:1": [1024, 1024],
  "3:2": [1536, 1024],
  "2:3": [1024, 1536],
  "16:9": [1792, 1008],
  "9:16": [1008, 1792],
  "5:4": [1280, 1024],
  "4:5": [1024, 1280],
  "4:3": [1360, 1024],
  "3:4": [1024, 1360],
  "21:9": [2016, 864],
  "9:21": [864, 2016],
  "1:3": [672, 2016],
  "3:1": [2016, 672],
  "2:1": [1536, 768],
  "1:2": [768, 1536],
};

const XIMU_GPT_IMAGE_PIXEL_SIZE_PATTERN = /^\d+x\d+$/i;

const normalizeXimuPixelSize = (width: number, height: number) =>
  `${Math.round(width / 16) * 16}x${Math.round(height / 16) * 16}` as const;

const scaleXimuPixelSize = (
  [baseWidth, baseHeight]: [number, number],
  resolution?: string,
) => {
  const normalizedResolution = (resolution || "1K").toUpperCase();
  const scale =
    normalizedResolution === "4K" ? 2 : normalizedResolution === "2K" ? 1.5 : 1;
  return normalizeXimuPixelSize(baseWidth * scale, baseHeight * scale);
};

export const resolveXimuGptAspectRatio = ({
  size,
  resolution,
}: {
  model?: XimuGptImageModel;
  size?: string;
  resolution?: string;
}): XimuGptImageAspectRatio => {
  const ratio = size || "auto";
  if (XIMU_GPT_IMAGE_PIXEL_SIZE_PATTERN.test(ratio)) {
    return ratio.toLowerCase() as XimuGptImageAspectRatio;
  }

  const baseSize = XIMU_GPT_IMAGE_RATIO_SIZE_MAP[ratio];
  if (!baseSize) {
    throw new Error(`GPT-Image-2 西牧渠道暂不支持 ${ratio} 比例`);
  }

  return scaleXimuPixelSize(baseSize, resolution);
};

export function buildXimuGptImageRequest({
  model = "gpt-image-2-vip",
  cardCode,
  prompt,
  aspectRatio = "1024x1024",
  urls,
  images,
  replyType = "async",
}: BuildXimuGptImageRequestOptions): XimuGptImageRequest {
  return {
    model,
    cardCode,
    prompt: prompt || "",
    aspectRatio,
    images: normalizeXimuImages(images || urls),
    replyType,
  };
}
