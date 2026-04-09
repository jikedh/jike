import type { VideoGenerationNode } from '@/types/flow'

/**
 * 从视频节点结果中提取 URL 列表。
 * 优先使用标准结果结构 result.data，兼容 metadata.url 与部分历史字段。
 */
export const getVideoUrlsFromNodeData = (data?: Partial<VideoGenerationNode> | null) => {
  if (!data) {
    return []
  }

  const resultUrls = (data.result?.data ?? [])
    .map((item) => item?.url)
    .filter((url): url is string => Boolean(url))

  // 标准结构优先，避免 metadata 旧值覆盖最新结果。
  if (resultUrls.length > 0) {
    return Array.from(new Set(resultUrls))
  }

  const fallbackUrls = [
    data.metadata?.url,
    (data as any)?.video_url,
  ].filter((url): url is string => Boolean(url))

  return Array.from(new Set(fallbackUrls))
}

/**
 * 获取视频节点首个可用 URL。
 */
export const getPrimaryVideoUrlFromNodeData = (data?: Partial<VideoGenerationNode> | null) => {
  return getVideoUrlsFromNodeData(data)[0]
}
