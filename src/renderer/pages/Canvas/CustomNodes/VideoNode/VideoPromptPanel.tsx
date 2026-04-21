import { useCallback, useEffect, useMemo, useRef } from "react";
import { VIDEO_MODELS } from "shared/constants/ai-models";
import { GenerationStatus } from "shared/constants/enum";
import { getVideoGenerationPoints } from "shared/constants/modelPoints";
import type { VideoGenerationNode } from "shared/types/flow";
import { getBalanceInfo } from "@/api/jikeing";
import { ModelPointsBadge } from "@/components/ModelPointsBadge";
import { PresetDropdown } from "@/components/PresetDropdown";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGenerationPoints } from "@/hooks/useGenerationPoints";
import useMessage from "@/hooks/useMessage";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

import { PROMPT_PANEL_STYLES } from "../shared/promptPanelStyles";
import { VideoModelParamsPanel } from "./components/VideoModelParamsPanel";
import type { VideoPromptEditorHandle } from "./components/VideoPromptEditor";
import { VideoPromptEditor } from "./components/VideoPromptEditor";
import { VideoReferenceAssetsBar } from "./components/VideoReferenceAssetsBar";
import {
  getVideoModelCapability,
  pickFirstAvailableVideoMode,
  VIDEO_MODE_BUTTONS,
  VideoInputMode,
} from "./constants/videoModelCapabilities";
import {
  getVideoLocalImageMentionId,
  getVideoParentAudioMentionId,
  getVideoParentImageMentionId,
  getVideoParentVideoMentionId,
  useVideoNodeReferences,
} from "./hooks/useVideoNodeReferences";
import { useVideoReferenceActions } from "./hooks/useVideoReferenceActions";
import { getVideoPayloadStrategy } from "./strategies/videoPayloadStrategies";

/**
 * 视频节点提示词面板（容器组件）。
 * 负责：聚合状态、分发子组件、组织“生成”动作。
 */
