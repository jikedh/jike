import { IconMusic } from "@tabler/icons-react";
import { type NodeProps, NodeToolbar, Position } from "@xyflow/react";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import type { AudioNodeType } from "shared/types/flow";
import { cn } from "shared/utils/utils";
import { ButtonHandle } from "@/components/button-handle";
import { useNodeScale } from "@/hooks/useNodeScale";
import { dispatchCreateAssetFromNode } from "@/pages/Canvas/components/CanvasSidebar";
import { NodeContextMenu } from "@/pages/Canvas/components/NodeContextMenu";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { NodeNameBadge } from "../shared/NodeNameBadge";
import { AudioPromptPanel } from "./AudioPromptPanel";
import { AudioContent } from "./components/AudioContent";
import { AudioToolbar } from "./components/AudioToolbar";

export const AudioNode = memo(
  ({ id, data, selected, dragging }: NodeProps<AudioNodeType>) => {
    const { zoom } = useNodeScale();
    const [isRenaming, setIsRenaming] = useState(false);
    const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode);
    const deleteNode = useCanvasFlowStore((state) => state.deleteNode);
    const updateNodeNickname = useCanvasFlowStore(
      (state) => state.updateNodeNickname,
    );
    // 仅订阅与当前节点相关的派生布尔值，避免高亮列表变化时所有节点重渲染
    const isSourceHighlighted = useCanvasFlowStore((state) =>
      state.highlightedSourceNodeIds.includes(id),
    );
    const isActiveFromStore = useCanvasFlowStore(
      (state) => state.activeNodeId === id,
    );
    const audioRef = useRef<HTMLAudioElement>(null);

    // 只让活动单节点挂载工具栏和生成面板。
    const isActiveNode = isActiveFromStore && selected;

    const handleVisibilityClass = selected
      ? "visible opacity-100"
      : "invisible opacity-0 group-hover/node:visible group-hover/node:opacity-100";
    const shouldShowToolbar = isActiveNode && !dragging;

    const handleDuplicate = useCallback(() => {
      duplicateNode(id);
    }, [duplicateNode, id]);

    const handleDelete = useCallback(() => {
      deleteNode(id);
    }, [deleteNode, id]);

    const handleRenameStart = useCallback(() => {
      if (selected) {
        setIsRenaming(true);
      }
    }, [selected]);

    const handleEditEnd = useCallback(() => setIsRenaming(false), []);

    const handleRename = useCallback(
      (name: string) => {
        updateNodeNickname(id, name);
      },
      [id, updateNodeNickname],
    );

    const badgeLabel =
      data.nickname ??
      data.badgeLabel ??
      (data.isUpload ? "上传音频" : "生成音频");

    const nodeIcon = useMemo(() => <IconMusic size={14} />, []);

    return (
      <NodeContextMenu
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onCreateAsset={() => dispatchCreateAssetFromNode(id)}
      >
        <div className="group/node relative">
          <NodeToolbar
            isVisible={shouldShowToolbar}
            position={Position.Top}
            offset={48 * zoom}
          >
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "bottom center",
              }}
            >
              <AudioToolbar nodeId={id} data={data} onDelete={handleDelete} />
            </div>
          </NodeToolbar>

          <div
            className={cn(
              "group/card relative flex h-62.5 w-87.5 flex-col rounded-xl border bg-linear-to-br from-[#141418] to-[#0d0d10] transition-all duration-300 ease-out",
              selected
                ? "border-[#B43FEB]/80 shadow-[0_0_25px_rgba(180,63,235,0.4),0_0_50px_rgba(180,63,235,0.15)] ring-1 ring-[#B43FEB]/30"
                : isSourceHighlighted
                  ? "border-[#B43FEB]/65 shadow-[0_0_18px_rgba(180,63,235,0.28),0_0_36px_rgba(180,63,235,0.12)] ring-1 ring-[#B43FEB]/20"
                  : "border-white/6 hover:border-white/12 hover:bg-linear-to-br hover:from-[#18181c] hover:to-[#101014]",
            )}
            style={{ pointerEvents: "auto" }}
          >
            <NodeNameBadge
              icon={nodeIcon}
              selected={selected}
              isEditing={isRenaming}
              onEditStart={handleRenameStart}
              onEditEnd={handleEditEnd}
              onRename={handleRename}
            >
              {badgeLabel}
            </NodeNameBadge>

            <ButtonHandle
              type="target"
              position={Position.Left}
              id="input"
              visible
              className={`transition-opacity duration-150 ${handleVisibilityClass}`}
            />

            <ButtonHandle
              type="source"
              position={Position.Right}
              id="output"
              visible
              className={`transition-opacity duration-150 ${handleVisibilityClass}`}
            />
            {selected ? (
              <>
                <div className="absolute -top-px -left-px h-4 w-4 rounded-tl-xl border-l-2 border-t-2 border-[#B43FEB]" />
                <div className="absolute -top-px -right-px h-4 w-4 rounded-tr-xl border-r-2 border-t-2 border-[#B43FEB]" />
                <div className="absolute -bottom-px -left-px h-4 w-4 rounded-bl-xl border-b-2 border-l-2 border-[#B43FEB]" />
                <div className="absolute -bottom-px -right-px h-4 w-4 rounded-br-xl border-b-2 border-r-2 border-[#B43FEB]" />
              </>
            ) : null}

            <div className="pointer-events-none absolute inset-0 rounded-xl bg-linear-to-tr from-transparent via-white/2 to-transparent opacity-0 transition-opacity duration-500 group-hover/card:opacity-100" />

            <div className="relative flex h-full w-full overflow-hidden rounded-lg bg-black/30">
              <AudioContent data={data} audioRef={audioRef} />
            </div>
          </div>
          {isActiveNode ? (
            <AudioPromptPanel nodeId={id} />
          ) : null}
        </div>
      </NodeContextMenu>
    );
  },
);

AudioNode.displayName = "AudioNode";
