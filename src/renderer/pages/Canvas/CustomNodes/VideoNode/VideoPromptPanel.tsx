import { useCallback, useEffect, useMemo, useRef } from "react";
import { GenerationStatus } from "shared/constants/enum";
import { getVideoGenerationPoints } from "shared/constants/model-points";
import type { VideoGenerationNode } from "shared/types/flow";
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
import { useChatSettingsStore } from "@/stores/chatSettingsStore";
import { PROMPT_PANEL_STYLES } from "../shared/promptPanelStyles";
import { getModelDefaultParams } from "./components/modelParamsConfig";
import { VideoModelParamsPanel } from "./components/VideoModelParamsPanel";
import type { VideoPromptEditorHandle } from "./components/VideoPromptEditor";
import { VideoPromptEditor } from "./components/VideoPromptEditor";
import { VideoReferenceAssetsBar } from "./components/VideoReferenceAssetsBar";
import {
  getVideoModelCapability,
  VIDEO_MODEL_FAMILY_OPTIONS,
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

const SEEEDANCE_SPECIAL_MODELS = new Set([
  "doubao-seedance-2.0-fast",
  "doubao-seedance-2.0-pro",
]);

const buildModelDefaultPatch = (
  model: string,
  currentVideoData: VideoGenerationNode | null,
) => {
  const defaults = getModelDefaultParams(model);
  const metadataPatch: Record<string, any> = {
    ...(currentVideoData?.metadata ?? {}),
  };

  const nextPatch: Record<string, any> = {
    model,
  };

  if (!defaults) {
    return nextPatch;
  }

  for (const [key, value] of Object.entries(defaults)) {
    if (key === "duration" || key === "aspect_ratio") {
      nextPatch[key] = value;
      continue;
    }

    metadataPatch[key] = value;
  }

  if (Object.keys(metadataPatch).length > 0) {
    nextPatch.metadata = metadataPatch;
  }

  return nextPatch;
};

/**
 * 视频节点提示词面板（容器组件）。
 * 负责：聚合状态、分发子组件、组织“生成”动作。
 */
export const VideoPromptPanel = ({ nodeId }: { nodeId: string }) => {
  const editorRef = useRef<VideoPromptEditorHandle | null>(null);

  const { success, warning } = useMessage();
  const {
    pointsEnabled,
    totalPoints,
    fallbackAIGenPrice,
    normalizeRequiredPoints,
    refreshBalanceInfo,
    validateBalanceBeforeGenerate,
  } = useGenerationPoints();

  const startVideoGeneration = useCanvasFlowStore(
    (state) => state.startVideoGeneration,
  );
  const stopVideoPolling = useCanvasFlowStore(
    (state) => state.stopVideoPolling,
  );
  const updateVideoNodeData = useCanvasFlowStore(
    (state) => state.updateVideoNodeData,
  );
  const setDefaultVideoPreset = useChatSettingsStore(
    (state) => state.setDefaultVideoPreset,
  );
  const deleteEdge = useCanvasFlowStore((state) => state.deleteEdge);
  const setReferenceHoverHighlight = useCanvasFlowStore(
    (state) => state.setReferenceHoverHighlight,
  );

  const currentVideoData = useCanvasFlowStore((state) => {
    const node = state.nodes.find((item) => item.id === nodeId);
    if (!node || node.type !== "videoNode") {
      return null;
    }

    return node.data as VideoGenerationNode;
  });

  const referenceImageUrls = useMemo(() => {
    return currentVideoData?.image_urls ?? [];
  }, [currentVideoData?.image_urls]);

  /** 当前视频模型，默认为豆包 Seedance 2.0 */
  const model = currentVideoData?.model ?? "doubao-seedance-2.0";
  const isCurrentSpecialSeedanceModel = SEEEDANCE_SPECIAL_MODELS.has(model);

  const promptDraftHtml = currentVideoData?.promptDraftHtml ?? "<p></p>";
  const {
    parentVideoNodes,
    parentAudioNodes,
    parentImageNodes,
    parentNoteContents,
    videoMentionItems,
    localReferenceImageUrls,
    localReferenceImageIndexes,
    allImageUrls,
    allVideoUrls,
    allAudioUrls,
  } = useVideoNodeReferences({
    nodeId,
    referenceImageUrls,
  });

  const currentModelCapability = useMemo(() => {
    return getVideoModelCapability(model);
  }, [model]);

  const persistVideoDefaultPreset = useCallback(
    (patch: Record<string, any>) => {
      const nextMetadata = {
        ...(currentVideoData?.metadata ?? {}),
        ...(patch.metadata ?? {}),
      };

      setDefaultVideoPreset({
        model: patch.model ?? currentVideoData?.model ?? model,
        aspectRatio:
          patch.aspect_ratio ?? currentVideoData?.aspect_ratio ?? "16:9",
        duration: patch.duration ?? currentVideoData?.duration ?? 5,
        resolution:
          nextMetadata.resolution ?? currentVideoData?.metadata?.resolution,
        mode: nextMetadata.mode,
        generateAudio: nextMetadata.generate_audio,
        audio: nextMetadata.audio,
        promptExtend: nextMetadata.prompt_extend,
      });
    },
    [
      currentVideoData?.aspect_ratio,
      currentVideoData?.duration,
      currentVideoData?.metadata,
      currentVideoData?.model,
      model,
      setDefaultVideoPreset,
    ],
  );

  const applyVideoBasicPatch = useCallback(
    (patch: Record<string, any>) => {
      persistVideoDefaultPreset(patch);
      updateVideoNodeData(nodeId, patch);
    },
    [nodeId, persistVideoDefaultPreset, updateVideoNodeData],
  );

  const requiredPoints = useMemo(() => {
    return normalizeRequiredPoints(
      getVideoGenerationPoints({
        model,
        duration: currentVideoData?.duration,
        resolution: currentVideoData?.metadata?.resolution,
        hasVideoInput: (allVideoUrls?.length ?? 0) > 0,
        hasAudio: Boolean(
          currentVideoData?.metadata?.generate_audio ??
          currentVideoData?.metadata?.audio ??
          (currentVideoData as any)?.generate_audio ??
          (currentVideoData as any)?.audio ??
          true,
        ),
        fallback: Math.max(fallbackAIGenPrice, 1),
      }),
    );
  }, [
    fallbackAIGenPrice,
    model,
    normalizeRequiredPoints,
    currentVideoData?.duration,
    currentVideoData?.metadata,
    allVideoUrls?.length,
  ]);

  const isGenerating = useMemo(() => {
    if (!currentVideoData) {
      return false;
    }

    const status = currentVideoData.status;
    return (
      status === GenerationStatus.IN_PROGRESS ||
      status === GenerationStatus.QUEUED
    );
  }, [currentVideoData]);

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

    // 所有图片在上传时已经上传到 OSS，或是在在线 URL，直接使用即可
    const imageUrls = allImageUrls;

    // Wan 2.7 R2V 模型特殊验证：必须提供参考素材或提示词
    if (model === "wan2.7-r2v") {
      const hasReferenceMaterial =
        imageUrls.length > 0 || allVideoUrls.length > 0;
      if (!hasReferenceMaterial) {
        warning("Wan 2.7 R2V 模型需要连接图片节点或视频节点作为参考素材");
        return;
      }
    }

    // Wan 2.7 T2V 模型特殊验证：必须提供文本提示词
    if (model === "wan2.7-t2v" && !mergedPrompt.trim()) {
      warning("Wan 2.7 T2V 模型需要输入文本提示词来生成视频");
      return;
    }

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

    const strategy = getVideoPayloadStrategy(model);
    const payload = strategy.buildPayload(nextVideoData, {
      prompt: mergedPrompt,
      imageUrls: imageUrls,
      videoUrls: allVideoUrls,
      audioUrls: allAudioUrls,
    });

    if (
      !(await validateBalanceBeforeGenerate({
        requiredPoints,
        warning,
      }))
    ) {
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
  ]);

  return (
    <div className={PROMPT_PANEL_STYLES.container}>
      <div className={PROMPT_PANEL_STYLES.inputArea}>
        <VideoReferenceAssetsBar
          isUploading={isUploading}
          fileInputRef={fileInputRef}
          onUploadClick={handleUploadClick}
          onFileChange={handleFileChange}
          referenceImageUrls={localReferenceImageUrls}
          referenceImageIndexes={localReferenceImageIndexes}
          parentImageNodes={parentImageNodes}
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
              const isNextSpecialSeedanceModel =
                SEEEDANCE_SPECIAL_MODELS.has(value);

              if (isNextSpecialSeedanceModel) {
                // 仅首次从其他模型切到 Fast/Pro 时，重置为约定默认值。
                if (!isCurrentSpecialSeedanceModel) {
                  applyVideoBasicPatch({
                    model: value,
                    aspect_ratio: "16:9",
                    duration: 10,
                    metadata: {
                      ...(currentVideoData?.metadata ?? {}),
                      resolution: "720p",
                    },
                  });
                  return;
                }

                applyVideoBasicPatch({ model: value });
                return;
              }

              applyVideoBasicPatch(
                buildModelDefaultPatch(value, currentVideoData),
              );
            }}
          >
            <SelectTrigger className={PROMPT_PANEL_STYLES.modelSelect}>
              <SelectValue placeholder="选择模型" />
            </SelectTrigger>
            <SelectContent className={PROMPT_PANEL_STYLES.modelSelectContent}>
              {VIDEO_MODEL_FAMILY_OPTIONS.map((item) => (
                <SelectItem
                  key={item.value}
                  value={item.value}
                  className={PROMPT_PANEL_STYLES.modelSelectItem}
                >
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <VideoModelParamsPanel
            currentVideoData={currentVideoData}
            onPatch={(patch) => applyVideoBasicPatch(patch)}
          />

          <div className="ml-auto flex items-center gap-3">
            {/* 预设提示词下拉 */}
            <PresetDropdown
              presetType="video"
              disabled={isUploading}
              onSelect={(content) => {
                editorRef.current?.insertContent(content);
              }}
            />

            {pointsEnabled ? (
              <ModelPointsBadge
                totalPoints={totalPoints}
                requiredPoints={requiredPoints}
                title={`当前模型预计消耗 ${requiredPoints} 积分，当前余额 ${totalPoints}`}
              />
            ) : null}

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
