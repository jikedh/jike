import { readMediaFromLocal } from "service/projectStorage";
import {
  ASSET_SUPPORTED_TYPES_LABEL,
  getAssetMediaTypeByFileName,
} from "shared/constants/mediaTypes";

export type AssetScope = "project" | "canvas" | "public";
export type AssetCategory = "person" | "scene" | "prop" | "audio";
export type AssetMediaType = "image" | "video" | "audio";

export type AssetRecord = {
  id: string;
  name: string;
  scope: Exclude<AssetScope, "public">;
  category: AssetCategory;
  mediaType: AssetMediaType;
  fileUrl: string;
  coverUrl?: string;
  originalFile: string;
  coverFile?: string;
  metadataFile: string;
  projectId?: string;
  source?: {
    type: "canvas" | "upload";
    projectId?: string;
    nodeId?: string;
  };
  width?: number;
  height?: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
};

export type AssetIndex = {
  version: 1;
  assets: AssetRecord[];
};

export type CreateAssetInput = {
  basePath: string;
  name: string;
  scope: Exclude<AssetScope, "public">;
  category: AssetCategory;
  mediaType: AssetMediaType;
  fileName: string;
  buffer: ArrayBuffer;
  projectId?: string;
  source?: AssetRecord["source"];
};

export type AssetMediaRef = {
  url?: string;
  remoteUrl?: string;
  displayUrl?: string;
  localPath?: string;
  localName?: string;
  format?: string;
};

const ASSET_INDEX_PATH = "assets/index.json";

const categoryLabels: Record<AssetCategory, string> = {
  person: "人物",
  scene: "场景",
  prop: "道具",
  audio: "音效",
};

const mediaTypeExtensions: Record<AssetMediaType, string> = {
  image: "png",
  video: "mp4",
  audio: "mp3",
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const sanitizePathSegment = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled";

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
};

const normalizeRelativePath = (value: string) =>
  value.replace(/\\/g, "/").replace(/^\/+/, "");

const hasFileExtension = (fileName: string) => /\.[a-z0-9]+$/i.test(fileName);

export const getAssetCategoryLabel = (category: AssetCategory) =>
  categoryLabels[category];

export const getAssetStoragePath = (): string => {
  try {
    const raw = localStorage.getItem("canvas-chat-settings");
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return parsed.state?.assetStoragePath || "";
  } catch {
    return "";
  }
};

export const getAssetFileUrl = (
  basePath: string,
  relativePath: string,
): string => {
  const normalizedBase = basePath.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedRelative = normalizeRelativePath(relativePath);
  if (!normalizedBase || !normalizedRelative) {
    return relativePath;
  }

  const absolutePath = `${normalizedBase}/${normalizedRelative}`;
  const fileUrl = /^[a-zA-Z]:\//.test(absolutePath)
    ? `file:///${absolutePath}`
    : `file://${absolutePath.startsWith("/") ? "" : "/"}${absolutePath}`;

  return encodeURI(fileUrl);
};

export const getAssetDisplayUrl = (asset: AssetRecord, basePath: string) =>
  getAssetFileUrl(basePath, asset.coverUrl || asset.fileUrl);

const inferExtension = (
  fileName: string | undefined,
  mediaType: AssetMediaType,
) => {
  const cleanName = (fileName || "").split("?")[0].split("#")[0];
  const extension = cleanName.split(".").pop()?.toLowerCase();
  if (extension && /^[a-z0-9]+$/.test(extension)) {
    return extension;
  }
  return mediaTypeExtensions[mediaType];
};

