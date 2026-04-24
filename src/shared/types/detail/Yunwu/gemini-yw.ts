// 注意：text 和 inline_data 不能同时存在，应该拆成多个 part，一个 part 放图，一个 part 放文本
export interface GeminiYwRequestBody {
  // 直接内联定义 contents 结构
  contents: {
    parts: {
      text?: string; // 文本内容
      inline_data?: {
        mime_type: string; // 内联数据类型（例如 image/png、image/jpeg）
        data: string; // Base64 编码后的内容
      };
    }[];
  }[];
  // 直接内联定义 generationConfig 结构
  generationConfig: {
    responseModalities: string[]; // 响应模态列表（例如 ["TEXT"]、["TEXT", "IMAGE"]）
  };
}

// Gemini 响应体类型定义
export interface GeminiYwResponseBody {
  // 候选回复列表
  candidates: {
    // 回复内容结构
    content: {
      parts: {
        text?: string; // 文本内容
        inlineData?: {
          mimeType: string; // 内联数据类型（例如 image/png、image/jpeg）
          data: string; // Base64 编码后的内容
        };
      }[];
      role: string; // 角色（例如 "model"）
    };
    finishReason: string; // 结束原因（例如 "STOP"）
    index: number; // 候选索引
  }[];
  // 使用量元数据
  usageMetadata: {
    promptTokenCount: number; // 提示词 token 数量
    candidatesTokenCount: number; // 候选回复 token 数量
    totalTokenCount: number; // 总 token 数量
    promptTokensDetails: {
      modality: string; // 模态类型（例如 "TEXT"、"IMAGE"）
      tokenCount: number; // token 数量
    }[];
    candidatesTokensDetails: {
      modality: string; // 模态类型（例如 "TEXT"、"IMAGE"）
      tokenCount: number; // token 数量
    }[];
  };
  modelVersion: string; // 模型版本（例如 "gemini-2.5-flash-image"）
  responseId: string; // 响应 ID
}
