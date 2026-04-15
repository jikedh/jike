/**
 * Xxx 生成节点数据结构
 * 用于 AI xxx 生成任务
 */
export interface XxxGenerationNode {
  // ---- 核心输入参数 ----
  model: string; // 使用的模型
  prompt: string; // 生成提示词
  promptDraft?: string; // 输入面板草稿文本
  promptDraftHtml?: string; // 输入面板草稿富文本

  // ---- 状态管理 ----
  status?: GenerationStatus; // 当前生成状态
  progress?: number; // 进度百分比（0-100）

  // ---- 输出结果 ----
  result?: {
    type: string; // 结果类型
    data: {
      url: string; // 生成的 URL
      format?: string; // 格式
      relativePath?: string; // 本地相对路径
      localFileName?: string; // 本地文件名
    }[];
  };

  // ---- 错误处理 ----
  error?: {
    code?: string;
    message?: string;
    detail?: string;
    serverMessage?: string;
    status?: number;
  };

  [key: string]: any; // React Flow 约束兼容
}

// 类型别名
export type XxxNodeType = Node<XxxGenerationNode, "xxxNode">;
