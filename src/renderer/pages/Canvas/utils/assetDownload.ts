import type { AssetRecord } from "service/assetStorage";

type ZipEntry = {
  name: string;
  data: Uint8Array<ArrayBuffer>;
};

const ZIP_UTF8_FILENAME_FLAG = 1 << 11;
const textEncoder = new TextEncoder();

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

const getCrc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const writeUint16 = (target: Uint8Array, offset: number, value: number) => {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
};

const writeUint32 = (target: Uint8Array, offset: number, value: number) => {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
};

const copyBytes = (value: Uint8Array) => {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy;
};

const toUint8Array = (value: unknown): Uint8Array<ArrayBuffer> => {
  if (value instanceof Uint8Array) {
    return copyBytes(value);
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value.slice(0));
  }
  if (ArrayBuffer.isView(value)) {
    return copyBytes(
      new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
    );
  }
  if (Array.isArray(value)) {
    return Uint8Array.from(value);
  }
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { data?: unknown }).data)
  ) {
    return Uint8Array.from((value as { data: number[] }).data);
  }

  throw new Error("读取资产文件失败");
};

const sanitizeFileName = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+|\.+$/g, "") || "asset";

const getExtension = (asset: AssetRecord) => {
  const fileName = (asset.originalFile || asset.fileUrl).split("/").pop() || "";
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext && /^[a-z0-9]+$/.test(ext)) {
    return ext;
  }
  if (asset.mediaType === "video") return "mp4";
  if (asset.mediaType === "audio") return "mp3";
  return "png";
};

const getAssetDownloadName = (asset: AssetRecord) => {
  const ext = getExtension(asset);
  const baseName = sanitizeFileName(asset.name).replace(/\.[a-z0-9]+$/i, "");
  return `${baseName}.${ext}`;
};

const getProjectStoragePath = () => {
  try {
    const raw = localStorage.getItem("canvas-chat-settings");
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return parsed.state?.storagePath || "";
  } catch {
    return "";
  }
};

const isAbsoluteMediaUrl = (value: string) =>
  /^(https?:|file:|blob:|data:)/i.test(value.trim());

const uniquifyNames = (entries: ZipEntry[]) => {
  const seen = new Map<string, number>();

  return entries.map((entry) => {
    const dotIndex = entry.name.lastIndexOf(".");
    const baseName = dotIndex > 0 ? entry.name.slice(0, dotIndex) : entry.name;
    const extension = dotIndex > 0 ? entry.name.slice(dotIndex) : "";
    const key = entry.name.toLowerCase();
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);

    if (count === 0) return entry;
    return {
      ...entry,
      name: `${baseName}-${count + 1}${extension}`,
    };
  });
};

const concatBytes = (parts: Uint8Array<ArrayBuffer>[]) => {
  const totalLength = parts.reduce((total, part) => total + part.byteLength, 0);
  const bytes = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return bytes;
};

