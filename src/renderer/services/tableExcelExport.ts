import {
  readInFlightStoryboardImage,
  readCachedStoryboardImage,
  type StoryboardImageCacheMap,
} from "@/services/storyboardImageCache";

type TableExportRow = Record<string, unknown>;

type SheetData = {
  name: string;
  columns: string[];
  rows: TableExportRow[];
  images?: WorksheetImage[];
};

export type ExportVideoPullFilmExcelInput = {
  title?: string;
  columns: string[];
  rows: TableExportRow[];
  characterProfiles?: unknown[];
  storyboardImageCache?: StoryboardImageCacheMap;
  projectId?: string | null;
};

export type ExportVideoPullFilmExcelResult = {
  filename: string;
  saved: boolean;
  embeddedImageCount: number;
  failedImageCount: number;
};

type ZipFile = {
  path: string;
  content: string | Uint8Array;
};

type ExcelImage = {
  bytes: Uint8Array;
  extension: string;
  contentType: string;
};

type WorksheetImage = {
  rowIndex: number;
  columnIndex: number;
  relationshipId: string;
  name: string;
};

type PreparedStoryboardImages = {
  rows: TableExportRow[];
  mediaFiles: Array<ZipFile & { contentType: string; extension: string }>;
  worksheetImages: WorksheetImage[];
  failedImageCount: number;
};

const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const STORYBOARD_IMAGE_EXPORT_CONCURRENCY = 6;

const ZIP_UTF8_FLAG = 0x0800;
const IMAGE_WIDTH_EMU = 160 * 9525;
const IMAGE_HEIGHT_EMU = 90 * 9525;
const EXCEL_EMBED_IMAGE_MAX_WIDTH = 640;
const EXCEL_EMBED_IMAGE_MAX_HEIGHT = 360;
const EXCEL_EMBED_IMAGE_JPEG_QUALITY = 0.82;

const textEncoder = new TextEncoder();

type PreparedStoryboardImageItem = {
  rowIndex: number;
  columnIndex: number;
  image: ExcelImage;
};

const CHARACTER_PROFILE_EXPORT_COLUMNS = [
  { label: "角色", keys: ["name", "角色", "姓名", "人物", "主体"] },
  { label: "别名", keys: ["aliases", "别名", "称呼"] },
  { label: "样貌", keys: ["appearance", "样貌", "外貌", "长相"] },
  { label: "穿着", keys: ["outfit", "穿着", "服装", "衣着"] },
  { label: "道具", keys: ["accessories", "道具", "饰品", "配饰"] },
  {
    label: "明显特征",
    keys: ["distinctiveFeatures", "明显特征", "特征", "标志"],
  },
  {
    label: "一致性提示",
    keys: ["consistencyPrompt", "一致性提示", "一致性", "保持"],
  },
  { label: "原始描述", keys: ["raw"] },
] as const;

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const stringifyCellValue = (value: unknown): string => {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyCellValue(item))
      .filter(Boolean)
      .join("、");
  }
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const isStoryboardImageColumn = (column: string) =>
  column.includes("分镜图") || column.includes("分镜草图");

const isImageSource = (value: string) =>
  /^(https?:|data:image\/|blob:|asset:|file:)/i.test(value.trim());

const getImageExtension = (contentType: string) => {
  const normalized = contentType.toLowerCase().split(";")[0]?.trim();
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpeg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/gif") return "gif";
  return "png";
};

const getImageContentType = (extension: string) => {
  if (extension === "jpeg" || extension === "jpg") return "image/jpeg";
  if (extension === "gif") return "image/gif";
  return "image/png";
};

const isExcelSupportedImageType = (contentType: string) =>
  ["image/png", "image/jpeg", "image/jpg", "image/gif"].includes(
    contentType.toLowerCase().split(";")[0]?.trim() ?? "",
  );

const loadImageElement = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败"));
    image.src = url;
  });

const convertImageToPng = async (bytes: Uint8Array, contentType: string) => {
  const objectUrl = URL.createObjectURL(
    new Blob([toArrayBuffer(bytes)], { type: contentType }),
  );

  try {
    const image = await loadImageElement(objectUrl);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width || 1;
    canvas.height = image.naturalHeight || image.height || 1;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法创建图片转换画布");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error("图片转换失败"));
      }, "image/png");
    });
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("图片压缩失败"));
      },
      type,
      quality,
    );
  });

