import type { VideoGenerationNode } from '@/types/flow'

/**
 * 视频生成 Payload 构建策略接口
 * 每个视频模型实现自己的 payload 构建逻辑
 */
export interface VideoPayloadStrategy {
  model: string
  buildPayload: (nodeData: VideoGenerationNode, inputs: { prompt: string; imageUrls: string[]; videoUrls?: string[]; audioUrls?: string[] }) => Record<string, unknown>
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
 * Seedance 2.0 图像角色映射
 * 约定：按产品要求，所有参考图 role 统一使用 reference_image
 */
const buildSeedance20Images = (imageUrls: string[]) => {
  return imageUrls
    .filter((url) => Boolean(url))
    .slice(0, 9)
    .map((url) => ({
      url,
      role: 'reference_image',
    }))
}

/**
 * Seedance 2.0 视频角色映射
 * 约定：所有参考视频 role 固定为 reference_video
 */
const buildSeedance20Videos = (videoUrls: string[]) => {
  return videoUrls
    .filter((url) => Boolean(url))
    .slice(0, 3)
    .map((url) => ({
      url,
      role: 'reference_video' as const,
    }))
}

/**
 * Seedance 2.0 音频角色映射
 * 约定：所有参考音频 role 固定为 reference_audio
 */
const buildSeedance20Audios = (audioUrls: string[]) => {
  return audioUrls
    .filter((url) => Boolean(url))
    .slice(0, 3)
    .map((url) => ({
      url,
      role: 'reference_audio' as const,
    }))
}

/**
 * Doubao Seedance 2.0 策略
 * 字段映射：使用 images（对象数组），并固定 generation_type=video
 * 支持视频和音频输入（仅 pro 模式）
 * 注意：input_type、seed、web_search 固定为默认值，不暴露给用户手动填写
 */
const doubaoSeedance20Strategy: VideoPayloadStrategy = {
  model: 'doubao-seedance-2.0',
  buildPayload: (nodeData, { prompt, imageUrls, videoUrls = [], audioUrls = [] }) => {
    const mode = nodeData.metadata?.mode ?? 'fast'
    const minDuration = 4
    const maxDuration = mode === 'pro' ? 15 : 12
    const rawDuration = nodeData.duration ?? 8
    const nextDuration = Math.min(Math.max(rawDuration, minDuration), maxDuration)

    const images = buildSeedance20Images(imageUrls)
    const videos = buildSeedance20Videos(videoUrls)
    const audios = buildSeedance20Audios(audioUrls)
    const hasImages = images.length > 0
    const hasVideos = videos.length > 0
    const hasAudios = audios.length > 0
    const hasReferenceContent = hasImages || hasVideos || hasAudios

    return {
      model: 'doubao-seedance-2.0',
      prompt,
      generation_type: 'video',
      mode,
      resolution: nodeData.metadata?.resolution ?? '720p',
      ratio: nodeData.aspect_ratio ?? '16:9',
      duration: nextDuration,
      generate_audio: nodeData.metadata?.generate_audio ?? true,
      seed: -1,
      web_search: false,
      ...(hasReferenceContent ? { video_input_type: 'reference' as const } : {}),
      ...(hasImages ? { images } : {}),
      ...(hasVideos ? { videos } : {}),
      ...(hasAudios ? { audios } : {}),
    }
  },
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
 * MiniMax Hailuo 2.3 策略
 * 字段映射：model、prompt、duration、metadata
 * 严格遵循 API 字段命名：first_frame_image、prompt_optimizer、fast_pretreatment
 * 注意：参考图第一张会作为 first_frame_image 传递
 */
const minimaxHailuo23Strategy: VideoPayloadStrategy = {
  model: 'MiniMax-Hailuo-2.3',
  buildPayload: (nodeData, { prompt, imageUrls }) => ({
    model: 'MiniMax-Hailuo-2.3',
    prompt,
    duration: nodeData.duration ?? 6,
    metadata: {
      resolution: nodeData.metadata?.resolution ?? '768p',
      // 优先使用用户手动设置的 first_frame_image，否则使用参考图第一张
      first_frame_image: nodeData.metadata?.first_frame_image ?? (imageUrls.length > 0 ? imageUrls[0] : undefined),
      prompt_optimizer: nodeData.metadata?.prompt_optimizer ?? true,
      fast_pretreatment: nodeData.metadata?.fast_pretreatment ?? false,
      watermark: nodeData.metadata?.watermark ?? false,
    },
  }),
}

/**
 * 策略注册表
 */
export const videoPayloadStrategies: Record<string, VideoPayloadStrategy> = {
  'grok-video-3': grokVideoStrategy,
  'doubao-seedance-1-5-pro': doubaoSeedanceStrategy,
  'doubao-seedance-2.0': doubaoSeedance20Strategy,
  'Veo3.1-quality-official': veo3Strategy,
  'Veo3.1-fast-official': veo3Strategy,
  'kling-video-o1': klingVideoO1Strategy,
  'MiniMax-Hailuo-2.3': minimaxHailuo23Strategy,
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
