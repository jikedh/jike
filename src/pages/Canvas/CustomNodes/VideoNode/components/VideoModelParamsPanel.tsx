import { Seedance15ProParamsPanel } from './Seedance15ProParamsPanel'
import { GrokVideoParamsPanel } from './GrokVideoParamsPanel'
import { Veo3ParamsPanel } from './Veo3ParamsPanel'
import { KlingVideoO1ParamsPanel } from './KlingVideoO1ParamsPanel'
import { MinimaxHailuo23ParamsPanel } from './MinimaxHailuo23ParamsPanel'
import { Seedance20ParamsPanel } from './Seedance20ParamsPanel'
import { clampSeedance20Duration } from '@/lib/utils'

/**
 * 视频模型参数面板分发组件。
 * 使用映射表组合模型和参数面板，减少容器层条件分支长度。
 */
export const VideoModelParamsPanel = ({
    model,
    currentVideoData,
    aspectRatio,
    videoSize,
    duration,
    resolution,
    seed,
    audio,
    camerafixed,
    seedance20Metadata,
    onPatch,
}: {
    model: string
    currentVideoData: any
    aspectRatio: string
    videoSize: string
    duration: number
    resolution: string
    seed: number
    audio: boolean
    camerafixed: boolean
    seedance20Metadata: any
    onPatch: (patch: any) => void
}) => {
    const renderers = {
        'grok-video-3': () => (
            <GrokVideoParamsPanel
                aspectRatio={aspectRatio}
                duration={duration}
                resolution={resolution}
                onAspectRatioChange={(value) => onPatch({ aspect_ratio: value })}
                onDurationChange={(value) => onPatch({ duration: value })}
                onResolutionChange={(value) => {
                    onPatch({
                        metadata: {
                            ...(currentVideoData?.metadata ?? {}),
                            resolution: value,
                        },
                    })
                }}
            />
        ),
        'kling-video-o1': () => (
            <KlingVideoO1ParamsPanel
                mode={currentVideoData?.metadata?.mode}
                duration={currentVideoData?.duration}
                aspectRatio={aspectRatio}
                watermark={currentVideoData?.metadata?.watermark}
                videoList={currentVideoData?.metadata?.video_list}
                onModeChange={(value) => {
                    onPatch({
                        metadata: {
                            ...(currentVideoData?.metadata ?? {}),
                            mode: value,
                        },
                    })
                }}
                onDurationChange={(value) => onPatch({ duration: value })}
                onAspectRatioChange={(value) => onPatch({ aspect_ratio: value })}
                onWatermarkChange={(value) => {
                    onPatch({
                        metadata: {
                            ...(currentVideoData?.metadata ?? {}),
                            watermark: value,
                        },
                    })
                }}
                onVideoListChange={(value) => {
                    onPatch({
                        metadata: {
                            ...(currentVideoData?.metadata ?? {}),
                            video_list: value,
                        },
                    })
                }}
            />
        ),
        'MiniMax-Hailuo-2.3': () => (
            <MinimaxHailuo23ParamsPanel
                duration={currentVideoData?.duration}
                metadata={currentVideoData?.metadata}
                onDurationChange={(value) => onPatch({ duration: value })}
                onMetadataChange={(metadata) => {
                    onPatch({ metadata })
                }}
            />
        ),
        'doubao-seedance-2.0': () => (
            <Seedance20ParamsPanel
                mode={(seedance20Metadata.mode as 'fast' | 'pro' | undefined) ?? 'fast'}
                duration={currentVideoData?.duration}
                aspectRatio={aspectRatio}
                resolution={(seedance20Metadata.resolution as '480p' | '720p' | undefined) ?? '720p'}
                generateAudio={seedance20Metadata.generate_audio}
                onModeChange={(value) => {
                    const nextDuration = clampSeedance20Duration(currentVideoData?.duration ?? 8, value)
                    onPatch({
                        duration: nextDuration,
                        metadata: {
                            ...seedance20Metadata,
                            mode: value,
                        },
                    })
                }}
                onDurationChange={(value) => {
                    const currentMode = (currentVideoData?.metadata?.mode ?? 'fast') as 'fast' | 'pro'
                    onPatch({
                        duration: clampSeedance20Duration(value, currentMode),
                    })
                }}
                onAspectRatioChange={(value) => onPatch({ aspect_ratio: value })}
                onResolutionChange={(value) => {
                    onPatch({
                        metadata: {
                            ...seedance20Metadata,
                            resolution: value,
                        },
                    })
                }}
                onGenerateAudioChange={(value) => {
                    onPatch({
                        metadata: {
                            ...seedance20Metadata,
                            generate_audio: value,
                        },
                    })
                }}
            />
        ),
        default: () => (
            <Seedance15ProParamsPanel
                aspectRatio={aspectRatio}
                videoSize={videoSize}
                duration={duration}
                resolution={resolution}
                seed={seed}
                audio={audio}
                camerafixed={camerafixed}
                onAspectRatioChange={(value) => onPatch({ aspect_ratio: value })}
                onVideoSizeChange={(value) => {
                    onPatch({
                        metadata: {
                            ...(currentVideoData?.metadata ?? {}),
                            size: value,
                        },
                    })
                }}
                onDurationChange={(value) => onPatch({ duration: value })}
                onResolutionChange={(value) => {
                    onPatch({
                        metadata: {
                            ...(currentVideoData?.metadata ?? {}),
                            resolution: value,
                        },
                    })
                }}
                onSeedChange={(value) => {
                    onPatch({
                        metadata: {
                            ...(currentVideoData?.metadata ?? {}),
                            seed: value,
                        },
                    })
                }}
                onAudioChange={(value) => onPatch({ audio: value })}
                onCameraFixedChange={(value) => onPatch({ camerafixed: value })}
            />
        ),
    } as const

    if (model.startsWith('Veo3')) {
        return (
            <Veo3ParamsPanel
                aspectRatio={aspectRatio}
                duration={duration}
                resolution={resolution}
                generateAudio={currentVideoData?.metadata?.generateAudio}
                negativePrompt={currentVideoData?.metadata?.negativePrompt}
                personGeneration={currentVideoData?.metadata?.personGeneration}
                referenceImages={currentVideoData?.metadata?.referenceImages}
                compressionQuality={currentVideoData?.metadata?.compressionQuality}
                resizeMode={currentVideoData?.metadata?.resizeMode}
                onAspectRatioChange={(value) => onPatch({ aspect_ratio: value })}
                onDurationChange={(value) => onPatch({ duration: value })}
                onResolutionChange={(value) => {
                    onPatch({
                        metadata: {
                            ...(currentVideoData?.metadata ?? {}),
                            resolution: value,
                        },
                    })
                }}
                onGenerateAudioChange={(value) => {
                    onPatch({
                        metadata: {
                            ...(currentVideoData?.metadata ?? {}),
                            generateAudio: value,
                        },
                    })
                }}
                onNegativePromptChange={(value) => {
                    onPatch({
                        metadata: {
                            ...(currentVideoData?.metadata ?? {}),
                            negativePrompt: value,
                        },
                    })
                }}
                onPersonGenerationChange={(value) => {
                    onPatch({
                        metadata: {
                            ...(currentVideoData?.metadata ?? {}),
                            personGeneration: value,
                        },
                    })
                }}
                onReferenceImagesChange={(value) => {
                    onPatch({
                        metadata: {
                            ...(currentVideoData?.metadata ?? {}),
                            referenceImages: value,
                        },
                    })
                }}
                onCompressionQualityChange={(value) => {
                    onPatch({
                        metadata: {
                            ...(currentVideoData?.metadata ?? {}),
                            compressionQuality: value,
                        },
                    })
                }}
                onResizeModeChange={(value) => {
                    onPatch({
                        metadata: {
                            ...(currentVideoData?.metadata ?? {}),
                            resizeMode: value,
                        },
                    })
                }}
            />
        )
    }

    const renderer = renderers[model as keyof typeof renderers] ?? renderers.default
    return renderer()
}