const optimizeImageForExcel = async (
  image: ExcelImage,
): Promise<ExcelImage> => {
  const objectUrl = URL.createObjectURL(
    new Blob([toArrayBuffer(image.bytes)], { type: image.contentType }),
  );

  try {
    const element = await loadImageElement(objectUrl);
    const sourceWidth = element.naturalWidth || element.width || 1;
    const sourceHeight = element.naturalHeight || element.height || 1;
    const scale = Math.min(
      1,
      EXCEL_EMBED_IMAGE_MAX_WIDTH / sourceWidth,
      EXCEL_EMBED_IMAGE_MAX_HEIGHT / sourceHeight,
    );
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (!context) return image;

    context.drawImage(element, 0, 0, targetWidth, targetHeight);
    const blob = await canvasToBlob(
      canvas,
      "image/jpeg",
      EXCEL_EMBED_IMAGE_JPEG_QUALITY,
    );
    return {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      extension: "jpeg",
      contentType: "image/jpeg",
    };
  } catch {
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const fetchImageViaBrowser = async (source: string) => {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const blob = await response.blob();
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    contentType:
      blob.type || response.headers.get("content-type") || "image/png",
  };
};

const fetchImageBytes = async (source: string): Promise<ExcelImage> => {
  let image: { bytes: Uint8Array; contentType: string };

  if (/^https?:\/\//i.test(source) && window.download?.imageAsBuffer) {
    const result = await window.download.imageAsBuffer(source);
    if (!result.success || !result.data?.data) {
      throw new Error(result.error || "图片下载失败");
    }
    image = {
      bytes: new Uint8Array(result.data.data),
      contentType: result.data.mimeType || "image/png",
    };
  } else {
    image = await fetchImageViaBrowser(source);
  }

  if (!isExcelSupportedImageType(image.contentType)) {
    image = {
      bytes: await convertImageToPng(image.bytes, image.contentType),
      contentType: "image/png",
    };
  }

  const extension = getImageExtension(image.contentType);
  return optimizeImageForExcel({
    bytes: image.bytes,
    extension,
    contentType: getImageContentType(extension),
  });
};

const getCachedImageBytes = async (
  source: string,
  storyboardImageCache?: StoryboardImageCacheMap,
  projectId?: string | null,
): Promise<ExcelImage | null> => {
  const cacheEntry = storyboardImageCache?.[source.trim()];
  let image = cacheEntry
    ? await readCachedStoryboardImage(cacheEntry)
    : await readInFlightStoryboardImage(source, projectId);
  if (!image) return null;

  if (!isExcelSupportedImageType(image.contentType)) {
    image = {
      bytes: await convertImageToPng(image.bytes, image.contentType),
      contentType: "image/png",
    };
  }

  const extension = getImageExtension(image.contentType);
  return optimizeImageForExcel({
    bytes: image.bytes,
    extension,
    contentType: getImageContentType(extension),
  });
};

const runWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await worker(items[currentIndex]);
      }
    },
  );

  await Promise.all(workers);
  return results;
};

const prepareStoryboardImages = async (
  columns: string[],
  rows: TableExportRow[],
  storyboardImageCache?: StoryboardImageCacheMap,
  projectId?: string | null,
): Promise<PreparedStoryboardImages> => {
  const imageColumnIndexes = columns
    .map((column, index) => (isStoryboardImageColumn(column) ? index : -1))
    .filter((index) => index >= 0);
  if (imageColumnIndexes.length === 0) {
    return {
      rows,
      mediaFiles: [],
      worksheetImages: [],
      failedImageCount: 0,
    };
  }

  const nextRows = rows.map((row) => ({ ...row }));
  const mediaFiles: PreparedStoryboardImages["mediaFiles"] = [];
  const worksheetImages: WorksheetImage[] = [];
  const imageSources = nextRows.flatMap((row, rowIndex) =>
    imageColumnIndexes
      .map((columnIndex) => ({
        rowIndex,
        columnIndex,
        columnName: columns[columnIndex],
        source: stringifyCellValue(row[columns[columnIndex]]).trim(),
      }))
      .filter(({ source }) => source && isImageSource(source)),
  );

  const preparedImages = await runWithConcurrency(
    imageSources,
    STORYBOARD_IMAGE_EXPORT_CONCURRENCY,
    async ({
      rowIndex,
      columnIndex,
      source,
    }): Promise<PreparedStoryboardImageItem | null> => {
      try {
        const image =
          (await getCachedImageBytes(
            source,
            storyboardImageCache,
            projectId,
          )) ?? (await fetchImageBytes(source));
        return {
          rowIndex,
          columnIndex,
          image,
        };
      } catch {
        return null;
      }
    },
  );

  const failedImageCount = preparedImages.filter(
    (item) => item === null,
  ).length;
  preparedImages
    .filter((item): item is PreparedStoryboardImageItem => item !== null)
    .sort((a, b) => a.rowIndex - b.rowIndex)
    .forEach(({ rowIndex, columnIndex, image }) => {
      const mediaIndex = mediaFiles.length + 1;
      const mediaPath = `xl/media/storyboard-${mediaIndex}.${image.extension}`;
      mediaFiles.push({
        path: mediaPath,
        content: image.bytes,
        contentType: image.contentType,
        extension: image.extension,
      });
      worksheetImages.push({
        rowIndex,
        columnIndex,
        relationshipId: `rId${mediaIndex}`,
        name: `${columns[columnIndex]} ${rowIndex + 1}`,
      });
      nextRows[rowIndex][columns[columnIndex]] = "";
    });

  return {
    rows: nextRows,
    mediaFiles,
    worksheetImages,
    failedImageCount,
  };
};

