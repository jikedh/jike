import type { NewVideoGenerationNode } from "shared/types/flow";

type VideoUrlItem = {
  url?: string;
  remoteUrl?: string;
  displayUrl?: string;
  localPath?: string;
  localName?: string;
  format?: string;
};

const getRemoteVideoUrlFromItem = (item?: VideoUrlItem | null) =>
  item?.remoteUrl || item?.url || "";

const getVideoUrlFromItem = (item?: VideoUrlItem | null) =>
  getRemoteVideoUrlFromItem(item) || item?.displayUrl || "";

/**
 * 从新版视频节点结果中提取 URL 列表。
 * 支持多种数据来源：
 * - result.data[].url（标准视频结果）
 * - result.data[].remoteUrl / displayUrl（持久化或本地显示兼容字段）
 * - metadata.url（部分模型返回）
 * - video_url（旧兼容字段）
 */
export const getVideoUrlsFromNodeData = (
  data?: Partial<NewVideoGenerationNode> | null,
) => {
  if (!data) {
    return [];
  }

  const resultUrls = (data.result?.data ?? [])
    .map((item) => getVideoUrlFromItem(item))
    .filter((url): url is string => Boolean(url));

  const metadataUrl = (data.metadata as Record<string, unknown>)?.url as
    | string
    | undefined;
  const legacyUrl = (data as Record<string, unknown>)?.video_url as
    | string
    | undefined;

  const allUrls = [...resultUrls];
  if (metadataUrl) allUrls.push(metadataUrl);
  if (legacyUrl) allUrls.push(legacyUrl);

  return Array.from(new Set(allUrls));
};

/**
 * 获取外部服务可访问的视频 URL 列表。
 * 不包含 displayUrl，因为 displayUrl 可能是 blob:/asset: 等本地展示地址。
 */
export const getRemoteVideoUrlsFromNodeData = (
  data?: Partial<NewVideoGenerationNode> | null,
) => {
  if (!data) {
    return [];
  }

  const resultUrls = (data.result?.data ?? [])
    .map((item) => getRemoteVideoUrlFromItem(item))
    .filter((url): url is string => Boolean(url));

  const metadataUrl = (data.metadata as Record<string, unknown>)?.url as
    | string
    | undefined;
  const legacyUrl = (data as Record<string, unknown>)?.video_url as
    | string
    | undefined;

  const allUrls = [...resultUrls];
  if (metadataUrl) allUrls.push(metadataUrl);
  if (legacyUrl) allUrls.push(legacyUrl);

  return Array.from(new Set(allUrls));
};

export const getVideoItemsFromNodeData = (
  data?: Partial<NewVideoGenerationNode> | null,
): VideoUrlItem[] => {
  if (!data) {
    return [];
  }

  const resultItems = (data.result?.data ?? []).filter((item) =>
    Boolean(getVideoUrlFromItem(item)),
  );
  const metadataUrl = (data.metadata as Record<string, unknown>)?.url as
    | string
    | undefined;
  const legacyUrl = (data as Record<string, unknown>)?.video_url as
    | string
    | undefined;

  const items: VideoUrlItem[] = [...resultItems];
  if (metadataUrl) items.push({ url: metadataUrl, remoteUrl: metadataUrl });
  if (legacyUrl) items.push({ url: legacyUrl, remoteUrl: legacyUrl });

  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.remoteUrl || item.url || item.displayUrl || "";
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

/**
 * 获取视频节点首个可用 URL。
 */
export const getPrimaryVideoUrlFromNodeData = (
  data?: Partial<NewVideoGenerationNode> | null,
) => {
  return getVideoUrlsFromNodeData(data)[0];
};

export const getPrimaryRemoteVideoUrlFromNodeData = (
  data?: Partial<NewVideoGenerationNode> | null,
) => {
  return getRemoteVideoUrlsFromNodeData(data)[0];
};
