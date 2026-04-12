import { type NodeProps, NodeResizer, Position } from "@xyflow/react";
import { memo } from "react";
import type { NoteNodeType } from "shared/types/flow";
import { cn } from "shared/utils/utils";
import { ButtonHandle } from "@/components/button-handle";
import { NodeContextMenu } from "@/pages/Canvas/components/NodeContextMenu";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

import { NoteContent } from "./NoteContent";

// NoteNode：文本节点实现，包含节点外壳和内容编辑区域
export const NoteNode = memo(
  ({
    id,
    data,
    selected,
    width,
    height,
    dragging,
  }: NodeProps<NoteNodeType>) => {
    const setNoteNodeEditing = useCanvasFlowStore(
      (state) => state.setNoteNodeEditing,
    );
    const updateNoteNodeContent = useCanvasFlowStore(
      (state) => state.updateNoteNodeContent,
    );
    const resizeNoteNode = useCanvasFlowStore((state) => state.resizeNoteNode);
    const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode);
    const deleteNode = useCanvasFlowStore((state) => state.deleteNode);
    const isDragging = Boolean(dragging);

    const handleVisibilityClass = selected
      ? "visible opacity-100"
      : "invisible opacity-0 group-hover/node:visible group-hover/node:opacity-100";

    return (
      <NodeContextMenu
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
      >
        <div className="group/node relative">
          <NodeResizer
            isVisible={selected && !isDragging}
            lineClassName="!border !border-[#B43FEB]/50 !rounded-xl"
            handleClassName="!w-5 !h-5 !bg-transparent !border-0"
            onResizeEnd={(_, { width, height }) => {
              resizeNoteNode(id, width, height);
            }}
          />

          {/* 左侧输入 Handle：用于接收其他节点连接。 */}
          <ButtonHandle
            type="target"
            position={Position.Left}
            id="input"
            visible
            className={`${handleVisibilityClass}`}
          />

          {/* 右侧输出 Handle：用于连接到其他节点。 */}
          <ButtonHandle
            type="source"
            position={Position.Right}
            id="output"
            visible
            className={` ${handleVisibilityClass}`}
          />

          <div
            style={{
              width,
              height,
            }}
            className={cn(
              "group/card relative flex h-full w-full flex-col rounded-xl border bg-gradient-to-br ",
              selected
                ? "shadow-[0_0_25px_rgba(180,63,235,0.4),0_0_50px_rgba(180,63,235,0.15)] ring-2 ring-[#B43FEB]/50"
                : "border-white/[0.06] hover:border-white/[0.12] hover:bg-gradient-to-br hover:from-[#18181c] hover:to-[#101014]",
            )}
          >
            {/* 节点外壳区域 - 可拖拽 */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] cursor-grab active:cursor-grabbing">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-[#B43FEB]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="text-sm font-medium text-white">
                  文本节点
                </span>
              </div>
            </div>

            {/* 内容区域 - 可编辑 */}
            <div className="nowheel flex h-full w-full overflow-hidden rounded-b-xl">
              <NoteContent
                content={data.content}
                isEditing={Boolean(data.isEditing)}
                isSelected={selected}
                onStartEdit={() => {
                  setNoteNodeEditing(id, true);
                }}
                onStopEdit={() => {
                  setNoteNodeEditing(id, false);
                }}
                onContentBlur={(value) => {
                  updateNoteNodeContent(id, value);
                }}
              />
            </div>
          </div>
        </div>
      </NodeContextMenu>
    );
  },
);

NoteNode.displayName = "NoteNode";