const getProfileValue = (
  profile: Record<string, unknown>,
  keys: readonly string[],
) => {
  for (const key of keys) {
    const value = stringifyCellValue(profile[key]).trim();
    if (value) return value;
  }
  return "";
};

const buildCharacterProfileRows = (profiles?: unknown[]): TableExportRow[] =>
  (profiles ?? []).map((profile, index) => {
    if (!profile || typeof profile !== "object") {
      return {
        角色: `角色 ${index + 1}`,
        原始描述: stringifyCellValue(profile),
      };
    }

    const item = profile as Record<string, unknown>;
    return CHARACTER_PROFILE_EXPORT_COLUMNS.reduce<TableExportRow>(
      (row, column) => {
        row[column.label] = getProfileValue(item, column.keys);
        return row;
      },
      {},
    );
  });

const getColumnName = (index: number) => {
  let value = "";
  let current = index + 1;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    value = String.fromCharCode(65 + remainder) + value;
    current = Math.floor((current - 1) / 26);
  }

  return value;
};

const getColumnWidth = (column: string) => {
  if (isStoryboardImageColumn(column)) return 48;
  if (
    column.includes("画面") ||
    column.includes("信息点") ||
    column.includes("声画关系") ||
    column.includes("技参") ||
    column.includes("原始描述") ||
    column.includes("一致性")
  ) {
    return 36;
  }
  if (
    column.includes("角色") ||
    column.includes("样貌") ||
    column.includes("穿着")
  ) {
    return 24;
  }
  return 16;
};

const createCellXml = (
  rowIndex: number,
  columnIndex: number,
  value: unknown,
) => {
  const text = stringifyCellValue(value);
  const ref = `${getColumnName(columnIndex)}${rowIndex}`;

  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
};

