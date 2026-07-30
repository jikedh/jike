import {
  type NodeProps,
  NodeResizer,
  NodeToolbar,
  Position,
} from "@xyflow/react";
import { memo, useCallback, useRef, useState } from "react";
import type { NoteNodeType } from "shared/types/flow";
import { cn } from "shared/utils/utils";
import { ButtonHandle } from "@/components/button-handle";
import { NodeContextMenu } from "@/pages/Canvas/components/NodeContextMenu";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { useNodeScale } from "@/hooks/useNodeScale";

import { NoteContent } from "./NoteContent";
import { NoteFullscreenEditor } from "./NoteFullscreenEditor";
import { NoteToolbar } from "./NoteToolbar";
import type { NoteEditorHandle } from "./NoteEditor";

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
    const updateNoteNodeHtml = useCanvasFlowStore(
      (state) => state.updateNoteNodeHtml,
    );
    const resizeNoteNode = useCanvasFlowStore((state) => state.resizeNoteNode);
    const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode);
    const deleteNode = useCanvasFlowStore((state) => state.deleteNode);
    const isActiveFromStore = useCanvasFlowStore(
      (state) => state.activeNodeId === id,
    );

    const [isFullscreen, setIsFullscreen] = useState(false);
    const editorRef = useRef<NoteEditorHandle>(null);
    const { zoom } = useNodeScale();

    const isDragging = Boolean(dragging);
    const isActiveNode = isActiveFromStore && selected;

    const handleStartEdit = useCallback(() => {
      setNoteNodeEditing(id, true);
    }, [id, setNoteNodeEditing]);

    const handleContentBlur = useCallback(
      (html: string, text: string) => {
        setNoteNodeEditing(id, false);
        updateNoteNodeContent(id, text);
        updateNoteNodeHtml(id, html);
      },
      [id, setNoteNodeEditing, updateNoteNodeContent, updateNoteNodeHtml],
    );

    const handleFullscreenClose = useCallback(
      (html: string, text: string) => {
        updateNoteNodeContent(id, text);
        updateNoteNodeHtml(id, html);
        setIsFullscreen(false);
      },
      [id, updateNoteNodeContent, updateNoteNodeHtml],
    );

    const handleCopy = useCallback(() => {
      duplicateNode(id);
    }, [duplicateNode, id]);

    const handleDelete = useCallback(() => {
      deleteNode(id);
    }, [deleteNode, id]);

    const handleFullscreen = useCallback(() => {
      setIsFullscreen(true);
    }, []);

    const handleVisibilityClass = selected
      ? "visible opacity-100"
      : "invisible opacity-0 group-hover/node:visible group-hover/node:opacity-100";

    const editor = editorRef.current?.editor ?? null;

    return (
      <>
        <NodeContextMenu
          onDuplicate={() => duplicateNode(id)}
          onDelete={() => deleteNode(id)}
        >
          <div className="group/node relative">
            <NodeResizer
              isVisible={isActiveNode && !isDragging}
              minWidth={200}
              minHeight={120}
              lineClassName="!border !border-[#B43FEB]/50 !rounded-xl"
              handleClassName="!w-5 !h-5 !bg-transparent !border-0"
              onResizeEnd={(_, { width, height }) => {
                resizeNoteNode(id, width, height);
              }}
            />

            {/* 格式工具栏 — 仅选中时显示 */}
            <NodeToolbar
              isVisible={isActiveNode && !isDragging}
              position={Position.Top}
              offset={8 * zoom}
            >
              <div
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "bottom center",
                }}
              >
                <NoteToolbar
                  editor={editor}
                  onCopy={handleCopy}
                  onDelete={handleDelete}
                  onFullscreen={handleFullscreen}
                />
              </div>
            </NodeToolbar>

            <div
              style={{ width, height }}
              className={cn(
                "group/card relative flex flex-col rounded-xl border bg-[#1f1f1f] transition-shadow duration-200",
                selected
                  ? "shadow-[0_0_25px_rgba(180,63,235,0.4),0_0_50px_rgba(180,63,235,0.15)] ring-2 ring-[#B43FEB]/50"
                  : "border-white/[0.06] hover:border-white/[0.12]",
              )}
            >
              {/* 连接 Handle */}
              <ButtonHandle
                type="target"
                position={Position.Left}
                id="input"
                visible
                className={handleVisibilityClass}
              />
              <ButtonHandle
                type="source"
                position={Position.Right}
                id="output"
                visible
                className={handleVisibilityClass}
              />

              {/* 内容区域 */}
              <div className="nopan flex h-full w-full overflow-hidden rounded-xl">
                <NoteContent
                  content={data.content}
                  contentHtml={data.contentHtml}
                  isEditing={Boolean(data.isEditing)}
                  selected={selected}
                  onStartEdit={handleStartEdit}
                  onContentBlur={handleContentBlur}
                  editorRef={editorRef}
                  scrollbarVariant={data.scrollbarVariant}
                />
              </div>
            </div>
          </div>
        </NodeContextMenu>

        {/* 沉浸式全屏编辑器 */}
        <NoteFullscreenEditor
          open={isFullscreen}
          content={data.content}
          contentHtml={data.contentHtml}
          onClose={handleFullscreenClose}
          onDelete={handleDelete}
        />
      </>
    );
  },
);

NoteNode.displayName = "NoteNode";
