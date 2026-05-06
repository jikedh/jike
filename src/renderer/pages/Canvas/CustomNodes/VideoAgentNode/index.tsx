/**
 * VideoAgentNode - 视频智能体节点
 * 用于 AI 视频分析的 React Flow 自定义节点
 */
import { IconVideo } from "@tabler/icons-react";
import { type NodeProps } from "@xyflow/react";
import { memo, useCallback, useEffect, useState } from "react";
import {
  getVideoAgentPresetById,
  getVideoAgentPresetLabelById,
} from "shared/constants/video-agent-presets";
import type { VideoAgentNodeType, VideoAgentPresetId } from "shared/types/flow";
import { NodeContextMenu } from "@/pages/Canvas/components/NodeContextMenu";
import { requestCanvasDeleteConfirm } from "@/pages/Canvas/utils/deleteConfirm";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { NodeNameBadge } from "../shared/NodeNameBadge";
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
    prev.data.nickname === next.data.nickname &&
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
      data.model || "qwen3.5-flash",
    );
    const [editableSystemPrompt, setEditableSystemPrompt] = useState("");
    const [isRenaming, setIsRenaming] = useState(false);

    const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode);
    const deleteNode = useCanvasFlowStore((state) => state.deleteNode);
    const updateVideoAgentNodeData = useCanvasFlowStore(
      (state) => state.updateVideoAgentNodeData,
    );
    const updateNodeNickname = useCanvasFlowStore(
      (state) => state.updateNodeNickname,
    );

    const presetId = data.presetId;
    const preset = presetId ? getVideoAgentPresetById(presetId) : null;
    const presetLabel = preset
      ? getVideoAgentPresetLabelById(presetId)
      : "视频智能体";

    const nodeLabel = data.nickname ?? presetLabel;

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

    const _hasConnectedVideoNode = useCallback(() => {
      const { edges, nodes } = useCanvasFlowStore.getState();
      const incomingEdges = edges.filter((edge) => edge.target === id);
      if (!incomingEdges.length) return false;

      const parentVideoNode = incomingEdges
        .map((edge) => nodes.find((node) => node.id === edge.source))
        // 视频智能体同时接受旧版和新版视频节点作为输入。
        .find(
          (node) => node?.type === "videoNode" || node?.type === "newVideoNode",
        );

      return !!parentVideoNode;
    }, [id]);

    const handleSelectPreset = useCallback(
      (newPresetId: VideoAgentPresetId) => {
        updateNodeData({ presetId: newPresetId });
        setShowPresetSelector(false);
      },
      [id, updateNodeData],
    );

    const handleModelChange = useCallback(
      (model: string) => {
        setCurrentModel(model);
        updateNodeData({ model });
      },
      [updateNodeData],
    );

    const handleDelete = useCallback(() => {
      if (isGenerating) {
        requestCanvasDeleteConfirm({
          message: "当前视频智能体节点还在生成中，确定要删除吗？",
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

    return (
      <NodeContextMenu
        onDuplicate={() => duplicateNode(id)}
        onDelete={handleDelete}
      >
        <div className="group/node relative flex flex-col items-center">
          {!showPresetSelector && (
            <NodeNameBadge
              icon={<IconVideo size={14} />}
              selected={selected}
              isEditing={isRenaming}
              onEditStart={handleRenameStart}
              onEditEnd={() => setIsRenaming(false)}
              onRename={handleRename}
            >
              {nodeLabel}
            </NodeNameBadge>
          )}

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
