/**
 * VideoAgentNode - 视频智能体节点
 * 用于 AI 视频分析的 React Flow 自定义节点
 */
import { type NodeProps } from "@xyflow/react";
import { memo, useCallback, useEffect, useState } from "react";
import {
  getVideoAgentPresetById,
  getVideoAgentPresetLabelById,
} from "shared/constants/video-agent-presets";
import type { VideoAgentNodeType, VideoAgentPresetId } from "shared/types/flow";
import { useMessage } from "@/hooks/useMessage";
import { NodeContextMenu } from "@/pages/Canvas/components/NodeContextMenu";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { ConfigPanel } from "./components/ConfigPanel";
import { NodeBody } from "./components/NodeBody";
import { PresetSelector } from "./components/PresetSelector";
import { useVideoAgentGenerate } from "./hooks/useVideoAgentGenerate";

const areVideoAgentNodePropsEqual = (
  prev: NodeProps<VideoAgentNodeType>,
  next: NodeProps<VideoAgentNodeType>,
) => {
  return (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data.model === next.data.model &&
    prev.data.presetId === next.data.presetId &&
    prev.data.useDefaultSystemPrompt === next.data.useDefaultSystemPrompt &&
    prev.data.customSystemPrompt === next.data.customSystemPrompt &&
    prev.data.status === next.data.status
  );
};

export const VideoAgentNode = memo(
  ({ id, data, selected }: NodeProps<VideoAgentNodeType>) => {
    const [showPresetSelector, setShowPresetSelector] = useState(
      !data.presetId,
    );
    const [currentModel, setCurrentModel] = useState(
      data.model || "gemini-2.0-flash-exp",
    );
    const [editableSystemPrompt, setEditableSystemPrompt] = useState("");

    const { warning } = useMessage();
    const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode);
    const deleteNode = useCanvasFlowStore((state) => state.deleteNode);
    const addNode = useCanvasFlowStore((state) => state.addNode);
    const onConnect = useCanvasFlowStore((state) => state.onConnect);
    const setNoteNodeEditing = useCanvasFlowStore(
      (state) => state.setNoteNodeEditing,
    );
    const updateVideoAgentNodeData = useCanvasFlowStore(
      (state) => state.updateVideoAgentNodeData,
    );
    const nodes = useCanvasFlowStore((state) => state.nodes);

    const presetId = data.presetId;
    const preset = presetId ? getVideoAgentPresetById(presetId) : null;
    const presetLabel = preset
      ? getVideoAgentPresetLabelById(presetId)
      : "视频智能体";

    const { isGenerating, handleGenerate } = useVideoAgentGenerate({
      id,
      presetId,
      editableSystemPrompt,
      currentModel,
      dataStatus: data.status,
    });

    useEffect(() => {
      if (preset) {
        setEditableSystemPrompt(preset.systemPrompt);
      }
    }, [preset]);

    const updateNodeData = useCallback(
      (updates: Partial<VideoAgentNodeType["data"]>) => {
        updateVideoAgentNodeData(id, updates);
      },
      [id, updateVideoAgentNodeData],
    );

    const hasConnectedVideoNode = useCallback(() => {
      const edges = useCanvasFlowStore.getState().edges;
      const incomingEdges = edges.filter((edge) => edge.target === id);
      if (!incomingEdges.length) return false;

      const parentVideoNode = incomingEdges
        .map((edge) => nodes.find((node) => node.id === edge.source))
        .find((node) => node?.type === "videoNode");

      return !!parentVideoNode;
    }, [id, nodes]);

    const handleSelectPreset = useCallback(
      (newPresetId: VideoAgentPresetId) => {
        updateNodeData({ presetId: newPresetId });
        setShowPresetSelector(false);
      },
      [
        id,
        updateNodeData,
      ],
    );

    const handleModelChange = useCallback(
      (model: string) => {
        setCurrentModel(model);
        updateNodeData({ model });
      },
      [updateNodeData],
    );

    return (
      <NodeContextMenu
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
      >
        <div className="group/node relative flex flex-col items-center">
          {showPresetSelector ? (
            <PresetSelector onSelect={handleSelectPreset} />
          ) : (
            <>
              <NodeBody
                presetId={presetId}
                presetLabel={presetLabel}
                selected={selected}
                isGenerating={isGenerating}
              />

              {selected && (
                <ConfigPanel
                  editableSystemPrompt={editableSystemPrompt}
                  onSystemPromptChange={setEditableSystemPrompt}
                  currentModel={currentModel}
                  onModelChange={handleModelChange}
                  isGenerating={isGenerating}
                  onGenerate={handleGenerate}
                />
              )}
            </>
          )}
        </div>
      </NodeContextMenu>
    );
  },
  areVideoAgentNodePropsEqual,
);

VideoAgentNode.displayName = "VideoAgentNode";
