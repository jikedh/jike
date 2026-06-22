/**
 * ImageAgentNode - 图片智能体节点
 * 用于 AI 图片反推的 React Flow 自定义节点
 * 位于文本智能体之后、视频智能体之前
 */
import { IconPhoto } from "@tabler/icons-react";
import { type NodeProps } from "@xyflow/react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  getImageAgentPresetById,
  getImageAgentPresetLabelById,
} from "shared/constants/image-agent-presets";
import type { ImageAgentNodeType, ImageAgentPresetId } from "shared/types/flow";
import { useMessage } from "@/hooks/useMessage";
import { NodeContextMenu } from "@/pages/Canvas/components/NodeContextMenu";
import { requestCanvasDeleteConfirm } from "@/pages/Canvas/utils/deleteConfirm";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { NodeNameBadge } from "../shared/NodeNameBadge";
import { ConfigPanel } from "./components/ConfigPanel";
import { NodeBody } from "./components/NodeBody";
import { PresetSelector } from "./components/PresetSelector";
import { useImageAgentGenerate } from "./hooks/useImageAgentGenerate";

/** memo 比较函数：仅在关键字段变化时重渲染 */
const areImageAgentNodePropsEqual = (
  prev: NodeProps<ImageAgentNodeType>,
  next: NodeProps<ImageAgentNodeType>,
) =>
  prev.id === next.id &&
  prev.selected === next.selected &&
  prev.data.model === next.data.model &&
  prev.data.presetId === next.data.presetId &&
  prev.data.nickname === next.data.nickname &&
  prev.data.customSystemPrompt === next.data.customSystemPrompt &&
  prev.data.status === next.data.status;

export const ImageAgentNode = memo(
  ({ id, data, selected }: NodeProps<ImageAgentNodeType>) => {
    // 没有预设时显示预设选择器
    const [showPresetSelector, setShowPresetSelector] = useState(
      !data.presetId,
    );
    const [currentModel, setCurrentModel] = useState(
      data.model || "qwen3.5-flash",
    );
    const [editableSystemPrompt, setEditableSystemPrompt] = useState("");
    const [isRenaming, setIsRenaming] = useState(false);

    const { warning } = useMessage();
    const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode);
    const deleteNode = useCanvasFlowStore((state) => state.deleteNode);
    const updateImageAgentNodeData = useCanvasFlowStore(
      (state) => state.updateImageAgentNodeData,
    );
    const updateNodeNickname = useCanvasFlowStore(
      (state) => state.updateNodeNickname,
    );

    const presetId = data.presetId;
    const preset = presetId ? getImageAgentPresetById(presetId) : null;
    const presetLabel = preset
      ? getImageAgentPresetLabelById(presetId)
      : "图片智能体";

    const nodeLabel = data.nickname ?? presetLabel;

    const { isGenerating, handleGenerate } = useImageAgentGenerate({
      id,
      presetId,
      editableSystemPrompt,
      currentModel,
      dataStatus: data.status,
    });

    // 选择预设后，同步默认系统提示词
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

    const handleSelectPreset = useCallback(
      (newPresetId: ImageAgentPresetId) => {
        updateNodeData({ presetId: newPresetId });
        setShowPresetSelector(false);
      },
      [updateNodeData],
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
          message: "当前图片智能体节点还在生成中，确定要删除吗？",
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

    const nodeIcon = useMemo(() => <IconPhoto size={14} />, []);

    return (
      <NodeContextMenu
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
      >
        <div className="group/node relative flex flex-col items-center">
          {!showPresetSelector && (
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

              {/* 选中时展开配置面板 */}
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
