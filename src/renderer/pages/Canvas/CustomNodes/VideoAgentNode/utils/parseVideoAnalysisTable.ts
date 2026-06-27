/**
 * 解析视频分析内容，提取结构化表格数据
 * 用于 video-pull-film 预设类型
 */
import { VIDEO_PULL_FILM_COLUMNS } from "shared/constants/video-agent-presets";

export type VideoAnalysisRow = Record<
  (typeof VIDEO_PULL_FILM_COLUMNS)[number],
  string
>;

export type VideoCharacterProfile = {
  id: string;
  name: string;
  aliases?: string[];
  appearance?: string;
  outfit?: string;
  accessories?: string;
  distinctiveFeatures?: string;
  consistencyPrompt?: string;
  raw?: string;
};

export type VideoAnalysisParseResult = {
  rows: VideoAnalysisRow[];
  characterProfiles: VideoCharacterProfile[];
};

const LEGACY_COLUMN_MAP: Record<string, keyof VideoAnalysisRow> = {
  时间点: "时长",
  场景描述: "画面",
  镜头类型: "景别",
  关键动作: "主体动作",
  画面构图: "画面",
  台词字幕: "信息点",
  节奏分析: "信息点",
  人物: "角色",
  出场角色: "角色",
  核心主体: "角色",
  "角色/主体": "角色",
};

type MarkdownTable = {
  headerCells: string[];
  rows: string[][];
};

const CHARACTER_PROFILE_HEADER_KEYWORDS = [
  "别名",
  "样貌",
  "外貌",
  "穿着",
  "服装",
  "道具",
  "明显特征",
  "一致性提示",
];

const createEmptyRow = (): VideoAnalysisRow =>
  VIDEO_PULL_FILM_COLUMNS.reduce((row, column) => {
    row[column] = "";
    return row;
  }, {} as VideoAnalysisRow);

const parseMarkdownTableRow = (row: string) => {
  const cells = row.split("|");
  if (cells[0]?.trim() === "") cells.shift();
  if (cells[cells.length - 1]?.trim() === "") cells.pop();
  return cells.map((cell) => cell.trim());
};

const isMarkdownTableSeparator = (line: string) =>
  /^\|[\s\-:|]+\|$/.test(line);

const collectMarkdownTables = (content: string): MarkdownTable[] => {
  const lines = content.split("\n");
  const tables: string[][] = [];
  let currentTable: string[] = [];

  const finishTable = () => {
    if (currentTable.length > 1) {
      tables.push(currentTable);
    }
    currentTable = [];
  };

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("|") && trimmedLine.endsWith("|")) {
      if (!isMarkdownTableSeparator(trimmedLine)) {
        currentTable.push(trimmedLine);
      }
      continue;
    }
    finishTable();
  }
  finishTable();

  return tables.map((tableRows) => ({
    headerCells: parseMarkdownTableRow(tableRows[0] ?? ""),
    rows: tableRows.slice(1).map(parseMarkdownTableRow),
  }));
};

const countVideoHeaders = (headers: string[]) =>
  headers.filter((header) =>
    (VIDEO_PULL_FILM_COLUMNS as readonly string[]).includes(header),
  ).length;

const isCharacterProfileTable = (headers: string[]) =>
  headers.includes("角色") &&
  headers.some((header) =>
    CHARACTER_PROFILE_HEADER_KEYWORDS.some((keyword) =>
      header.includes(keyword),
    ),
  );

const isVideoAnalysisTable = (headers: string[]) =>
  countVideoHeaders(headers) >= 3 &&
  (headers.includes("场景") ||
    headers.includes("镜号") ||
    headers.includes("画面"));

const parseVideoRowsFromTable = (table: MarkdownTable): VideoAnalysisRow[] => {
  const normalizedHeaders = table.headerCells.map(
    (header, index) =>
      (VIDEO_PULL_FILM_COLUMNS as readonly string[]).includes(header)
        ? (header as keyof VideoAnalysisRow)
        : (LEGACY_COLUMN_MAP[header] ?? VIDEO_PULL_FILM_COLUMNS[index] ?? null),
  );

  return table.rows
    .filter((cells) => cells.length >= 2)
    .map((cells) => {
      const nextRow = createEmptyRow();
      cells.forEach((cell, index) => {
        const column = normalizedHeaders[index];
        if (!column) return;
        nextRow[column] = cell || "";
      });
      return nextRow;
    });
};

const splitAliases = (value?: string) =>
  String(value ?? "")
    .split(/[、,，/]/)
    .map((item) => item.trim())
    .filter(Boolean);

const getCellByHeader = (
  headers: string[],
  cells: string[],
  keywords: string[],
) => {
  const index = headers.findIndex((header) =>
    keywords.some((keyword) => header.includes(keyword)),
  );
  return index >= 0 ? cells[index]?.trim() : "";
};

