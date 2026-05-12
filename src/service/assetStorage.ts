import { readMediaFromLocal } from "service/projectStorage";
import { getAssetMediaTypeByFileName } from "shared/constants/mediaTypes";
import type { AssetDiskFileInfo, AssetDiskProjectInfo } from "shared/types/storage";
import { uploadFileToOSS } from "service/oss";

export type AssetScope = "project" | "canvas" | "public";
export type AssetMediaType = "image" | "video" | "audio";
export type AssetLibraryCategory = "role" | "scene" | "prop" | "audio";
export type AssetCategory = AssetLibraryCategory | AssetMediaType;

export type AssetFolder = {
  id: string;
  name: string;
  sourceName?: string;
  createdAt: string;
  updatedAt: string;
};

export type AssetRecord = {
  id: string;
  name: string;
  scope: Exclude<AssetScope, "public">;
  category: AssetCategory;
  mediaType: AssetMediaType;
  fileUrl: string;
  /** OSS 公网访问 URL，优先用于画布节点 */
  ossUrl?: string;
  coverUrl?: string;
  originalFile: string;
  coverFile?: string;
  metadataFile: string;
  projectId?: string;
  folderId?: string;
  folderName?: string;
  source?: {
    type: "canvas" | "upload" | "disk";
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
  folders: AssetFolder[];
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
  folderId?: string;
  folderName?: string;
  source?: AssetRecord["source"];
};

type PreparedAsset = {
  asset: AssetRecord;
  originalFile: string;
  originalBuffer: ArrayBuffer;
  extension: string;
  mediaType: AssetMediaType;
  originalExtension: string;
  coverFile?: string;
  coverBuffer?: ArrayBuffer;
  metadataFile: string;
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
const ASSET_CACHE_DIR = ".jike-assets-cache";
const ASSET_THUMBNAIL_DIR = `${ASSET_CACHE_DIR}/thumbnails`;
const ASSET_OSS_CACHE_PATH = `${ASSET_CACHE_DIR}/oss-index.json`;
export const DEFAULT_ASSET_FOLDER_ID = "unassigned";
export const DEFAULT_ASSET_FOLDER_NAME = "未归档资产";

const categoryLabels: Record<AssetCategory, string> = {
  role: "角色",
  scene: "场景",
  prop: "道具",
  image: "图片",
  video: "视频",
  audio: "音频",
};

const diskCategoryAliases: Record<string, AssetCategory> = {
  role: "role",
  roles: "role",
  character: "role",
  characters: "role",
  person: "role",
  people: "role",
  "人物": "role",
  "角色": "role",
  scene: "scene",
  scenes: "scene",
  "场景": "scene",
  prop: "prop",
  props: "prop",
  object: "prop",
  objects: "prop",
  "道具": "prop",
  audio: "audio",
  audios: "audio",
  sound: "audio",
  sounds: "audio",
  voice: "audio",
  voices: "audio",
  "音频": "audio",
  "音效": "audio",
  "音色": "audio",
};

const mediaTypeExtensions: Record<AssetMediaType, string> = {
  image: "png",
  video: "mp4",
  audio: "mp3",
};

const ASSET_THUMBNAIL_SIZE = 320;
const ASSET_THUMBNAIL_QUALITY = 0.78;
const ASSET_THUMBNAIL_EXTENSION = "webp";
const ASSET_THUMBNAIL_MIME = "image/webp";

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

const createStableId = (value: string) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

const getFileNameWithoutExtension = (fileName: string) =>
  fileName.replace(/\.[^.]+$/, "");

const getFileExtension = (fileName: string) =>
  fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";

const getAssetFileName = (asset: AssetRecord) => {
  const sourcePath = asset.originalFile || asset.fileUrl || asset.name;
  const fileName = sourcePath.split("/").pop() || asset.name || "asset";
  return hasFileExtension(fileName)
    ? fileName
    : `${fileName}.${inferExtension(fileName, asset.mediaType)}`;
};

const getAssetMimeType = (asset: AssetRecord) => {
  const extension = getFileExtension(getAssetFileName(asset));
  const mimeTypeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    aac: "audio/aac",
    ogg: "audio/ogg",
  };
  return mimeTypeMap[extension] || `${asset.mediaType}/${extension || "octet-stream"}`;
};

const getDiskCategory = (categoryName: string, mediaType: AssetMediaType) => {
  const normalized = categoryName.trim().toLowerCase();
  return (
    diskCategoryAliases[categoryName.trim()] ||
    diskCategoryAliases[normalized] ||
    (mediaType === "audio" ? "audio" : "prop")
  );
};

const getCacheThumbnailPath = (assetId: string) =>
  `${ASSET_THUMBNAIL_DIR}/${assetId}.${ASSET_THUMBNAIL_EXTENSION}`;

const isAbsoluteMediaUrl = (value: string) =>
  /^(https?:|file:|blob:|data:)/i.test(value.trim());

const getAssetOssCacheKey = (asset: AssetRecord) =>
  [
    asset.source?.type || "index",
    asset.originalFile || asset.fileUrl,
    asset.updatedAt || "",
  ].join("|");

const isAssetMediaType = (value: unknown): value is AssetMediaType =>
  value === "image" || value === "video" || value === "audio";

const isAssetLibraryCategory = (value: unknown): value is AssetLibraryCategory =>
  value === "role" || value === "scene" || value === "prop" || value === "audio";

const isAssetCategory = (value: unknown): value is AssetCategory =>
  isAssetMediaType(value) || isAssetLibraryCategory(value);

const normalizeAssetCategory = (
  category: unknown,
  mediaType: unknown,
  scope?: AssetScope,
): AssetCategory => {
  if (category === "person") return "role";
  if (isAssetCategory(category)) {
    if (
      scope === "project" &&
      (category === "image" || category === "video")
    ) {
      return isAssetMediaType(mediaType) && mediaType === "audio"
        ? "audio"
        : "prop";
    }
    return category;
  }
  if (isAssetMediaType(mediaType)) return mediaType;
  return "image";
};

const normalizeAssetRecord = (asset: AssetRecord): AssetRecord => {
  const mediaType = isAssetMediaType(asset.mediaType)
    ? asset.mediaType
    : getAssetMediaTypeByFileName(asset.originalFile || asset.fileUrl || "") ||
    "image";

  return {
    ...asset,
    mediaType,
    category: normalizeAssetCategory(asset.category, mediaType, asset.scope),
    folderId:
      asset.scope === "project"
        ? asset.folderId || asset.projectId || DEFAULT_ASSET_FOLDER_ID
        : asset.folderId,
    folderName:
      asset.scope === "project"
        ? asset.folderName || DEFAULT_ASSET_FOLDER_NAME
        : asset.folderName,
  };
};

export const getAssetCategoryLabel = (category: AssetCategory | string) =>
  categoryLabels[normalizeAssetCategory(category, category)] || "资产";

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
  if (/^(https?:|file:|blob:|data:)/i.test(relativePath.trim())) {
    return relativePath;
  }
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

export const getAssetOriginalDisplayUrl = (
  asset: AssetRecord,
  basePath: string,
) => getAssetFileUrl(basePath, asset.fileUrl || asset.originalFile);

export const ensureAssetOssUrl = async (
  basePath: string,
  asset: AssetRecord,
) => {
  if (asset.ossUrl || isAbsoluteMediaUrl(asset.fileUrl)) {
    return asset.ossUrl || asset.fileUrl;
  }

  const cacheKey = getAssetOssCacheKey(asset);
  const cache = await readAssetOssCache(basePath);
  if (cache[cacheKey]) {
    return cache[cacheKey];
  }

  const relativePath = asset.originalFile || asset.fileUrl;
  const result =
    asset.source?.type === "disk"
      ? await window.storage.readRawFile(basePath, relativePath)
      : await window.storage.readMedia(basePath, relativePath);
  if (!result.success || !result.data) {
    throw new Error("读取资产文件失败，无法上传 OSS");
  }

  const file = new File([new Uint8Array(result.data)], getAssetFileName(asset), {
    type: getAssetMimeType(asset),
  });
  const uploadResult = await uploadFileToOSS(file);
  if (!uploadResult.url) {
    throw new Error("上传资产到 OSS 失败");
  }

  cache[cacheKey] = uploadResult.url;
  await writeAssetOssCache(basePath, cache);
  return uploadResult.url;
};

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

const getAssetContentType = (
  mediaType: AssetMediaType,
  extension: string,
): string => {
  const normalizedExtension = extension.toLowerCase();
  if (mediaType === "image") {
    if (normalizedExtension === "jpg" || normalizedExtension === "jpeg") {
      return "image/jpeg";
    }
    if (normalizedExtension === "webp") return "image/webp";
    if (normalizedExtension === "gif") return "image/gif";
    return "image/png";
  }
  if (mediaType === "video") {
    if (normalizedExtension === "webm") return "video/webm";
    if (normalizedExtension === "mov") return "video/quicktime";
    return "video/mp4";
  }
  if (normalizedExtension === "wav") return "audio/wav";
  if (normalizedExtension === "m4a") return "audio/mp4";
  if (normalizedExtension === "aac") return "audio/aac";
  if (normalizedExtension === "ogg") return "audio/ogg";
  return "audio/mpeg";
};

const toOssBlobType = (
  mediaType: AssetMediaType,
): "image" | "video" | "audio" => mediaType;

const createAssetId = () =>
  `asset_${new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;

export const createAssetFolderId = () =>
  `folder_${new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;

const getAssetFolder = (input: {
  scope: Exclude<AssetScope, "public">;
  category: AssetCategory;
  id: string;
  projectId?: string;
  folderId?: string;
}) => {
  const projectSegment = sanitizePathSegment(input.projectId || "unassigned");
  const folderSegment = sanitizePathSegment(
    input.folderId || DEFAULT_ASSET_FOLDER_ID,
  );

  if (input.scope === "canvas") {
    return [
      "assets",
      "canvas",
      projectSegment,
      input.category,
      input.id,
    ].join("/");
  }

  return [
    "assets",
    "project-folders",
    folderSegment,
    input.category,
    input.id,
  ].join("/");
};

const blobToArrayBuffer = (blob: Blob) =>
  blob.arrayBuffer().then((buffer) => buffer.slice(0));

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });

