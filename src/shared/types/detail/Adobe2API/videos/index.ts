export type {
  Sora2Duration,
  Sora2ProDuration,
  Sora2ProRatio,
  Sora2ProVideoErrorResponse,
  Sora2ProVideoModel,
  Sora2ProVideoRequest,
  Sora2ProVideoResponse,
  Sora2Ratio,
  Sora2VideoErrorResponse,
  Sora2VideoModel,
  Sora2VideoRequest,
  Sora2VideoResponse,
} from "./sora2";
export type {
  Veo31Duration,
  Veo31FastDuration,
  Veo31FastRatio,
  Veo31FastResolution,
  Veo31FastVideoErrorResponse,
  Veo31FastVideoModel,
  Veo31FastVideoRequest,
  Veo31FastVideoResponse,
  Veo31FrameVideoErrorResponse,
  Veo31FrameVideoModel,
  Veo31FrameVideoRequest,
  Veo31FrameVideoResponse,
  Veo31Ratio,
  Veo31RefDuration,
  Veo31RefRatio,
  Veo31RefResolution,
  Veo31ReferenceVideoErrorResponse,
  Veo31ReferenceVideoModel,
  Veo31ReferenceVideoRequest,
  Veo31ReferenceVideoResponse,
  Veo31Resolution,
} from "./veo31";

import type {
  Sora2ProVideoErrorResponse,
  Sora2ProVideoRequest,
  Sora2ProVideoResponse,
  Sora2VideoErrorResponse,
  Sora2VideoRequest,
  Sora2VideoResponse,
} from "./sora2";
import type {
  Veo31FastVideoErrorResponse,
  Veo31FastVideoRequest,
  Veo31FastVideoResponse,
  Veo31FrameVideoErrorResponse,
  Veo31FrameVideoRequest,
  Veo31FrameVideoResponse,
  Veo31ReferenceVideoErrorResponse,
  Veo31ReferenceVideoRequest,
  Veo31ReferenceVideoResponse,
} from "./veo31";

export type Adobe2ApiVideoGenerationRequest =
  | Sora2VideoRequest
  | Sora2ProVideoRequest
  | Veo31FrameVideoRequest
  | Veo31ReferenceVideoRequest
  | Veo31FastVideoRequest;

export type Adobe2ApiVideoGenerationResponse =
  | Sora2VideoResponse
  | Sora2ProVideoResponse
  | Veo31FrameVideoResponse
  | Veo31ReferenceVideoResponse
  | Veo31FastVideoResponse;

export type Adobe2ApiVideoGenerationErrorResponse =
  | Sora2VideoErrorResponse
  | Sora2ProVideoErrorResponse
  | Veo31FrameVideoErrorResponse
  | Veo31ReferenceVideoErrorResponse
  | Veo31FastVideoErrorResponse;
