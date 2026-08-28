import { IconVideo } from "@tabler/icons-react";
import {
  type NodeProps,
  Position,
  useUpdateNodeInternals
} from "@xyflow/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GenerationStatus } from "shared/constants/enum";
import type { NewVideoNodeType } from "shared/types/flow";
import { cn } from "shared/utils/utils";
import { ButtonHandle } from "@/components/button-handle";
import { getNodeSizeByAspectRatio } from "@/pages/Canvas/CustomNodes/ImageNode/utils/aspectRatioUtils";
import { dispatchCreateAssetFromNode } from "@/pages/Canvas/components/CanvasSidebar";
import { NodeContextMenu } from "@/pages/Canvas/components/NodeContextMenu";
import { requestCanvasDeleteConfirm } from "@/pages/Canvas/utils/deleteConfirm";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { NodeNameBadge } from "../shared/NodeNameBadge";
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
  const [isUploading, setIsUploading] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const primaryVideoRef = useRef<HTMLVideoElement | null>(null);

  const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode);
  const deleteNode = useCanvasFlowStore((state) => state.deleteNode);
  const updateNodeNickname = useCanvasFlowStore(
    (state) => state.updateNodeNickname,
  );
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
  // 仅订阅与当前节点相关的派生布尔值，避免其他节点的 activeNodeId 变化时整树重渲染
  const isActiveFromStore = useCanvasFlowStore(
    (state) => state.activeNodeId === id,
  );
  const hasActiveVideoTool = useCanvasFlowStore(
    (state) => state.activeVideoTool !== null,
  );

  // 只关心是否 > 1，避免选中数量变化时所有节点重渲染
  const hasMultipleSelected = useCanvasFlowStore(
    (state) => state.selectedNodesCount > 1,
  );
  const isActiveNode = isActiveFromStore && selected;

  const handleVisibilityClass = useMemo(
    () =>
      isGalleryExpanded
        ? "invisible opacity-0"
        : isActiveNode
          ? "visible opacity-100"
          : "invisible opacity-0 group-hover/node:visible group-hover/node:opacity-100",
    [isActiveNode, isGalleryExpanded],
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

  const handleRenameStart = useCallback(() => {
    if (isActiveNode) {
      setIsRenaming(true);
    }
  }, [isActiveNode]);

  const handleRename = useCallback(
    (name: string) => {
      updateNodeNickname(id, name);
    },
    [id, updateNodeNickname],
  );

  const handleSeparateToNodes = useCallback(() => {
    separateToNodes(id);
  }, [separateToNodes, id]);

  const handleEditEnd = useCallback(() => setIsRenaming(false), []);

  const handleCreateAsset = useCallback(
    () => dispatchCreateAssetFromNode(id),
    [id],
  );

  const nodeIcon = useMemo(() => <IconVideo size={14} />, []);

  const shouldShowToolbar = useMemo(
    () =>
      isActiveNode && !isDragging && isDragUiSettled && !hasMultipleSelected,
    [isActiveNode, isDragging, isDragUiSettled, hasMultipleSelected],
  );
  const shouldShowPromptPanel = isActiveNode && !hasMultipleSelected;

  // 生成中的占位卡在新版节点里也算一个视频，用于支持“1 个真实视频 + 1 个生成中占位”时独立为视频。
  const hasMultipleResults =
    (data.result?.data?.length ?? 0) + (isGenerating ? 1 : 0) > 1;
  const isUploadVideo = data.isUpload ?? false;
  const badgeLabel =
    data.nickname ??
    data.badgeLabel ??
    (isUploadVideo ? "上传视频" : "生成视频");
  const contentFrameSize = useMemo(
    () => ({
      width: nodeSize.width,
      height: nodeSize.height,
    }),
    [nodeSize.height, nodeSize.width],
  );

  return (
    <NodeContextMenu
      onDuplicate={handleDuplicate}
      onDelete={handleDelete}
      onSeparateToNodes={handleSeparateToNodes}
      onCreateAsset={handleCreateAsset}
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
        {shouldShowToolbar && (
          <div className="selection-box-deferred-ui nodrag nopan nowheel absolute -top-23 left-1/2 z-50 -translate-x-1/2">
            <VideoToolbar
              nodeId={id}
              data={data}
              onDelete={handleDelete}
              isUploading={isUploading}
              onUploadingChange={setIsUploading}
              primaryVideoRef={primaryVideoRef}
            />
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
            hasMultipleResults && "bg-linear-to-br from-[#141418] to-[#0d0d10]",
            isActiveNode
              ? "border-[#B43FEB]/80 shadow-[0_0_25px_rgba(180,63,235,0.4),0_0_50px_rgba(180,63,235,0.15)] ring-1 ring-[#B43FEB]/30"
              : isSourceHighlighted
                ? "border-[#B43FEB]/65 shadow-[0_0_18px_rgba(180,63,235,0.28),0_0_36px_rgba(180,63,235,0.12)] ring-1 ring-[#B43FEB]/20"
                : "border-white/6 hover:border-white/12 hover:bg-linear-to-br hover:from-[#18181c] hover:to-[#101014]",
          )}
        >
          <NodeNameBadge
            icon={nodeIcon}
            selected={isActiveNode}
            isEditing={isRenaming}
            onEditStart={handleRenameStart}
            onEditEnd={handleEditEnd}
            onRename={handleRename}
          >
            {badgeLabel}
          </NodeNameBadge>

          {isActiveNode && !isDragging && (
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
              updateNewVideoNodeData={updateNewVideoNodeData}
              onGalleryExpandedChange={setIsGalleryExpanded}
              isUploading={isUploading}
              forcePosterOnly={hasActiveVideoTool}
              frameSize={contentFrameSize}
              primaryVideoRef={primaryVideoRef}
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

        {shouldShowPromptPanel && !isUploadVideo && (
          <div className="selection-box-deferred-ui nodrag nopan nowheel absolute top-full left-1/2 z-50 mt-4 w-175 -translate-x-1/2">
            <VideoPromptPanel nodeId={id} />
          </div>
        )}
      </div>
    </NodeContextMenu>
  );
};

export default memo(NewVideoNode);
