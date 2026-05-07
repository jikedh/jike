export type {
  BuildXimuGptImageRequestOptions,
  XimuGptImageAspectRatio,
  XimuGptImageModel,
  XimuGptImageQuality,
  XimuGptImageRequest,
} from "./gpt-image/gpt-image-2";
export {
  buildXimuGptImageRequest,
  resolveXimuGptAspectRatio,
  XIMU_GPT_IMAGE_ASPECT_RATIOS,
} from "./gpt-image/gpt-image-2";

export type {
  BuildXimuNanoBananaRequestOptions,
  XimuImageSize,
  XimuNanoBananaAspectRatio,
  XimuNanoBananaModel,
  XimuNanoBananaRequest,
} from "./nano-banana/nano-banana-pro";
export {
  buildXimuNanoBananaRequest,
  resolveXimuImageSize,
  resolveXimuNanoBananaProAspectRatio,
  XIMU_IMAGE_SIZES,
  XIMU_NANO_BANANA_PRO_ASPECT_RATIOS,
} from "./nano-banana/nano-banana-pro";

import type {
  XimuGptImageModel,
  XimuGptImageRequest,
} from "./gpt-image/gpt-image-2";
import type {
  XimuNanoBananaModel,
  XimuNanoBananaRequest,
} from "./nano-banana/nano-banana-pro";

export type XimuImageModel = XimuGptImageModel | XimuNanoBananaModel;
export type XimuImageGenerationRequest =
  | XimuGptImageRequest
  | XimuNanoBananaRequest;
