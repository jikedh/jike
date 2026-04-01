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
 * Veo 3 策略
 * 字段映射：model、prompt、duration、size、resolution、image_urls（首帧参考图）
 * metadata 包含 generateAudio、negativePrompt、personGeneration、referenceImages、
 * compressionQuality、resizeMode 等扩展参数
 */
const veo3Strategy: VideoPayloadStrategy = {
  model: 'Veo3.1-quality-official',
  buildPayload: (nodeData, { prompt, imageUrls }) => ({
    model: nodeData.model ?? 'Veo3.1-quality-official',
    prompt,
    duration: nodeData.duration,
    size: nodeData.aspect_ratio,
    resolution: nodeData.metadata?.resolution ?? '720p',
    image_urls: imageUrls.length > 0 ? [imageUrls[0]] : undefined,
    metadata: {
      generateAudio: nodeData.metadata?.generateAudio,
      negativePrompt: nodeData.metadata?.negativePrompt,
      personGeneration: nodeData.metadata?.personGeneration,
      referenceImages: nodeData.metadata?.referenceImages,
      compressionQuality: nodeData.metadata?.compressionQuality,
      resizeMode: nodeData.metadata?.resizeMode,
    },
  }),
}

/**
 * Kling Video O1 策略
 * 字段映射：model、prompt、mode、duration、aspect_ratio、image_urls、video_list、metadata
 */
const klingVideoO1Strategy: VideoPayloadStrategy = {
  model: 'kling-video-o1',
  buildPayload: (nodeData, { prompt, imageUrls }) => ({
    model: 'kling-video-o1',
    prompt,
    mode: nodeData.metadata?.mode ?? 'std',
    duration: nodeData.duration ?? 5,
    aspect_ratio: nodeData.aspect_ratio ?? '16:9',
    image_urls: imageUrls.length > 0 ? imageUrls : undefined,
    video_list: nodeData.metadata?.video_list,
    metadata: {
      watermark: nodeData.metadata?.watermark,
    },
  }),
}

/**
 * 策略注册表
 */
export const videoPayloadStrategies: Record<string, VideoPayloadStrategy> = {
  'grok-video-3': grokVideoStrategy,
  'doubao-seedance-1-5-pro': doubaoSeedanceStrategy,
  'Veo3.1-quality-official': veo3Strategy,
  'Veo3.1-fast-official': veo3Strategy,
  'kling-video-o1': klingVideoO1Strategy,
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
