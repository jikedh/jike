import { GenerationStatus } from "shared/constants/enum";
import type { VideoGenerationNode } from "shared/types/flow";
import { CollapsibleVideoGallery } from "./CollapsibleVideoGallery";

type VideoContentProps = {
  data: VideoGenerationNode;
  onRetry?: () => void;
  nodeId?: string;
  updateVideoNodeData?: (nodeId: string, patch: any) => void;
};

export const VideoContent = ({ data, onRetry, nodeId, updateVideoNodeData }: VideoContentProps) => {
  // 结果视频列表（支持多个），保留原始对象结构用于排序
  const videos = data.result?.data?.filter((item) => item?.url) ?? [];
  const status = data.status ?? GenerationStatus.COMPLETED;
  const progress = data.progress ?? 0;
  const error = data.error;

  // 判断是否应该显示失败状态：
  // 1. 状态明确为 failed（API 返回失败）
  // 2. 有错误信息且不是进行中/排队状态
  // 注意：新创建的节点默认 status 是 COMPLETED，但没有 videos 时应该显示"暂无视频"而非失败
  const hasError = Boolean(
    error?.message || error?.detail || error?.serverMessage,
  );
  const isExplicitlyFailed = status === GenerationStatus.FAILED;

  if (
    isExplicitlyFailed ||
    (hasError &&
      status !== GenerationStatus.IN_PROGRESS &&
      status !== GenerationStatus.QUEUED)
  ) {
    const displayMessage =
      error?.detail ||
      error?.serverMessage ||
      error?.message ||
      "生成失败，请稍后再试";

    return (
      <div className="nopan h-full w-full flex flex-col items-center justify-center p-4 text-center bg-destructive/5">
        <div className="text-sm font-medium text-destructive mb-2">
          生成失败
        </div>
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
    );
  }

  if (
    status === GenerationStatus.IN_PROGRESS ||
    status === GenerationStatus.QUEUED
  ) {
    return (
      <div className="nopan h-full w-full flex flex-col items-center justify-center p-4 bg-muted/20">
        <div className="relative w-8 h-8 mb-3">
          <div className="absolute inset-0 border-2 border-primary/30 rounded-full"></div>
          <div className="absolute inset-0 border-2 border-transparent border-t-primary rounded-full animate-spin"></div>
        </div>
        <div className="text-xs text-muted-foreground">生成中...</div>
      </div>
    );
  }

  // 已完成状态
  if (videos.length > 0) {
    return (
      <CollapsibleVideoGallery
        videos={videos}
        nodeId={nodeId}
        updateVideoNodeData={updateVideoNodeData}
      />
    );
  }

  // 空状态
  return (
    <div className="nopan h-full w-full flex items-center justify-center p-4 text-center text-muted-foreground text-sm bg-muted/10">
      暂无视频
    </div>
  );
};
