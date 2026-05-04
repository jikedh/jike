import type {
  Adobe2ApiChatCompletionResponse,
  Adobe2ApiChatMessage,
  Adobe2ApiErrorResponse,
  Adobe2ApiImageUrlResponse,
} from "../../common";

export type NanoBananaProResolution = "1k" | "2k" | "4k";
export type NanoBananaProRatio = "1x1" | "16x9" | "9x16" | "4x3" | "3x4";

export type NanoBananaProImageModel =
  `firefly-nano-banana-pro-${NanoBananaProResolution}-${NanoBananaProRatio}`;

/** Text-to-image request via /v1/images/generations. */
export interface NanoBananaProText2ImageRequest {
  model: NanoBananaProImageModel;
  prompt: string;
  response_format?: "url";
}

/** Image-to-image or multimodal image generation via /v1/chat/completions. */
export interface NanoBananaProImage2ImageRequest {
  model: NanoBananaProImageModel;
  messages: Adobe2ApiChatMessage[];
  stream?: boolean;
}

export type NanoBananaProImageResponse =
  Adobe2ApiImageUrlResponse<NanoBananaProImageModel>;

export type NanoBananaProChatImageResponse =
  Adobe2ApiChatCompletionResponse<NanoBananaProImageModel>;

export type NanoBananaProImageErrorResponse = Adobe2ApiErrorResponse;
