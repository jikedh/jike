/**
 * Adobe2API common OpenAI-compatible request/response types.
 */

export type Adobe2ApiErrorType =
  | "invalid_request_error"
  | "authentication_error"
  | "rate_limit_error"
  | "server_error";

export interface Adobe2ApiErrorResponse {
  error: {
    message: string;
    type: Adobe2ApiErrorType;
    code?: string;
  };
}

export type Adobe2ApiChatMessageContent =
  | string
  | (
      | {
          type: "text";
          text: string;
        }
      | {
          type: "image_url";
          image_url:
            | string
            | {
                url: string;
              };
        }
    )[];

export interface Adobe2ApiChatMessage {
  role: "system" | "user" | "assistant";
  content: Adobe2ApiChatMessageContent;
}

export interface Adobe2ApiImageUrlResponse<Model extends string = string> {
  created: number;
  model: Model;
  data: {
    url: string;
  }[];
}

export interface Adobe2ApiChatCompletionResponse<Model extends string = string> {
  id: string;
  object: "chat.completion";
  created: number;
  model: Model;
  choices: {
    index: number;
    message: {
      role: "assistant";
      content: string;
    };
    finish_reason: "stop";
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
