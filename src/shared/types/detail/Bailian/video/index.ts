export type {
  KlingV3OmniVideoGenerationCreateResponse,
  KlingV3OmniVideoGenerationErrorResponse,
  KlingV3OmniVideoGenerationQueryResponse,
  KlingV3OmniVideoGenerationRequest,
} from "./keling/kling-v3-omni-video-generation";
export type {
  KlingV3VideoGenerationCreateResponse,
  KlingV3VideoGenerationErrorResponse,
  KlingV3VideoGenerationQueryResponse,
  KlingV3VideoGenerationRequest,
} from "./keling/kling-v3-video-generation";
export type {
  PixverseI2vCreateResponse,
  PixverseI2vErrorResponse,
  PixverseI2vQueryResponse,
  PixverseI2vRequest,
} from "./pixverse/pixverse-i2v";
export type {
  PixverseKf2vCreateResponse,
  PixverseKf2vErrorResponse,
  PixverseKf2vQueryResponse,
  PixverseKf2vRequest,
} from "./pixverse/pixverse-kf2v";
export type {
  PixverseR2vCreateResponse,
  PixverseR2vErrorResponse,
  PixverseR2vQueryResponse,
  PixverseR2vRequest,
} from "./pixverse/pixverse-r2v";
export type {
  PixverseT2vCreateResponse,
  PixverseT2vErrorResponse,
  PixverseT2vQueryResponse,
  PixverseT2vRequest,
} from "./pixverse/pixverse-t2v";
export type {
  ViduQ2Reference2VideoCreateResponse,
  ViduQ2Reference2VideoErrorResponse,
  ViduQ2Reference2VideoQueryResponse,
  ViduQ2Reference2VideoRequest,
} from "./vidu/viduq2_reference2video";
export type {
  ViduQ3TurboStartEnd2VideoCreateResponse,
  ViduQ3TurboStartEnd2VideoErrorResponse,
  ViduQ3TurboStartEnd2VideoQueryResponse,
  ViduQ3TurboStartEnd2VideoRequest,
} from "./vidu/viduq3-turbo_start-end2video";
export type {
  ViduQ3TurboText2VideoCreateResponse,
  ViduQ3TurboText2VideoErrorResponse,
  ViduQ3TurboText2VideoQueryResponse,
  ViduQ3TurboText2VideoRequest,
} from "./vidu/viduq3-turbo_text2video";
export type {
  Wan27I2vCreateResponse,
  Wan27I2vErrorResponse,
  Wan27I2vQueryResponse,
  Wan27I2vRequest,
} from "./wanxiang/wan2.7-i2v";
export type {
  Wan27R2vCreateResponse,
  Wan27R2vErrorResponse,
  Wan27R2vQueryResponse,
  Wan27R2vRequest,
} from "./wanxiang/wan2.7-r2v";
export type {
  Wan27T2vCreateResponse,
  Wan27T2vErrorResponse,
  Wan27T2vQueryResponse,
  Wan27T2vRequest,
} from "./wanxiang/wan2.7-t2v";

