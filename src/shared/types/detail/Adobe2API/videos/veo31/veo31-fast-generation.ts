import type {
  Adobe2ApiChatCompletionResponse,
  Adobe2ApiChatMessage,
  Adobe2ApiErrorResponse,
} from "../../common";

export type Veo31FastDuration = "4s" | "6s" | "8s";
export type Veo31FastRatio = "16x9" | "9x16";
export type Veo31FastResolution = "1080p" | "720p";

export type Veo31FastVideoModel =
  `firefly-veo31-fast-${Veo31FastDuration}-${Veo31FastRatio}-${Veo31FastResolution}`;

/** Fast frame-mode video request. One image is first frame; two images are first and last frame. */
export interface Veo31FastVideoRequest {
  model: Veo31FastVideoModel;
  messages: Adobe2ApiChatMessage[];
  stream?: boolean;
  generate_audio?: boolean;
  negative_prompt?: string;
  reference_mode?: "frame";
}

export type Veo31FastVideoResponse =
  Adobe2ApiChatCompletionResponse<Veo31FastVideoModel>;

export type Veo31FastVideoErrorResponse = Adobe2ApiErrorResponse;
