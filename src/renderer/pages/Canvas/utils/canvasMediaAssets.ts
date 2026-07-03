import type { AssetMediaType, AssetRecord, AssetScope } from "service/assetStorage";
import type { AllNodeType } from "shared/types/flow";

type MediaItem = {
  assetName?: string;
  url?: string;
  remoteUrl?: string;
  displayUrl?: string;
  thumbnailUrl?: string;
  posterUrl?: string;
  coverUrl?: string;
};

const normalizePath = (value: string) =>
  value.trim().replace(/\\/g, "/").replace(/\/+/g, "/");

const isAbsoluteMediaUrl = (value: string) =>
  /^(https?:|file:|blob:|data:)/i.test(value.trim());

const stripQueryAndHash = (value: string) => value.split("?")[0].split("#")[0];

const getFileName = (item: MediaItem, fallback: string) => {
  const candidate =
    item.assetName ||
    item.remoteUrl ||
    item.url ||
    item.displayUrl ||
    fallback;

  const clean = decodeURIComponent(stripQueryAndHash(candidate));
  return clean.split(/[\\/]/).pop() || fallback;
};

const getNodeMediaType = (node: AllNodeType): AssetMediaType | null => {
  if (node.type === "imageNode") return "image";
  if (node.type === "newVideoNode") return "video";
  if (node.type === "audioNode") return "audio";
  return null;
};

const getDisplayUrl = (item: MediaItem) =>
  item.thumbnailUrl ||
  item.posterUrl ||
  item.coverUrl ||
  item.displayUrl ||
  item.remoteUrl ||
  item.url ||
  "";

const getCoverUrl = (item: MediaItem) =>
  item.thumbnailUrl || item.posterUrl || item.coverUrl || "";

const getDedupKey = (item: MediaItem) => {
  const sourceUrl = item.remoteUrl || item.url || item.displayUrl;
  if (sourceUrl) return `url:${sourceUrl.trim()}`;

  return "";
};

const getAssetDedupKey = (asset: AssetRecord) => {
  const sourcePath = asset.originalFile || asset.fileUrl;
  if (sourcePath && !isAbsoluteMediaUrl(sourcePath)) {
    return `local:${normalizePath(sourcePath).toLowerCase()}`;
  }

  const sourceUrl = asset.originalFile || asset.fileUrl;
  if (sourceUrl) return `url:${sourceUrl.trim()}`;

  return "";
};

const getSourcePath = (item: MediaItem) =>
  item.remoteUrl || item.url || item.displayUrl || "";

const getMediaItems = (node: AllNodeType): MediaItem[] => {
  const data = node.data as Record<string, any>;
  const resultData = data.result?.data;
  return Array.isArray(resultData)
    ? resultData.filter((item): item is MediaItem =>
      Boolean(
        item &&
        typeof item === "object" &&
        (item.url || item.remoteUrl || item.displayUrl),
      ),
    )
    : [];
};

const buildMediaAssets = (
  nodes: AllNodeType[],
  scope: Exclude<AssetScope, "public">,
  projectId?: string | null,
  idPrefix = "canvas-media",
): AssetRecord[] => {
  const seen = new Set<string>();
  const assets: AssetRecord[] = [];
  const orderedNodes = scope === "canvas" ? [...nodes].reverse() : nodes;

  for (const node of orderedNodes) {
    const mediaType = getNodeMediaType(node);
    if (!mediaType) continue;

    const nodeName = String((node.data as any)?.nickname || "").trim();

    for (const item of getMediaItems(node)) {
      const key = getDedupKey(item);
      if (!key || seen.has(key)) continue;

      const displayUrl = getDisplayUrl(item);
      const sourcePath = getSourcePath(item);
      if (!displayUrl && !sourcePath) continue;

      seen.add(key);

      const name = getFileName(item, nodeName || mediaType);
      const now = new Date().toISOString();
      const coverUrl = mediaType === "video" ? getCoverUrl(item) : "";
      const fileUrl =
        mediaType === "video" ? sourcePath || displayUrl : displayUrl || sourcePath;

      assets.push({
        id: `${idPrefix}-${projectId || "unknown"}-${mediaType}-${assets.length}`,
        name,
        scope,
        category: mediaType,
        mediaType,
        fileUrl,
        originalFile: sourcePath || fileUrl,
        ...(coverUrl ? { coverUrl } : {}),
        metadataFile: "",
        projectId: projectId || undefined,
        source: {
          type: "canvas",
          projectId: projectId || undefined,
          nodeId: node.id,
        },
        createdAt: now,
        updatedAt: now,
        tags: [],
      });
    }
  }

  return assets;
};

export const buildCanvasMediaAssets = (
  nodes: AllNodeType[],
  projectId?: string | null,
): AssetRecord[] =>
  buildMediaAssets(nodes, "canvas", projectId, "canvas-media");

export const buildProjectMediaAssets = (
  nodes: AllNodeType[],
  projectId?: string | null,
): AssetRecord[] =>
  buildMediaAssets(nodes, "project", projectId, "project-media");

export const isAbsoluteCanvasMediaUrl = isAbsoluteMediaUrl;

export const removeCanvasMediaAssetsFromNodes = (
  nodes: AllNodeType[],
  assets: AssetRecord[],
): { nodes: AllNodeType[]; removedCount: number } => {
  const targetKeys = new Set(
    assets
      .filter((asset) => asset.scope === "canvas" || asset.source?.type === "canvas")
      .map(getAssetDedupKey)
      .filter(Boolean),
  );

  if (targetKeys.size === 0) {
    return { nodes, removedCount: 0 };
  }

  let removedCount = 0;

  const nextNodes = nodes.map((node) => {
    if (!getNodeMediaType(node)) return node;

    const data = node.data as Record<string, any>;
    const resultData = data.result?.data;
    if (!Array.isArray(resultData)) return node;

    const nextData = resultData.filter((item) => {
      const key = getDedupKey(item);
      const shouldRemove = Boolean(key && targetKeys.has(key));
      if (shouldRemove) {
        removedCount += 1;
      }
      return !shouldRemove;
    });

    if (nextData.length === resultData.length) return node;

    return {
      ...node,
      data: {
        ...node.data,
        result: {
          ...data.result,
          data: nextData,
        },
      },
    } as AllNodeType;
  });

  return { nodes: nextNodes, removedCount };
};

export const renameCanvasMediaAssetInNodes = (
  nodes: AllNodeType[],
  asset: AssetRecord,
  name: string,
): { nodes: AllNodeType[]; renamedCount: number } => {
  const nextName = name.trim();
  const targetKey = getAssetDedupKey(asset);
  if (!nextName || !targetKey) {
    return { nodes, renamedCount: 0 };
  }

  let renamedCount = 0;

  const nextNodes = nodes.map((node) => {
    if (!getNodeMediaType(node)) return node;

    const data = node.data as Record<string, any>;
    const resultData = data.result?.data;
    if (!Array.isArray(resultData)) return node;

    let nodeRenamed = false;
    const nextData = resultData.map((item) => {
      const key = getDedupKey(item);
      if (!key || key !== targetKey) return item;

      renamedCount += 1;
      nodeRenamed = true;
      return {
        ...item,
        assetName: nextName,
      };
    });

    if (!nodeRenamed) return node;

    return {
      ...node,
      data: {
        ...node.data,
        result: {
          ...data.result,
          data: nextData,
        },
      },
    } as AllNodeType;
  });

  return { nodes: nextNodes, renamedCount };
};
