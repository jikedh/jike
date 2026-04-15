/**
 * 阿里云百炼 API 请求/响应类型定义
 * OpenAI 兼容接口，支持文本和图片混合输入
 * @see https://help.aliyun.com/document_detail/314905.html
 */

/**
 * 阿里云百炼请求体
 * @example
 * {
 *   "model": "qwen-vl-plus",
 *   "messages": [
 *     {
 *       "role": "user",
 *       "content": [
 *         { "type": "text", "text": "请描述这张图片" },
 *         { "type": "image_url", "image_url": { "url": "https://example.com/image.jpg" } }
 *       ]
 *     }
 *   ]
 * }
 * @example
 * {
 *   "model": "qwen3.5-flash",
 *   "messages": [
 *     {
 *       "role": "user",
 *       "content": [
 *         { "type": "video_url", "video_url": { "url": "https://example.com/video.mp4" }, "fps": 2 },
 *         { "type": "text", "text": "这段视频的内容是什么?" }
 *       ]
 *     }
 *   ]
 * }
 */
export interface DashscopeRequestBody {
  model: string;
  messages: {
    role: "system" | "user" | "assistant";
    content:
      | string
      | {
          type: "text" | "image_url" | "video_url";
          text?: string;
          image_url?: { url: string };
          video_url?: { url: string };
          fps?: number;
        }[];
  }[];
  stream?: boolean;
}

/**
 * 阿里云百炼响应体
 */
export interface DashscopeResponseBody {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: {
    index: number;
    message: { role: "assistant"; content: string };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
