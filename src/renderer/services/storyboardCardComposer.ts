import { copyMediaUrlToOss, uploadFileToOSS } from "service/oss";

export const STORYBOARD_CARD_FIELDS = [
  "镜号",
  "场景",
  "时长",
  "角色",
  "景别",
  "画面",
  "角度",
  "运动",
  "主体动作",
  "信息点",
  "声画关系",
  "技参",
  "转场",
] as const;

export const STORYBOARD_RAW_SKETCH_FIELD = "__storyboardSketchRawUrl";
export const STORYBOARD_CARD_STALE_FIELD = "__storyboardCardStale";
export const STORYBOARD_CARD_VERSION_FIELD = "__storyboardCardVersion";
export const STORYBOARD_CARD_VERSION = 1;
export const isStoryboardCardField = (field: string) =>
  (STORYBOARD_CARD_FIELDS as readonly string[]).includes(field);

type StoryboardCardRow = Record<string, unknown>;

type CreateStoryboardCardOptions = {
  sketchUrl: string;
  row: StoryboardCardRow;
  rowIndex: number;
  signal?: AbortSignal;
};

const CARD_WIDTH = 1920;
const SKETCH_HEIGHT = 1080;
const HEADER_HEIGHT = 72;
const CELL_HORIZONTAL_PADDING = 28;
const CELL_VERTICAL_PADDING = 22;
const LABEL_HEIGHT = 30;
const LABEL_VALUE_GAP = 12;
const VALUE_LINE_HEIGHT = 40;
const MIN_ROW_HEIGHT = 112;
const TABLE_BACKGROUND = "#f4f4f1";
const TABLE_BORDER = "#252525";
const LABEL_COLOR = "#646464";
const VALUE_COLOR = "#141414";

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    const error = new Error("已停止生成");
    error.name = "AbortError";
    throw error;
  }
};

const stringifyFieldValue = (value: unknown) => {
  if (value == null || value === "") return "-";
  if (Array.isArray(value)) {
    return value.map((item) => stringifyFieldValue(item)).join("、");
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const fetchImageBlob = async (source: string, signal?: AbortSignal) => {
  throwIfAborted(signal);

  if (/^https?:\/\//i.test(source) && window.download?.imageAsBuffer) {
    const result = await window.download.imageAsBuffer(source);
    if (!result.success || !result.data?.data) {
      throw new Error(result.error || "分镜草图下载失败");
    }
    return new Blob([new Uint8Array(result.data.data)], {
      type: result.data.mimeType || "image/png",
    });
  }

  const response = await fetch(source, { signal });
  if (!response.ok) {
    throw new Error(`分镜草图下载失败: HTTP ${response.status}`);
  }
  return response.blob();
};

const loadImage = async (blob: Blob) => {
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("分镜草图解码失败"));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const wrapText = (
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
) => {
  const lines: string[] = [];
  const paragraphs = value.replace(/\r\n?/g, "\n").split("\n");

  paragraphs.forEach((paragraph) => {
    if (!paragraph) {
      lines.push("");
      return;
    }

    let currentLine = "";
    Array.from(paragraph).forEach((character) => {
      const nextLine = `${currentLine}${character}`;
      if (currentLine && context.measureText(nextLine).width > maxWidth) {
        lines.push(currentLine);
        currentLine = character;
      } else {
        currentLine = nextLine;
      }
    });
    lines.push(currentLine);
  });

  return lines.length > 0 ? lines : ["-"];
};

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("分镜卡导出失败"));
      }
    }, "image/png");
  });

export const persistStoryboardSketchSource = async (sketchUrl: string) =>
  (await copyMediaUrlToOss(sketchUrl)) || sketchUrl;