export const VideoPromptPanel = ({ nodeId }: { nodeId: string }) => {
  const editorRef = useRef<VideoPromptEditorHandle | null>(null);

  const { success, warning } = useMessage();
  const {
    totalPoints,
    fallbackAIGenPrice,
    refreshBalanceInfo,
    ensureEnoughPoints,
  } = useGenerationPoints();

  const nodes = useCanvasFlowStore((state) => state.nodes);
  const edges = useCanvasFlowStore((state) => state.edges);
  const startVideoGeneration = useCanvasFlowStore(
    (state) => state.startVideoGeneration,
  );
  const stopVideoPolling = useCanvasFlowStore(
    (state) => state.stopVideoPolling,
  );
  const updateVideoNodeData = useCanvasFlowStore(
    (state) => state.updateVideoNodeData,
  );
  const deleteEdge = useCanvasFlowStore((state) => state.deleteEdge);
  const setReferenceHoverHighlight = useCanvasFlowStore(
    (state) => state.setReferenceHoverHighlight,
  );

  const currentNode = useMemo(() => {
    return nodes.find((node) => node.id === nodeId);
  }, [nodes, nodeId]);

  const currentVideoData = useMemo(() => {
    if (!currentNode || currentNode.type !== "videoNode") {
      return null;
    }

    return currentNode.data as VideoGenerationNode;
  }, [currentNode]);

  const referenceImageUrls = useMemo(() => {
    return currentVideoData?.image_urls ?? [];
  }, [currentVideoData?.image_urls]);

  const model = useMemo(() => {
    const fallbackModel = VIDEO_MODELS[0]?.model ?? "doubao-seedance-2.0";
    const currentModel = currentVideoData?.model;
    if (!currentModel) {
      return fallbackModel;
    }

    const isSupportedModel = VIDEO_MODELS.some(
      (item) => item.model === currentModel,
    );
    return isSupportedModel ? currentModel : fallbackModel;
  }, [currentVideoData?.model]);
  const aspectRatio = currentVideoData?.aspect_ratio ?? "16:9";
  const promptDraftHtml = currentVideoData?.promptDraftHtml ?? "<p></p>";
  const seedance20Metadata = currentVideoData?.metadata ?? {};
  const requiredPoints = useMemo(() => {
    return getVideoGenerationPoints({
      model,
      fallback: Math.max(fallbackAIGenPrice, 1),
    });
  }, [fallbackAIGenPrice, model]);

  const currentModelCapability = useMemo(() => {
    return getVideoModelCapability(model);
  }, [model]);

  const selectedMode = useMemo(() => {
    const persistedMode = currentVideoData?.metadata?.generation_mode as
      | VideoInputMode
      | undefined;
    return pickFirstAvailableVideoMode(currentModelCapability, persistedMode);
  }, [currentModelCapability, currentVideoData?.metadata?.generation_mode]);

  const {
    parentVideoNodes,
    parentAudioNodes,
    parentImageNodes,
    parentImageNodeUrls,
    parentImageNodeIdByUrl,
    parentNoteContents,
    videoMentionItems,
    allImageUrls,
    allVideoUrls,
    allAudioUrls,
  } = useVideoNodeReferences({
    nodeId,
    nodes,
    edges,
    referenceImageUrls,
  });

  const isGenerating = useMemo(() => {
    if (!currentNode || currentNode.type !== "videoNode") {
      return false;
    }

    const status = currentNode.data.status;
    return (
      status === GenerationStatus.IN_PROGRESS ||
      status === GenerationStatus.QUEUED
    );
  }, [currentNode]);

  const modeButtonStateMap = useMemo(() => {
    const imageCount = allImageUrls.length;
    return {
      [VideoInputMode.TextToVideo]: {
        supported: currentModelCapability.supportedModes.includes(
          VideoInputMode.TextToVideo,
        ),
        available: true,
      },
      [VideoInputMode.ImageToVideo]: {
        supported: currentModelCapability.supportedModes.includes(
          VideoInputMode.ImageToVideo,
        ),
        available: imageCount >= 1,
      },
      [VideoInputMode.LastFrame]: {
        supported: currentModelCapability.supportedModes.includes(
          VideoInputMode.LastFrame,
        ),
        available: imageCount >= 2,
      },
      [VideoInputMode.MultiImageReference]: {
        supported: currentModelCapability.supportedModes.includes(
          VideoInputMode.MultiImageReference,
        ),
        available: imageCount >= 2,
      },
    };
  }, [allImageUrls.length, currentModelCapability.supportedModes]);

  useEffect(() => {
    if (!currentVideoData) {
      return;
    }

    const currentMode = currentVideoData.metadata?.generation_mode as
      | VideoInputMode
      | undefined;
    const normalizedMode = pickFirstAvailableVideoMode(
      currentModelCapability,
      currentMode,
    );

    if (currentMode === normalizedMode) {
      return;
    }

    updateVideoNodeData(nodeId, {
      metadata: {
        ...(currentVideoData.metadata ?? {}),
        generation_mode: normalizedMode,
      },
    });
  }, [currentModelCapability, currentVideoData, nodeId, updateVideoNodeData]);

  /**
   * 参考资源悬浮时，触发来源节点与连接边高亮。
   */
  const handleReferenceHoverChange = useCallback(
    (sourceNodeId: string, isHovering: boolean) => {
      if (!sourceNodeId) {
        return;
      }

      setReferenceHoverHighlight(sourceNodeId, nodeId, isHovering);
    },
    [nodeId, setReferenceHoverHighlight],
  );

  /**
   * 编辑器草稿变化回调。
   * 每次输入同步更新纯文本和富文本草稿，保持与当前节点数据一致。
   */
  const handleDraftChange = useCallback(
    (payload: { text: string; html: string }) => {
      updateVideoNodeData(nodeId, {
        promptDraft: payload.text,
        promptDraftHtml: payload.html,
      });
    },
    [nodeId, updateVideoNodeData],
  );

  const removeReferenceMentions = useCallback(
    (
      matchers: Array<{
        ids?: string[];
        thumbnail?: string;
        type?: "image" | "video" | "audio";
      }>,
    ) => {
      editorRef.current?.removeReferenceMentions(matchers);
    },
    [],
  );

  const availableReferenceMentions = useMemo(() => {
    return [
      ...(referenceImageUrls ?? []).map((url) => ({
        id: getVideoLocalImageMentionId(url),
        thumbnail: url,
        type: "image" as const,
      })),
      ...parentImageNodes.map((item) => ({
        id: getVideoParentImageMentionId(item.id),
        thumbnail: item.url,
        type: "image" as const,
      })),
      ...parentVideoNodes.map((item) => ({
        id: getVideoParentVideoMentionId(item.id),
        thumbnail: item.url,
        type: "video" as const,
      })),
      ...parentAudioNodes.map((item) => ({
        id: getVideoParentAudioMentionId(item.id),
        thumbnail: item.url,
        type: "audio" as const,
      })),
    ];
  }, [
    parentAudioNodes,
    parentImageNodes,
    parentVideoNodes,
    referenceImageUrls,
  ]);

  const previousAvailableReferenceMentionsRef = useRef<
    Array<{
      id: string;
      thumbnail: string;
      type: "image" | "video" | "audio";
    }>
  >([]);

  useEffect(() => {
    const previousItems = previousAvailableReferenceMentionsRef.current;
    const currentIds = new Set(
      availableReferenceMentions.map((item) => item.id),
    );
    const removedItems = previousItems.filter(
      (item) => !currentIds.has(item.id),
    );

    if (removedItems.length > 0) {
      removeReferenceMentions(
        removedItems.map((item) => ({
          ids: [item.id],
          thumbnail: item.thumbnail,
          type: item.type,
        })),
      );
    }

    previousAvailableReferenceMentionsRef.current = availableReferenceMentions;
  }, [availableReferenceMentions, removeReferenceMentions]);

  const handleDisconnectedReferenceNode = useCallback(
    (sourceNodeId: string) => {
      const parentImage = parentImageNodes.find(
        (item) => item.id === sourceNodeId,
      );
      if (parentImage) {
        removeReferenceMentions([
          {
            ids: [getVideoParentImageMentionId(sourceNodeId)],
            type: "image",
          },
        ]);
        return;
      }

      const parentVideo = parentVideoNodes.find(
        (item) => item.id === sourceNodeId,
      );
      if (parentVideo) {
        removeReferenceMentions([
          {
            ids: [getVideoParentVideoMentionId(sourceNodeId)],
            type: "video",
          },
        ]);
        return;
      }

      const parentAudio = parentAudioNodes.find(
        (item) => item.id === sourceNodeId,
      );
      if (parentAudio) {
        removeReferenceMentions([
          {
            ids: [getVideoParentAudioMentionId(sourceNodeId)],
            type: "audio",
          },
        ]);
      }
    },
    [
      parentAudioNodes,
      parentImageNodes,
      parentVideoNodes,
      removeReferenceMentions,
    ],
  );

  const handleRemovedUploadedReferenceImage = useCallback(
    (url: string) => {
      removeReferenceMentions([
        {
          ids: [getVideoLocalImageMentionId(url)],
          thumbnail: url,
          type: "image",
        },
      ]);
    },
    [removeReferenceMentions],
  );

  const {
    isUploading,
    fileInputRef,
    handleDisconnectNode,
    handleRemoveReferenceImage,
    handleUploadClick,
    handleFileChange,
  } = useVideoReferenceActions({
    nodeId,
    edges,
    currentImageUrls: referenceImageUrls,
    updateVideoNodeData,
    deleteEdge,
    onDisconnectedNode: handleDisconnectedReferenceNode,
    onRemovedReferenceImage: handleRemovedUploadedReferenceImage,
  });

  /**
   * 停止正在进行的视频生成轮询。
   */
  const handleStop = useCallback(() => {
    if (!isGenerating) return;
    stopVideoPolling(nodeId);
    // 重置节点状态为完成，清除进度和结果
    updateVideoNodeData(nodeId, {
      status: GenerationStatus.COMPLETED,
      progress: 0,
      result: undefined,
      error: undefined,
    });
    success("已停止生成");
  }, [isGenerating, stopVideoPolling, nodeId, success, updateVideoNodeData]);

  /**
   * 触发视频生成。
   * 合并上游 note 文本与当前编辑器文本后，按模型策略构建 payload。
   */
  const handleGenerate = useCallback(async () => {
    if (!currentVideoData) {
      warning("当前视频节点不可用");
      return;
    }

    // 防止连续点击触发重复请求
    if (isGenerating) {
      return;
    }

    const promptText = editorRef.current?.getPlainText() ?? "";
    const mergedPrompt = [...parentNoteContents, promptText]
      .map((content) => content.trim())
      .filter((content) => content.length > 0)
      .join(" ");

    if (!mergedPrompt) {
      warning("请输入提示词");
      return;
    }

    if (!currentModelCapability.callable) {
      warning("当前模型暂不可用，请切换其他模型");
      return;
    }

    const selectedModeState = modeButtonStateMap[selectedMode];
    if (!selectedModeState?.supported) {
      warning("当前模型不支持该生成模式");
      return;
    }
    if (!selectedModeState.available) {
      const modeValidationMessageMap = {
        [VideoInputMode.TextToVideo]: "当前模式可直接生成",
        [VideoInputMode.ImageToVideo]: "图生视频模式需要至少 1 张参考图",
        [VideoInputMode.LastFrame]: "首尾帧模式需要至少 2 张参考图",
        [VideoInputMode.MultiImageReference]: "多图参考模式需要至少 2 张参考图",
      };
      warning(modeValidationMessageMap[selectedMode]);
      return;
    }

    if (
      !ensureEnoughPoints({
        requiredPoints,
        actionLabel: "生成视频",
        warning,
      })
    ) {
      return;
    }

    // 所有图片在上传时已经上传到 OSS，或是在线 URL，直接使用即可
    const imageUrls = allImageUrls;

    // Seedance 2.0 在存在参考音频时仅允许使用 Pro 模式。
    // 命中该条件时先提示用户，再自动修正为 Pro 并继续本次生成。
    const hasReferenceAudio = allAudioUrls.length > 0;
    const currentSeedanceMode = currentVideoData.metadata?.mode ?? "fast";
    const shouldForceProMode =
      hasReferenceAudio && currentSeedanceMode !== "pro";

    let nextVideoData = currentVideoData;
    if (shouldForceProMode) {
      warning("当存在音频的时候只能使用Pro模型");

      const nextMetadata = {
        ...(currentVideoData.metadata ?? {}),
        mode: "pro",
      };

      // 同步更新节点状态，保证 UI 与后续生成配置一致。
      updateVideoNodeData(nodeId, { metadata: nextMetadata });

      // 使用本地修正后的快照立即构建 payload，避免等待 store 异步回流。
      nextVideoData = {
        ...currentVideoData,
        metadata: nextMetadata,
      };
    }

    nextVideoData = {
      ...nextVideoData,
      metadata: {
        ...(nextVideoData.metadata ?? {}),
        generation_mode: selectedMode,
      },
    };

    const strategy = getVideoPayloadStrategy(model);
    const payload = strategy.buildPayload(nextVideoData, {
      prompt: mergedPrompt,
      imageUrls: imageUrls,
      videoUrls: allVideoUrls,
      audioUrls: allAudioUrls,
    });

    const scoreCost = requiredPoints;
    try {
      const balanceResponse = await getBalanceInfo();
      const currentVipScore = Number(balanceResponse?.data?.vipScore ?? 0);
      if (currentVipScore < scoreCost) {
        warning(`积分不足，当前生成需 ${scoreCost} 积分`);
        return;
      }
    } catch (_balanceError: any) {
      warning("积分校验失败，请稍后重试");
      return;
    }

    await startVideoGeneration(nodeId, {
      ...payload,
      requiredPoints,
    });
    success("已开始生成视频");
    void refreshBalanceInfo();
  }, [
    currentVideoData,
    currentModelCapability.callable,
    warning,
    isGenerating,
    modeButtonStateMap,
    selectedMode,
    parentNoteContents,
    model,
    allImageUrls,
    allVideoUrls,
    allAudioUrls,
    updateVideoNodeData,
    startVideoGeneration,
    nodeId,
    success,
    requiredPoints,
    refreshBalanceInfo,
    ensureEnoughPoints,
  ]);

  return (
    <div className={PROMPT_PANEL_STYLES.container}>
      <div className={PROMPT_PANEL_STYLES.inputArea}>
        <div className="flex items-center gap-2 flex-wrap">
          {VIDEO_MODE_BUTTONS.map((item) => {
            const modeState = modeButtonStateMap[item.key];
            const isSelected = selectedMode === item.key;
            const isDisabled =
              !modeState?.supported || !modeState.available || isGenerating;

            return (
              <Button
                key={item.key}
                type="button"
                unstyled
                disabled={isDisabled}
                onClick={() => {
                  if (isDisabled) {
                    return;
                  }
                  updateVideoNodeData(nodeId, {
                    metadata: {
                      ...(currentVideoData?.metadata ?? {}),
                      generation_mode: item.key,
                    },
                  });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  isSelected
                    ? "bg-[#B43FEB]/20 text-[#d97bff] border-[#B43FEB]/60"
                    : "bg-white/5 text-white/70 border-white/10"
                } ${isDisabled ? "opacity-45 cursor-not-allowed" : "hover:bg-white/10 hover:text-white"}`}
              >
                {item.label}
              </Button>
            );
          })}
        </div>

        <VideoReferenceAssetsBar
          isUploading={isUploading}
          fileInputRef={fileInputRef}
          onUploadClick={handleUploadClick}
          onFileChange={handleFileChange}
          referenceImageUrls={referenceImageUrls}
          parentImageNodeUrls={parentImageNodeUrls}
          parentImageNodeIdByUrl={parentImageNodeIdByUrl}
          parentAudioNodes={parentAudioNodes}
          parentVideoNodes={parentVideoNodes}
          onDisconnectNode={handleDisconnectNode}
          onRemoveReferenceImage={handleRemoveReferenceImage}
          onReferenceHoverChange={handleReferenceHoverChange}
        />

        <div className={PROMPT_PANEL_STYLES.textAreaWrap}>
          <VideoPromptEditor
            ref={editorRef}
            promptDraftHtml={promptDraftHtml}
            mentionItems={videoMentionItems}
            onDraftChange={handleDraftChange}
          />
        </div>
      </div>

      <div className={PROMPT_PANEL_STYLES.divider} />

      <div className={PROMPT_PANEL_STYLES.controlArea}>
        <div className="flex items-center gap-3 flex-wrap w-full">
          <Select
            value={model}
            onValueChange={(value) => {
              const nextCapability = getVideoModelCapability(value);
              const nextMode = pickFirstAvailableVideoMode(nextCapability);
              updateVideoNodeData(nodeId, {
                model: value,
                metadata: {
                  ...(currentVideoData?.metadata ?? {}),
                  generation_mode: nextMode,
                },
              });
            }}
          >
            <SelectTrigger className={PROMPT_PANEL_STYLES.modelSelect}>
              <SelectValue placeholder="选择模型" />
            </SelectTrigger>
            <SelectContent className={PROMPT_PANEL_STYLES.modelSelectContent}>
              {VIDEO_MODELS.map((item) => (
                <SelectItem
                  key={item.id}
                  value={item.model}
                  disabled={item.callable === false}
                  className={PROMPT_PANEL_STYLES.modelSelectItem}
                >
                  {item.name}
                  {item.callable === false ? "（暂不可用）" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <VideoModelParamsPanel
            currentVideoData={currentVideoData}
            aspectRatio={aspectRatio}
            seedance20Metadata={seedance20Metadata}
            onPatch={(patch) => updateVideoNodeData(nodeId, patch)}
          />

          <div className="ml-auto flex items-center gap-3">
            {/* 预设提示词下拉 */}
            <PresetDropdown
              presetType="video"
              disabled={isGenerating || isUploading}
              onSelect={(content) => {
                editorRef.current?.insertContent(content);
              }}
            />

            <ModelPointsBadge
              totalPoints={totalPoints}
              requiredPoints={requiredPoints}
              title={`当前模型预计消耗 ${requiredPoints} 积分，当前余额 ${totalPoints}`}
            />

            {isGenerating ? (
              <Button
                type="button"
                unstyled
                className={PROMPT_PANEL_STYLES.stopButton}
                onClick={handleStop}
              >
                停止
              </Button>
            ) : (
              <Button
                type="button"
                unstyled
                className={PROMPT_PANEL_STYLES.generateButton}
                onClick={handleGenerate}
                disabled={isUploading}
              >
                生成
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
