/**
 * ============================================
 * ImageAgentNode - 图片智能体节点
 * ============================================
 *
 * 【节点功能】
 * 该节点用于 AI 图片反推（Image Reverse Prompt）任务。
 * 用户可以连接一个图片节点，节点会调用 AI 模型分析图片内容，
 * 并生成描述性文字作为输出。
 *
 * 【使用场景】
 * - 从一张图片反推出可用于生成的 Prompt
 * - 分析图片内容并生成描述文本
 * - 作为图片到文字的中间处理节点
 *
 * 【数据流向】
 * 1. 接收来自 ImageNode 的图片数据
 * 2. 结合用户编辑的系统提示词
 * 3. 调用 AI API 进行图片分析
 * 4. 将分析结果输出到 NoteNode
 *
 * 【节点类型标识】imageAgentNode
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
import { useImageAgentGenerate } from "./hooks/useImageAgentGenerate";
import { PresetSelector } from "./components/PresetSelector";
import { NodeBody } from "./components/NodeBody";
import { ConfigPanel } from "./components/ConfigPanel";

/**
 * ============================================
 * 节点 Props 比较函数
 * ============================================
 *
 * 【功能说明】
 * 自定义比较函数，用于 React.memo 优化渲染性能。
 * 只有当指定的属性发生变化时，组件才会重新渲染。
 *
 * 【比较的字段】
 * - id: 节点唯一标识
 * - selected: 节点是否被选中
 * - model: 当前使用的 AI 模型
 * - presetId: 智能体预设 ID
 * - useDefaultSystemPrompt: 是否使用默认系统提示词
 * - customSystemPrompt: 自定义系统提示词
 * - status: 节点状态（idle/generating/success/error）
 *
 * @param prev - 上一次的节点 props
 * @param next - 当前的节点 props
 * @returns boolean - 返回 true 表示 props 相等，不需要重新渲染
 */
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

/**
 * ============================================
 * ImageAgentNode 组件
 * ============================================
 *
 * 【组件功能】
 * React Flow 自定义图片智能体节点的主组件。
 * 负责协调子组件的渲染、状态管理和用户交互。
 *
 * 【渲染逻辑】
 * 1. 如果未选择预设 (presetId)，显示 PresetSelector 让用户选择
 * 2. 已选择预设后，显示 NodeBody（节点主体）
 * 3. 当节点被选中时，额外显示 ConfigPanel（配置面板）
 *
 * 【状态管理】
 * - showPresetSelector: 控制是否显示预设选择器
 * - currentModel: 当前选择的 AI 模型
 * - editableSystemPrompt: 用户编辑的系统提示词
 *
 * @param id - 节点的唯一标识符
 * @param data - 节点携带的业务数据（类型为 ImageAgentNodeData）
 * @param selected - 节点是否被用户选中
 */
