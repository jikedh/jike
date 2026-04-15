/**
 * ============================================
 * useImageAgentGenerate - 图片智能体生成逻辑 Hook
 * ============================================
 *
 * 【Hook 功能】
 * 封装图片智能体节点的核心业务逻辑，包括：
 * 1. 输入验证 - 检查是否连接了图片节点
 * 2. 调用 AI API - 向 AI 服务发送图片分析请求
 * 3. 响应解析 - 解析 AI 返回的结果
 * 4. 输出创建 - 自动创建便签节点存放分析结果
 *
 * 【数据流向】
 * ┌─────────────┐    ┌──────────────────┐    ┌─────────────┐
 * │ ImageNode   │───▶│ ImageAgentNode   │───▶│ NoteNode    │
 * │ (输入图片)   │    │  (调用AI分析)     │    │ (存放结果)   │
 * └─────────────┘    └──────────────────┘    └─────────────┘
 *
 * 【AI API 调用格式】
 * 使用多模态消息格式：
 * {
 *   model: "qwen3.5-flash",
 *   messages: [{
 *     role: "user",
 *     content: [
 *       { type: "image_url", image_url: { url: "图片URL" } },
 *       { type: "text", text: "系统提示词" }
 *     ]
 *   }]
 * }
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageAgentNodeType, ImageAgentPresetId } from "shared/types/flow";
import { createDashscopeChatCompletion } from "@/api/ai";
import { useMessage } from "@/hooks/useMessage";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

/**
 * ============================================
 * Hook 输入参数接口
 * ============================================
 *
 * @property id - 当前节点的唯一标识
 * @property presetId - 智能体预设 ID（如 image-reverse-prompt）
 * @property editableSystemPrompt - 用户编辑的系统提示词
 * @property currentModel - 当前选择的 AI 模型
 * @property dataStatus - 节点数据中的状态（用于恢复中断的请求）
 */
interface UseImageAgentGenerateProps {
  /** 当前图片智能体节点的 ID */
  id: string;

  /** 当前选择的预设 ID */
  presetId: ImageAgentPresetId | undefined;

  /** 用户编辑的系统提示词 */
  editableSystemPrompt: string;

  /** 当前选择的 AI 模型标识 */
  currentModel: string;

  /** 节点数据中的状态（可选，用于状态恢复） */
  dataStatus?: string;
}

/**
 * ============================================
 * useImageAgentGenerate Hook
 * ============================================
 *
 * @param id - 节点 ID
 * @param presetId - 预设 ID
 * @param editableSystemPrompt - 系统提示词
 * @param currentModel - AI 模型
 * @param dataStatus - 数据状态
 * @returns
 *   - isGenerating: boolean - 是否正在生成中
 *   - handleGenerate: () => Promise<void> - 触发生成的主函数
 */