const parseCharacterProfilesFromTable = (
  table: MarkdownTable,
): VideoCharacterProfile[] =>
  table.rows
    .map((cells, index) => {
      const name =
        getCellByHeader(table.headerCells, cells, ["角色", "人物", "主体"]) ||
        cells[0]?.trim() ||
        "";
      if (!name || name === "无人物") return null;

      const aliases = splitAliases(
        getCellByHeader(table.headerCells, cells, ["别名", "称呼"]),
      );
      const appearance = getCellByHeader(table.headerCells, cells, [
        "样貌",
        "外貌",
        "长相",
        "发型",
        "体型",
      ]);
      const outfit = getCellByHeader(table.headerCells, cells, [
        "穿着",
        "服装",
        "衣着",
      ]);
      const accessories = getCellByHeader(table.headerCells, cells, [
        "道具",
        "饰品",
        "配饰",
      ]);
      const distinctiveFeatures = getCellByHeader(table.headerCells, cells, [
        "明显特征",
        "特征",
        "标志",
      ]);
      const consistencyPrompt = getCellByHeader(table.headerCells, cells, [
        "一致性提示",
        "一致性",
        "保持",
      ]);

      return {
        id: `char_${index + 1}`,
        name,
        ...(aliases.length ? { aliases } : {}),
        ...(appearance ? { appearance } : {}),
        ...(outfit ? { outfit } : {}),
        ...(accessories ? { accessories } : {}),
        ...(distinctiveFeatures ? { distinctiveFeatures } : {}),
        ...(consistencyPrompt ? { consistencyPrompt } : {}),
        raw: cells.filter(Boolean).join("；"),
      };
    })
    .filter(Boolean) as VideoCharacterProfile[];

const parseCharacterProfilesFromText = (
  content: string,
): VideoCharacterProfile[] => {
  const tables = collectMarkdownTables(content);
  const tableProfiles = tables
    .filter((table) => isCharacterProfileTable(table.headerCells))
    .flatMap(parseCharacterProfilesFromTable);

  if (tableProfiles.length > 0) {
    return tableProfiles;
  }

  const lines = content
    .split("\n")
    .map((line) => line.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean);
  const profileLines = lines.filter((line) =>
    /^(角色|人物|主体)\s*[\w\u4e00-\u9fa5]{1,12}[：:]/.test(line) ||
    /^[\w\u4e00-\u9fa5]{1,12}[：:].*(样貌|外貌|穿着|服装|发型|体型|特征)/.test(
      line,
    ),
  );

  return profileLines.map((line, index) => {
    const [namePart, ...rest] = line.split(/[：:]/);
    const name = namePart.replace(/^(角色|人物|主体)\s*/, "").trim();
    const raw = rest.join("：").trim();
    return {
      id: `char_${index + 1}`,
      name,
      raw,
      consistencyPrompt: raw,
    };
  });
};

const parseVideoRowsFromSegments = (content: string): VideoAnalysisRow[] => {
  const lines = content.split("\n");
  const timePointPatterns = [
    /^(\d{1,2}:\d{2}(?::\d{2})?)/,
    /^第(\d+)[幕场集]/,
    /^场景?(\d+)/,
    /^镜头?(\d+)/,
    /^(\d+)[.、](?=\D)/,
  ];

  const segments: { timePoint: string; content: string }[] = [];
  let currentSegment: { timePoint: string; content: string } | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

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
      currentSegment = {
        timePoint: matchedTimePoint,
        content: trimmedLine
          .replace(timePointPatterns.find((p) => trimmedLine.match(p))!, "")
          .trim(),
      };
    } else if (currentSegment) {
      currentSegment.content += "\n" + trimmedLine;
    }
  }

  if (currentSegment) {
    segments.push(currentSegment);
  }

  if (segments.length > 0) {
    return segments.map((seg) => {
      const row = createEmptyRow();
      if (/^\d{1,2}:\d{2}/.test(seg.timePoint)) {
        row.时长 = seg.timePoint;
      } else if (
        /^镜头?\d+/.test(seg.timePoint) ||
        /^\d+[.、]/.test(seg.timePoint)
      ) {
        row.镜号 = seg.timePoint.replace(/[.、]$/, "");
      } else {
        row.场景 = seg.timePoint;
      }
      row.画面 = seg.content;
      return row;
    });
  }

  if (content.trim()) {
    const row = createEmptyRow();
    row.场景 = "全文";
    row.画面 = content;
    return [row];
  }

  return [];
};

/**
 * 解析视频分析文本，尝试从 Markdown 表格中提取数据
 * 如果没有表格，则按时间点/序号分段解析
 */
export const parseVideoAnalysisTable = (
  content: string,
): VideoAnalysisRow[] => {
  const tables = collectMarkdownTables(content);
  const videoTable =
    tables.find((table) => isVideoAnalysisTable(table.headerCells)) ??
    tables.find((table) => !isCharacterProfileTable(table.headerCells));

  if (videoTable) {
    return parseVideoRowsFromTable(videoTable);
  }

  return parseVideoRowsFromSegments(content);
};

export const parseVideoAnalysisResult = (
  content: string,
): VideoAnalysisParseResult => ({
  rows: parseVideoAnalysisTable(content),
  characterProfiles: parseCharacterProfilesFromText(content),
});
