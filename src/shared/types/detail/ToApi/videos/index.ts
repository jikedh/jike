export type {
  DoubaoSeedance15ProRequest,
  DoubaoSeedance15ProResponse,
} from "./doubao-seedance-1-5-pro";
export type { GrokVideoRequest, GrokVideoResponse } from "./Grok";
export type {
  KlingVideoO1Request,
  KlingVideoO1Response,
} from "./kling-video-o1";
export type {
  MinimaxHailuo23Request,
  MinimaxHailuo23Response,
} from "./minimax-hailuo-2-3";
export type { SoraRequest, SoraResponse } from "./Sora";
export type { Veo3Request, Veo3Response } from "./Veo3";
export type { ViduQ3ProRequest, ViduQ3ProResponse } from "./vidu-q3-pro";
export type { Wan26Request, Wan26Response } from "./wan-2-6";

import type {
  DoubaoSeedance15ProRequest,
  DoubaoSeedance15ProResponse,
} from "./doubao-seedance-1-5-pro";
import type { GrokVideoRequest, GrokVideoResponse } from "./Grok";
import type {
  KlingVideoO1Request,
  KlingVideoO1Response,
} from "./kling-video-o1";
import type {
  MinimaxHailuo23Request,
  MinimaxHailuo23Response,
} from "./minimax-hailuo-2-3";
import type { SoraRequest, SoraResponse } from "./Sora";
import type { Veo3Request, Veo3Response } from "./Veo3";
import type { ViduQ3ProRequest, ViduQ3ProResponse } from "./vidu-q3-pro";
import type { Wan26Request, Wan26Response } from "./wan-2-6";

export type ToApiVideoGenerationRequest =
  | DoubaoSeedance15ProRequest
  | GrokVideoRequest
  | KlingVideoO1Request
  | MinimaxHailuo23Request
  | SoraRequest
  | Veo3Request
  | ViduQ3ProRequest
  | Wan26Request;

export type ToApiVideoGenerationResponse =
  | DoubaoSeedance15ProResponse
  | GrokVideoResponse
  | KlingVideoO1Response
  | MinimaxHailuo23Response
  | SoraResponse
  | Veo3Response
  | ViduQ3ProResponse
  | Wan26Response;