export const ImageAgentNode = memo(
  ({ id, data, selected }: NodeProps<ImageAgentNodeType>) => {
    // ============================================
    // 组件内部状态
    // ============================================

    /** 控制是否显示预设选择器（首次使用时需要选择预设） */
    const [showPresetSelector, setShowPresetSelector] = useState(
      !data.presetId,
    );

    /** 当前选择的 AI 模型，默认为 qwen3.5-flash */
    const [currentModel, setCurrentModel] = useState(
      data.model || "qwen3.5-flash",
    );

    /** 用户可编辑的系统提示词 */
    const [editableSystemPrompt, setEditableSystemPrompt] = useState("");

    // ============================================
    // Store 数据获取
    // ============================================

    const { warning } = useMessage();

    /** 复制节点方法 */
    const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode);
    /** 删除节点方法 */
    const deleteNode = useCanvasFlowStore((state) => state.deleteNode);
    /** 添加节点方法 */
    const addNode = useCanvasFlowStore((state) => state.addNode);
    /** 连接边方法 */
    const onConnect = useCanvasFlowStore((state) => state.onConnect);
    /** 设置便签节点编辑状态方法 */
    const setNoteNodeEditing = useCanvasFlowStore(
      (state) => state.setNoteNodeEditing,
    );
    /** 更新图片智能体节点数据方法 */
    const updateImageAgentNodeData = useCanvasFlowStore(
      (state) => state.updateImageNodeData,
    );
    /** 画布上所有节点数据 */
    const nodes = useCanvasFlowStore((state) => state.nodes);

    // ============================================
    // 预设相关数据
    // ============================================

    /** 当前预设 ID */
    const presetId = data.presetId;

    /** 根据预设 ID 获取预设详情 */
    const preset = presetId ? getImageAgentPresetById(presetId) : null;

    /** 获取预设的显示标签 */
    const presetLabel = preset
      ? getImageAgentPresetLabelById(presetId)
      : "图片智能体";

    // ============================================
    // 生成逻辑 Hook
    // ============================================

    /**
     * useImageAgentGenerate - 处理图片分析的核心逻辑
     *
     * @description
     * 该 Hook 封装了完整的图片分析流程：
     * 1. 输入验证（检查是否连接了图片节点）
     * 2. 调用 AI API 分析图片
     * 3. 解析响应结果
     * 4. 创建输出便签节点
     *
     * @returns
     * - isGenerating: 是否正在生成中
     * - handleGenerate: 触发生成的回调函数
     */
    const { isGenerating, handleGenerate } = useImageAgentGenerate({
      id,
      presetId,
      editableSystemPrompt,
      currentModel,
      dataStatus: data.status,
    });

    // ============================================
    // 副作用处理
    // ============================================

    /**
     * 当预设变化时，更新系统提示词
     *
     * @description
     * 如果选择了某个预设，自动将该预设的默认系统提示词
     * 填充到可编辑的提示词输入框中
     */
    useEffect(() => {
      if (preset) {
        setEditableSystemPrompt(preset.systemPrompt);
      }
    }, [preset]);

    // ============================================
    // 回调函数定义
    // ============================================

    /**
     * 更新节点数据的统一方法
     *
     * @param updates - 要更新的字段集合
     * @description
     * 将 updates 对象合并到节点的 data 中，
     * 通过 updateImageAgentNodeData action 更新 store
     */
    const updateNodeData = useCallback(
      (updates: Partial<ImageAgentNodeType["data"]>) => {
        updateImageAgentNodeData(id, updates);
      },
      [id, updateImageAgentNodeData],
    );

    /**
     * 检查是否连接了图片父节点
     *
     * @returns boolean - 是否存在连接的图片节点
     * @description
     * 通过遍历当前节点的入边，找到源节点，
     * 筛选出类型为 imageNode 的节点
     */
    const hasConnectedImageNode = useCallback(() => {
      const edges = useCanvasFlowStore.getState().edges;
      const incomingEdges = edges.filter((edge) => edge.target === id);
      if (!incomingEdges.length) return false;

      const parentImageNode = incomingEdges
        .map((edge) => nodes.find((node) => node.id === edge.source))
        .find((node) => node?.type === "imageNode");

      return !!parentImageNode;
    }, [id, nodes]);

    /**
     * 处理预设选择
     *
     * @param newPresetId - 用户选择的新预设 ID
     * @description
     * 1. 更新节点的 presetId
     * 2. 隐藏预设选择器，显示节点主体
     */
    const handleSelectPreset = useCallback(
      (newPresetId: ImageAgentPresetId) => {
        updateNodeData({ presetId: newPresetId });
        setShowPresetSelector(false);
      },
      [id, updateNodeData],
    );

    /**
     * 处理模型切换
     *
     * @param model - 用户选择的新模型名称
     * @description
     * 1. 更新本地状态 currentModel
     * 2. 同步更新节点数据中的 model 字段
     */
    const handleModelChange = useCallback(
      (model: string) => {
        setCurrentModel(model);
        updateNodeData({ model });
      },
      [updateNodeData],
    );

    // ============================================
    // 渲染逻辑
    // ============================================

    return (
      <NodeContextMenu
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
      >
        <div className="group/node relative flex flex-col items-center">
          {/* 条件渲染：未选择预设时显示预设选择器 */}
          {showPresetSelector ? (
            <PresetSelector onSelect={handleSelectPreset} />
          ) : (
            <>
              {/* 节点主体：显示预设信息和连接手柄 */}
              <NodeBody
                presetId={presetId}
                presetLabel={presetLabel}
                selected={selected}
                isGenerating={isGenerating}
              />

              {/* 选中时显示配置面板 */}
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

/** 设置组件显示名称，便于调试和 React DevTools */
ImageAgentNode.displayName = "ImageAgentNode";
