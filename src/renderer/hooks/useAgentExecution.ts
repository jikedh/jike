import { useCallback, useState } from "react";
import type { AllNodeType, EdgeType } from "shared/types/flow";
import type { NoteGenerationRequest } from "shared/types/NoteGeneration";
import { createDesktopChatCompletions } from "@/api/jikeGo";
import { useMessage } from "@/hooks/useMessage";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

/**
 * 获取父便签节点
 */
const getParentNoteNode = (
  nodeId: string,
  nodes: AllNodeType[],
  edges: EdgeType[],
) => {
  const incomingEdges = edges.filter((edge) => edge.target === nodeId);
  if (!incomingEdges.length) {
    return { node: null, error: "需要有便签节点作为智能体节点的父节点" };
  }

  const parentNoteNode = incomingEdges
    .map((edge) => nodes.find((node) => node.id === edge.source))
    .find((node) => node?.type === "noteNode");

  if (!parentNoteNode) {
    return { node: null, error: "智能体节点的父节点只能是便签节点" };
  }

  const parentContent = String(parentNoteNode.data?.content ?? "").trim();
  if (!parentContent) {
    return { node: null, error: "父便签内容不能为空，请先输入内容再生成" };
  }

  return { node: parentNoteNode, content: parentContent, error: null };
};

/**
 * Agent 执行 Hook
 * 处理 AI 内容生成的完整流程：验证 -> 调用 API -> 创建输出节点
 */
export const useAgentExecution = (options: {
  // 当前 Agent 节点 ID
  nodeId: string;
  // AI 模型
  model: string;
  // 预设消息列表（包含 system prompt）
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string;
  }>;
}): {
  // 是否正在生成
  isGenerating: boolean;
  // 执行生成
  execute: () => Promise<void>;
} => {
  const { nodeId, model, messages } = options;

  const [isGenerating, setIsGenerating] = useState(false);
  const { warning, error, success } = useMessage();

  const execute = useCallback(async () => {
    if (isGenerating) {
      return;
    }

    // 执行时读取最新的 store 快照，避免订阅 nodes/edges 导致频繁重渲染
    const {
      nodes,
      edges,
      addNode,
      onConnect,
      updateNoteNodeContent,
      setNoteNodeEditing,
    } = useCanvasFlowStore.getState();

    // 验证父节点
    const result = getParentNoteNode(nodeId, nodes, edges);
    if (result.error || !result.node) {
      warning(result.error ?? "未知错误");
      return;
    }

    const payload: NoteGenerationRequest = {
      model,
      messages: [
        ...messages,
        {
          role: "user",
          content: result.content!,
        },
      ],
    };

    setIsGenerating(true);

    try {
      const response = await createDesktopChatCompletions({
        ...payload,
        platform: "toapi",
        upstreamPath: "/v1/chat/completions",
      });
      const resp = (response as any)?.data ?? response;
      // console.log('AI 响应', response)
      // 检查是否是流式响应（AsyncGenerator）或普通响应
      const generatedContent =
        resp?.choices?.[0]?.message?.content ||
        "生成出现了点问题，未能获取到有效内容，请稍后再试~";

      if (!generatedContent) {
        error("生成失败", "未获取到有效的文本结果");
        return;
      }

      // 计算新节点位置（当前节点右侧）
      const currentNode = nodes.find((node) => node.id === nodeId);
      const nextPosition = currentNode
        ? {
            x: currentNode.position.x + 320,
            y: currentNode.position.y,
          }
        : undefined;

      // 创建新便签节点
      const newNoteId = addNode("note", nextPosition);
      updateNoteNodeContent(newNoteId, generatedContent);
      setNoteNodeEditing(newNoteId, false);

      // 建立连接
      onConnect({
        source: nodeId,
        sourceHandle: "output",
        target: newNoteId,
        targetHandle: "input",
      });

      success("生成成功");
    } catch (e: any) {
      error("生成失败");
    } finally {
      setIsGenerating(false);
    }
  }, [error, isGenerating, messages, model, nodeId, success, warning]);

  return {
    isGenerating,
    execute,
  };
};
