export type {
  BuildFireflyGptImageToImageRequestOptions,
  BuildFireflyGptText2ImageRequestOptions,
  FireflyGptChatImageResponse,
  FireflyGptImage2ImageRequest,
  FireflyGptImageErrorResponse,
  FireflyGptImageMessageContentPart,
  FireflyGptImageModel,
  FireflyGptImageRatio,
  FireflyGptImageResolution,
  FireflyGptImageResponse,
  FireflyGptImageTextContentPart,
  FireflyGptImageToImageErrorResponse,
  FireflyGptImageToImageRequest,
  FireflyGptImageToImageResponse,
  FireflyGptImageUrlContentPart,
  FireflyGptImageUserMessage,
  FireflyGptText2ImageRequest,
} from "./gpt-image";
export {
  buildFireflyGptImageToImageRequest,
  buildFireflyGptText2ImageRequest,
  FIREFLY_GPT_IMAGE_MAX_INPUT_IMAGES,
  normalizeFireflyGptImageInputUrls,
} from "./gpt-image";
export type {
  NanoBanana2ChatImageResponse,
  NanoBanana2Image2ImageRequest,
  NanoBanana2ImageErrorResponse,
  NanoBanana2ImageModel,
  NanoBanana2ImageResponse,
  NanoBanana2Ratio,
  NanoBanana2Resolution,
  NanoBanana2Text2ImageRequest,
  NanoBananaChatImageResponse,
  NanoBananaImage2ImageRequest,
  NanoBananaImageErrorResponse,
  NanoBananaImageModel,
  NanoBananaImageResponse,
  NanoBananaProChatImageResponse,
  NanoBananaProImage2ImageRequest,
  NanoBananaProImageErrorResponse,
  NanoBananaProImageModel,
  NanoBananaProImageResponse,
  NanoBananaProRatio,
  NanoBananaProResolution,
  NanoBananaProText2ImageRequest,
  NanoBananaRatio,
  NanoBananaResolution,
  NanoBananaText2ImageRequest,
} from "./nano-banana";

import type {
  FireflyGptChatImageResponse,
  FireflyGptImage2ImageRequest,
  FireflyGptImageErrorResponse,
  FireflyGptImageResponse,
  FireflyGptText2ImageRequest,
} from "./gpt-image";
import type {
  NanoBanana2ChatImageResponse,
  NanoBanana2Image2ImageRequest,
  NanoBanana2ImageErrorResponse,
  NanoBanana2ImageResponse,
  NanoBanana2Text2ImageRequest,
  NanoBananaChatImageResponse,
  NanoBananaImage2ImageRequest,
  NanoBananaImageErrorResponse,
  NanoBananaImageResponse,
  NanoBananaProChatImageResponse,
  NanoBananaProImage2ImageRequest,
  NanoBananaProImageErrorResponse,
  NanoBananaProImageResponse,
  NanoBananaProText2ImageRequest,
  NanoBananaText2ImageRequest,
} from "./nano-banana";

export type Adobe2ApiImageText2ImageRequest =
  | NanoBananaProText2ImageRequest
  | NanoBananaText2ImageRequest
  | NanoBanana2Text2ImageRequest
  | FireflyGptText2ImageRequest;

export type Adobe2ApiImage2ImageRequest =
  | NanoBananaProImage2ImageRequest
  | NanoBananaImage2ImageRequest
  | NanoBanana2Image2ImageRequest
  | FireflyGptImage2ImageRequest;

export type Adobe2ApiImageGenerationRequest =
  | Adobe2ApiImageText2ImageRequest
  | Adobe2ApiImage2ImageRequest;

export type Adobe2ApiImageGenerationResponse =
  | NanoBananaProImageResponse
  | NanoBananaImageResponse
  | NanoBanana2ImageResponse
  | FireflyGptImageResponse
  | NanoBananaProChatImageResponse
  | NanoBananaChatImageResponse
  | NanoBanana2ChatImageResponse
  | FireflyGptChatImageResponse;

export type Adobe2ApiImageGenerationErrorResponse =
  | NanoBananaProImageErrorResponse
  | NanoBananaImageErrorResponse
  | NanoBanana2ImageErrorResponse
  | FireflyGptImageErrorResponse;
