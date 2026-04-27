import {
  type NodeProps,
  Position,
  useUpdateNodeInternals,
} from "@xyflow/react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";

import type { NewVideoNodeType } from "shared/types/flow";
import { ButtonHandle } from "@/components/button-handle";
import { getNodeSizeByAspectRatio } from "@/pages/Canvas/CustomNodes/ImageNode/utils/aspectRatioUtils";
import { NodeContextMenu } from "@/pages/Canvas/components/NodeContextMenu";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { VideoContent } from "./VideoContent";
import { VideoPromptPanel } from "./VideoPromptPanel";

const DRAG_UI_RESTORE_DELAY = 140;

/**
 * 新版视频节点入口组件 (Node Shell)
 */
const NewVideoNode = ({
  id,
  data,
  selected,
  dragging,
}: NodeProps<NewVideoNodeType>) => {
  const isDragging = Boolean(dragging);
  const [isDragUiSettled, setIsDragUiSettled] = useState(!isDragging);

  // Store actions
  const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode);
  const deleteNode = useCanvasFlowStore((state) => state.deleteNode);
  const updateVideoNodeData = useCanvasFlowStore(
    (state) => state.updateVideoNodeData,
  );

  // Handle 显示逻辑
  const handleVisibilityClass = useMemo(
    () =>
      selected
        ? "visible opacity-100"
        : "invisible opacity-0 group-hover/node:visible group-hover/node:opacity-100",
    [selected],
  );

  // 动态计算节点尺寸
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

  // 尺寸变化时通知 ReactFlow 重新计算 Handle 位置
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(id);
  }, [nodeSize.width, nodeSize.height, id, updateNodeInternals]);

  // 缓存回调
  const handleDuplicate = useCallback(() => {
    duplicateNode(id);
  }, [duplicateNode, id]);

  const handleDelete = useCallback(() => {
    deleteNode(id);
  }, [deleteNode, id]);

  const selectedNodesCount = useCanvasFlowStore((s) => s.selectedNodesCount);
  const isSelectionBoxActive = useCanvasFlowStore(
    (s) => s.isSelectionBoxActive,
  );

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

  const shouldShowToolbar =
    selected &&
    !isSelectionBoxActive &&
    !isDragging &&
    isDragUiSettled &&
    selectedNodesCount <= 1;

  return (
    <NodeContextMenu onDuplicate={handleDuplicate} onDelete={handleDelete}>
      <div
        className="group/node relative"
        style={{
          width: `${nodeSize.width}px`,
          height: `${nodeSize.height}px`,
        }}
      >
        {/* 选中态高亮：紫色边框 + 四角装饰 + 发光 */}
        <div
          className={
            selected
              ? "absolute inset-0 rounded-xl border-2 border-[#B43FEB] shadow-[0_0_20px_rgba(180,63,235,0.3)] pointer-events-none z-10"
              : "absolute inset-0 rounded-xl border border-neutral-700 pointer-events-none"
          }
        />
        {/* 左侧输入 Handle */}
        <ButtonHandle
          type="target"
          position={Position.Left}
          id="input"
          visible
          className={`transition-opacity duration-150 ${handleVisibilityClass}`}
        />

        {/* 节点内容区 */}
        <VideoContent
          data={data}
          isDragging={isDragging}
          nodeId={id}
          updateVideoNodeData={updateVideoNodeData}
          frameSize={{
            width: nodeSize.width,
            height: nodeSize.height,
          }}
        />

        {/* 右侧输出 Handle */}
        <ButtonHandle
          type="source"
          position={Position.Right}
          id="output"
          visible
          className={`transition-opacity duration-150 ${handleVisibilityClass}`}
        />

        {/* 底部面板 */}
        {shouldShowToolbar && (
          <div className="selection-box-deferred-ui absolute top-full left-1/2 z-50 mt-4 -translate-x-1/2">
            <VideoPromptPanel nodeId={id} />
          </div>
        )}
      </div>
    </NodeContextMenu>
  );
};

export default memo(NewVideoNode);
