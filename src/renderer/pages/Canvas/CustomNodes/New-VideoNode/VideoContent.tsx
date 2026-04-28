import { GenerationStatus } from "shared/constants/enum";
import type { NewVideoGenerationNode } from "shared/types/flow";
import { assignMissingMediaSequences } from "shared/utils/mediaSequence";
import { CollapsibleVideoGallery } from "../VideoNode/CollapsibleVideoGallery";

type VideoContentProps = {
  data: NewVideoGenerationNode;
  nodeId?: string;
  updateVideoNodeData?: (
    nodeId: string,
    patch: Partial<NewVideoGenerationNode>,
  ) => void;
  onRetry?: () => void;
  onGalleryExpandedChange?: (expanded: boolean) => void;
  frameSize?: {
    width: number;
    height: number;
  };
};

export const VideoContent = ({
  data,
  nodeId,
  updateVideoNodeData,
  onRetry,
  onGalleryExpandedChange,
  frameSize,
}: VideoContentProps) => {
  const status = data.status ?? GenerationStatus.COMPLETED;
  // 新版生成支持多任务，内容区必须展示完整结果列表，而不是只取第一个视频。
  const videos = assignMissingMediaSequences(
    data.result?.data?.filter((item) => item?.url) ?? [],
  );
  const hasError = Boolean(
    data.error?.message || data.error?.detail || data.error?.serverMessage,
  );

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

  if (
    status === GenerationStatus.IN_PROGRESS ||
    status === GenerationStatus.QUEUED
  ) {
    const progress = data.progress ?? 0;
    return (
      <div className="nopan flex h-full w-full flex-col items-center justify-center bg-[#141418] p-4">
        <div className="relative mb-3 h-8 w-8">
          <div className="absolute inset-0 rounded-full border-2 border-primary/30" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />
        </div>
        <div className="mb-2 text-xs text-muted-foreground">生成中...</div>
        <div className="h-1.5 w-48 overflow-hidden rounded-full bg-neutral-700">
          <div
            className="h-full bg-[#B43FEB] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-neutral-500">{progress}%</div>
      </div>
    );
  }

  if (videos.length > 0) {
    return (
      <CollapsibleVideoGallery
        videos={videos}
        nodeId={nodeId}
        updateVideoNodeData={updateVideoNodeData}
        onExpandedChange={onGalleryExpandedChange}
        frameSize={frameSize}
      />
    );
  }

  return (
    <div className="nopan flex h-full w-full items-center justify-center bg-[#121216] p-4 text-center text-sm text-muted-foreground">
      暂无视频
    </div>
  );
};
