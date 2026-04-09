import { GenerationStatus } from '@/constants/enum'
import type { VideoGenerationNode } from '@/types/flow'

type VideoContentProps = {
    data: VideoGenerationNode
    onRetry?: () => void
}

export const VideoContent = ({ data, onRetry }: VideoContentProps) => {
  const videoUrl = data.result?.data?.find((item) => !!item?.url)?.url || data.metadata?.url
    const status = data.status ?? GenerationStatus.COMPLETED
    const progress = data.progress ?? 0
    const error = data.error

    if (status === GenerationStatus.FAILED) {
        const displayMessage = error?.detail || error?.serverMessage || error?.message || '生成失败，请稍后再试'

        return (
            <div className="nopan h-full w-full flex flex-col items-center justify-center p-4 text-center bg-destructive/5">
                <div className="text-sm font-medium text-destructive mb-2">生成失败</div>
                <div className="text-xs text-muted-foreground mb-3 line-clamp-3 max-w-full px-2">
                    {displayMessage}
                </div>
                {onRetry && (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="nodrag px-2 py-1 text-xs rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                    >
                        重试
                    </button>
                )}
            </div>
        )
    }

    if (status === GenerationStatus.IN_PROGRESS || status === GenerationStatus.QUEUED) {
        return (
            <div className="nopan h-full w-full flex flex-col items-center justify-center p-4 bg-muted/20">
                <div className="relative w-8 h-8 mb-3">
                    <div className="absolute inset-0 border-2 border-primary/30 rounded-full"></div>
                    <div className="absolute inset-0 border-2 border-transparent border-t-primary rounded-full animate-spin"></div>
                </div>
                <div className="text-xs text-muted-foreground">
                    生成中...
                </div>
            </div>
        )
    }

    if (videoUrl) {
        return (
            <div className="nopan nowheel h-full w-full relative group/video">
                <video
                    src={videoUrl}
                    controls
                    className="block h-full w-full object-cover object-center"
                >
                    你的浏览器不支持视频播放
                </video>
            </div>
        )
    }

    return (
        <div className="nopan h-full w-full flex items-center justify-center p-4 text-center text-muted-foreground text-sm bg-muted/10">
            暂无视频
        </div>
    )
}
