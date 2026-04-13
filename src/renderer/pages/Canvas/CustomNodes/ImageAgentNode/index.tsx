/**
 * ImageAgentNode - 图片智能体节点
 * 用于 AI 图片反推的 React Flow 自定义节点
 */
import { type NodeProps } from "@xyflow/react";
import { memo, useCallback, useEffect, useState } from "react";
import {
  getImageAgentPresetById,
  getImageAgentPresetLabelById,
} from "shared/constants/image-agent-presets";
import type { ImageAgentNodeType, ImageAgentPresetId } from "shared/types/flow";
import { useMessage } from "@/hooks/useMessage";
import { NodeContextMenu } from "@/pages/Canvas/components/NodeContextMenu";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
//port { ConfigPanel } from "./components/ConfigPanel";
// import { NodeBody } from "./components/NodeBody";
// import { PresetSelector } from "./components/PresetSelector";
import { useImageAgentGenerate } from "./hooks/useImageAgentGenerate";
import { PresetSelector } from "./components/PresetSelector";
import { NodeBody } from "./components/NodeBody";
import { ConfigPanel } from "./components/ConfigPanel";

const areImageAgentNodePropsEqual = (
  prev: NodeProps<ImageAgentNodeType>,
  next: NodeProps<ImageAgentNodeType>,
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

export const ImageAgentNode = memo(
  ({ id, data, selected }: NodeProps<ImageAgentNodeType>) => {
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
    const updateImageAgentNodeData = useCanvasFlowStore(
      (state) => state.updateImageNodeData,
    );
    const nodes = useCanvasFlowStore((state) => state.nodes);

    const presetId = data.presetId;
    const preset = presetId ? getImageAgentPresetById(presetId) : null;
    const presetLabel = preset
      ? getImageAgentPresetLabelById(presetId)
      : "图片智能体";

    const { isGenerating, handleGenerate } = useImageAgentGenerate({
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
      (updates: Partial<ImageAgentNodeType["data"]>) => {
        updateImageAgentNodeData(id, updates);
      },
      [id, updateImageAgentNodeData],
    );

    const hasConnectedImageNode = useCallback(() => {
      const edges = useCanvasFlowStore.getState().edges;
      const incomingEdges = edges.filter((edge) => edge.target === id);
      if (!incomingEdges.length) return false;

      const parentImageNode = incomingEdges
        .map((edge) => nodes.find((node) => node.id === edge.source))
        .find((node) => node?.type === "imageNode");

      return !!parentImageNode;
    }, [id, nodes]);

    const handleSelectPreset = useCallback(
      (newPresetId: ImageAgentPresetId) => {
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
  areImageAgentNodePropsEqual,
);

ImageAgentNode.displayName = "ImageAgentNode";