const createAssetId = () =>
  `asset_${new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;

const getAssetFolder = (input: {
  scope: Exclude<AssetScope, "public">;
  category: AssetCategory;
  id: string;
  projectId?: string;
}) => {
  if (input.scope === "canvas") {
    return [
      "assets",
      "canvas",
      sanitizePathSegment(input.projectId || "unknown-project"),
      input.category,
      input.id,
    ].join("/");
  }

  return ["assets", "project", input.category, input.id].join("/");
};

const readTextFile = async (basePath: string, relativePath: string) => {
  const result = await window.storage.readMedia(basePath, relativePath);
  if (!result.success || !result.data) return null;
  return textDecoder.decode(new Uint8Array(result.data));
};

const writeTextFile = async (
  basePath: string,
  relativePath: string,
  content: string,
) => {
  const bytes = textEncoder.encode(content);
  return window.storage.saveMedia(basePath, relativePath, toArrayBuffer(bytes));
};

export const readAssetIndex = async (basePath: string): Promise<AssetIndex> => {
  if (!window.storage || !basePath) {
    return { version: 1, assets: [] };
  }

  try {
    const raw = await readTextFile(basePath, ASSET_INDEX_PATH);
    if (!raw) return { version: 1, assets: [] };
    const parsed = JSON.parse(raw) as Partial<AssetIndex>;
    return {
      version: 1,
      assets: Array.isArray(parsed.assets) ? parsed.assets : [],
    };
  } catch {
    return { version: 1, assets: [] };
  }
};

export const writeAssetIndex = async (basePath: string, index: AssetIndex) => {
  await writeTextFile(
    basePath,
    ASSET_INDEX_PATH,
    JSON.stringify(index, null, 2),
  );
};

export const initializeAssetStorage = async (basePath: string) => {
  const index = await readAssetIndex(basePath);
  await writeAssetIndex(basePath, index);
};

export const createAssetFromBuffer = async (
  input: CreateAssetInput,
): Promise<AssetRecord> => {
  const supportedMediaType = getAssetMediaTypeByFileName(input.fileName);
  if (!supportedMediaType) {
    throw new Error(`不支持的资产类型。支持${ASSET_SUPPORTED_TYPES_LABEL}`);
  }
  if (supportedMediaType !== input.mediaType) {
    throw new Error("资产文件类型与媒体类型不一致");
  }

  const id = createAssetId();
  const now = new Date().toISOString();
  const extension = inferExtension(input.fileName, input.mediaType);
  const folder = getAssetFolder({
    scope: input.scope,
    category: input.category,
    projectId: input.projectId,
    id,
  });
  const originalFile = `${folder}/original.${extension}`;
  const metadataFile = `${folder}/metadata.json`;
  const coverFile = input.mediaType === "image" ? originalFile : undefined;

  const asset: AssetRecord = {
    id,
    name: input.name.trim() || "未命名资产",
    scope: input.scope,
    category: input.category,
    mediaType: input.mediaType,
    fileUrl: originalFile,
    coverUrl: coverFile,
    originalFile,
    coverFile,
    metadataFile,
    projectId: input.scope === "canvas" ? input.projectId : undefined,
    source: input.source,
    createdAt: now,
    updatedAt: now,
    tags: [],
  };

  const saveResult = await window.storage.saveMedia(
    input.basePath,
    originalFile,
    input.buffer,
  );
  if (!saveResult.success) {
    throw new Error(saveResult.error || "保存资产文件失败");
  }

  await writeTextFile(
    input.basePath,
    metadataFile,
    JSON.stringify(asset, null, 2),
  );

  const index = await readAssetIndex(input.basePath);
  await writeAssetIndex(input.basePath, {
    version: 1,
    assets: [asset, ...index.assets.filter((item) => item.id !== id)],
  });

  return asset;
};

export const readSourceMediaBuffer = async (
  mediaRef: AssetMediaRef,
): Promise<ArrayBuffer> => {
  if (mediaRef.localPath && !mediaRef.localPath.startsWith("assets/")) {
    const localMedia = await readMediaFromLocal(mediaRef.localPath);
    if (localMedia) return localMedia;
  }

  const sourceUrl = mediaRef.displayUrl || mediaRef.remoteUrl || mediaRef.url;
  if (!sourceUrl) {
    throw new Error("没有可用的素材地址");
  }

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`读取素材失败: ${response.status}`);
  }
  return response.arrayBuffer();
};

export const createAssetFromMediaRef = async (input: {
  basePath: string;
  name: string;
  scope: Exclude<AssetScope, "public">;
  category: AssetCategory;
  mediaType: AssetMediaType;
  mediaRef: AssetMediaRef;
  projectId?: string;
  nodeId?: string;
}) => {
  const buffer = await readSourceMediaBuffer(input.mediaRef);
  const candidateFileName =
    input.mediaRef.localName ||
    input.mediaRef.localPath?.split("/").pop() ||
    input.mediaRef.url?.split("?")[0].split("/").pop() ||
    "";
  const fileName =
    candidateFileName && hasFileExtension(candidateFileName)
      ? candidateFileName
      : `asset.${mediaTypeExtensions[input.mediaType]}`;

  return createAssetFromBuffer({
    basePath: input.basePath,
    name: input.name,
    scope: input.scope,
    category: input.category,
    mediaType: input.mediaType,
    fileName,
    buffer,
    projectId: input.projectId,
    source: {
      type: "canvas",
      projectId: input.projectId,
      nodeId: input.nodeId,
    },
  });
};

export const deleteAssetsById = async (
  basePath: string,
  assetIds: string[],
) => {
  const targetIds = new Set(assetIds);
  const index = await readAssetIndex(basePath);
  const deletingAssets = index.assets.filter((asset) =>
    targetIds.has(asset.id),
  );

  for (const asset of deletingAssets) {
    const paths = Array.from(
      new Set(
        [asset.originalFile, asset.coverFile, asset.metadataFile].filter(
          (item): item is string => Boolean(item),
        ),
      ),
    );
    for (const path of paths) {
      await window.storage.deleteMedia(basePath, path);
    }
  }

  await writeAssetIndex(basePath, {
    version: 1,
    assets: index.assets.filter((asset) => !targetIds.has(asset.id)),
  });
};

export const renameAsset = async (
  basePath: string,
  assetId: string,
  name: string,
): Promise<AssetRecord> => {
  const nextName = name.trim();
  if (!nextName) {
    throw new Error("资产名称不能为空");
  }

  const index = await readAssetIndex(basePath);
  const asset = index.assets.find((item) => item.id === assetId);
  if (!asset) {
    throw new Error("资产不存在");
  }

  const renamedAsset: AssetRecord = {
    ...asset,
    name: nextName,
    updatedAt: new Date().toISOString(),
  };

  await writeTextFile(
    basePath,
    renamedAsset.metadataFile,
    JSON.stringify(renamedAsset, null, 2),
  );
  await writeAssetIndex(basePath, {
    version: 1,
    assets: index.assets.map((item) =>
      item.id === assetId ? renamedAsset : item,
    ),
  });

  return renamedAsset;
};
