import type { VideoGenerationNode } from '@/types/flow'

/**
 * 视频生成 Payload 构建策略接口
 * 每个视频模型实现自己的 payload 构建逻辑
 */
export interface VideoPayloadStrategy {
  model: string
  buildPayload: (nodeData: VideoGenerationNode, inputs: { prompt: string; imageUrls: string[] }) => Record<string, unknown>
}

/**
 * Grok Video 3 策略
 * 字段映射：图片字段使用 images
 */
const grokVideoStrategy: VideoPayloadStrategy = {
  model: 'grok-video-3',
  buildPayload: (nodeData, { prompt, imageUrls }) => ({
    model: 'grok-video-3',
    prompt,
    images: imageUrls,
    aspect_ratio: nodeData.aspect_ratio,
    duration: nodeData.duration,
    metadata: {
      resolution: nodeData.metadata?.resolution,
    },
  }),
}

/**
 * Doubao Seedance 1.5 Pro 策略
 * 字段映射：图片字段使用 image_urls，支持 audio、camerafixed
 */
const doubaoSeedanceStrategy: VideoPayloadStrategy = {
  model: 'doubao-seedance-1-5-pro',
  buildPayload: (nodeData, { prompt, imageUrls }) => ({
    model: 'doubao-seedance-1-5-pro',
    prompt,
    image_urls: imageUrls,
    aspect_ratio: nodeData.aspect_ratio,
    duration: nodeData.duration,
    metadata: {
      resolution: nodeData.metadata?.resolution,
      seed: nodeData.metadata?.seed,
      audio: nodeData.audio,
      camerafixed: nodeData.camerafixed,
    },
    audio: nodeData.audio,
    camerafixed: nodeData.camerafixed,
  }),
}

/**
 * 策略注册表
 */
export const videoPayloadStrategies: Record<string, VideoPayloadStrategy> = {
  'grok-video-3': grokVideoStrategy,
  'doubao-seedance-1-5-pro': doubaoSeedanceStrategy,
}

/**
 * 获取指定模型的 payload 构建策略
 */
export const getVideoPayloadStrategy = (model: string): VideoPayloadStrategy => {
  const strategy = videoPayloadStrategies[model]
  if (!strategy) {
    throw new Error(`不支持的视频模型: ${model}`)
  }
  return strategy
}
