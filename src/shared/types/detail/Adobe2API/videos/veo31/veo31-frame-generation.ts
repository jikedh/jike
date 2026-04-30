import type {
  Adobe2ApiChatCompletionResponse,
  Adobe2ApiChatMessage,
  Adobe2ApiErrorResponse,
} from "../../common";

export type Veo31Duration = "4s" | "6s" | "8s";
export type Veo31Ratio = "16x9" | "9x16";
export type Veo31Resolution = "1080p" | "720p";

export type Veo31FrameVideoModel =
  `firefly-veo31-${Veo31Duration}-${Veo31Ratio}-${Veo31Resolution}`;

/** Frame-mode video request. One image is first frame; two images are first and last frame. */
export interface Veo31FrameVideoRequest {
  model: Veo31FrameVideoModel;
  messages: Adobe2ApiChatMessage[];
  stream?: boolean;
  generate_audio?: boolean;
  negative_prompt?: string;
  reference_mode?: "frame";
}

export type Veo31FrameVideoResponse =
  Adobe2ApiChatCompletionResponse<Veo31FrameVideoModel>;

export type Veo31FrameVideoErrorResponse = Adobe2ApiErrorResponse;
