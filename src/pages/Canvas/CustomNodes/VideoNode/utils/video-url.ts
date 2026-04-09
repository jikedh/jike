import type { VideoGenerationNode } from '@/types/flow'

/**
 * 从视频节点结果中提取 URL 列表。
 * 同时检查 result.data 和 metadata.url，因为不同模型返回位置不同：
 * - doubao-seedance-1-5-pro, Veo3: URL 在 metadata.url
 * - Grok, kling-video-o1, minimax-hailuo-2-3: URL 在 result.data
 * 两者都检查，返回所有非空 URL。
 */
export const getVideoUrlsFromNodeData = (data?: Partial<VideoGenerationNode> | null) => {
  if (!data) {
    return []
  }

  const resultUrls = (data.result?.data ?? [])
    .map((item) => item?.url)
    .filter((url): url is string => Boolean(url))

  const metadataUrl = data.metadata?.url
  const legacyUrl = (data as any)?.video_url

  // 合并所有来源的 URL，去重后返回
  const allUrls = [...resultUrls]
  if (metadataUrl) allUrls.push(metadataUrl)
  if (legacyUrl) allUrls.push(legacyUrl)

  return Array.from(new Set(allUrls))
}

/**
 * 获取视频节点首个可用 URL。
 */
export const getPrimaryVideoUrlFromNodeData = (data?: Partial<VideoGenerationNode> | null) => {
  return getVideoUrlsFromNodeData(data)[0]
}
