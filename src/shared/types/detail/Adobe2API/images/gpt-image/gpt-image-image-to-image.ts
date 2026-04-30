import type {
  Adobe2ApiChatCompletionResponse,
  Adobe2ApiErrorResponse,
} from "../../common";
import type { FireflyGptImageModel } from "./gpt-image-generation";

export const FIREFLY_GPT_IMAGE_MAX_INPUT_IMAGES = 6;

export interface FireflyGptImageTextContentPart {
  type: "text";
  text: string;
}

export interface FireflyGptImageUrlContentPart {
  type: "image_url";
  image_url: string;
}

export type FireflyGptImageMessageContentPart =
  | FireflyGptImageTextContentPart
  | FireflyGptImageUrlContentPart;

export interface FireflyGptImageUserMessage {
  role: "user";
  content: FireflyGptImageMessageContentPart[];
}

export interface BuildFireflyGptImageToImageRequestOptions {
  model: FireflyGptImageModel;
  prompt?: string;
  imageUrls: readonly string[];
  stream?: boolean;
  maxInputImages?: number;
}

/**
 * GPT-Image-2 image-to-image/edit request via /v1/chat/completions.
 *
 * Adobe2API reads image references from the latest user message content:
 * [{ type: "image_url", image_url: "https://..." }]. The backend accepts up to 6
 * image_url items and maps GPT-Image references to upstream reference assets.
 */
export interface FireflyGptImageToImageRequest {
  model: FireflyGptImageModel;
  messages: FireflyGptImageUserMessage[];
  stream?: boolean;
}

export function normalizeFireflyGptImageInputUrls(
  imageUrls: readonly string[],
  maxInputImages = FIREFLY_GPT_IMAGE_MAX_INPUT_IMAGES,
): string[] {
  const limit = Math.max(0, Math.floor(maxInputImages));
  return Array.from(
    new Set(
      imageUrls
        .map((url) => String(url || "").trim())
        .filter(Boolean),
    ),
  ).slice(0, limit);
}

export function buildFireflyGptImageToImageRequest({
  model,
  prompt,
  imageUrls,
  stream,
  maxInputImages,
}: BuildFireflyGptImageToImageRequestOptions): FireflyGptImageToImageRequest {
  const normalizedImageUrls = normalizeFireflyGptImageInputUrls(
    imageUrls,
    maxInputImages,
  );
  return {
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt || "" },
          ...normalizedImageUrls.map((url) => ({
            type: "image_url" as const,
            image_url: url,
          })),
        ],
      },
    ],
    ...(stream === undefined ? {} : { stream }),
  };
}

export type FireflyGptImageToImageResponse =
  Adobe2ApiChatCompletionResponse<FireflyGptImageModel>;

export type FireflyGptImageToImageErrorResponse = Adobe2ApiErrorResponse;

// Backward-compatible alias used by the existing Adobe2API image union.
export type FireflyGptImage2ImageRequest = FireflyGptImageToImageRequest;
export type FireflyGptChatImageResponse = FireflyGptImageToImageResponse;
