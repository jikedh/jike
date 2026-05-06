/**
 * TextAgentNode - 文本智能体节点
 * 用于 AI 文本生成的 React Flow 自定义节点
 */
import { IconSparkles } from "@tabler/icons-react";
import { type NodeProps } from "@xyflow/react";
import { memo, useCallback, useEffect, useState } from "react";
import {
  getTextAgentPresetById,
  getTextAgentPresetLabelById,
} from "shared/constants/text-agent-presets";
import type { TextAgentNodeType, TextAgentPresetId } from "shared/types/flow";
import { NodeContextMenu } from "@/pages/Canvas/components/NodeContextMenu";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { NodeNameBadge } from "../../shared/NodeNameBadge";
import { ConfigPanel } from "./components/ConfigPanel";
import { NodeBody } from "./components/NodeBody";
import { PresetSelector } from "./components/PresetSelector";
import { useTextAgentGenerate } from "./hooks/useTextAgentGenerate";

// Props 比较函数，用于优化 memo 性能
const areTextAgentNodePropsEqual = (
  prev: NodeProps<TextAgentNodeType>,
  next: NodeProps<TextAgentNodeType>,
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

export const TextAgentNode = memo(
  ({ id, data, selected }: NodeProps<TextAgentNodeType>) => {
    // UI 状态
    const [showPresetSelector, setShowPresetSelector] = useState(
      !data.presetId,
    );
    const [currentModel, setCurrentModel] = useState(
      data.model || "gemini-3.1-pro",
    );
    const [editableSystemPrompt, setEditableSystemPrompt] = useState("");
    const [isRenaming, setIsRenaming] = useState(false);

    // Store 状态和方法
    const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode);
    const deleteNode = useCanvasFlowStore((state) => state.deleteNode);
    const addNode = useCanvasFlowStore((state) => state.addNode);
    const onConnect = useCanvasFlowStore((state) => state.onConnect);
    const setNoteNodeEditing = useCanvasFlowStore(
      (state) => state.setNoteNodeEditing,
    );
    const updateTextAgentNodeData = useCanvasFlowStore(
      (state) => state.updateTextAgentNodeData,
    );
    const updateNodeNickname = useCanvasFlowStore(
      (state) => state.updateNodeNickname,
    );
    // 当前预设信息
    const presetId = data.presetId;
    const preset = presetId ? getTextAgentPresetById(presetId) : null;
    const presetLabel = preset
      ? getTextAgentPresetLabelById(presetId)
      : "文本智能体";

    // 生成逻辑 hook
    const nodeLabel = data.nickname ?? presetLabel;

    const { isGenerating, handleGenerate } = useTextAgentGenerate({
      id,
      presetId,
      editableSystemPrompt,
      currentModel,
      dataStatus: data.status,
    });

    // 当预设变化时，更新可编辑的系统提示词
    useEffect(() => {
      if (preset) {
        setEditableSystemPrompt(preset.systemPrompt);
      }
    }, [preset]);

    // 更新节点数据
    const updateNodeData = useCallback(
      (updates: Partial<TextAgentNodeType["data"]>) => {
        updateTextAgentNodeData(id, updates);
      },
      [id, updateTextAgentNodeData],
    );

    // 检查是否已连接便签节点
    const hasConnectedNote = useCallback(() => {
      const { edges, nodes } = useCanvasFlowStore.getState();
      const incomingEdges = edges.filter((edge) => edge.target === id);
      if (!incomingEdges.length) return false;

      const parentNoteNode = incomingEdges
        .map((edge) => nodes.find((node) => node.id === edge.source))
        .find((node) => node?.type === "noteNode");

      return !!parentNoteNode;
    }, [id]);

    // 选择预设
    const handleSelectPreset = useCallback(
      (newPresetId: TextAgentPresetId) => {
        updateNodeData({ presetId: newPresetId });
        setShowPresetSelector(false);

        // 如果已有连接的便签节点，不再创建
        if (hasConnectedNote()) {
          return;
        }

        const currentNode = useCanvasFlowStore
          .getState()
          .nodes.find((n) => n.id === id);
        if (!currentNode) return;

        // 自动创建输入便签节点
        const inputNoteId = addNode("note", {
          x: currentNode.position.x - 450,
          y: currentNode.position.y + 100,
        });
        setNoteNodeEditing(inputNoteId, true);

        // 延迟连接
        setTimeout(() => {
          onConnect({
            source: inputNoteId,
            sourceHandle: "output",
            target: id,
            targetHandle: "input",
          });
        }, 100);
      },
      [
        id,
        addNode,
        setNoteNodeEditing,
        onConnect,
        updateNodeData,
        hasConnectedNote,
      ],
    );

    // 模型变化时同步到节点数据
    const handleModelChange = useCallback(
      (model: string) => {
        setCurrentModel(model);
        updateNodeData({ model });
      },
      [updateNodeData],
    );

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
        onDelete={() => deleteNode(id)}
      >
        <div className="group/node relative flex flex-col items-center">
          {!showPresetSelector && (
            <NodeNameBadge
              icon={<IconSparkles size={14} />}
              selected={selected}
              isEditing={isRenaming}
              onEditStart={handleRenameStart}
              onEditEnd={() => setIsRenaming(false)}
              onRename={handleRename}
            >
              {nodeLabel}
            </NodeNameBadge>
          )}

          {/* 预设选择器 */}
          {showPresetSelector ? (
            <PresetSelector onSelect={handleSelectPreset} />
          ) : (
            <>
              {/* 节点主体 */}
              <NodeBody
                presetId={presetId}
                presetLabel={presetLabel}
                selected={selected}
                isGenerating={isGenerating}
              />

              {/* 配置面板（选中时显示） */}
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
  areTextAgentNodePropsEqual,
);

TextAgentNode.displayName = "TextAgentNode";
