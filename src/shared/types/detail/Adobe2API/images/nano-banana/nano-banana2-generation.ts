import type {
  Adobe2ApiChatCompletionResponse,
  Adobe2ApiChatMessage,
  Adobe2ApiErrorResponse,
  Adobe2ApiImageUrlResponse,
} from "../../common";

export type NanoBanana2Resolution = "1k" | "2k" | "4k";
export type NanoBanana2Ratio =
  | "1x1"
  | "16x9"
  | "9x16"
  | "4x3"
  | "3x4"
  | "1x8"
  | "1x4"
  | "4x1"
  | "8x1";

export type NanoBanana2ImageModel =
  `firefly-nano-banana2-${NanoBanana2Resolution}-${NanoBanana2Ratio}`;

/** Text-to-image request via /v1/images/generations. */
export interface NanoBanana2Text2ImageRequest {
  model: NanoBanana2ImageModel;
  prompt: string;
  response_format?: "url";
}

/** Image-to-image or multimodal image generation via /v1/chat/completions. */
export interface NanoBanana2Image2ImageRequest {
  model: NanoBanana2ImageModel;
  messages: Adobe2ApiChatMessage[];
  stream?: boolean;
}

export type NanoBanana2ImageResponse =
  Adobe2ApiImageUrlResponse<NanoBanana2ImageModel>;

export type NanoBanana2ChatImageResponse =
  Adobe2ApiChatCompletionResponse<NanoBanana2ImageModel>;

export type NanoBanana2ImageErrorResponse = Adobe2ApiErrorResponse;