const saveBytesToFile = async (fileName: string, bytes: Uint8Array) => {
  const copy = copyBytes(bytes);
  const saveBufferToFile = (
    window.storage as typeof window.storage & {
      saveBufferToFile?: typeof window.storage.saveBufferToFile;
    }
  ).saveBufferToFile;

  if (typeof saveBufferToFile !== "function") {
    const url = URL.createObjectURL(
      new Blob([copy.buffer], { type: "application/octet-stream" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return false;
  }

  const result = await saveBufferToFile(fileName, copy.buffer);
  if (result.canceled) return false;
  if (!result.success) {
    throw new Error(result.error || "保存文件失败");
  }
  return true;
};

const createZipBytes = (entries: ZipEntry[]) => {
  const localParts: Uint8Array<ArrayBuffer>[] = [];
  const centralParts: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.name);
    const crc = getCrc32(entry.data);

    const localHeader: Uint8Array<ArrayBuffer> = new Uint8Array(
      30 + nameBytes.length,
    );
    writeUint32(localHeader, 0, 0x04034b50);
    writeUint16(localHeader, 4, 20);
    writeUint16(localHeader, 6, ZIP_UTF8_FILENAME_FLAG);
    writeUint16(localHeader, 8, 0);
    writeUint16(localHeader, 10, 0);
    writeUint16(localHeader, 12, 0);
    writeUint32(localHeader, 14, crc);
    writeUint32(localHeader, 18, entry.data.byteLength);
    writeUint32(localHeader, 22, entry.data.byteLength);
    writeUint16(localHeader, 26, nameBytes.length);
    writeUint16(localHeader, 28, 0);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, entry.data);

    const centralHeader: Uint8Array<ArrayBuffer> = new Uint8Array(
      46 + nameBytes.length,
    );
    writeUint32(centralHeader, 0, 0x02014b50);
    writeUint16(centralHeader, 4, 20);
    writeUint16(centralHeader, 6, 20);
    writeUint16(centralHeader, 8, ZIP_UTF8_FILENAME_FLAG);
    writeUint16(centralHeader, 10, 0);
    writeUint16(centralHeader, 12, 0);
    writeUint16(centralHeader, 14, 0);
    writeUint32(centralHeader, 16, crc);
    writeUint32(centralHeader, 20, entry.data.byteLength);
    writeUint32(centralHeader, 24, entry.data.byteLength);
    writeUint16(centralHeader, 28, nameBytes.length);
    writeUint16(centralHeader, 30, 0);
    writeUint16(centralHeader, 32, 0);
    writeUint16(centralHeader, 34, 0);
    writeUint16(centralHeader, 36, 0);
    writeUint32(centralHeader, 38, 0);
    writeUint32(centralHeader, 42, offset);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.byteLength + entry.data.byteLength;
  }

  const centralSize = centralParts.reduce(
    (total, part) => total + part.byteLength,
    0,
  );
  const endHeader: Uint8Array<ArrayBuffer> = new Uint8Array(22);
  writeUint32(endHeader, 0, 0x06054b50);
  writeUint16(endHeader, 4, 0);
  writeUint16(endHeader, 6, 0);
  writeUint16(endHeader, 8, entries.length);
  writeUint16(endHeader, 10, entries.length);
  writeUint32(endHeader, 12, centralSize);
  writeUint32(endHeader, 16, offset);
  writeUint16(endHeader, 20, 0);

  return concatBytes([...localParts, ...centralParts, endHeader]);
};

const readAssetEntry = async (
  basePath: string,
  asset: AssetRecord,
): Promise<ZipEntry> => {
  const sourcePath = asset.originalFile || asset.fileUrl;

  if (isAbsoluteMediaUrl(sourcePath)) {
    const response = await fetch(sourcePath);
    if (!response.ok) {
      throw new Error(`读取资产失败：${asset.name}`);
    }
    return {
      name: getAssetDownloadName(asset),
      data: new Uint8Array(await response.arrayBuffer()),
    };
  }

  const readBasePath =
    asset.source?.type === "canvas" && !sourcePath.startsWith("assets/")
      ? getProjectStoragePath()
      : basePath;
  const result = await window.storage.readMedia(readBasePath, sourcePath);
  if (!result.success || !result.data) {
    throw new Error(result.error || `读取资产失败：${asset.name}`);
  }

  return {
    name: getAssetDownloadName(asset),
    data: toUint8Array(result.data),
  };
};

export const downloadAssets = async (
  basePath: string,
  assets: AssetRecord[],
) => {
  if (assets.length === 0) return false;

  const entries = uniquifyNames(
    await Promise.all(assets.map((asset) => readAssetEntry(basePath, asset))),
  );

  if (entries.length === 1) {
    return saveBytesToFile(entries[0].name, entries[0].data);
  }

  return saveBytesToFile(`assets-${Date.now()}.zip`, createZipBytes(entries));
};