const createImageThumbnail = async (
  buffer: ArrayBuffer,
): Promise<ArrayBuffer | null> => {
  if (typeof document === "undefined") return null;

  const objectUrl = URL.createObjectURL(new Blob([buffer]));
  const image = new Image();
  image.decoding = "async";

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("图片缩略图生成失败"));
      image.src = objectUrl;
    });

    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) return null;

    const scale = Math.min(
      ASSET_THUMBNAIL_SIZE / sourceWidth,
      ASSET_THUMBNAIL_SIZE / sourceHeight,
      1,
    );
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const blob =
      (await canvasToBlob(
        canvas,
        ASSET_THUMBNAIL_MIME,
        ASSET_THUMBNAIL_QUALITY,
      )) ||
      (await canvasToBlob(canvas, "image/jpeg", ASSET_THUMBNAIL_QUALITY));
    return blob ? blobToArrayBuffer(blob) : null;
  } catch (error) {
    console.warn("[assetStorage] create thumbnail failed", error);
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const ensureDiskThumbnail = async (
  basePath: string,
  assetId: string,
  relativePath: string,
  mediaType: AssetMediaType,
) => {
  if (mediaType !== "image") return undefined;

  const thumbnailPath = getCacheThumbnailPath(assetId);
  if (await window.storage.mediaExists(basePath, thumbnailPath)) {
    return thumbnailPath;
  }

  const sourceResult = await window.storage.readRawFile(basePath, relativePath);
  if (!sourceResult.success || !sourceResult.data) return undefined;

  const thumbnailBuffer = await createImageThumbnail(
    toArrayBuffer(new Uint8Array(sourceResult.data)),
  );
  if (!thumbnailBuffer) return undefined;

  const saveResult = await window.storage.writeRawFile(
    basePath,
    thumbnailPath,
    thumbnailBuffer,
  );
  return saveResult.success ? thumbnailPath : undefined;
};

const getExistingDiskThumbnail = async (
  basePath: string,
  assetId: string,
  mediaType: AssetMediaType,
) => {
  if (mediaType !== "image") return undefined;
  const thumbnailPath = getCacheThumbnailPath(assetId);
  return (await window.storage.mediaExists(basePath, thumbnailPath))
    ? thumbnailPath
    : undefined;
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

const readRawTextFile = async (basePath: string, relativePath: string) => {
  const result = await window.storage.readRawFile(basePath, relativePath);
  if (!result.success || !result.data) return null;
  return textDecoder.decode(new Uint8Array(result.data));
};

const writeRawTextFile = async (
  basePath: string,
  relativePath: string,
  content: string,
) => {
  const bytes = textEncoder.encode(content);
  return window.storage.writeRawFile(basePath, relativePath, toArrayBuffer(bytes));
};

const readAssetOssCache = async (basePath: string) => {
  try {
    const raw = await readRawTextFile(basePath, ASSET_OSS_CACHE_PATH);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
};

const writeAssetOssCache = async (
  basePath: string,
  cache: Record<string, string>,
) => {
  await writeRawTextFile(basePath, ASSET_OSS_CACHE_PATH, JSON.stringify(cache, null, 2));
};

export const readAssetIndex = async (basePath: string): Promise<AssetIndex> => {
  if (!window.storage || !basePath) {
    return { version: 1, folders: [], assets: [] };
  }

  try {
    const raw = await readTextFile(basePath, ASSET_INDEX_PATH);
    if (!raw) return { version: 1, folders: [], assets: [] };
    const parsed = JSON.parse(raw) as Partial<AssetIndex>;
    const assets = Array.isArray(parsed.assets)
      ? (parsed.assets as AssetRecord[]).map(normalizeAssetRecord)
      : [];
    const existingFolders = Array.isArray(parsed.folders)
      ? (parsed.folders as AssetFolder[])
      : [];
    const folderMap = new Map<string, AssetFolder>();

    for (const folder of existingFolders) {
      if (!folder?.id) continue;
      folderMap.set(folder.id, {
        id: folder.id,
        name: folder.name || DEFAULT_ASSET_FOLDER_NAME,
        sourceName: folder.sourceName,
        createdAt: folder.createdAt || new Date().toISOString(),
        updatedAt: folder.updatedAt || folder.createdAt || new Date().toISOString(),
      });
    }

    for (const asset of assets) {
      if (asset.scope !== "project" || !asset.folderId) continue;
      if (folderMap.has(asset.folderId)) continue;
      folderMap.set(asset.folderId, {
        id: asset.folderId,
        name: asset.folderName || DEFAULT_ASSET_FOLDER_NAME,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
      });
    }

    return {
      version: 1,
      folders: Array.from(folderMap.values()),
      assets,
    };
  } catch {
    return { version: 1, folders: [], assets: [] };
  }
};

export const readDiskAssetIndex = async (
  basePath: string,
): Promise<AssetIndex> => {
  if (!window.storage?.scanAssetLibrary || !basePath) {
    return { version: 1, folders: [], assets: [] };
  }

  const result = await window.storage.scanAssetLibrary(basePath);
  if (!result.success || !result.files) {
    return { version: 1, folders: [], assets: [] };
  }

  const folders = new Map<string, AssetFolder>();
  const assets: AssetRecord[] = [];

  for (const project of (result.projects || []) as AssetDiskProjectInfo[]) {
    const folderId = `disk_folder_${createStableId(project.name)}`;
    folders.set(folderId, {
      id: folderId,
      name: project.name,
      sourceName: project.name,
      createdAt: new Date(project.createdAt || Date.now()).toISOString(),
      updatedAt: new Date(project.modifiedAt || Date.now()).toISOString(),
    });
  }

  for (const file of result.files as AssetDiskFileInfo[]) {
    const mediaType = getAssetMediaTypeByFileName(file.name);
    if (!mediaType) continue;

    const category = getDiskCategory(file.categoryName, mediaType);
    const assetId = `disk_${createStableId(file.relativePath)}`;
    const folderId = `disk_folder_${createStableId(file.projectName)}`;
    const updatedAt = new Date(file.modifiedAt || Date.now()).toISOString();
    const coverFile = await getExistingDiskThumbnail(
      basePath,
      assetId,
      mediaType,
    );
    if (!coverFile && mediaType === "image") {
      void ensureDiskThumbnail(basePath, assetId, file.relativePath, mediaType);
    }

    folders.set(folderId, {
      id: folderId,
      name: file.projectName,
      sourceName: file.projectName,
      createdAt: updatedAt,
      updatedAt,
    });

    assets.push({
      id: assetId,
      name: getFileNameWithoutExtension(file.name),
      scope: "project",
      category,
      mediaType,
      fileUrl: file.relativePath,
      coverUrl: coverFile || (mediaType === "image" ? file.relativePath : undefined),
      originalFile: file.relativePath,
      coverFile,
      metadataFile: "",
      folderId,
      folderName: file.projectName,
      source: { type: "disk" },
      createdAt: updatedAt,
      updatedAt,
      tags: [],
    });
  }

  return {
    version: 1,
    folders: Array.from(folders.values()),
    assets,
  };
};

export const readCombinedAssetIndex = async (
  basePath: string,
): Promise<AssetIndex> => {
  const [legacyIndex, diskIndex] = await Promise.all([
    readAssetIndex(basePath),
    readDiskAssetIndex(basePath),
  ]);

  const folderMap = new Map<string, AssetFolder>();
  for (const folder of legacyIndex.folders) {
    folderMap.set(folder.id, folder);
  }
  for (const folder of diskIndex.folders) {
    folderMap.set(folder.id, folder);
  }

  const assetMap = new Map<string, AssetRecord>();
  for (const asset of legacyIndex.assets) {
    assetMap.set(asset.id, asset);
  }
  for (const asset of diskIndex.assets) {
    assetMap.set(asset.id, asset);
  }

  return {
    version: 1,
    folders: Array.from(folderMap.values()),
    assets: Array.from(assetMap.values()),
  };
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

export const upsertAssetFolder = async (
  basePath: string,
  folder: AssetFolder,
) => {
  const index = await readAssetIndex(basePath);
  const folderMap = new Map(index.folders.map((item) => [item.id, item]));
  folderMap.set(folder.id, folder);
  await writeAssetIndex(basePath, {
    version: 1,
    folders: Array.from(folderMap.values()),
    assets: index.assets,
  });
};

export const renameAssetFolder = async (
  basePath: string,
  folderId: string,
  name: string,
): Promise<AssetFolder> => {
  const nextName = name.trim();
  if (!nextName) {
    throw new Error("资产项目名称不能为空");
  }

  const index = await readAssetIndex(basePath);
  const existingFolder = index.folders.find((folder) => folder.id === folderId);
  if (!existingFolder) {
    throw new Error("资产项目不存在");
  }

  const now = new Date().toISOString();
  const renamedFolder: AssetFolder = {
    ...existingFolder,
    name: nextName,
    updatedAt: now,
  };
  const nextAssets = index.assets.map((asset) =>
    asset.scope === "project" && asset.folderId === folderId
      ? {
        ...asset,
        folderName: nextName,
        updatedAt: now,
      }
      : asset,
  );

  for (const asset of nextAssets) {
    if (asset.scope !== "project" || asset.folderId !== folderId) continue;
    await writeTextFile(basePath, asset.metadataFile, JSON.stringify(asset, null, 2));
  }

  await writeAssetIndex(basePath, {
    version: 1,
    folders: index.folders.map((folder) =>
      folder.id === folderId ? renamedFolder : folder,
    ),
    assets: nextAssets,
  });

  return renamedFolder;
};

const isCategoryMediaCompatible = (
  category: AssetCategory,
  mediaType: AssetMediaType,
) => {
  if (category === "audio") return mediaType === "audio";
  if (category === "role" || category === "scene" || category === "prop") {
    return mediaType === "image" || mediaType === "video";
  }
  return category === mediaType;
};

const prepareAssetFromBuffer = async (
  input: CreateAssetInput,
): Promise<PreparedAsset> => {
  const supportedMediaType = getAssetMediaTypeByFileName(input.fileName);
  if (!supportedMediaType) {
    throw new Error("不支持的资产类型");
  }
  if (supportedMediaType !== input.mediaType) {
    throw new Error("资产文件类型与媒体类型不一致");
  }
  if (!isCategoryMediaCompatible(input.category, input.mediaType)) {
    throw new Error("资产分类与媒体类型不匹配");
  }

  const id = createAssetId();
  const now = new Date().toISOString();
  const extension = inferExtension(input.fileName, input.mediaType);
  const folderId =
    input.scope === "project"
      ? input.folderId || input.projectId || DEFAULT_ASSET_FOLDER_ID
      : undefined;
  const folderName =
    input.scope === "project"
      ? input.folderName || DEFAULT_ASSET_FOLDER_NAME
      : undefined;
  const folder = getAssetFolder({
    scope: input.scope,
    category: input.category,
    projectId: input.projectId,
    folderId,
    id,
  });
  const originalFile = `${folder}/original.${extension}`;
  const metadataFile = `${folder}/metadata.json`;
  const thumbnailBuffer =
    input.mediaType === "image"
      ? await createImageThumbnail(input.buffer)
      : null;
  const coverFile = thumbnailBuffer
    ? `${folder}/cover.${ASSET_THUMBNAIL_EXTENSION}`
    : input.mediaType === "image"
      ? originalFile
      : undefined;

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
    projectId: input.projectId,
    folderId,
    folderName,
    source: input.source,
    createdAt: now,
    updatedAt: now,
    tags: [],
  };

  return {
    asset,
    originalFile,
    originalBuffer: input.buffer,
    extension,
    mediaType: input.mediaType,
    originalExtension: extension,
    coverFile: thumbnailBuffer ? coverFile : undefined,
    coverBuffer: thumbnailBuffer || undefined,
    metadataFile,
  };
};
const uploadPreparedAssetToOss = async (prepared: PreparedAsset) => {
  try {
    const putUrlResp = await getUploadOssPutUrl({
      blob_type: toOssBlobType(prepared.asset.mediaType),
      ext: prepared.originalExtension,
      content_type: getAssetContentType(
        prepared.asset.mediaType,
        prepared.originalExtension,
      ),
      ttl: 3600,
    });
    const putUrlData = putUrlResp?.data ?? putUrlResp;
    if (!putUrlData?.put_url) {
      return;
    }

    const uploadResp = await fetch(putUrlData.put_url, {
      method: "PUT",
      body: prepared.originalBuffer,
      headers: putUrlData.headers || {},
    });
    if (uploadResp.ok && putUrlData.access_url) {
      prepared.asset.ossUrl = putUrlData.access_url as string;
      return;
    }

    console.warn("[assetStorage] OSS PUT 失败:", uploadResp.status);
  } catch (ossError) {
    console.warn("[assetStorage] 上传 OSS 失败，仅保存本地:", ossError);
  }
};


const savePreparedAssetFiles = async (
  basePath: string,
  prepared: PreparedAsset,
) => {
  const saveResult = await window.storage.saveMedia(
    basePath,
    prepared.originalFile,
    prepared.originalBuffer,
  );
  if (!saveResult.success) {
    throw new Error(saveResult.error || "保存资产文件失败");
  }

  // 上传到 OSS，获取公网 URL 存入 ossUrl 字段。
  try {
    const file = new File(
      [prepared.originalBuffer],
      getAssetFileName(prepared.asset),
      { type: getAssetMimeType(prepared.asset) },
    );
    const uploadResult = await uploadFileToOSS(file);
    if (uploadResult.url) {
      prepared.asset.ossUrl = uploadResult.url;
    }
  } catch (ossError) {
    console.warn("[assetStorage] 上传 OSS 失败，仅保存本地:", ossError);
  }
  await uploadPreparedAssetToOss(prepared);
  if (prepared.coverFile && prepared.coverBuffer) {
    const coverResult = await window.storage.saveMedia(
      basePath,
      prepared.coverFile,
      prepared.coverBuffer,
    );
    if (!coverResult.success) {
      throw new Error(coverResult.error || "保存资产缩略图失败");
    }
  }

  await writeTextFile(
    basePath,
    prepared.metadataFile,
    JSON.stringify(prepared.asset, null, 2),
  );
};


const mergeAssetsIntoIndex = (
  index: AssetIndex,
  assets: AssetRecord[],
): AssetIndex => {
  const folderMap = new Map(index.folders.map((item) => [item.id, item]));

  for (const asset of assets) {
    if (asset.scope !== "project" || !asset.folderId || !asset.folderName) {
      continue;
    }
    const existingFolder = folderMap.get(asset.folderId);
    folderMap.set(asset.folderId, {
      id: asset.folderId,
      name: asset.folderName,
      sourceName: existingFolder?.sourceName,
      createdAt: existingFolder?.createdAt || asset.createdAt,
      updatedAt: asset.updatedAt,
    });
  }

  const newAssetIds = new Set(assets.map((asset) => asset.id));
  return {
    version: 1,
    folders: Array.from(folderMap.values()),
    assets: [
      ...assets,
      ...index.assets.filter((item) => !newAssetIds.has(item.id)),
    ],
  };
};

export const createAssetsFromBuffers = async (
  inputs: CreateAssetInput[],
): Promise<AssetRecord[]> => {
  if (inputs.length === 0) return [];

  const basePath = inputs[0].basePath;
  if (!basePath || inputs.some((input) => input.basePath !== basePath)) {
    throw new Error("批量创建资产需要使用同一个资产库路径");
  }

  const preparedAssets: PreparedAsset[] = [];
  for (const input of inputs) {
    preparedAssets.push(await prepareAssetFromBuffer(input));
  }

  for (const prepared of preparedAssets) {
    await savePreparedAssetFiles(basePath, prepared);
  }

  const index = await readAssetIndex(basePath);
  await writeAssetIndex(
    basePath,
    mergeAssetsIntoIndex(
      index,
      preparedAssets.map((prepared) => prepared.asset),
    ),
  );

  return preparedAssets.map((prepared) => prepared.asset);
};

export const createAssetFromBuffer = async (
  input: CreateAssetInput,
): Promise<AssetRecord> => {
  const [asset] = await createAssetsFromBuffers([input]);

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
  folderId?: string;
  folderName?: string;
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
    folderId: input.folderId,
    folderName: input.folderName,
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
    folders: index.folders,
    assets: index.assets.filter((asset) => !targetIds.has(asset.id)),
  });
};

export const deleteAssetFolderById = async (
  basePath: string,
  folderId: string,
) => {
  const index = await readAssetIndex(basePath);
  const deletingAssets = index.assets.filter(
    (asset) => asset.scope === "project" && asset.folderId === folderId,
  );

  if (deletingAssets.length > 0) {
    await deleteAssetsById(
      basePath,
      deletingAssets.map((asset) => asset.id),
    );
  }

  const nextIndex = await readAssetIndex(basePath);
  await writeAssetIndex(basePath, {
    version: 1,
    folders: nextIndex.folders.filter((folder) => folder.id !== folderId),
    assets: nextIndex.assets.filter((asset) => asset.folderId !== folderId),
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
    folders: index.folders,
    assets: index.assets.map((item) =>
      item.id === assetId ? renamedAsset : item,
    ),
  });

  return renamedAsset;
};
