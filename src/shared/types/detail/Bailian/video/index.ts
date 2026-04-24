export type {
  KlingV3OmniVideoGenerationRequest,
  KlingV3OmniVideoGenerationCreateResponse,
  KlingV3OmniVideoGenerationQueryResponse,
  KlingV3OmniVideoGenerationErrorResponse,
} from "./keling/kling-v3-omni-video-generation";
export type {
  KlingV3VideoGenerationRequest,
  KlingV3VideoGenerationCreateResponse,
  KlingV3VideoGenerationQueryResponse,
  KlingV3VideoGenerationErrorResponse,
} from "./keling/kling-v3-video-generation";
export type {
  ViduQ3TurboText2VideoRequest,
  ViduQ3TurboText2VideoCreateResponse,
  ViduQ3TurboText2VideoQueryResponse,
  ViduQ3TurboText2VideoErrorResponse,
} from "./vidu/viduq3-turbo_text2video";
export type {
  Wan27I2vRequest,
  Wan27I2vCreateResponse,
  Wan27I2vQueryResponse,
  Wan27I2vErrorResponse,
} from "./wanxiang/wan2.7-i2v";
export type {
  PixverseI2vRequest,
  PixverseI2vCreateResponse,
  PixverseI2vQueryResponse,
  PixverseI2vErrorResponse,
} from "./pixverse/pixverse-i2v";

import type {
  KlingV3OmniVideoGenerationRequest,
  KlingV3OmniVideoGenerationCreateResponse,
  KlingV3OmniVideoGenerationQueryResponse,
  KlingV3OmniVideoGenerationErrorResponse,
} from "./keling/kling-v3-omni-video-generation";
import type {
  KlingV3VideoGenerationRequest,
  KlingV3VideoGenerationCreateResponse,
  KlingV3VideoGenerationQueryResponse,
  KlingV3VideoGenerationErrorResponse,
} from "./keling/kling-v3-video-generation";
import type {
  ViduQ3TurboText2VideoRequest,
  ViduQ3TurboText2VideoCreateResponse,
  ViduQ3TurboText2VideoQueryResponse,
  ViduQ3TurboText2VideoErrorResponse,
} from "./vidu/viduq3-turbo_text2video";
import type {
  Wan27I2vRequest,
  Wan27I2vCreateResponse,
  Wan27I2vQueryResponse,
  Wan27I2vErrorResponse,
} from "./wanxiang/wan2.7-i2v";
import type {
  PixverseI2vRequest,
  PixverseI2vCreateResponse,
  PixverseI2vQueryResponse,
  PixverseI2vErrorResponse,
} from "./pixverse/pixverse-i2v";

// 请求体联合类型
export type BailianVideoGenerationRequest =
  | KlingV3OmniVideoGenerationRequest
  | KlingV3VideoGenerationRequest
  | ViduQ3TurboText2VideoRequest
  | Wan27I2vRequest
  | PixverseI2vRequest;

// 响应体联合类型
export type BailianVideoGenerationCreateResponse =
  | KlingV3OmniVideoGenerationCreateResponse
  | KlingV3VideoGenerationCreateResponse
  | ViduQ3TurboText2VideoCreateResponse
  | Wan27I2vCreateResponse
  | PixverseI2vCreateResponse;

// 轮询接口的响应体联合类型
export type BailianVideoGenerationQueryResponse =
  | KlingV3OmniVideoGenerationQueryResponse
  | KlingV3VideoGenerationQueryResponse
  | ViduQ3TurboText2VideoQueryResponse
  | Wan27I2vQueryResponse
  | PixverseI2vQueryResponse;
