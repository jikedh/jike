import type {
  Adobe2ApiChatCompletionResponse,
  Adobe2ApiChatMessage,
  Adobe2ApiErrorResponse,
  Adobe2ApiImageUrlResponse,
} from "../../common";

export type NanoBananaResolution = "1k" | "2k" | "4k";
export type NanoBananaRatio = "1x1" | "16x9" | "9x16" | "4x3" | "3x4";

export type NanoBananaImageModel =
  `firefly-nano-banana-${NanoBananaResolution}-${NanoBananaRatio}`;

/** Text-to-image request via /v1/images/generations. */
export interface NanoBananaText2ImageRequest {
  model: NanoBananaImageModel;
  prompt: string;
  response_format?: "url";
}

/** Image-to-image or multimodal image generation via /v1/chat/completions. */
export interface NanoBananaImage2ImageRequest {
  model: NanoBananaImageModel;
  messages: Adobe2ApiChatMessage[];
  stream?: boolean;
}

export type NanoBananaImageResponse =
  Adobe2ApiImageUrlResponse<NanoBananaImageModel>;

export type NanoBananaChatImageResponse =
  Adobe2ApiChatCompletionResponse<NanoBananaImageModel>;

export type NanoBananaImageErrorResponse = Adobe2ApiErrorResponse;
