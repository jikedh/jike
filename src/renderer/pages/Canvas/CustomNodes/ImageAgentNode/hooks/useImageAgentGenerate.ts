/**
 * 图片智能体生成逻辑 hook
 * 处理图片反推流程：读取上游图片节点 URL → 调用 DashScope API → 创建便签子节点
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createDashscopeChatCompletion } from "@/api/ai";
import { useMessage } from "@/hooks/useMessage";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import type { ImageAgentNodeData, ImageAgentPresetId } from "shared/types/flow";

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

    const updateNodeData = useCallback(
        (updates: Partial<ImageAgentNodeData>) => {
            updateImageAgentNodeData(id, updates);
        },
        [id, updateImageAgentNodeData],
    );

    /**
     * 从上游连接的图片节点中获取图片 URL
     */
    const getParentImageUrl = useCallback((): { imageUrl: string | null; inputError: string | null } => {
        const currentEdges = useCanvasFlowStore.getState().edges;
        const currentNodes = useCanvasFlowStore.getState().nodes;

        const incomingEdges = currentEdges.filter((edge) => edge.target === id);
        if (!incomingEdges.length) {
            return { imageUrl: null, inputError: "需要连接一个图片节点作为输入" };
        }

        // 查找上游图片节点
        const parentImageNode = incomingEdges
            .map((edge) => currentNodes.find((node) => node.id === edge.source))
            .find((node) => node?.type === "imageNode");

        if (!parentImageNode) {
            return { imageUrl: null, inputError: "输入节点必须是图片节点" };
        }

        // 取第一张生成的图片 URL
        const imageData = parentImageNode.data?.result?.data;
        const imageUrl = Array.isArray(imageData) && imageData.length > 0
            ? imageData[0]?.url
            : parentImageNode.data?.image_urls?.[0];

        if (!imageUrl) {
            return { imageUrl: null, inputError: "图片节点尚未生成图片" };
        }

        return { imageUrl, inputError: null };
    }, [id]);

    /**
     * 将 API 返回的文本内容作为便签子节点追加到画布
     * 支持多次点击，每次生成新的子节点
     */
    const createOutputNoteNode = useCallback(
        (content: string) => {
            const currentNode = nodes.find((n) => n.id === id);

            // 基础偏移，新节点落在当前节点右侧；多次点击时 Y 轴随机偏移避免堆叠
            const baseOffset = { x: 400, y: 0 };
            const randomYOffset = (Math.random() - 0.5) * 80;

            const nextPosition = currentNode
                ? {
                    x: currentNode.position.x + baseOffset.x,
                    y: currentNode.position.y + baseOffset.y + randomYOffset,
                }
                : undefined;

            // 根据内容长度估算便签尺寸
            const lines = content.split("\n").length;
            const maxLineLength = Math.max(
                ...content.split("\n").map((line) => line.length),
            );
            const width = Math.min(Math.max(maxLineLength * 8, 280), 600);
            const height = Math.min(Math.max(lines * 20 + 60, 120), 400);

            const outputNoteId = addNode("note", nextPosition, {
                initialWidth: width,
                initialHeight: height,
                initialContent: content,
            });
            setNoteNodeEditing(outputNoteId, false);

            // 连接图片智能体 → 便签节点
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

    /**
     * 执行图片反推：调用阿里云百炼 API，传入图片 URL + 系统提示词
     */
    const handleGenerate = useCallback(async () => {
        if (isGenerating) return;

        // 校验前置条件
        const { imageUrl, inputError } = getParentImageUrl();
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
            /**
             * 调用阿里云百炼 API（qwen3.5-flash 支持图片输入）
             * 入参格式参考 DashscopeRequestBody：messages 中 content 为混合数组
             */
            const response = await createDashscopeChatCompletion(
                {
                    model: currentModel,
                    messages: [
                        {
                            role: "system",
                            content: systemPrompt,
                        },
                        {
                            role: "user",
                            content: [
                                {
                                    type: "image_url",
                                    image_url: { url: imageUrl },
                                },
                                {
                                    type: "text",
                                    text: "请根据以上指令分析这张图片。",
                                },
                            ],
                        },
                    ],
                    // 使用非流式，直接获取完整响应 DashscopeResponseBody
                    stream: false,
                },
                abortController.signal,
            );

            // 提取 DashscopeResponseBody.choices[0].message.content
            const content = response?.data?.choices?.[0]?.message?.content
                ?? response?.choices?.[0]?.message?.content;

            if (!content) {
                error("反推失败", "未获取到有效内容");
                updateNodeData({ status: "error", error: "未获取到有效内容" });
                setIsGenerating(false);
                return;
            }

            // 将结果渲染为便签子节点（支持多次追加）
            createOutputNoteNode(content);
            updateNodeData({ status: "success" });
            success("图片反推完成");
        } catch (err: any) {
            if (err?.name !== "AbortError") {
                updateNodeData({ status: "error", error: err?.message || "未知错误" });
                error("反推失败", err?.message || "未知错误");
            }
        } finally {
            setIsGenerating(false);
            abortControllerRef.current = null;
        }
    }, [
        isGenerating,
        getParentImageUrl,
        presetId,
        editableSystemPrompt,
        currentModel,
        createOutputNoteNode,
        updateNodeData,
        warning,
        error,
        success,
    ]);

    return { isGenerating, handleGenerate };
};
