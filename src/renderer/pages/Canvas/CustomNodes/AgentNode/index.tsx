import { IconRobot } from "@tabler/icons-react";
import { type NodeProps, Position } from "@xyflow/react";
import { memo, useCallback, useMemo, useState } from "react";
import { getAgentPresetLabelById } from "shared/constants/agent-presets";
import type { AgentNodeType } from "shared/types/flow";
import { ButtonHandle } from "@/components/button-handle";
import { Button } from "@/components/ui/button";
import { useAgentExecution } from "@/hooks/useAgentExecution";
import { NodeContextMenu } from "@/pages/Canvas/components/NodeContextMenu";
import { requestCanvasDeleteConfirm } from "@/pages/Canvas/utils/deleteConfirm";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { cn } from "shared/utils/utils";
import { NodeNameBadge } from "../shared/NodeNameBadge";

const areAgentNodePropsEqual = (
  prev: NodeProps<AgentNodeType>,
  next: NodeProps<AgentNodeType>,
) => {
  return (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data.model === next.data.model &&
    prev.data.agentPresetId === next.data.agentPresetId &&
    prev.data.nickname === next.data.nickname &&
    // 这里是应用比较哎
    prev.data.messages === next.data.messages
  );
};

export const AgentNode = memo(
  ({ id, data, selected }: NodeProps<AgentNodeType>) => {
    const handleVisibilityClass = selected
      ? "visible opacity-100"
      : "invisible opacity-0 group-hover/node:visible group-hover/node:opacity-100";
    const { isGenerating, execute } = useAgentExecution({
      nodeId: id,
      model: data.model,
      messages: data.messages,
    });
    const presetLabel = getAgentPresetLabelById(data.agentPresetId);
    const nodeLabel = data.nickname ?? presetLabel;
    const [isRenaming, setIsRenaming] = useState(false);
    const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode);
    const deleteNode = useCanvasFlowStore((state) => state.deleteNode);
    const updateNodeNickname = useCanvasFlowStore(
      (state) => state.updateNodeNickname,
    );

    const handleDelete = useCallback(() => {
      if (isGenerating) {
        requestCanvasDeleteConfirm({
          message: "当前智能体节点还在生成中，确定要删除吗？",
          onConfirm: () => deleteNode(id),
        });
        return;
      }

      deleteNode(id);
    }, [deleteNode, id, isGenerating]);

    const handleRenameStart = useCallback(() => {
      if (selected) {
        setIsRenaming(true);
      }
    }, [selected]);

    const handleRename = useCallback(
      (name: string) => {
        updateNodeNickname(id, name);
      },
      [id, updateNodeNickname],
    );

    const handleDuplicate = useCallback(() => {
      duplicateNode(id);
    }, [duplicateNode, id]);

    const handleEditEnd = useCallback(() => setIsRenaming(false), []);

    const nodeIcon = useMemo(() => <IconRobot size={14} />, []);

    return (
      <NodeContextMenu
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
      >
        <div className="group/node relative">
          <div
            className={cn(
              "group/card relative flex h-48 w-48 items-center justify-center rounded-xl border bg-gradient-to-br from-[#141418] to-[#0d0d10] transition-all duration-300 ease-out",
              selected
                ? "border-[#B43FEB]/80 shadow-[0_0_25px_rgba(180,63,235,0.4),0_0_50px_rgba(180,63,235,0.15)] ring-1 ring-[#B43FEB]/30"
                : "border-white/[0.06] hover:border-white/[0.12] hover:bg-gradient-to-br hover:from-[#18181c] hover:to-[#101014]",
            )}
          >
            <NodeNameBadge
              icon={nodeIcon}
              selected={selected}
              isEditing={isRenaming}
              onEditStart={handleRenameStart}
              onEditEnd={handleEditEnd}
              onRename={handleRename}
            >
              {nodeLabel}
            </NodeNameBadge>

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
            <span className="absolute left-2 top-2 max-w-40 truncate rounded-md border border-white/10 bg-[#1a1a1d] px-2 py-0.5 text-[11px] leading-4 text-white/60">
              {presetLabel}
            </span>
            <Button
              disabled={isGenerating}
              onClick={execute}
              className="bg-[#B43FEB] hover:bg-[#B43FEB]/80"
            >
              {isGenerating ? "生成中..." : "生成"}
            </Button>
          </div>
        </div>
      </NodeContextMenu>
    );
  },
  areAgentNodePropsEqual,
);

AgentNode.displayName = "AgentNode";
