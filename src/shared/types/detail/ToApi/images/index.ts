export type { Flux20ImageRequest, Flux20ImageResponse } from "./flux-2-0-image";
export type { Gemini3ProRequest, Gemini3ProResponse } from "./gemini-image";
export type { GPT4oImageRequest, GPT4oImageResponse } from "./gpt-4o-image";
export type {
  GptImage2GenerationRequest,
  GptImage2GenerationResponse,
} from "./gpt-image-2";
export type { ImageTaskStatus } from "./image-task-status";
export type { GrokImageRequest, GrokImageResponse } from "./grok-image";
export type {
  Seedream5ImageRequest,
  Seedream5ImageResponse,
} from "./seedream-5-0-image";

import type {
  Flux20ImageRequest,
  Flux20ImageResponse,
} from "./flux-2-0-image";
import type {
  Gemini3ProRequest,
  Gemini3ProResponse,
} from "./gemini-image";
import type {
  GPT4oImageRequest,
  GPT4oImageResponse,
} from "./gpt-4o-image";
import type {
  GptImage2GenerationRequest,
  GptImage2GenerationResponse,
} from "./gpt-image-2";
import type { ImageTaskStatus } from "./image-task-status";
import type { GrokImageRequest, GrokImageResponse } from "./grok-image";
import type {
  Seedream5ImageRequest,
  Seedream5ImageResponse,
} from "./seedream-5-0-image";

export type ToApiImageGenerationRequest =
  | Flux20ImageRequest
  | Gemini3ProRequest
  | GPT4oImageRequest
  | GptImage2GenerationRequest
  | GrokImageRequest
  | Seedream5ImageRequest;

export type ToApiImageGenerationResponse =
  | Flux20ImageResponse
  | Gemini3ProResponse
  | GPT4oImageResponse
  | GptImage2GenerationResponse
  | GrokImageResponse
  | Seedream5ImageResponse;

export type ToApiImageTaskStatusResponse = ImageTaskStatus;
