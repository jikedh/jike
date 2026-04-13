/**
 * 图片智能体生成逻辑 hook
 * 处理图片分析流程、输入验证、输出节点创建等核心业务逻辑
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageAgentNodeType, ImageAgentPresetId } from "shared/types/flow";
import { createChatCompletion } from "@/api/ai";
import { useMessage } from "@/hooks/useMessage";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

interface UseImageAgentGenerateProps {
  id: string;
  presetId: ImageAgentPresetId | undefined;
  editableSystemPrompt: string;
  currentModel: string;
  dataStatus?: string;
}

export const useImageAgentGenerate = ({
  id,
  presetId,
  editableSystemPrompt,
  currentModel,
  dataStatus,
}: UseImageAgentGenerateProps) => {
  const [isGenerating, setIsGenerating] = useState(dataStatus === "generating");
  const abortControllerRef = useRef<AbortController | null>(null);

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

  useEffect(() => {
    setIsGenerating(dataStatus === "generating");
  }, [dataStatus]);

  useEffect(() => {
    if (dataStatus === "error" && isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
    }
  }, [dataStatus, isGenerating]);

  const updateNodeData = useCallback(
    (updates: Partial<ImageAgentNodeType["data"]>) => {
      updateImageAgentNodeData(id, updates);
    },
    [id, updateImageAgentNodeData],
  );

  const getParentImageNode = useCallback(() => {
    const currentEdges = useCanvasFlowStore.getState().edges;
    const currentNodes = useCanvasFlowStore.getState().nodes;

    const incomingEdges = currentEdges.filter((edge) => edge.target === id);
    if (!incomingEdges.length) {
      return { imageUrl: null, error: "需要连接一个图片节点作为输入" };
    }

    const parentImageNode = incomingEdges
      .map((edge) => currentNodes.find((node) => node.id === edge.source))
      .find((node) => node?.type === "imageNode");

    if (!parentImageNode) {
      return { imageUrl: null, error: "输入节点必须是图片节点" };
    }

    const imageUrls = parentImageNode.data?.result?.data || [];
    if (!imageUrls || imageUrls.length === 0) {
      return { imageUrl: null, error: "输入图片节点没有生成图片" };
    }

    return { imageUrl: imageUrls[0], error: null };
  }, [id]);

  const createOutputNode = useCallback(
    (cleanContent: string) => {
      const currentNode = nodes.find((n) => n.id === id);
      const nextPosition = currentNode
        ? {
            x: currentNode.position.x + 400,
            y: currentNode.position.y,
          }
        : undefined;

      const noteSize = calculateNoteSize(cleanContent);
      const outputNoteId = addNode("note", nextPosition, {
        initialWidth: noteSize.width,
        initialHeight: noteSize.height,
        initialContent: cleanContent,
      });
      setNoteNodeEditing(outputNoteId, false);

      setTimeout(() => {
        onConnect({
          source: id,
          sourceHandle: "output",
          target: outputNoteId,
          targetHandle: "input",
        });
      }, 100);
    },
    [id, nodes, addNode, setNoteNodeEditing, onConnect],
  );

  const handleApiError = useCallback((resp: any): string | null => {
    if (resp?.error) {
      const errorData = resp.error;
      return typeof errorData?.message === "string"
        ? errorData.message
        : typeof errorData === "string"
          ? errorData
          : JSON.stringify(errorData);
    }

    if (resp?.code && resp?.message) {
      return typeof resp.message === "string"
        ? resp.message
        : JSON.stringify(resp.message);
    }

    return null;
  }, []);

  const handleGenerate = useCallback(async () => {
    if (isGenerating) return;

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

    setIsGenerating(true);
    updateNodeData({ status: "generating", error: undefined });

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await createChatCompletion(
        {
          model: currentModel,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: imageUrl,
                  },
                },
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

      const errorMsg = handleApiError(resp);
      if (errorMsg) {
        error("分析失败", errorMsg);
        updateNodeData({ status: "error", error: errorMsg });
        setIsGenerating(false);
        return;
      }

      const choice = resp?.choices?.[0];
      const generatedContent = choice?.message?.content;
      const finishReason = choice?.finish_reason;

      if (finishReason === "content_filter") {
        error("分析失败", "内容被安全过滤器拦截");
        updateNodeData({ status: "error", error: "内容被安全过滤器拦截" });
        setIsGenerating(false);
        return;
      }

      if (finishReason === "length") {
        warning("分析内容达到最大长度限制，可能不完整");
      }

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

      createOutputNode(cleanContent);
      updateNodeData({ status: "success" });
      success("分析完成");
    } catch (err: any) {
      if (err.name !== "AbortError") {
        error("分析失败", err.message || "未知错误");
        updateNodeData({ status: "error", error: err.message || "未知错误" });
      }
    } finally {
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

  return { isGenerating, handleGenerate };
};

function calculateNoteSize(content: string): { width: number; height: number } {
  const lines = content.split("\n").length;
  const maxLineLength = Math.max(
    ...content.split("\n").map((line) => line.length),
  );
  const width = Math.min(Math.max(maxLineLength * 8, 200), 600);
  const height = Math.min(Math.max(lines * 20 + 40, 100), 400);
  return { width, height };
}