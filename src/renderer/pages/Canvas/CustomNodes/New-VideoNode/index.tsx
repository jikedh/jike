import {
  type NodeProps,
  Position,
  useUpdateNodeInternals,
} from "@xyflow/react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { GenerationStatus } from "shared/constants/enum";
import type { NewVideoNodeType } from "shared/types/flow";
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
 * 新版视频节点入口。
 * 这里保留新版参数面板，同时把旧版成熟的尺寸同步、右键拆分和多结果承载能力补回来。
 */
const NewVideoNode = ({
  id,
  data,
  selected,
  dragging,
}: NodeProps<NewVideoNodeType>) => {
  const isDragging = Boolean(dragging);
  const [isDragUiSettled, setIsDragUiSettled] = useState(!isDragging);
  const [isGalleryExpanded, setIsGalleryExpanded] = useState(false);

  const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode);
  const deleteNode = useCanvasFlowStore((state) => state.deleteNode);
  const separateToNodes = useCanvasFlowStore((state) => state.separateToNodes);
  const updateNewVideoNodeData = useCanvasFlowStore(
    (state) => state.updateNewVideoNodeData,
  );
  const updateNodeDimensions = useCanvasFlowStore(
    (state) => state.updateNodeDimensions,
  );
  const isSourceHighlighted = useCanvasFlowStore((state) =>
    state.highlightedSourceNodeIds.includes(id),
  );

  const selectedNodesCount = useCanvasFlowStore(
    (state) => state.selectedNodesCount,
  );
  const isSelectionBoxActive = useCanvasFlowStore(
    (state) => state.isSelectionBoxActive,
  );

  const handleVisibilityClass = useMemo(
    () =>
      isGalleryExpanded
        ? "invisible opacity-0"
        : selected
        ? "visible opacity-100"
        : "invisible opacity-0 group-hover/node:visible group-hover/node:opacity-100",
    [isGalleryExpanded, selected],
  );

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

  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(id);
  }, [nodeSize.width, nodeSize.height, id, updateNodeInternals]);

  useEffect(() => {
    // React Flow 的 measured 尺寸不会自动跟随我们的内容比例，手动同步给框选、连线和命中检测使用。
    updateNodeDimensions(id, nodeSize.width, nodeSize.height);
  }, [id, nodeSize.height, nodeSize.width, updateNodeDimensions]);

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

  const shouldShowToolbar =
    selected &&
    !isSelectionBoxActive &&
    !isDragging &&
    isDragUiSettled &&
    selectedNodesCount <= 1;

  const hasMultipleResults = (data.result?.data?.length ?? 0) > 1;

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
          {/* 顶部标签用于区分新版视频节点和旧版视频节点，保持常驻显示，避免用户在画布上混淆。 */}
          <div className="pointer-events-none absolute -top-6 left-2 z-40 rounded-md border border-[#B43FEB]/35 bg-[#17131d]/95 px-2 py-0.5 text-[11px] font-medium text-[#D9A7FF] shadow-[0_4px_14px_rgba(0,0,0,0.24)]">
            新版视频
          </div>

        {shouldShowToolbar && (
          <div className="selection-box-deferred-ui nodrag nopan nowheel absolute -top-13 left-1/2 z-50 -translate-x-1/2">
            <VideoToolbar nodeId={id} data={data} onDelete={handleDelete} />
          </div>
        )}

        <ButtonHandle
          type="target"
          position={Position.Left}
          id="input"
          visible
          className={`transition-opacity duration-150 ${handleVisibilityClass}`}
        />

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
          {selected && !isDragging && (
            <>
              <div className="absolute -top-px -left-px w-4 h-4 border-l-2 border-t-2 border-[#B43FEB] rounded-tl-xl" />
              <div className="absolute -top-px -right-px w-4 h-4 border-r-2 border-t-2 border-[#B43FEB] rounded-tr-xl" />
              <div className="absolute -bottom-px -left-px w-4 h-4 border-l-2 border-b-2 border-[#B43FEB] rounded-bl-xl" />
              <div className="absolute -bottom-px -right-px w-4 h-4 border-r-2 border-b-2 border-[#B43FEB] rounded-br-xl" />
            </>
          )}

          <div
            className={cn(
              "pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-500 group-hover/card:opacity-100",
              hasMultipleResults &&
                "bg-linear-to-tr from-transparent via-white/2 to-transparent",
            )}
          />

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
              updateVideoNodeData={updateNewVideoNodeData}
              onGalleryExpandedChange={setIsGalleryExpanded}
              frameSize={{
                width: nodeSize.width,
                height: nodeSize.height,
              }}
            />
          </div>
        </div>

        <ButtonHandle
          type="source"
          position={Position.Right}
          id="output"
          visible
          className={`transition-opacity duration-150 ${handleVisibilityClass}`}
        />

        {shouldShowToolbar && (
          <div className="selection-box-deferred-ui nodrag nopan nowheel absolute top-full left-1/2 z-50 mt-4 w-175 -translate-x-1/2">
            <VideoPromptPanel nodeId={id} />
          </div>
        )}
      </div>
    </NodeContextMenu>
  );
};

export default memo(NewVideoNode);
