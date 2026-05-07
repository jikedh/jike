import type { XimuBaseImageRequest } from "../../common";
import { normalizeXimuUrls } from "../../common";

export type XimuNanoBananaModel = "nano-banana-2" | "nano-banana-pro";

export type XimuNanoBananaAspectRatio =
  | "auto"
  | "1:1"
  | "16:9"
  | "9:16"
  | "4:3"
  | "3:4"
  | "3:2"
  | "2:3"
  | "5:4"
  | "4:5"
  | "21:9"
  | "1:4"
  | "4:1"
  | "1:8"
  | "8:1";

export type XimuImageSize = "1K" | "2K" | "4K";

export interface XimuNanoBananaRequest extends XimuBaseImageRequest {
  model: XimuNanoBananaModel;
  aspectRatio: XimuNanoBananaAspectRatio;
  imageSize: XimuImageSize;
}

export interface BuildXimuNanoBananaRequestOptions {
  cardCode: string;
  prompt?: string;
  aspectRatio?: XimuNanoBananaAspectRatio;
  imageSize?: XimuImageSize;
  urls?: readonly string[];
  shutProgress?: boolean;
}

export const XIMU_NANO_BANANA_PRO_ASPECT_RATIOS = [
  "auto",
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "5:4",
  "4:5",
  "21:9",
] as const satisfies readonly XimuNanoBananaAspectRatio[];

export const XIMU_IMAGE_SIZES = ["1K", "2K", "4K"] as const;

const XIMU_NANO_BANANA_PRO_ASPECT_RATIO_SET = new Set<string>(
  XIMU_NANO_BANANA_PRO_ASPECT_RATIOS,
);
const XIMU_IMAGE_SIZE_SET = new Set<string>(XIMU_IMAGE_SIZES);

export const resolveXimuImageSize = (resolution?: string): XimuImageSize => {
  const normalized = (resolution || "1K").toUpperCase();
  return XIMU_IMAGE_SIZE_SET.has(normalized)
    ? (normalized as XimuImageSize)
    : "1K";
};

export const resolveXimuNanoBananaProAspectRatio = (
  size?: string,
): XimuNanoBananaAspectRatio => {
  const ratio = size || "auto";
  if (!XIMU_NANO_BANANA_PRO_ASPECT_RATIO_SET.has(ratio)) {
    throw new Error(`Nano Banana Pro 西牧渠道暂不支持 ${ratio} 比例`);
  }
  return ratio as XimuNanoBananaAspectRatio;
};

export function buildXimuNanoBananaRequest({
  cardCode,
  prompt,
  aspectRatio = "auto",
  imageSize = "1K",
  urls,
  shutProgress = false,
}: BuildXimuNanoBananaRequestOptions): XimuNanoBananaRequest {
  return {
    model: "nano-banana-pro",
    cardCode,
    prompt: prompt || "",
    aspectRatio,
    imageSize,
    urls: normalizeXimuUrls(urls),
    shutProgress,
  };
}
