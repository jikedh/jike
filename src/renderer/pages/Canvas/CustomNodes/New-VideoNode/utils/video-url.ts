import type { NewVideoGenerationNode } from "shared/types/flow";

/**
 * 从新版视频节点结果中提取 URL 列表。
 * 支持多种数据来源：
 * - result.data[].url（标准视频结果）
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
    .map((item) => item?.url)
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
 * 获取视频节点首个可用 URL。
 */
export const getPrimaryVideoUrlFromNodeData = (
  data?: Partial<NewVideoGenerationNode> | null,
) => {
  return getVideoUrlsFromNodeData(data)[0];
};
