import { type NodeProps, Position } from "@xyflow/react";
import { memo } from "react";
import { getAgentPresetLabelById } from "shared/constants/agent-presets";
import { cn } from "shared/lib/utils";
import type { AgentNodeType } from "shared/types/flow";
import { ButtonHandle } from "@/components/button-handle";
import { Button } from "@/components/ui/button";
import { useAgentExecution } from "@/hooks/useAgentExecution";
import { NodeContextMenu } from "@/pages/Canvas/components/NodeContextMenu";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

const areAgentNodePropsEqual = (
  prev: NodeProps<AgentNodeType>,
  next: NodeProps<AgentNodeType>,
) => {
  return (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data.model === next.data.model &&
    prev.data.agentPresetId === next.data.agentPresetId &&
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
    const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode);
    const deleteNode = useCanvasFlowStore((state) => state.deleteNode);

    return (
      <NodeContextMenu
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
      >
        <div className="group/node relative">
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

          <div
            className={cn(
              "group/card relative flex h-48 w-48 items-center justify-center rounded-xl border bg-gradient-to-br from-[#141418] to-[#0d0d10] transition-all duration-300 ease-out",
              selected
                ? "border-[#B43FEB]/80 shadow-[0_0_25px_rgba(180,63,235,0.4),0_0_50px_rgba(180,63,235,0.15)] ring-1 ring-[#B43FEB]/30"
                : "border-white/[0.06] hover:border-white/[0.12] hover:bg-gradient-to-br hover:from-[#18181c] hover:to-[#101014]",
            )}
          >
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