export const createAndUploadStoryboardCard = async ({
  sketchUrl,
  row,
  rowIndex,
  signal,
}: CreateStoryboardCardOptions) => {
  const sourceBlob = await fetchImageBlob(sketchUrl, signal);
  throwIfAborted(signal);
  const image = await loadImage(sourceBlob);
  throwIfAborted(signal);

  const measureCanvas = document.createElement("canvas");
  const measureContext = measureCanvas.getContext("2d");
  if (!measureContext) {
    throw new Error("无法创建分镜卡绘图上下文");
  }

  measureContext.font =
    '28px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';
  const cellWidth = CARD_WIDTH / 2;
  const textMaxWidth = cellWidth - CELL_HORIZONTAL_PADDING * 2;
  const fieldRows = Array.from(
    { length: Math.ceil(STORYBOARD_CARD_FIELDS.length / 2) },
    (_, index) => STORYBOARD_CARD_FIELDS.slice(index * 2, index * 2 + 2),
  );
  const measuredRows = fieldRows.map((fields) => {
    const cells = fields.map((field) => ({
      field,
      lines: wrapText(
        measureContext,
        stringifyFieldValue(row[field]),
        fields.length === 1
          ? CARD_WIDTH - CELL_HORIZONTAL_PADDING * 2
          : textMaxWidth,
      ),
    }));
    const maxLineCount = Math.max(...cells.map((cell) => cell.lines.length), 1);
    const height = Math.max(
      MIN_ROW_HEIGHT,
      CELL_VERTICAL_PADDING * 2 +
        LABEL_HEIGHT +
        LABEL_VALUE_GAP +
        maxLineCount * VALUE_LINE_HEIGHT,
    );
    return { cells, height };
  });

  const tableHeight = measuredRows.reduce(
    (total, current) => total + current.height,
    0,
  );
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = SKETCH_HEIGHT + HEADER_HEIGHT + tableHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("无法创建分镜卡绘图上下文");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const imageWidth = image.naturalWidth || image.width || 1;
  const imageHeight = image.naturalHeight || image.height || 1;
  const imageScale = Math.min(
    CARD_WIDTH / imageWidth,
    SKETCH_HEIGHT / imageHeight,
  );
  const drawWidth = Math.round(imageWidth * imageScale);
  const drawHeight = Math.round(imageHeight * imageScale);
  const drawX = Math.round((CARD_WIDTH - drawWidth) / 2);
  const drawY = Math.round((SKETCH_HEIGHT - drawHeight) / 2);
  context.fillStyle = "#111111";
  context.fillRect(0, 0, CARD_WIDTH, SKETCH_HEIGHT);
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  const mirrorNumber = stringifyFieldValue(row["镜号"]);
  context.fillStyle = "#202020";
  context.fillRect(0, SKETCH_HEIGHT, CARD_WIDTH, HEADER_HEIGHT);
  context.fillStyle = "#ffffff";
  context.font =
    '600 30px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';
  context.textBaseline = "middle";
  context.fillText(
    mirrorNumber === "-" ? "分镜信息" : `分镜 ${mirrorNumber} · 分镜信息`,
    32,
    SKETCH_HEIGHT + HEADER_HEIGHT / 2,
  );

  let currentY = SKETCH_HEIGHT + HEADER_HEIGHT;
  measuredRows.forEach(({ cells, height }) => {
    cells.forEach(({ field, lines }, cellIndex) => {
      const isSingleCell = cells.length === 1;
      const width = isSingleCell ? CARD_WIDTH : cellWidth;
      const x = isSingleCell ? 0 : cellIndex * cellWidth;

      context.fillStyle = TABLE_BACKGROUND;
      context.fillRect(x, currentY, width, height);
      context.strokeStyle = TABLE_BORDER;
      context.lineWidth = 2;
      context.strokeRect(x, currentY, width, height);

      context.textBaseline = "top";
      context.fillStyle = LABEL_COLOR;
      context.font =
        '600 24px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';
      context.fillText(
        field,
        x + CELL_HORIZONTAL_PADDING,
        currentY + CELL_VERTICAL_PADDING,
      );

      context.fillStyle = VALUE_COLOR;
      context.font =
        '28px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';
      const valueY =
        currentY + CELL_VERTICAL_PADDING + LABEL_HEIGHT + LABEL_VALUE_GAP;
      lines.forEach((line, lineIndex) => {
        context.fillText(
          line || " ",
          x + CELL_HORIZONTAL_PADDING,
          valueY + lineIndex * VALUE_LINE_HEIGHT,
        );
      });
    });
    currentY += height;
  });

  throwIfAborted(signal);
  const cardBlob = await canvasToBlob(canvas);
  throwIfAborted(signal);
  const cardFile = new File(
    [cardBlob],
    `storyboard-card-${rowIndex + 1}-${Date.now()}.png`,
    { type: "image/png" },
  );
  const uploadResult = await uploadFileToOSS(cardFile);
  if (!uploadResult.url) {
    throw new Error("分镜卡上传失败");
  }
  return uploadResult.url;
};
