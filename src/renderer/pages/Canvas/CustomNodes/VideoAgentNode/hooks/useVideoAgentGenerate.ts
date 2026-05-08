/**
 * 视频智能体生成逻辑 hook
 * 调用阿里云百炼 API（qwen3.5-flash）分析视频，将结果追加到画布
 * video-pull-film 预设输出为表格节点，其他预设输出为便签节点
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { VideoAgentNodeType, VideoAgentPresetId } from "shared/types/flow";
import { createDashscopeChatCompletion } from "@/api/ai";
import { useMessage } from "@/hooks/useMessage";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { parseVideoAnalysisTable } from "../utils";

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

  const updateNodeData = useCallback(
    (updates: Partial<VideoAgentNodeType["data"]>) => {
      updateVideoAgentNodeData(id, updates);
    },
    [id, updateVideoAgentNodeData],
  );

  /** 从上游连接中获取视频 URL */
  const getParentVideoUrl = useCallback((): {
    videoUrl: string | null;
    inputError: string | null;
  } => {
    const currentEdges = useCanvasFlowStore.getState().edges;
    const currentNodes = useCanvasFlowStore.getState().nodes;

    const incomingEdges = currentEdges.filter((edge) => edge.target === id);
    if (!incomingEdges.length) {
      return { videoUrl: null, inputError: "需要连接一个视频节点作为输入" };
    }

    const parentVideoNode = incomingEdges
      .map((edge) => currentNodes.find((node) => node.id === edge.source))
      .find((node) => node?.type === "newVideoNode");

    if (!parentVideoNode) {
      return { videoUrl: null, inputError: "输入节点必须是视频节点" };
    }

    const videoUrl =
      parentVideoNode.data?.video_url ??
      parentVideoNode.data?.result?.data?.[0]?.url;
    if (!videoUrl) {
      return { videoUrl: null, inputError: "视频节点尚未生成视频" };
    }

    return { videoUrl, inputError: null };
  }, [id]);

  /**
   * 将 API 返回内容追加为子节点
   * video-pull-film 预设 → 表格节点
   * 其他预设 → 便签节点
   * 多次点击时每次生成独立新节点（Y 轴随机偏移避免堆叠）
   */
  const createOutputNode = useCallback(
    (content: string) => {
      const currentNode = nodes.find((n) => n.id === id);
      const randomYOffset = (Math.random() - 0.5) * 80;
      const nextPosition = currentNode
        ? {
            x: currentNode.position.x + 400,
            y: currentNode.position.y + randomYOffset,
          }
        : undefined;

      let outputNodeId: string;

      if (presetId === "video-pull-film") {
        // 视频拉片预设 → 输出表格节点
        const tableRows = parseVideoAnalysisTable(content);
        outputNodeId = addNode("table", nextPosition, {
          tableTitle: "视频拉片分析",
          tableColumns: [
            "时间点",
            "场景描述",
            "镜头类型",
            "关键动作",
            "画面构图",
            "台词字幕",
            "节奏分析",
          ],
          tableRows: tableRows,
        });
      } else {
        // 其他预设 → 输出便签节点
        const lines = content.split("\n").length;
        const maxLineLength = Math.max(
          ...content.split("\n").map((l) => l.length),
        );
        const width = Math.min(Math.max(maxLineLength * 8, 280), 600);
        const height = Math.min(Math.max(lines * 20 + 60, 120), 400);

        outputNodeId = addNode("note", nextPosition, {
          initialWidth: width,
          initialHeight: height,
          initialContent: content,
        });
        setNoteNodeEditing(outputNodeId, false);
      }

      setTimeout(() => {
        onConnect({
          source: id,
          sourceHandle: "output",
          target: outputNodeId,
          targetHandle: "input",
        });
      }, 100);
    },
    [id, nodes, presetId, addNode, setNoteNodeEditing, onConnect],
  );

  const handleGenerate = useCallback(async () => {
    if (isGenerating) return;

    const { videoUrl, inputError } = getParentVideoUrl();
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
      /**
       * 调用阿里云百炼 API（非流式）
       * 入参格式遵循 DashscopeRequestBody：video_url 类型传递视频地址
       */
      const response = await createDashscopeChatCompletion(
        {
          model: currentModel,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "video_url",
                  video_url: { url: videoUrl },
                },
                {
                  type: "text",
                  text: "请根据以上指令分析这段视频。",
                },
              ],
            },
          ],
          stream: false,
        },
        abortController.signal,
      );

      // 提取 DashscopeResponseBody.choices[0].message.content
      const content: string =
        response?.data?.choices?.[0]?.message?.content ??
        response?.choices?.[0]?.message?.content ??
        "";

      if (!content) {
        error("分析失败", "未获取到有效内容");
        updateNodeData({ status: "error", error: "未获取到有效内容" });
        return;
      }

      // 以便签子节点形式追加，支持多次点击
      createOutputNode(content);
      updateNodeData({ status: "success" });
      success("分析完成");
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        updateNodeData({ status: "error", error: err?.message || "未知错误" });
        error("分析失败", err?.message || "未知错误");
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [
    isGenerating,
    getParentVideoUrl,
    presetId,
    editableSystemPrompt,
    currentModel,
    createOutputNode,
    updateNodeData,
    warning,
    error,
    success,
  ]);

  return { isGenerating, handleGenerate };
};