import type {
  KlingV3OmniVideoGenerationCreateResponse,
  KlingV3OmniVideoGenerationErrorResponse,
  KlingV3OmniVideoGenerationQueryResponse,
  KlingV3OmniVideoGenerationRequest,
} from "./keling/kling-v3-omni-video-generation";
import type {
  KlingV3VideoGenerationCreateResponse,
  KlingV3VideoGenerationErrorResponse,
  KlingV3VideoGenerationQueryResponse,
  KlingV3VideoGenerationRequest,
} from "./keling/kling-v3-video-generation";
import type {
  PixverseI2vCreateResponse,
  PixverseI2vErrorResponse,
  PixverseI2vQueryResponse,
  PixverseI2vRequest,
} from "./pixverse/pixverse-i2v";
import type {
  PixverseKf2vCreateResponse,
  PixverseKf2vErrorResponse,
  PixverseKf2vQueryResponse,
  PixverseKf2vRequest,
} from "./pixverse/pixverse-kf2v";
import type {
  PixverseR2vCreateResponse,
  PixverseR2vErrorResponse,
  PixverseR2vQueryResponse,
  PixverseR2vRequest,
} from "./pixverse/pixverse-r2v";
import type {
  PixverseT2vCreateResponse,
  PixverseT2vErrorResponse,
  PixverseT2vQueryResponse,
  PixverseT2vRequest,
} from "./pixverse/pixverse-t2v";
import type {
  ViduQ2Reference2VideoCreateResponse,
  ViduQ2Reference2VideoErrorResponse,
  ViduQ2Reference2VideoQueryResponse,
  ViduQ2Reference2VideoRequest,
} from "./vidu/viduq2_reference2video";
import type {
  ViduQ3TurboStartEnd2VideoCreateResponse,
  ViduQ3TurboStartEnd2VideoErrorResponse,
  ViduQ3TurboStartEnd2VideoQueryResponse,
  ViduQ3TurboStartEnd2VideoRequest,
} from "./vidu/viduq3-turbo_start-end2video";
import type {
  ViduQ3TurboText2VideoCreateResponse,
  ViduQ3TurboText2VideoErrorResponse,
  ViduQ3TurboText2VideoQueryResponse,
  ViduQ3TurboText2VideoRequest,
} from "./vidu/viduq3-turbo_text2video";
import type {
  Wan27I2vCreateResponse,
  Wan27I2vErrorResponse,
  Wan27I2vQueryResponse,
  Wan27I2vRequest,
} from "./wanxiang/wan2.7-i2v";
import type {
  Wan27R2vCreateResponse,
  Wan27R2vErrorResponse,
  Wan27R2vQueryResponse,
  Wan27R2vRequest,
} from "./wanxiang/wan2.7-r2v";
import type {
  Wan27T2vCreateResponse,
  Wan27T2vErrorResponse,
  Wan27T2vQueryResponse,
  Wan27T2vRequest,
} from "./wanxiang/wan2.7-t2v";

// 请求体联合类型
export type BailianVideoGenerationRequest =
  | KlingV3OmniVideoGenerationRequest
  | KlingV3VideoGenerationRequest
  | ViduQ2Reference2VideoRequest
  | ViduQ3TurboStartEnd2VideoRequest
  | ViduQ3TurboText2VideoRequest
  | Wan27T2vRequest
  | Wan27I2vRequest
  | Wan27R2vRequest
  | PixverseT2vRequest
  | PixverseI2vRequest
  | PixverseKf2vRequest
  | PixverseR2vRequest;

// 响应体联合类型
export type BailianVideoGenerationCreateResponse =
  | KlingV3OmniVideoGenerationCreateResponse
  | KlingV3VideoGenerationCreateResponse
  | ViduQ2Reference2VideoCreateResponse
  | ViduQ3TurboStartEnd2VideoCreateResponse
  | ViduQ3TurboText2VideoCreateResponse
  | Wan27T2vCreateResponse
  | Wan27I2vCreateResponse
  | Wan27R2vCreateResponse
  | PixverseT2vCreateResponse
  | PixverseI2vCreateResponse
  | PixverseKf2vCreateResponse
  | PixverseR2vCreateResponse;

// 轮询接口的响应体联合类型
export type BailianVideoGenerationQueryResponse =
  | KlingV3OmniVideoGenerationQueryResponse
  | KlingV3VideoGenerationQueryResponse
  | ViduQ2Reference2VideoQueryResponse
  | ViduQ3TurboStartEnd2VideoQueryResponse
  | ViduQ3TurboText2VideoQueryResponse
  | Wan27T2vQueryResponse
  | Wan27I2vQueryResponse
  | Wan27R2vQueryResponse
  | PixverseT2vQueryResponse
  | PixverseI2vQueryResponse
  | PixverseKf2vQueryResponse
  | PixverseR2vQueryResponse;

// 异常响应联合类型
export type BailianVideoGenerationErrorResponse =
  | KlingV3OmniVideoGenerationErrorResponse
  | KlingV3VideoGenerationErrorResponse
  | ViduQ2Reference2VideoErrorResponse
  | ViduQ3TurboStartEnd2VideoErrorResponse
  | ViduQ3TurboText2VideoErrorResponse
  | Wan27T2vErrorResponse
  | Wan27I2vErrorResponse
  | Wan27R2vErrorResponse
  | PixverseT2vErrorResponse
  | PixverseI2vErrorResponse
  | PixverseKf2vErrorResponse
  | PixverseR2vErrorResponse;
