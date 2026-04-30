import type {
  Adobe2ApiChatCompletionResponse,
  Adobe2ApiChatMessage,
  Adobe2ApiErrorResponse,
} from "../../common";

export type Sora2ProDuration = "4s" | "8s" | "12s";
export type Sora2ProRatio = "16x9" | "9x16";

export type Sora2ProVideoModel =
  `firefly-sora2-pro-${Sora2ProDuration}-${Sora2ProRatio}`;

/** Text-to-video or single-image-to-video request via /v1/chat/completions. */
export interface Sora2ProVideoRequest {
  model: Sora2ProVideoModel;
  messages: Adobe2ApiChatMessage[];
  stream?: boolean;
  generate_audio?: boolean;
  negative_prompt?: string;
  reference_mode?: "image";
}

export type Sora2ProVideoResponse =
  Adobe2ApiChatCompletionResponse<Sora2ProVideoModel>;

export type Sora2ProVideoErrorResponse = Adobe2ApiErrorResponse;
