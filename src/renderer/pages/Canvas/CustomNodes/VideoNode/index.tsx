import {
  type NodeProps,
  Position,
  useUpdateNodeInternals,
} from "@xyflow/react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { GenerationStatus } from "shared/constants/enum";
import type { VideoNodeType } from "shared/types/flow";
import { cn } from "shared/utils/utils";
import { ButtonHandle } from "@/components/button-handle";
import { getNodeSizeByAspectRatio } from "@/pages/Canvas/CustomNodes/ImageNode/utils/aspectRatioUtils";
import { NodeContextMenu } from "@/pages/Canvas/components/NodeContextMenu";
import { requestCanvasDeleteConfirm } from "@/pages/Canvas/utils/deleteConfirm";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { VideoContent } from "./VideoContent";
import { VideoPromptPanel } from "./VideoPromptPanel";
import { VideoToolbar } from "./VideoToolbar";

const DRAG_UI_RESTORE_DELAY = 140;

/**
 * 视频节点组件
 * 职责：
 * - 不支持拖拽调整尺寸，使用内容驱动与样式约束
 * - 提供左右 Handle 用于流程连接
 * - 展示视频内容、生成状态与进度
 * - 提供工具栏操作（复制、删除、重新生成）
 */
export const VideoNode = memo(
  ({ id, data, selected, dragging }: NodeProps<VideoNodeType>) => {
    const isDragging = Boolean(dragging);
    const [isDragUiSettled, setIsDragUiSettled] = useState(!isDragging);
    const [isGalleryExpanded, setIsGalleryExpanded] = useState(false);
    const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode);
    const deleteNode = useCanvasFlowStore((state) => state.deleteNode);
    const separateToNodes = useCanvasFlowStore(
      (state) => state.separateToNodes,
    );
    const isSourceHighlighted = useCanvasFlowStore((state) =>
      state.highlightedSourceNodeIds.includes(id),
    );
    const updateVideoNodeData = useCanvasFlowStore(
      (state) => state.updateVideoNodeData,
    );
    const updateNodeDimensions = useCanvasFlowStore(
      (state) => state.updateNodeDimensions,
    );
    // 从 store 直接读取选中节点数量，避免 O(n²) 遍历
    const selectedNodesCount = useCanvasFlowStore(
      (state) => state.selectedNodesCount,
    );
    const isSelectionBoxActive = useCanvasFlowStore(
      (state) => state.isSelectionBoxActive,
    );

    // 使用 useMemo 缓存样式类名
    useEffect(() => {
      if (isDragging) {
        setIsDragUiSettled(false);
        return;
      }

      const timer = window.setTimeout(() => {
        setIsDragUiSettled(true);
      }, DRAG_UI_RESTORE_DELAY);

      return () => window.clearTimeout(timer);
    }, [isDragging]);

    const handleVisibilityClass = useMemo(
      () =>
        isGalleryExpanded
          ? "invisible opacity-0"
          : selected
            ? "visible opacity-100"
            : "invisible opacity-0 group-hover/node:visible group-hover/node:opacity-100",
      [isGalleryExpanded, selected],
    );

    // 使用 useMemo 缓存工具栏显示条件
    const shouldShowToolbar = useMemo(
      () =>
        selected &&
        !isSelectionBoxActive &&
        !isDragging &&
        isDragUiSettled &&
        selectedNodesCount <= 1,
      [
        selected,
        isSelectionBoxActive,
        isDragging,
        isDragUiSettled,
        selectedNodesCount,
      ],
    );

    // 根据 data.aspect_ratio（如 "1:1", "16:9"）动态计算节点尺寸，按视频原始比例展示
    const nodeSize = useMemo(() => {
      const sizeStr = data.aspect_ratio;
      if (!sizeStr || !sizeStr.includes(":")) {
        return { width: 350, height: 250, aspectRatio: "7/5" };
      }
      const [w, h] = sizeStr.split(":").map(Number);
      if (!w || !h) {
        return { width: 350, height: 250, aspectRatio: "7/5" };
      }
      const computed = getNodeSizeByAspectRatio(sizeStr, 250);
      return {
        width: computed.width,
        height: computed.height,
        aspectRatio: `${w}/${h}`,
      };
    }, [data.aspect_ratio]);

    // 节点尺寸变化时，通知 ReactFlow 重新计算 Handle 位置，确保连线贴合节点边缘
    const updateNodeInternals = useUpdateNodeInternals();
    useEffect(() => {
      updateNodeInternals(id);
    }, [nodeSize.width, nodeSize.height, id, updateNodeInternals]);

    useEffect(() => {
      updateNodeDimensions(id, nodeSize.width, nodeSize.height);
    }, [id, nodeSize.height, nodeSize.width, updateNodeDimensions]);

    const isGenerating = useMemo(() => {
      const status = data.status ?? GenerationStatus.COMPLETED;
      return (
        status === GenerationStatus.IN_PROGRESS ||
        status === GenerationStatus.QUEUED
      );
    }, [data.status]);

    const confirmDeleteIfNeeded = useCallback(() => {
      if (!isGenerating) {
        return true;
      }

      requestCanvasDeleteConfirm({
        message: "当前视频节点还在生成中，确定要删除吗？",
        onConfirm: () => deleteNode(id),
      });
      return false;
    }, [deleteNode, id, isGenerating]);

    // 缓存回调函数
    const handleDuplicate = useCallback(() => {
      duplicateNode(id);
    }, [duplicateNode, id]);

    const handleDelete = useCallback(() => {
      if (!confirmDeleteIfNeeded()) {
        return;
      }
      deleteNode(id);
    }, [confirmDeleteIfNeeded, deleteNode, id]);

    const handleSeparateToNodes = useCallback(() => {
      separateToNodes(id);
    }, [separateToNodes, id]);

    const hasMultipleResults = (data.result?.data?.length ?? 0) > 1;

    // console.log('视频节点重新渲染', id)

    return (
      <NodeContextMenu
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onSeparateToNodes={handleSeparateToNodes}
        hasMultipleResults={hasMultipleResults}
        separateToNodesLabel="独立为视频"
      >
        <div
          className="group/node relative"
          style={{
            width: `${nodeSize.width}px`,
            height: `${nodeSize.height}px`,
          }}
        >
          {/* 顶部工具栏：放在节点几何空间内，缩放时自动保持一致 */}
          {/* 拖动结束后再挂载，降低首次拖拽时的渲染负担 */}
          {shouldShowToolbar && (
            <div className="selection-box-deferred-ui nodrag nopan nowheel absolute -top-13 left-1/2 z-50 -translate-x-1/2">
              <VideoToolbar nodeId={id} data={data} onDelete={handleDelete} />
            </div>
          )}

          <div
            className={cn(
              "group/card relative flex h-full w-full flex-col rounded-xl border",
              hasMultipleResults &&
                "bg-linear-to-br from-[#141418] to-[#0d0d10]",
              selected
                ? "border-[#B43FEB]/80 shadow-[0_0_25px_rgba(180,63,235,0.4),0_0_50px_rgba(180,63,235,0.15)] ring-1 ring-[#B43FEB]/30"
                : isSourceHighlighted
                  ? "border-[#B43FEB]/65 shadow-[0_0_18px_rgba(180,63,235,0.28),0_0_36px_rgba(180,63,235,0.12)] ring-1 ring-[#B43FEB]/20"
                  : "border-white/6 hover:border-white/12 hover:bg-linear-to-br hover:from-[#18181c] hover:to-[#101014]",
            )}
          >
            {/* 左侧输入 Handle */}
            <ButtonHandle
              type="target"
              position={Position.Left}
              id="input"
              visible
              className={`transition-opacity duration-150 ${handleVisibilityClass}`}
            />

            {/* 右侧输出 Handle */}
            <ButtonHandle
              type="source"
              position={Position.Right}
              id="output"
              visible
              className={`transition-opacity duration-150 ${handleVisibilityClass}`}
            />
            {/* 选中状态角落装饰 */}
            {selected && !isDragging && (
              <>
                <div className="absolute -top-px -left-px w-4 h-4 border-l-2 border-t-2 border-[#B43FEB] rounded-tl-xl" />
                <div className="absolute -top-px -right-px w-4 h-4 border-r-2 border-t-2 border-[#B43FEB] rounded-tr-xl" />
                <div className="absolute -bottom-px -left-px w-4 h-4 border-l-2 border-b-2 border-[#B43FEB] rounded-bl-xl" />
                <div className="absolute -bottom-px -right-px w-4 h-4 border-r-2 border-b-2 border-[#B43FEB] rounded-br-xl" />
              </>
            )}

            {/* 扫光效果 */}
            <div
              className={cn(
                "pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-500 group-hover/card:opacity-100",
                hasMultipleResults &&
                  "bg-linear-to-tr from-transparent via-white/2 to-transparent",
              )}
            />

            {/* 视频内容区 */}
            <div
              className={cn(
                "relative flex h-full w-full",
                hasMultipleResults ? "rounded-lg bg-black/30" : "rounded-xl",
                isGalleryExpanded ? "overflow-visible" : "overflow-hidden",
              )}
            >
              <VideoContent
                data={data}
                nodeId={id}
                updateVideoNodeData={updateVideoNodeData}
                onGalleryExpandedChange={setIsGalleryExpanded}
                frameSize={{
                  width: nodeSize.width,
                  height: nodeSize.height,
                }}
              />
            </div>
          </div>

          {/* 底部增强输入区：放在节点几何空间内，缩放时自动保持一致 */}
          {/* 拖动结束后再挂载，降低首次拖拽时的渲染负担 */}
          {shouldShowToolbar && (
            <div className="selection-box-deferred-ui nodrag nopan nowheel absolute top-full left-1/2 z-50 mt-4 w-175 -translate-x-1/2">
              <VideoPromptPanel nodeId={id} />
            </div>
          )}
        </div>
      </NodeContextMenu>
    );
  },
);

VideoNode.displayName = "VideoNode";
