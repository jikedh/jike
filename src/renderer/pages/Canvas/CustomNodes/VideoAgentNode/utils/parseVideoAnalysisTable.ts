/**
 * 解析视频分析内容，提取结构化表格数据
 * 用于 video-pull-film 预设类型
 */
export interface VideoAnalysisRow {
  时间点: string;
  场景描述: string;
  镜头类型: string;
  关键动作: string;
  画面构图: string;
  台词字幕: string;
  节奏分析: string;
}

/**
 * 解析视频分析文本，尝试从 Markdown 表格中提取数据
 * 如果没有表格，则按时间点/序号分段解析
 */
export const parseVideoAnalysisTable = (content: string): VideoAnalysisRow[] => {
  const rows: VideoAnalysisRow[] = [];

  // 尝试匹配 Markdown 表格格式
  const lines = content.split("\n");
  const tableRows: string[] = [];
  let inTable = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    // 检测表格行（以 | 开头和结尾）
    if (trimmedLine.startsWith("|") && trimmedLine.endsWith("|")) {
      // 跳过分隔行（如 |---|---|）
      if (/^\|[\s\-:|]+\|$/.test(trimmedLine)) {
        continue;
      }
      tableRows.push(trimmedLine);
      inTable = true;
    } else if (inTable && trimmedLine === "") {
      // 空行结束表格
      break;
    }
  }

  // 如果找到表格数据，解析它
  if (tableRows.length > 1) {
    // 跳过表头行，从第二行开始解析数据
    for (let i = 1; i < tableRows.length; i++) {
      const row = tableRows[i];
      const cells = row
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell) => cell !== "");

      if (cells.length >= 2) {
        rows.push({
          时间点: cells[0] || "",
          场景描述: cells[1] || "",
          镜头类型: cells[2] || "",
          关键动作: cells[3] || "",
          画面构图: cells[4] || "",
          台词字幕: cells[5] || "",
          节奏分析: cells[6] || "",
        });
      }
    }
    return rows;
  }

  // 如果没有表格，尝试按时间点模式解析（如 "0:00"、"第1幕"、"场景1" 等）
  const timePointPatterns = [
    /^(\d{1,2}:\d{2}(?::\d{2})?)/, // 0:00 或 00:00:00
    /^第(\d+)[幕场集]/, // 第1幕、第1场、第1集
    /^场景?(\d+)/, // 场景1、场景2
    /^镜头?(\d+)/, // 镜头1
    /^(\d+)[.、](?=\D)/, // 1. 或 1、
  ];

  const segments: { timePoint: string; content: string }[] = [];
  let currentSegment: { timePoint: string; content: string } | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // 检查是否匹配时间点模式
    let matchedTimePoint: string | null = null;
    for (const pattern of timePointPatterns) {
      const match = trimmedLine.match(pattern);
      if (match) {
        matchedTimePoint = match[0];
        break;
      }
    }

    if (matchedTimePoint) {
      if (currentSegment) {
        segments.push(currentSegment);
      }
      currentSegment = { timePoint: matchedTimePoint, content: trimmedLine.replace(timePointPatterns.find(p => trimmedLine.match(p))!, "").trim() };
    } else if (currentSegment) {
      currentSegment.content += "\n" + trimmedLine;
    }
  }

  if (currentSegment) {
    segments.push(currentSegment);
  }

  // 如果解析到段落，转换为 rows
  if (segments.length > 0) {
    return segments.map((seg) => ({
      时间点: seg.timePoint,
      场景描述: seg.content,
      镜头类型: "",
      关键动作: "",
      画面构图: "",
      台词字幕: "",
      节奏分析: "",
    }));
  }

  // 如果完全无法解析，返回单行原始内容
  if (content.trim()) {
    return [{
      时间点: "全文",
      场景描述: content,
      镜头类型: "",
      关键动作: "",
      画面构图: "",
      台词字幕: "",
      节奏分析: "",
    }];
  }

  return [];
};
