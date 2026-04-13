/**
 * 根据内容长度计算便签节点的尺寸
 * 用于生成输出便签节点时的自适应大小
 */
export interface NoteSize {
  width: number;
  height: number;
}

export const calculateNoteSize = (content: string): NoteSize => {
  const charCount = content.length;
  const lineCount = content.split("\n").length;
  const avgCharsPerLine = 40;

  // 估算总行数
  const estimatedLines = Math.max(
    lineCount,
    Math.ceil(charCount / avgCharsPerLine),
  );

  // 计算宽度：基于字符数，限制在 280-500px 之间
  const width = Math.min(Math.max(280, Math.min(500, charCount * 2)), 500);

  // 计算高度：基于估算行数，限制在 180-600px 之间
  const height = Math.min(Math.max(180, estimatedLines * 24 + 40), 600);

  return { width, height };
};
