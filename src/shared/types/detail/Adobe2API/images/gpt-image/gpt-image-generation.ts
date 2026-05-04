import type {
  Adobe2ApiErrorResponse,
  Adobe2ApiImageUrlResponse,
} from "../../common";

export type FireflyGptImageResolution = "1k" | "2k" | "4k";
export type FireflyGptImageRatio =
  | "1x1"
  | "5x4"
  | "9x16"
  | "21x9"
  | "16x9"
  | "3x2"
  | "4x3"
  | "4x5"
  | "3x4"
  | "2x3";

export type FireflyGptImageModel =
  `firefly-gpt-image-${FireflyGptImageResolution}-${FireflyGptImageRatio}`;

/** Text-to-image request via /v1/images/generations. */
export interface FireflyGptText2ImageRequest {
  model: FireflyGptImageModel;
  prompt: string;
  response_format?: "url";
}

export interface BuildFireflyGptText2ImageRequestOptions {
  model: FireflyGptImageModel;
  prompt?: string;
  responseFormat?: FireflyGptText2ImageRequest["response_format"];
}

export function buildFireflyGptText2ImageRequest({
  model,
  prompt,
  responseFormat = "url",
}: BuildFireflyGptText2ImageRequestOptions): FireflyGptText2ImageRequest {
  return {
    model,
    prompt: prompt || "",
    response_format: responseFormat,
  };
}

export type FireflyGptImageResponse =
  Adobe2ApiImageUrlResponse<FireflyGptImageModel>;

export type FireflyGptImageErrorResponse = Adobe2ApiErrorResponse;
