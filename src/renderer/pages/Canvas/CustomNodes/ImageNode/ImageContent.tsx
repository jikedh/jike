import { memo } from "react";
import { GenerationStatus } from "shared/constants/enum";
import type { ImageGenerationNode } from "shared/types/flow";
import { assignMissingMediaSequences } from "shared/utils/mediaSequence";
import { CollapsibleImageGallery } from "./CollapsibleImageGallery";

type ImageContentProps = {
  data: ImageGenerationNode;
  onRetry?: () => void;
  onReorder?: (fromIndex: number) => void;
  nodeId?: string;
  updateImageNodeData?: (nodeId: string, patch: any) => void;
  onGalleryExpandedChange?: (expanded: boolean) => void;
  isNodeActive?: boolean;
  isUploading?: boolean;
  frameSize?: {
    width: number;
    height: number;
  };
};

/**
 * 图片节点内容渲染组件
 * 职责：
 * - 显示生成或上传的图片
 * - 显示生成状态与进度条
 * - 处理错误状态展示
 * - 支持点击图片重新排序
 */
export const ImageContent = memo(
  ({
    data,
    onRetry,
    onReorder,
    nodeId,
    updateImageNodeData,
    onGalleryExpandedChange,
    isNodeActive = false,
    isUploading = false,
    frameSize,
  }: ImageContentProps) => {
    // 结果图片列表（支持多张），保留原始对象结构用于排序
    const images = assignMissingMediaSequences(
      data.result?.data?.filter((item) => item?.url) ?? [],
    );
    const status = data.status ?? GenerationStatus.COMPLETED;
    const progress = data.progress ?? 0;
    const error = data.error;
    const isUpload = data.isUpload ?? false;
    const hasImages = images.length > 0;

    // 错误状态
    if (status === GenerationStatus.FAILED && !hasImages) {
      const displayMessage =
        error?.detail ||
        error?.serverMessage ||
        error?.message ||
        "生成失败，请稍后再试";

      return (
        <div className="h-full w-full flex flex-col items-center justify-center p-4 text-center bg-[#141418]">
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
              className="px-2 py-1 text-xs rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
            >
              重试
            </button>
          )}
        </div>
      );
    }

    // 加载中状态
    if (
      isUploading ||
      status === GenerationStatus.IN_PROGRESS ||
      status === GenerationStatus.QUEUED
    ) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center p-4 bg-[#141418]">
          <div className="relative w-8 h-8 mb-3">
            <div className="absolute inset-0 border-2 border-primary/30 rounded-full"></div>
            <div className="absolute inset-0 border-2 border-transparent border-t-primary rounded-full animate-spin"></div>
          </div>
          <div className="text-xs font-medium text-white/75">
            {isUploading || isUpload ? "上传中..." : "生成中..."}
          </div>
        </div>
      );
    }

    // 已完成状态
    if (hasImages) {
      return (
        <CollapsibleImageGallery
          images={images}
          onReorder={onReorder}
          nodeId={nodeId}
          updateImageNodeData={updateImageNodeData}
          onExpandedChange={onGalleryExpandedChange}
          isNodeActive={isNodeActive}
          frameSize={frameSize}
        />
      );
    }

    // 空状态
    return (
      <div className="h-full w-full flex items-center justify-center p-4 text-center text-muted-foreground text-sm bg-[#121216]">
        暂无图片
      </div>
    );
  },
);

ImageContent.displayName = "ImageContent";
