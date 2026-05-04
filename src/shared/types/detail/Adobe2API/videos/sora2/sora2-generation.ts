import type {
  Adobe2ApiChatCompletionResponse,
  Adobe2ApiChatMessage,
  Adobe2ApiErrorResponse,
} from "../../common";

export type Sora2Duration = "4s" | "8s" | "12s";
export type Sora2Ratio = "16x9" | "9x16";

export type Sora2VideoModel = `firefly-sora2-${Sora2Duration}-${Sora2Ratio}`;

/** Text-to-video or single-image-to-video request via /v1/chat/completions. */
export interface Sora2VideoRequest {
  model: Sora2VideoModel;
  messages: Adobe2ApiChatMessage[];
  stream?: boolean;
  generate_audio?: boolean;
  negative_prompt?: string;
}

export type Sora2VideoResponse =
  Adobe2ApiChatCompletionResponse<Sora2VideoModel>;

export type Sora2VideoErrorResponse = Adobe2ApiErrorResponse;