const createWorksheetXml = ({ columns, rows, images = [] }: SheetData) => {
  const imageRowIndexes = new Set(images.map((image) => image.rowIndex));
  const columnXml = columns
    .map((column, index) => {
      const columnNumber = index + 1;
      return `<col min="${columnNumber}" max="${columnNumber}" width="${getColumnWidth(
        column,
      )}" customWidth="1"/>`;
    })
    .join("");

  const headerRow = `<row r="1" ht="22" customHeight="1">${columns
    .map((column, index) => createCellXml(1, index, column))
    .join("")}</row>`;

  const bodyRows = rows
    .map((row, rowIndex) => {
      const excelRowIndex = rowIndex + 2;
      const cellXml = columns
        .map((column, columnIndex) =>
          createCellXml(excelRowIndex, columnIndex, row[column]),
        )
        .join("");
      const rowHeightAttrs = imageRowIndexes.has(rowIndex)
        ? ' ht="92" customHeight="1"'
        : "";
      return `<row r="${excelRowIndex}"${rowHeightAttrs}>${cellXml}</row>`;
    })
    .join("");

  const lastCell = `${getColumnName(Math.max(columns.length - 1, 0))}${Math.max(
    rows.length + 1,
    1,
  )}`;

  const drawingXml = images.length > 0 ? '<drawing r:id="rId1"/>' : "";
  const relationshipNamespace =
    images.length > 0
      ? ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
      : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"${relationshipNamespace}>
  <dimension ref="A1:${lastCell}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${columnXml}</cols>
  <sheetData>${headerRow}${bodyRows}</sheetData>
  ${drawingXml}
</worksheet>`;
};

const createWorksheetDrawingRelsXml = () =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`;

const createDrawingXml = (images: WorksheetImage[]) => {
  const imageXml = images
    .map((image, index) => {
      const pictureId = index + 1;
      return `<xdr:oneCellAnchor>
  <xdr:from>
    <xdr:col>${image.columnIndex}</xdr:col>
    <xdr:colOff>95250</xdr:colOff>
    <xdr:row>${image.rowIndex + 1}</xdr:row>
    <xdr:rowOff>95250</xdr:rowOff>
  </xdr:from>
  <xdr:ext cx="${IMAGE_WIDTH_EMU}" cy="${IMAGE_HEIGHT_EMU}"/>
  <xdr:pic>
    <xdr:nvPicPr>
      <xdr:cNvPr id="${pictureId}" name="${escapeXml(image.name)}"/>
      <xdr:cNvPicPr/>
    </xdr:nvPicPr>
    <xdr:blipFill>
      <a:blip r:embed="${image.relationshipId}"/>
      <a:stretch><a:fillRect/></a:stretch>
    </xdr:blipFill>
    <xdr:spPr>
      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    </xdr:spPr>
  </xdr:pic>
  <xdr:clientData/>
</xdr:oneCellAnchor>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  ${imageXml}
</xdr:wsDr>`;
};

const getMediaRelationshipTarget = (path: string) =>
  `../media/${path.split("/").pop() ?? path}`;

const createDrawingRelsXml = (
  mediaFiles: PreparedStoryboardImages["mediaFiles"],
) => {
  const relationships = mediaFiles
    .map(
      (file, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${escapeXml(
          getMediaRelationshipTarget(file.path),
        )}"/>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${relationships}
</Relationships>`;
};

const sanitizeSheetName = (name: string) =>
  (name || "Sheet")
    .replace(/[\[\]:*?/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31) || "Sheet";

const sanitizeFilename = (value: string) =>
  (value || "视频拉片分析")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const createTimestamp = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
};

const IMAGE_CONTENT_TYPE_DEFAULTS = [
  { extension: "png", contentType: "image/png" },
  { extension: "jpeg", contentType: "image/jpeg" },
  { extension: "jpg", contentType: "image/jpeg" },
  { extension: "gif", contentType: "image/gif" },
] as const;

const createContentTypesXml = (sheetCount: number, hasImages: boolean) => {
  const sheetOverrides = Array.from({ length: sheetCount }, (_, index) => {
    const sheetNumber = index + 1;
    return `<Override PartName="/xl/worksheets/sheet${sheetNumber}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  }).join("");
  const imageDefaults = hasImages
    ? IMAGE_CONTENT_TYPE_DEFAULTS.map(
        (item) =>
          `<Default Extension="${item.extension}" ContentType="${item.contentType}"/>`,
      ).join("")
    : "";
  const drawingOverride = hasImages
    ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>'
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${imageDefaults}
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${drawingOverride}
  ${sheetOverrides}
</Types>`;
};

const createRootRelsXml =
  () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const createWorkbookXml = (sheets: SheetData[]) => {
  const sheetXml = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml(sanitizeSheetName(sheet.name))}" sheetId="${
          index + 1
        }" r:id="rId${index + 1}"/>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetXml}</sheets>
</workbook>`;
};

const createWorkbookRelsXml = (sheetCount: number) => {
  const relationships = Array.from({ length: sheetCount }, (_, index) => {
    const sheetNumber = index + 1;
    return `<Relationship Id="rId${sheetNumber}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheetNumber}.xml"/>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${relationships}
</Relationships>`;
};

const crcTable = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }

  return table;
})();

const getCrc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const createZipDateTime = () => {
  const now = new Date();
  const year = Math.max(now.getFullYear(), 1980);

  return {
    time:
      (now.getHours() << 11) |
      (now.getMinutes() << 5) |
      Math.floor(now.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate(),
  };
};

const toArrayBuffer = (bytes: Uint8Array) => {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
};

const createZip = (files: ZipFile[]) => {
  const { time, date } = createZipDateTime();
  const parts: Uint8Array[] = [];
  const centralDirectoryParts: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file) => {
    const pathBytes = textEncoder.encode(file.path);
    const contentBytes =
      typeof file.content === "string"
        ? textEncoder.encode(file.content)
        : file.content;
    const crc32 = getCrc32(contentBytes);
    const localHeader = new Uint8Array(30 + pathBytes.length);
    const localView = new DataView(localHeader.buffer);

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, ZIP_UTF8_FLAG, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, time, true);
    localView.setUint16(12, date, true);
    localView.setUint32(14, crc32, true);
    localView.setUint32(18, contentBytes.length, true);
    localView.setUint32(22, contentBytes.length, true);
    localView.setUint16(26, pathBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(pathBytes, 30);

    parts.push(localHeader, contentBytes);

    const centralDirectoryHeader = new Uint8Array(46 + pathBytes.length);
    const centralView = new DataView(centralDirectoryHeader.buffer);

    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, ZIP_UTF8_FLAG, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, time, true);
    centralView.setUint16(14, date, true);
    centralView.setUint32(16, crc32, true);
    centralView.setUint32(20, contentBytes.length, true);
    centralView.setUint32(24, contentBytes.length, true);
    centralView.setUint16(28, pathBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralDirectoryHeader.set(pathBytes, 46);

    centralDirectoryParts.push(centralDirectoryHeader);
    offset += localHeader.length + contentBytes.length;
  });

  const centralDirectorySize = centralDirectoryParts.reduce(
    (total, part) => total + part.length,
    0,
  );
  const centralDirectoryOffset = offset;
  const endHeader = new Uint8Array(22);
  const endView = new DataView(endHeader.buffer);

  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralDirectorySize, true);
  endView.setUint32(16, centralDirectoryOffset, true);
  endView.setUint16(20, 0, true);

  const blobParts = [...parts, ...centralDirectoryParts, endHeader].map(
    toArrayBuffer,
  );

  return new Blob(blobParts, {
    type: XLSX_MIME_TYPE,
  });
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const saveBlobToFile = async (blob: Blob, filename: string) => {
  const saveBufferToFile =
    typeof window !== "undefined" ? window.storage?.saveBufferToFile : null;

  if (typeof saveBufferToFile !== "function") {
    downloadBlob(blob, filename);
    return true;
  }

  const result = await saveBufferToFile(filename, await blob.arrayBuffer());
  if (result.canceled) return false;
  if (!result.success) {
    throw new Error(result.error || "保存文件失败");
  }
  return true;
};

export const exportVideoPullFilmExcel = async ({
  title,
  columns,
  rows,
  characterProfiles,
  storyboardImageCache,
  projectId,
}: ExportVideoPullFilmExcelInput): Promise<ExportVideoPullFilmExcelResult> => {
  const tableColumns = columns.length > 0 ? columns : ["视频拉片分析"];
  const preparedStoryboardImages = await prepareStoryboardImages(
    tableColumns,
    rows,
    storyboardImageCache,
    projectId,
  );
  const characterProfileRows = buildCharacterProfileRows(characterProfiles);
  const sheets: SheetData[] = [
    {
      name: "视频拉片分析",
      columns: tableColumns,
      rows: preparedStoryboardImages.rows,
      images: preparedStoryboardImages.worksheetImages,
    },
    {
      name: "角色档案",
      columns: CHARACTER_PROFILE_EXPORT_COLUMNS.map((column) => column.label),
      rows: characterProfileRows,
    },
  ];
  const hasImages = preparedStoryboardImages.mediaFiles.length > 0;

  const files: ZipFile[] = [
    {
      path: "[Content_Types].xml",
      content: createContentTypesXml(sheets.length, hasImages),
    },
    { path: "_rels/.rels", content: createRootRelsXml() },
    { path: "xl/workbook.xml", content: createWorkbookXml(sheets) },
    {
      path: "xl/_rels/workbook.xml.rels",
      content: createWorkbookRelsXml(sheets.length),
    },
    ...sheets.map((sheet, index) => ({
      path: `xl/worksheets/sheet${index + 1}.xml`,
      content: createWorksheetXml(sheet),
    })),
  ];

  if (hasImages) {
    files.push(
      {
        path: "xl/worksheets/_rels/sheet1.xml.rels",
        content: createWorksheetDrawingRelsXml(),
      },
      {
        path: "xl/drawings/drawing1.xml",
        content: createDrawingXml(preparedStoryboardImages.worksheetImages),
      },
      {
        path: "xl/drawings/_rels/drawing1.xml.rels",
        content: createDrawingRelsXml(preparedStoryboardImages.mediaFiles),
      },
      ...preparedStoryboardImages.mediaFiles,
    );
  }

  const blob = createZip(files);
  const filename = `${sanitizeFilename(title || "视频拉片分析")}-${createTimestamp()}.xlsx`;
  const saved = await saveBlobToFile(blob, filename);

  return {
    filename,
    saved,
    embeddedImageCount: preparedStoryboardImages.mediaFiles.length,
    failedImageCount: preparedStoryboardImages.failedImageCount,
  };
};
