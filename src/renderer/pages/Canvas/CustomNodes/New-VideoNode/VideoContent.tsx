import { GenerationStatus } from "shared/constants/enum";
import type { NewVideoGenerationNode } from "shared/types/flow";
import { VideoPlayer } from "@/components/ui/video-player";

type VideoContentProps = {
  data: NewVideoGenerationNode;
  nodeId?: string;
  updateVideoNodeData?: (
    nodeId: string,
    patch: Partial<NewVideoGenerationNode>,
  ) => void;
  frameSize?: {
    width: number;
    height: number;
  };
};

export const VideoContent = ({
  data,
  nodeId,
  updateVideoNodeData,
  frameSize,
}: VideoContentProps) => {
  const status = data.status ?? GenerationStatus.COMPLETED;
  const videos = data.result?.data?.filter((item) => item?.url) ?? [];
  const hasError = Boolean(data.error?.message || data.error?.detail);

  // 有视频结果时展示视频
  if (videos.length > 0) {
    const firstVideo = videos[0];

    return (
      <VideoPlayer
        src={firstVideo.url}
        muted
        loop
        playsInline
        preload="metadata"
        containerClassName="h-full w-full rounded-xl bg-neutral-900"
        videoClassName="h-full w-full object-cover"
      />
    );
  }

  // 生成中状态
  if (
    status === GenerationStatus.IN_PROGRESS ||
    status === GenerationStatus.QUEUED
  ) {
    const progress = data.progress ?? 0;
    return (
      <div className="nopan h-full w-full flex flex-col items-center justify-center bg-[#141418]">
        <div className="mb-3 text-sm text-neutral-400">视频生成中...</div>
        <div className="w-48 h-1.5 bg-neutral-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#B43FEB] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-neutral-500">{progress}%</div>
      </div>
    );
  }

  // 失败状态
  if (status === GenerationStatus.FAILED || hasError) {
    return (
      <div className="nopan h-full w-full flex flex-col items-center justify-center bg-[#141418] p-4 text-center">
        <div className="mb-2 text-sm font-medium text-destructive">
          生成失败
        </div>
        <div className="text-xs text-muted-foreground line-clamp-3 max-w-full px-2">
          {data.error?.detail || data.error?.message || "请稍后再试"}
        </div>
      </div>
    );
  }

  // 默认占位状态（无真实视频数据）
  return (
    <div className="nopan h-full w-full flex flex-col items-center justify-center bg-neutral-900/50 rounded-xl border border-dashed border-neutral-700">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-800">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-neutral-500"
        >
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      </div>
      <div className="text-sm font-medium text-neutral-400">视频生成节点</div>
      <div className="mt-1 text-xs text-neutral-600">
        {frameSize ? `${frameSize.width}×${frameSize.height}` : "等待生成"}
      </div>
    </div>
  );
};