export const useImageAgentGenerate = ({
  id,
  presetId,
  editableSystemPrompt,
  currentModel,
  dataStatus,
}: UseImageAgentGenerateProps) => {
  // ============================================
  // 状态定义
  // ============================================

  /**
   * 是否正在生成中
   * 初始值从 dataStatus === "generating" 恢复
   * 用于控制 UI 状态和防止重复点击
   */
  const [isGenerating, setIsGenerating] = useState(
    dataStatus === "generating"
  );

  /**
   * AbortController 引用
   * 用于在组件卸载或取消时中止正在进行的请求
   */
  const abortControllerRef = useRef<AbortController | null>(null);

  // ============================================
  // Store 数据获取
  // ============================================

  const { warning, error, success } = useMessage();
  const nodes = useCanvasFlowStore((state) => state.nodes);
  const edges = useCanvasFlowStore((state) => state.edges);
  const addNode = useCanvasFlowStore((state) => state.addNode);
  const onConnect = useCanvasFlowStore((state) => state.onConnect);
  const setNoteNodeEditing = useCanvasFlowStore(
    (state) => state.setNoteNodeEditing,
  );
  const updateImageAgentNodeData = useCanvasFlowStore(
    (state) => state.updateImageAgentNodeData,
  );

  // ============================================
  // 副作用处理
  // ============================================

  /**
   * 同步生成状态
   * 当外部 dataStatus 变化时（如从外部恢复状态），同步 isGenerating
   */
  useEffect(() => {
    setIsGenerating(dataStatus === "generating");
  }, [dataStatus]);

  /**
   * 处理错误状态的副作用
   * 当 dataStatus 变为 "error" 且当前正在生成时，取消请求
   */
  useEffect(() => {
    if (
      dataStatus === "error" &&
      isGenerating &&
      abortControllerRef.current
    ) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
    }
  }, [dataStatus, isGenerating]);

  // ============================================
  // 内部方法
  // ============================================

  /**
   * 更新节点数据的统一方法
   *
   * @param updates - 要更新的字段
   * @description
   * 封装 updateImageAgentNodeData，提供更简洁的调用方式
   */
  const updateNodeData = useCallback(
    (updates: Partial<ImageAgentNodeType["data"]>) => {
      updateImageAgentNodeData(id, updates);
    },
    [id, updateImageAgentNodeData],
  );

  /**
   * 获取父级图片节点
   *
   * @returns
   *   - imageUrl: string | null - 图片 URL
   *   - error: string | null - 错误信息（如果有）
   *
   * @description
   * 通过遍历入边找到源图片节点，验证其有效性并提取图片 URL
   *
   * 【验证逻辑】
   * 1. 检查是否有入边（连接到当前节点）
   * 2. 检查源节点是否是图片节点（imageNode）
   * 3. 检查图片节点是否有生成结果
   * 4. 提取第一个图片的 URL
   */
  const getParentImageNode = useCallback(() => {
    const currentEdges = useCanvasFlowStore.getState().edges;
    const currentNodes = useCanvasFlowStore.getState().nodes;

    // 筛选连接到当前节点的入边
    const incomingEdges = currentEdges.filter((edge) => edge.target === id);

    // 验证 1：检查是否有入边
    if (!incomingEdges.length) {
      return { imageUrl: null, error: "需要连接一个图片节点作为输入" };
    }

    // 查找源图片节点
    const parentImageNode = incomingEdges
      .map((edge) => currentNodes.find((node) => node.id === edge.source))
      .find((node) => node?.type === "imageNode");

    // 验证 2：检查源节点是否是图片节点
    if (!parentImageNode) {
      return { imageUrl: null, error: "输入节点必须是图片节点" };
    }

    // 从图片节点的数据中提取图片 URL
    const imageUrls = parentImageNode.data?.result?.data || [];

    // 验证 3：检查是否有生成结果
    if (!imageUrls || imageUrls.length === 0) {
      return { imageUrl: null, error: "输入图片节点没有生成图片" };
    }

    return { imageUrl: imageUrls[0], error: null };
  }, [id]);

  /**
   * 创建输出便签节点
   *
   * @param cleanContent - 便签内容（AI 生成的分析结果）
   * @description
   * 1. 计算便签的尺寸（根据内容长度）
   * 2. 在当前节点右侧创建便签节点
   * 3. 连接到当前节点的输出端口
   *
   * 【位置计算】
   * 新节点位于当前节点右侧 400px，Y 坐标相同
   */
  const createOutputNode = useCallback(
    (cleanContent: string) => {
      // 查找当前节点位置
      const currentNode = nodes.find((n) => n.id === id);

      // 计算新节点位置（当前节点右侧）
      const nextPosition = currentNode
        ? {
          x: currentNode.position.x + 400,
          y: currentNode.position.y,
        }
        : undefined;

      // 根据内容计算便签尺寸
      const noteSize = calculateNoteSize(cleanContent);

      // 创建便签节点
      const outputNoteId = addNode("note", nextPosition, {
        initialWidth: noteSize.width,
        initialHeight: noteSize.height,
        initialContent: cleanContent,
      });

      // 设置便签为非编辑状态
      setNoteNodeEditing(outputNoteId, false);

      // 延迟建立连接（等待节点创建完成）
      setTimeout(() => {
        onConnect({
          source: id, // 当前图片智能体节点
          sourceHandle: "output",
          target: outputNoteId, // 新创建的便签节点
          targetHandle: "input",
        });
      }, 100);
    },
    [id, nodes, addNode, setNoteNodeEditing, onConnect],
  );

  /**
   * 处理 API 错误响应
   *
   * @param resp - API 响应对象
   * @returns 错误信息字符串，或 null（如果没有错误）
   *
   * @description
   * 统一解析不同格式的 API 错误响应：
   * 1. { error: { message: "..." } } 格式
   * 2. { error: "..." } 格式
   * 3. { code: ..., message: "..." } 格式
   */
  const handleApiError = useCallback((resp: any): string | null => {
    // 格式 1：标准错误格式 { error: { message: "..." } }
    if (resp?.error) {
      const errorData = resp.error;
      return typeof errorData?.message === "string"
        ? errorData.message
        : typeof errorData === "string"
          ? errorData
          : JSON.stringify(errorData);
    }

    // 格式 2：带 code 和 message 的格式 { code: ..., message: ... }
    if (resp?.code && resp?.message) {
      return typeof resp.message === "string"
        ? resp.message
        : JSON.stringify(resp.message);
    }

    return null;
  }, []);

  /**
   * ============================================
   * handleGenerate - 核心生成函数
   * ============================================
   *
   * @description
   * 执行完整的图片分析流程：
   *
   * 【执行步骤】
   * 1. 前置验证
   *    - 检查是否正在生成中（防止重复点击）
   *    - 获取并验证父级图片节点
   *    - 检查预设是否已选择
   *    - 检查系统提示词是否为空
   *
   * 2. 发送请求
   *    - 更新状态为 "generating"
   *    - 调用 createDashscopeChatCompletion API
   *    - 传入图片 URL 和系统提示词
   *
   * 3. 处理响应
   *    - 解析错误响应
   *    - 检查 finish_reason（内容过滤、长度限制等）
   *    - 提取生成的文本内容
   *
   * 4. 创建输出
   *    - 创建便签节点
   *    - 自动连接节点
   *    - 更新状态为 "success"
   *
   * 5. 错误处理
   *    - 区分 AbortError（用户取消）和其他错误
   *    - 更新状态为 "error"
   *    - 显示错误消息
   */
  const handleGenerate = useCallback(async () => {
    // 防止重复点击
    if (isGenerating) return;

    // ========== 步骤 1：输入验证 ==========

    const { imageUrl, inputError } = getParentImageNode();
    if (inputError || !imageUrl) {
      warning(inputError || "未知错误");
      return;
    }

    if (!presetId) {
      warning("请先选择智能体类型");
      return;
    }

    const systemPrompt = editableSystemPrompt.trim();
    if (!systemPrompt) {
      warning("系统提示词不能为空");
      return;
    }

    // ========== 步骤 2：发送请求 ==========

    setIsGenerating(true);
    updateNodeData({ status: "generating", error: undefined });

    // 创建 AbortController 用于取消请求
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // 调用 AI API
      const response = await createDashscopeChatCompletion(
        {
          model: currentModel,
          messages: [
            {
              role: "user",
              content: [
                // 图片内容
                {
                  type: "image_url",
                  image_url: {
                    url: imageUrl,
                  },
                },
                // 文本指令
                {
                  type: "text",
                  text: systemPrompt,
                },
              ],
            },
          ],
        },
        abortController.signal,
      );

      const resp = response as any;

      // ========== 步骤 3：解析响应 ==========

      // 检查 API 错误
      const errorMsg = handleApiError(resp);
      if (errorMsg) {
        // error("分析失败", errorMsg);
        updateNodeData({ status: "error", error: errorMsg });
        setIsGenerating(false);
        return;
      }

      // 提取响应内容
      const choice = resp?.choices?.[0];
      const generatedContent = choice?.message?.content;
      const finishReason = choice?.finish_reason;

      // 检查内容过滤器
      if (finishReason === "content_filter") {
        error("分析失败", "内容被安全过滤器拦截");
        updateNodeData({ status: "error", error: "内容被安全过滤器拦截" });
        setIsGenerating(false);
        return;
      }

      // 检查长度限制
      if (finishReason === "length") {
        warning("分析内容达到最大长度限制，可能不完整");
      }

      // 检查有效内容
      if (!generatedContent) {
        error("分析失败", "未获取到有效内容");
        updateNodeData({ status: "error", error: "未获取到有效内容" });
        setIsGenerating(false);
        return;
      }

      const cleanContent = generatedContent;
      if (!cleanContent) {
        error("分析失败", "未获取到有效内容");
        updateNodeData({ status: "error", error: "未获取到有效内容" });
        setIsGenerating(false);
        return;
      }

      // ========== 步骤 4：创建输出节点 ==========

      createOutputNode(cleanContent);
      updateNodeData({ status: "success" });
      success("分析完成");
    } catch (err: any) {
      // ========== 步骤 5：错误处理 ==========

      // AbortError 是用户主动取消，不显示错误
      if (err.name !== "AbortError") {
        error("分析失败", err.message || "未知错误");
        updateNodeData({ status: "error", error: err.message || "未知错误" });
      }
    } finally {
      // 清理状态
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [
    isGenerating,
    getParentImageNode,
    presetId,
    editableSystemPrompt,
    currentModel,
    handleApiError,
    createOutputNode,
    updateNodeData,
    warning,
    error,
    success,
  ]);

  // ============================================
  // 返回值
  // ============================================

  return { isGenerating, handleGenerate };
};

/**
 * ============================================
 * calculateNoteSize - 计算便签节点尺寸
 * ============================================
 *
 * @param content - 便签文本内容
 * @returns { width: number, height: number } - 便签的宽度和高度
 *
 * @description
 * 根据内容自动计算便签节点的合适尺寸：
 * - 宽度：根据最长行字符数计算（每字符 8px）
 * - 高度：根据行数计算（每行 20px + 40px 内边距）
 * - 宽度范围：200px - 600px
 * - 高度范围：100px - 400px
 */
function calculateNoteSize(
  content: string,
): { width: number; height: number } {
  // 计算行数
  const lines = content.split("\n").length;

  // 计算最长行的字符数
  const maxLineLength = Math.max(
    ...content.split("\n").map((line) => line.length),
  );

  // 计算宽度：每字符 8px，限制在 200-600px
  const width = Math.min(Math.max(maxLineLength * 8, 200), 600);

  // 计算高度：每行 20px + 40px 内边距，限制在 100-400px
  const height = Math.min(Math.max(lines * 20 + 40, 100), 400);

  return { width, height };
}
