import type { XimuBaseImageRequest } from "../../common";
import { normalizeXimuUrls } from "../../common";

export type XimuGptImageModel = "gpt-image-2" | "gpt-image-2-vip";

export type XimuGptImageAspectRatio =
  | "auto"
  | "1:1"
  | "3:2"
  | "2:3"
  | "16:9"
  | "9:16"
  | "5:4"
  | "4:5"
  | "4:3"
  | "3:4"
  | "21:9"
  | "9:21"
  | "1:3"
  | "3:1"
  | "2:1"
  | "1:2"
  | "1024x1024"
  | "2048x2048"
  | "4096x4096";

export type XimuGptImageQuality = "auto" | "low" | "medium" | "high";

export interface XimuGptImageRequest extends XimuBaseImageRequest {
  model: XimuGptImageModel;
  aspectRatio: XimuGptImageAspectRatio;
  quality: XimuGptImageQuality;
}

export interface BuildXimuGptImageRequestOptions {
  cardCode: string;
  prompt?: string;
  aspectRatio?: XimuGptImageAspectRatio;
  quality?: XimuGptImageQuality;
  urls?: readonly string[];
  shutProgress?: boolean;
}

export const XIMU_GPT_IMAGE_ASPECT_RATIOS = [
  "auto",
  "1:1",
  "3:2",
  "2:3",
  "16:9",
  "9:16",
  "5:4",
  "4:5",
  "4:3",
  "3:4",
  "21:9",
  "9:21",
  "1:3",
  "3:1",
  "2:1",
  "1:2",
] as const satisfies readonly XimuGptImageAspectRatio[];

const XIMU_GPT_IMAGE_ASPECT_RATIO_SET = new Set<string>(
  XIMU_GPT_IMAGE_ASPECT_RATIOS,
);

export const resolveXimuGptAspectRatio = ({
  size,
  resolution,
}: {
  size?: string;
  resolution?: string;
}): XimuGptImageAspectRatio => {
  const ratio = size || "1:1";
  if (!XIMU_GPT_IMAGE_ASPECT_RATIO_SET.has(ratio)) {
    throw new Error(`GPT-Image-2 西牧渠道暂不支持 ${ratio} 比例`);
  }

  if (ratio === "1:1") {
    if (resolution === "2K") {
      return "2048x2048";
    }
    if (resolution === "4K") {
      return "4096x4096";
    }
    return "1024x1024";
  }

  return ratio as XimuGptImageAspectRatio;
};

export function buildXimuGptImageRequest({
  cardCode,
  prompt,
  aspectRatio = "1:1",
  quality = "auto",
  urls,
  shutProgress = false,
}: BuildXimuGptImageRequestOptions): XimuGptImageRequest {
  return {
    model: "gpt-image-2-vip",
    cardCode,
    prompt: prompt || "",
    aspectRatio,
    quality,
    urls: normalizeXimuUrls(urls),
    shutProgress,
  };
}
