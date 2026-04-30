import type {
  Adobe2ApiChatCompletionResponse,
  Adobe2ApiChatMessage,
  Adobe2ApiErrorResponse,
} from "../../common";

export type Veo31RefDuration = "4s" | "6s" | "8s";
export type Veo31RefRatio = "16x9" | "9x16";
export type Veo31RefResolution = "1080p" | "720p";

export type Veo31ReferenceVideoModel =
  `firefly-veo31-ref-${Veo31RefDuration}-${Veo31RefRatio}-${Veo31RefResolution}`;

/** Reference-image video request. Supports 1 to 3 reference images. */
export interface Veo31ReferenceVideoRequest {
  model: Veo31ReferenceVideoModel;
  messages: Adobe2ApiChatMessage[];
  stream?: boolean;
  generate_audio?: boolean;
  negative_prompt?: string;
  reference_mode?: "image";
}

export type Veo31ReferenceVideoResponse =
  Adobe2ApiChatCompletionResponse<Veo31ReferenceVideoModel>;

export type Veo31ReferenceVideoErrorResponse = Adobe2ApiErrorResponse;
