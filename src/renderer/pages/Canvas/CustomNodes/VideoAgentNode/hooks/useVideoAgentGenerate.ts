/**
 * 视频智能体生成逻辑 hook
 * 处理视频分析流程、输入验证、输出节点创建等核心业务逻辑
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { VideoAgentNodeType, VideoAgentPresetId } from "shared/types/flow";
import { createChatCompletion, createDashscopeChatCompletion } from "@/api/ai";
import { useMessage } from "@/hooks/useMessage";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

interface UseVideoAgentGenerateProps {
  id: string;
  presetId: VideoAgentPresetId | undefined;
  editableSystemPrompt: string;
  currentModel: string;
  dataStatus?: string;
}

export const useVideoAgentGenerate = ({
  id,
  presetId,
  editableSystemPrompt,
  currentModel,
  dataStatus,
}: UseVideoAgentGenerateProps) => {
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
  const updateVideoAgentNodeData = useCanvasFlowStore(
    (state) => state.updateVideoAgentNodeData,
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
    (updates: Partial<VideoAgentNodeType["data"]>) => {
      updateVideoAgentNodeData(id, updates);
    },
    [id, updateVideoAgentNodeData],
  );

  const getParentVideoNode = useCallback(() => {
    const currentEdges = useCanvasFlowStore.getState().edges;
    const currentNodes = useCanvasFlowStore.getState().nodes;

    const incomingEdges = currentEdges.filter((edge) => edge.target === id);
    if (!incomingEdges.length) {
      return { videoUrl: null, error: "需要连接一个视频节点作为输入" };
    }

    const parentVideoNode = incomingEdges
      .map((edge) => currentNodes.find((node) => node.id === edge.source))
      .find((node) => node?.type === "videoNode");

    if (!parentVideoNode) {
      return { videoUrl: null, error: "输入节点必须是视频节点" };
    }

    const videoUrl = parentVideoNode.data?.video_url;
    if (!videoUrl) {
      return { videoUrl: null, error: "输入视频节点没有生成视频" };
    }

    return { videoUrl, error: null };
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

    const { videoUrl, inputError } = getParentVideoNode();
    if (inputError || !videoUrl) {
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
      // 根据模型选择不同的API服务
      let response;
      if (currentModel === "qwen3.5-flash") {
        // 使用阿里云百炼API
        response = await createDashscopeChatCompletion(
          {
            model: currentModel,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "video",
                    video: {
                      url: videoUrl,
                    },
                  },
                  {
                    type: "text",
                    text: systemPrompt,
                  },
                ],
              },
            ],
            stream: true,
            extra_body: {
              enable_thinking: true,
            },
          },
          abortController.signal,
        );
      } else {
        // 使用默认API
        response = await createChatCompletion(
          {
            model: currentModel || "qwen3.5-flash",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "video",
                    video: {
                      url: videoUrl,
                    },
                  },
                  {
                    type: "text",
                    text: systemPrompt,
                  },
                ],
              },
            ],
            stream: true,
            extra_body: {
              enable_thinking: true,
            },
          },
          abortController.signal,
        );
      }

      // 处理流式响应
      let fullContent = "";
      let thinkingContent = "";

      for await (const chunk of response) {
        if (chunk.reasoning_content) {
          thinkingContent += chunk.reasoning_content;
        }
        if (chunk.content) {
          fullContent += chunk.content;
        }
      }

      // 组合思考内容和最终内容
      const generatedContent = thinkingContent ? `${thinkingContent}\n\n${fullContent}` : fullContent;

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
        // error("分析失败", err.message || "未知错误");
        updateNodeData({ status: "error", error: err.message || "未知错误" });
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [
    isGenerating,
    getParentVideoNode,
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
