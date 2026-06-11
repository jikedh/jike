import { memo, useMemo } from "react";
import { GenerationStatus } from "shared/constants/enum";
import type { NewVideoGenerationNode } from "shared/types/flow";
import { assignMissingMediaSequences } from "shared/utils/mediaSequence";
import { CollapsibleVideoGallery } from "./components/CollapsibleVideoGallery";

type VideoContentProps = {
  data: NewVideoGenerationNode;
  nodeId?: string;
  updateNewVideoNodeData?: (
    nodeId: string,
    patch: Partial<NewVideoGenerationNode>,
  ) => void;
  onRetry?: () => void;
  onGalleryExpandedChange?: (expanded: boolean) => void;
  forcePosterOnly?: boolean;
  frameSize?: {
    width: number;
    height: number;
  };
};

export const VideoContent = memo(
  ({
    data,
    nodeId,
    updateNewVideoNodeData,
    onRetry,
    onGalleryExpandedChange,
    forcePosterOnly = false,
    frameSize,
  }: VideoContentProps) => {
    const status = data.status ?? GenerationStatus.COMPLETED;
    const videos = useMemo(
      () =>
        assignMissingMediaSequences(
          data.result?.data?.filter((item) => item?.url) ?? [],
        ),
      [data.result?.data],
    );
    const hasError = Boolean(
      data.error?.message || data.error?.detail || data.error?.serverMessage,
    );
    const isGenerating =
      status === GenerationStatus.IN_PROGRESS ||
      status === GenerationStatus.QUEUED;
    const isUpload = data.isUpload ?? false;

    const displayVideos = useMemo(() => {
      if (!isGenerating || videos.length === 0) {
        return videos;
      }

      return [
        {
          url: "",
          pending: true,
          sequence:
            videos.reduce(
              (max, item) => Math.max(max, Number(item.sequence) || 0),
              0,
            ) + 1,
        },
        ...videos,
      ];
    }, [isGenerating, videos]);

    if (
      status === GenerationStatus.FAILED ||
      (hasError &&
        status !== GenerationStatus.IN_PROGRESS &&
        status !== GenerationStatus.QUEUED)
    ) {
      const displayMessage =
        data.error?.detail ||
        data.error?.serverMessage ||
        data.error?.message ||
        "生成失败，请稍后再试";

      return (
        <div className="nopan flex h-full w-full flex-col items-center justify-center bg-[#141418] p-4 text-center">
          <div className="mb-2 text-sm font-medium text-destructive">
            生成失败
          </div>
          <div className="mb-3 line-clamp-3 max-w-full px-2 text-xs text-muted-foreground">
            {displayMessage}
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="nodrag rounded bg-destructive/10 px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/20"
            >
              重试
            </button>
          )}
        </div>
      );
    }

    if (displayVideos.length > 0) {
      return (
        <div className="relative h-full w-full">
          {/* 生成中也保留旧结果区，并加一个临时占位卡，让数量、序号和展开体验与旧版一致。 */}
          <CollapsibleVideoGallery
            videos={displayVideos}
            nodeId={nodeId}
            updateNewVideoNodeData={updateNewVideoNodeData}
            onExpandedChange={onGalleryExpandedChange}
            forcePosterOnly={forcePosterOnly}
            frameSize={frameSize}
          />
        </div>
      );
    }

    if (isGenerating) {
      return (
        <div className="nopan flex h-full w-full flex-col items-center justify-center bg-[#141418] p-4">
          <div className="relative mb-3 h-8 w-8">
            <div className="absolute inset-0 rounded-full border-2 border-primary/30" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />
          </div>
          <div className="text-xs text-muted-foreground">
            {isUpload ? "上传中..." : "生成中..."}
          </div>
        </div>
      );
    }

    return (
      <div className="nopan flex h-full w-full items-center justify-center bg-[#121216] p-4 text-center text-sm text-muted-foreground">
        暂无视频
      </div>
    );
  },
);

VideoContent.displayName = "NewVideoContent";
