export type Grok2ApiImageModel =
  | "grok-imagine-image-lite"
  | "grok-imagine-image"
  | "grok-imagine-image-pro";

export type Grok2ApiImageEditModel = "grok-imagine-image-edit";

export type Grok2ApiImageSize =
  | "1280x720"
  | "720x1280"
  | "1792x1024"
  | "1024x1792"
  | "1024x1024";

export type Grok2ApiImageGenerationRequest = {
  model: Grok2ApiImageModel;
  prompt: string;
  n?: number;
  size?: Grok2ApiImageSize;
  response_format?: "url" | "b64_json";
};

export type Grok2ApiImageGenerationResponse = {
  created?: number;
  data?: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
  error?: {
    message?: string;
  };
};

export type Grok2ApiChatImageEditRequest = {
  model: Grok2ApiImageEditModel;
  stream?: false;
  messages: Array<{
    role: "user";
    content: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;
  }>;
  image_config?: {
    n?: 1 | 2;
    size?: "1024x1024";
    response_format?: "url" | "b64_json";
  };
};

export type Grok2ApiVideoSize =
  | "720x1280"
  | "1280x720"
  | "1024x1024"
  | "1024x1792"
  | "1792x1024";

export type Grok2ApiVideoGenerationRequest = {
  model: "grok-imagine-video";
  stream?: false;
  messages: Array<{
    role: "user";
    content:
      | string
      | Array<
          | { type: "text"; text: string }
          | { type: "image_url"; image_url: { url: string } }
        >;
  }>;
  video_config: {
    seconds: 6 | 10 | 12 | 16 | 20;
    size: Grok2ApiVideoSize;
    resolution_name?: "480p" | "720p";
    preset?: "fun" | "normal" | "spicy" | "custom";
  };
};

export type Grok2ApiVideoGenerationResponse = {
  id?: string;
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string; content?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
};
