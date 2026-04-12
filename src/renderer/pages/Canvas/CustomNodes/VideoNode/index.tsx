import { type NodeProps, Position } from "@xyflow/react";
import { memo, useCallback, useMemo } from "react";
import type { VideoNodeType } from "shared/types/flow";
import { cn } from "shared/utils/utils";
import { ButtonHandle } from "@/components/button-handle";
import { NodeContextMenu } from "@/pages/Canvas/components/NodeContextMenu";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { VideoContent } from "./VideoContent";
import { VideoPromptPanel } from "./VideoPromptPanel";
import { VideoToolbar } from "./VideoToolbar";

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
    const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode);
    const deleteNode = useCanvasFlowStore((state) => state.deleteNode);
    const separateToNodes = useCanvasFlowStore(
      (state) => state.separateToNodes,
    );
    const highlightedSourceNodeIds = useCanvasFlowStore(
      (state) => state.highlightedSourceNodeIds,
    );
    // 从 store 直接读取选中节点数量，避免 O(n²) 遍历
    const selectedNodesCount = useCanvasFlowStore(
      (state) => state.selectedNodesCount,
    );

    // 使用 useMemo 缓存样式类名
    const handleVisibilityClass = useMemo(
      () =>
        selected
          ? "visible opacity-100"
          : "invisible opacity-0 group-hover/node:visible group-hover/node:opacity-100",
      [selected],
    );

    // 使用 useMemo 缓存工具栏显示条件
    const shouldShowToolbar = useMemo(
      () => selected && !isDragging && selectedNodesCount <= 1,
      [selected, isDragging, selectedNodesCount],
    );

    const isSourceHighlighted = useMemo(() => {
      return highlightedSourceNodeIds.includes(id);
    }, [highlightedSourceNodeIds, id]);

    // 缓存回调函数
    const handleDuplicate = useCallback(() => {
      duplicateNode(id);
    }, [duplicateNode, id]);

    const handleDelete = useCallback(() => {
      deleteNode(id);
    }, [deleteNode, id]);

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
      >
        <div className="group/node relative">
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

          {/* 顶部工具栏：放在节点几何空间内，缩放时自动保持一致 */}
          {/* 使用 CSS 控制显隐，避免条件渲染导致 DOM 销毁重建 */}
          <div
            className={cn(
              "nodrag nopan nowheel absolute -top-12 left-1/2 z-50 -translate-x-1/2 transition-opacity duration-200",
              shouldShowToolbar ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none",
            )}
          >
            <VideoToolbar nodeId={id} data={data} onDelete={handleDelete} />
          </div>

          <div
            className={cn(
              "group/card relative flex w-87.5 h-62.5 flex-col rounded-xl border bg-linear-to-br from-[#141418] to-[#0d0d10] transition-all duration-300 ease-out",
              selected
                ? "border-[#B43FEB]/80 shadow-[0_0_25px_rgba(180,63,235,0.4),0_0_50px_rgba(180,63,235,0.15)] ring-1 ring-[#B43FEB]/30"
                : isSourceHighlighted
                  ? "border-[#B43FEB]/65 shadow-[0_0_18px_rgba(180,63,235,0.28),0_0_36px_rgba(180,63,235,0.12)] ring-1 ring-[#B43FEB]/20"
                  : "border-white/6 hover:border-white/12 hover:bg-linear-to-br hover:from-[#18181c] hover:to-[#101014]",
            )}
          >
            {/* 选中状态角落装饰 */}
            {selected && (
              <>
                <div className="absolute -top-px -left-px w-4 h-4 border-l-2 border-t-2 border-[#B43FEB] rounded-tl-xl" />
                <div className="absolute -top-px -right-px w-4 h-4 border-r-2 border-t-2 border-[#B43FEB] rounded-tr-xl" />
                <div className="absolute -bottom-px -left-px w-4 h-4 border-l-2 border-b-2 border-[#B43FEB] rounded-bl-xl" />
                <div className="absolute -bottom-px -right-px w-4 h-4 border-r-2 border-b-2 border-[#B43FEB] rounded-br-xl" />
              </>
            )}

            {/* 扫光效果 */}
            <div className="pointer-events-none absolute inset-0 rounded-xl bg-linear-to-tr from-transparent via-white/2 to-transparent opacity-0 transition-opacity duration-500 group-hover/card:opacity-100" />

            {/* 视频内容区 */}
            <div className="relative flex h-full w-full overflow-hidden rounded-lg bg-black/30">
              <VideoContent data={data} />
            </div>
          </div>

          {/* 底部增强输入区：放在节点几何空间内，缩放时自动保持一致 */}
          {/* 使用 CSS 控制显隐，避免条件渲染导致 DOM 销毁重建 */}
          <div
            className={cn(
              "nodrag nopan nowheel absolute top-full left-1/2 z-50 mt-4 w-175 -translate-x-1/2 transition-opacity duration-200",
              shouldShowToolbar ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none",
            )}
          >
            <VideoPromptPanel nodeId={id} />
          </div>
        </div>
      </NodeContextMenu>
    );
  },
);

VideoNode.displayName = "VideoNode";
