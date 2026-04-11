/**
 * 过滤 AI 模型返回内容中的思考过程标签
 * 支持 <think>...</think> 和 <thinking>...</thinking> 格式
 */
export const filterThinkingContent = (content: string): string => {
  return content
    .replace(/<think[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking[\s\S]*?<\/thinking>/gi, "")
    .trim();
};
