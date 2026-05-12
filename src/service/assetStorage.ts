import { readMediaFromLocal } from "service/projectStorage";
import {
  ASSET_SUPPORTED_TYPES_LABEL,
  getAssetMediaTypeByFileName,
} from "shared/constants/mediaTypes";
import { getUploadOssPutUrl } from "@/api/jikeGo";

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
  /** OSS 公网访问 URL，创建资产时上传后写入，优先用于画布节点 */
  ossUrl?: string;
  coverUrl?: string;
  originalFile: string;
  coverFile?: string;
  metadataFile: string;
  projectId?: string;
  folderId?: string;
  folderName?: string;
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

export type AssetMediaRef = {
  url?: string;
  remoteUrl?: string;
  displayUrl?: string;
  localPath?: string;
  localName?: string;
  format?: string;
};

const ASSET_INDEX_PATH = "assets/index.json";
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
    projectId: input.projectId,
    folderId,
    folderName,
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

  // 上传到 OSS，获取公网 URL 存入 ossUrl 字段
  try {
    const ext = extension;
    const blobTypeMap: Record<AssetMediaType, "image" | "video" | "audio"> = {
      image: "image",
      video: "video",
      audio: "audio",
    };
    const putUrlResp = await getUploadOssPutUrl({
      blob_type: blobTypeMap[input.mediaType],
      ext,
      ttl: 3600,
    });
    const putUrlData = putUrlResp?.data ?? putUrlResp;
    if (putUrlData?.put_url) {
      const uploadResp = await fetch(putUrlData.put_url, {
        method: "PUT",
        body: input.buffer,
        headers: putUrlData.headers || {},
      });
      if (uploadResp.ok) {
        asset.ossUrl = putUrlData.access_url as string;
      } else {
        console.warn("[assetStorage] OSS PUT 失败:", uploadResp.status);
      }
    }
  } catch (ossError) {
    console.warn("[assetStorage] 上传 OSS 失败，仅保存本地:", ossError);
  }

  await writeTextFile(
    input.basePath,
    metadataFile,
    JSON.stringify(asset, null, 2),
  );

  const index = await readAssetIndex(input.basePath);
  const folderMap = new Map(index.folders.map((item) => [item.id, item]));
  if (input.scope === "project" && folderId && folderName) {
    const existingFolder = folderMap.get(folderId);
    folderMap.set(folderId, {
      id: folderId,
      name: folderName,
      sourceName: existingFolder?.sourceName,
      createdAt: existingFolder?.createdAt || now,
      updatedAt: now,
    });
  }
  await writeAssetIndex(input.basePath, {
    version: 1,
    folders: Array.from(folderMap.values()),
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
