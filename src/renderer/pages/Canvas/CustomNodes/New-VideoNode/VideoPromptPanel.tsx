import { arrayMove } from "@dnd-kit/sortable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GenerationStatus } from "shared/constants/enum";
import { getVideoGenerationPoints } from "shared/constants/model-points";
import type { NewVideoGenerationNode } from "shared/types/flow";
import { ModelPointsBadge } from "@/components/ModelPointsBadge";
import { PresetDropdown } from "@/components/PresetDropdown";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGenerationPoints } from "@/hooks/useGenerationPoints";
import useMessage from "@/hooks/useMessage";
import {
  getVideoLocalImageMentionId,
  getVideoParentAudioMentionId,
  getVideoParentImageMentionId,
  getVideoParentVideoMentionId,
  useVideoNodeReferences,
} from "@/pages/Canvas/CustomNodes/VideoNode/hooks/useVideoNodeReferences";
import { useVideoReferenceActions } from "@/pages/Canvas/CustomNodes/VideoNode/hooks/useVideoReferenceActions";
import type { VideoPromptEditorHandle } from "@/pages/Canvas/CustomNodes/VideoNode/components/VideoPromptEditor";
import { VideoPromptEditor } from "@/pages/Canvas/CustomNodes/VideoNode/components/VideoPromptEditor";
import { VideoReferenceAssetsBar } from "@/pages/Canvas/CustomNodes/VideoNode/components/VideoReferenceAssetsBar";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";
import { PROMPT_PANEL_STYLES } from "../shared/promptPanelStyles";
import {
  BottomParamsBar,
  type VideoGenerateRequest,
} from "./components/BottomParamsBar";
import { ModeToggleBar } from "./components/ModeToggleBar";
import { ReferenceThumbnails } from "./components/ReferenceThumbnails";
import { type MentionItem, VIDEO_MODEL_OPTIONS } from "./constants/mockData";
import {
  ALL_MODE_KEYS,
  getFirstSupportedModeForModel,
  getSupportedModesForModel,
  type VideoModeKey,
} from "./constants/videoModelCapabilities";
import {
  normalizeVideoParams,
  type VideoParamState,
} from "./constants/videoParamConfigs";
import { useModeAvailability } from "./hooks/useModeAvailability";
import { buildVideoApiRequest } from "./utils/buildVideoApiRequest";

interface VideoPromptPanelProps {
  nodeId: string;
}

const isVideoModeKey = (value: unknown): value is VideoModeKey => {
  return typeof value === "string" && ALL_MODE_KEYS.includes(value as VideoModeKey);
};

const normalizeNewVideoModelId = (
  value: string | undefined,
  mode?: VideoModeKey,
) => {
  // Q2 模型暂时屏蔽：历史节点或上一次错误拆分的 ID 统一落到 Q3 Pro，避免下拉出现空值。
  if (
    value === "vidu-reference" ||
    value === "vidu-q2-fast" ||
    value === "vidu-q2-pro" ||
    value === "vidu-q2-pro-reference" ||
    value === "vidu-q2-pro-image-to-video"
  ) {
    return "vidu-q3-pro";
  }
  return value ?? VIDEO_MODEL_OPTIONS[0].value;
};

const buildReferenceItems = (
  imageUrls: string[] = [],
  videoUrls: string[] = [],
  audioUrls: string[] = [],
): MentionItem[] => [
  ...imageUrls.map((url, index) => ({
    id: `image-${index}-${url}`,
    label: `图片${index + 1}`,
    value: url,
    thumbnail: url,
    type: "image" as const,
  })),
  ...videoUrls.map((url, index) => ({
    id: `video-${index}-${url}`,
    label: `视频${index + 1}`,
    value: url,
    thumbnail: url,
    type: "video" as const,
  })),
  ...audioUrls.map((url, index) => ({
    id: `audio-${index}-${url}`,
    label: `音频${index + 1}`,
    value: url,
    thumbnail: url,
    type: "audio" as const,
  })),
];

export const VideoPromptPanel = ({ nodeId }: VideoPromptPanelProps) => {
  const editorRef = useRef<VideoPromptEditorHandle | null>(null);
  const { success, warning } = useMessage();
  const {
    pointsEnabled,
    totalPoints,
    fallbackAIGenPrice,
    normalizeRequiredPoints,
    refreshBalanceInfo,
    ensureEnoughPoints,
    validateBalanceBeforeGenerate,
  } = useGenerationPoints();

  const nodes = useCanvasFlowStore((state) => state.nodes);
  const edges = useCanvasFlowStore((state) => state.edges);
  const startNewVideoGeneration = useCanvasFlowStore(
    (state) => state.startNewVideoGeneration,
  );
  const stopVideoPolling = useCanvasFlowStore((state) => state.stopVideoPolling);
  const updateNewVideoNodeData = useCanvasFlowStore(
    (state) => state.updateNewVideoNodeData,
  );
  const deleteEdge = useCanvasFlowStore((state) => state.deleteEdge);
  const setReferenceHoverHighlight = useCanvasFlowStore(
    (state) => state.setReferenceHoverHighlight,
  );
  const setDefaultVideoPreset = useChatSettingsStore(
    (state) => state.setDefaultVideoPreset,
  );

  const currentNode = useMemo(
    () => nodes.find((node) => node.id === nodeId && node.type === "newVideoNode"),
    [nodes, nodeId],
  );
  const currentData = currentNode?.data as NewVideoGenerationNode | undefined;

  const metadataParams = currentData?.metadata?.params as
    | VideoParamState
    | undefined;
  const initialMode = isVideoModeKey(currentData?.metadata?.mode)
    ? currentData?.metadata?.mode
    : "all-reference";
  const model = normalizeNewVideoModelId(currentData?.model, initialMode);

  const [activeMode, setActiveMode] = useState<VideoModeKey>(initialMode);
  const [selectedModel, setSelectedModel] = useState(model);
  const [promptText, setPromptText] = useState(
    currentData?.promptDraft ?? currentData?.prompt ?? "",
  );
  const [selectedParams, setSelectedParams] = useState<VideoParamState>(() =>
    normalizeVideoParams(model, metadataParams, initialMode),
  );

  useEffect(() => {
    setSelectedModel(model);
  }, [model]);

  useEffect(() => {
    // 外部恢复工程或撤销重做后，同步面板状态，避免 UI 与节点数据分叉。
    setPromptText(currentData?.promptDraft ?? currentData?.prompt ?? "");
  }, [currentData?.prompt, currentData?.promptDraft]);

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
    referenceImageUrls: currentData?.image_urls ?? [],
  });

  // 兼容两种来源：连线带来的父节点引用，以及粘贴/历史数据里已经落到节点字段的媒体 URL。
  const mergedVideoUrls = useMemo(
    () => Array.from(new Set([...(currentData?.video_urls ?? []), ...allVideoUrls])),
    [allVideoUrls, currentData?.video_urls],
  );
  const mergedAudioUrls = useMemo(
    () => Array.from(new Set([...(currentData?.audio_urls ?? []), ...allAudioUrls])),
    [allAudioUrls, currentData?.audio_urls],
  );

  const generationReferenceItems = useMemo(
    () => buildReferenceItems(allImageUrls, mergedVideoUrls, mergedAudioUrls),
    [allImageUrls, mergedAudioUrls, mergedVideoUrls],
  );

  const sortableReferenceItems = useMemo(
    () =>
      buildReferenceItems(
        currentData?.image_urls,
        currentData?.video_urls,
        currentData?.audio_urls,
      ),
    [currentData?.audio_urls, currentData?.image_urls, currentData?.video_urls],
  );

  const referenceImages = useMemo(
    () =>
      generationReferenceItems
        .filter((item) => item.type === "image")
        .map((item) => item.thumbnail)
        .filter(Boolean),
    [generationReferenceItems],
  );

  const referenceAllImages =
    generationReferenceItems.length > 0 &&
    generationReferenceItems.every((item) => item.type === "image");

  const { modeStates } = useModeAvailability({
    selectedModelId: selectedModel,
    referenceCount: referenceImages.length,
    hasAnyReference: generationReferenceItems.length > 0,
    referenceAllImages,
  });

  const currentModeEnabled = useMemo(() => {
    const state = modeStates.find((mode) => mode.key === activeMode);
    return state?.enabled ?? false;
  }, [modeStates, activeMode]);

  const effectiveMode = useMemo(() => {
    if (currentModeEnabled) return activeMode;
    const firstEnabled = modeStates.find((mode) => mode.enabled);
    // 如果当前模型因为缺少参考图而暂时没有可用模式，仍停留在该模型支持的模式上，避免参数配置回落到默认模型。
    return firstEnabled?.key ?? getFirstSupportedModeForModel(selectedModel, activeMode);
  }, [currentModeEnabled, activeMode, modeStates, selectedModel]);

  useEffect(() => {
    if (effectiveMode !== activeMode) {
      setActiveMode(effectiveMode);
    }
  }, [effectiveMode, activeMode]);

  useEffect(() => {
    setSelectedParams((prev) =>
      normalizeVideoParams(selectedModel, prev, activeMode),
    );
  }, [selectedModel, activeMode]);

  const persistPanelPatch = useCallback(
    (patch: Partial<NewVideoGenerationNode>) => {
      updateNewVideoNodeData(nodeId, patch);
    },
    [nodeId, updateNewVideoNodeData],
  );

  const persistVideoDefaultPreset = useCallback(
    (params: {
      model?: string;
      mode?: VideoModeKey;
      videoParams?: VideoParamState;
    }) => {
      const nextParams = params.videoParams ?? selectedParams;
      // 与老版保持一致：用户调整模型/参数后立即记忆，下次新建视频节点沿用这组常用配置。
      setDefaultVideoPreset({
        model: params.model ?? selectedModel,
        aspectRatio: nextParams.aspectRatio ?? currentData?.aspect_ratio ?? "16:9",
        duration: nextParams.duration ?? currentData?.duration ?? 5,
        resolution: nextParams.resolution,
        mode: params.mode ?? activeMode,
        generateAudio: nextParams.generateAudio,
        promptExtend: nextParams.promptExtend,
      });
    },
    [
      activeMode,
      currentData?.aspect_ratio,
      currentData?.duration,
      selectedModel,
      selectedParams,
      setDefaultVideoPreset,
    ],
  );

  const handleModeChange = useCallback(
    (mode: VideoModeKey) => {
      const state = modeStates.find((item) => item.key === mode);
      if (!state?.enabled) {
        return;
      }

      setActiveMode(mode);
      persistVideoDefaultPreset({ mode });
      persistPanelPatch({
        metadata: {
          ...(currentData?.metadata ?? {}),
          mode,
        },
      });
    },
    [currentData?.metadata, modeStates, persistPanelPatch, persistVideoDefaultPreset],
  );

  const handleModelChange = useCallback(
    (modelId: string) => {
      const supportedModes = getSupportedModesForModel(modelId);
      // 对 Vidu Q2 Pro 这类单能力模型，切换模型时同步切到它支持的模式，避免 UI 和请求模式短暂错位。
      const nextMode = supportedModes.includes(activeMode)
        ? activeMode
        : getFirstSupportedModeForModel(modelId, activeMode);
      const nextParams = normalizeVideoParams(modelId, selectedParams, nextMode);
      setSelectedModel(modelId);
      setActiveMode(nextMode);
      setSelectedParams(nextParams);
      persistVideoDefaultPreset({
        model: modelId,
        mode: nextMode,
        videoParams: nextParams,
      });
      // 模型和参数即时写回节点，保证取消选中后再打开仍是刚才的选择。
      persistPanelPatch({
        model: modelId,
        duration: nextParams.duration,
        aspect_ratio: nextParams.aspectRatio ?? currentData?.aspect_ratio ?? "16:9",
        metadata: {
          ...(currentData?.metadata ?? {}),
          params: nextParams,
          mode: nextMode,
        },
      });
    },
    [activeMode, currentData?.aspect_ratio, currentData?.metadata, persistPanelPatch, persistVideoDefaultPreset, selectedParams],
  );

  const handleParamsChange = useCallback(
    (params: VideoParamState) => {
      const nextParams = normalizeVideoParams(selectedModel, params, activeMode);
      setSelectedParams(nextParams);
      persistVideoDefaultPreset({ videoParams: nextParams });
      persistPanelPatch({
        duration: nextParams.duration,
        aspect_ratio: nextParams.aspectRatio ?? currentData?.aspect_ratio ?? "16:9",
        metadata: {
          ...(currentData?.metadata ?? {}),
          params: nextParams,
          mode: activeMode,
        },
      });
    },
    [activeMode, currentData?.aspect_ratio, currentData?.metadata, persistPanelPatch, persistVideoDefaultPreset, selectedModel],
  );

  const handleDraftChange = useCallback(
    (payload: { text: string; html: string }) => {
      setPromptText(payload.text);
      // 新版恢复旧版的富文本草稿持久化，节点收起、保存工程和撤销重做都能找回输入。
      updateNewVideoNodeData(nodeId, {
        promptDraft: payload.text,
        promptDraftHtml: payload.html,
      } as Partial<NewVideoGenerationNode>);
    },
    [nodeId, updateNewVideoNodeData],
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

  const handleDisconnectedReferenceNode = useCallback(
    (sourceNodeId: string) => {
      const parentImage = parentImageNodes.find((item) => item.id === sourceNodeId);
      if (parentImage) {
        removeReferenceMentions([
          { ids: [getVideoParentImageMentionId(sourceNodeId)], type: "image" },
        ]);
        return;
      }

      const parentVideo = parentVideoNodes.find((item) => item.id === sourceNodeId);
      if (parentVideo) {
        removeReferenceMentions([
          { ids: [getVideoParentVideoMentionId(sourceNodeId)], type: "video" },
        ]);
        return;
      }

      const parentAudio = parentAudioNodes.find((item) => item.id === sourceNodeId);
      if (parentAudio) {
        removeReferenceMentions([
          { ids: [getVideoParentAudioMentionId(sourceNodeId)], type: "audio" },
        ]);
      }
    },
    [parentAudioNodes, parentImageNodes, parentVideoNodes, removeReferenceMentions],
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
    currentImageUrls: currentData?.image_urls ?? [],
    updateVideoNodeData: updateNewVideoNodeData,
    deleteEdge,
    onDisconnectedNode: handleDisconnectedReferenceNode,
    onRemovedReferenceImage: handleRemovedUploadedReferenceImage,
  });

  const handleReferenceHoverChange = useCallback(
    (sourceNodeId: string, isHovering: boolean) => {
      if (!sourceNodeId) return;
      setReferenceHoverHighlight(sourceNodeId, nodeId, isHovering);
    },
    [nodeId, setReferenceHoverHighlight],
  );

  const handleReferenceReorder = useCallback(
    (type: MentionItem["type"], fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;

      const fieldByType = {
        image: "image_urls",
        video: "video_urls",
        audio: "audio_urls",
      } as const;
      const field = fieldByType[type];
      const urls = currentData?.[field] ?? [];

      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= urls.length ||
        toIndex >= urls.length
      ) {
        return;
      }

      updateNewVideoNodeData(nodeId, {
        [field]: arrayMove(urls, fromIndex, toIndex),
      });
    },
    [currentData, nodeId, updateNewVideoNodeData],
  );

  const requiredPoints = useMemo(() => {
    const perTaskPoints = normalizeRequiredPoints(
      getVideoGenerationPoints({
        model: selectedModel,
        duration: selectedParams.duration,
        resolution: selectedParams.resolution,
        hasVideoInput: mergedVideoUrls.length > 0,
        hasAudio: Boolean(selectedParams.generateAudio ?? true),
        fallback: Math.max(fallbackAIGenPrice, 1),
      }),
    );
    return perTaskPoints;
  }, [
    fallbackAIGenPrice,
    mergedVideoUrls.length,
    normalizeRequiredPoints,
    selectedModel,
    selectedParams.duration,
    selectedParams.generateAudio,
    selectedParams.resolution,
  ]);

  const isGenerating =
    currentData?.status === GenerationStatus.QUEUED ||
    currentData?.status === GenerationStatus.IN_PROGRESS;

  const handleStop = useCallback(() => {
    if (!isGenerating) return;
    stopVideoPolling(nodeId);
    updateNewVideoNodeData(nodeId, {
      status: GenerationStatus.COMPLETED,
      progress: 0,
      result: { type: "video", data: [] },
      error: undefined,
    });
    success("已停止生成");
  }, [isGenerating, nodeId, stopVideoPolling, success, updateNewVideoNodeData]);

  const handleGenerate = useCallback(
    async (request: VideoGenerateRequest) => {
      if (isGenerating) {
        return;
      }

      const editorText = editorRef.current?.getPlainText() ?? request.prompt;
      const mergedPrompt = [...parentNoteContents, editorText]
        .map((content) => content.trim())
        .filter((content) => content.length > 0)
        .join(" ");

      if (!mergedPrompt) {
        warning("请输入提示词");
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

      if (
        !(await validateBalanceBeforeGenerate({
          requiredPoints,
          warning,
        }))
      ) {
        return;
      }

      const fullRequest: VideoGenerateRequest = {
        ...request,
        prompt: mergedPrompt,
        referenceItems: generationReferenceItems,
      };
      const apiRequest = buildVideoApiRequest(fullRequest);

      await startNewVideoGeneration(
        nodeId,
        {
          ...apiRequest,
          requiredPoints,
          __newVideoInput: fullRequest,
        },
        1,
      );
      success("已开始生成视频");
      void refreshBalanceInfo();
    },
    [
      ensureEnoughPoints,
      generationReferenceItems,
      isGenerating,
      nodeId,
      parentNoteContents,
      refreshBalanceInfo,
      requiredPoints,
      startNewVideoGeneration,
      success,
      validateBalanceBeforeGenerate,
      warning,
    ],
  );

  return (
    <TooltipProvider>
      <div className={PROMPT_PANEL_STYLES.container}>
        <div className={PROMPT_PANEL_STYLES.inputArea}>
          <div className="flex min-h-8 items-center gap-3 overflow-visible">
            <ModeToggleBar
              modeStates={modeStates}
              activeMode={activeMode}
              onModeChange={(key) => handleModeChange(key as VideoModeKey)}
            />
            {sortableReferenceItems.length > 1 ? (
              <div className="min-w-0 flex-1 overflow-visible">
                <ReferenceThumbnails
                  items={sortableReferenceItems}
                  onReorder={handleReferenceReorder}
                />
              </div>
            ) : null}
          </div>

          <VideoReferenceAssetsBar
            isUploading={isUploading}
            fileInputRef={fileInputRef}
            onUploadClick={handleUploadClick}
            onFileChange={handleFileChange}
            referenceImageUrls={currentData?.image_urls ?? []}
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
              promptDraftHtml={
                (currentData as any)?.promptDraftHtml ?? "<p></p>"
              }
              mentionItems={videoMentionItems}
              onDraftChange={handleDraftChange}
            />
          </div>
        </div>

        <div className={PROMPT_PANEL_STYLES.divider} />

        <BottomParamsBar
          selectedModel={selectedModel}
          selectedParams={selectedParams}
          prompt={promptText}
          referenceItems={generationReferenceItems}
          mode={activeMode}
          onModelChange={handleModelChange}
          onParamsChange={handleParamsChange}
          onGenerate={handleGenerate}
          onStop={handleStop}
          isGenerating={isGenerating}
          disabled={isUploading}
          accessory={
            <>
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
            </>
          }
        />
      </div>
    </TooltipProvider>
  );
};
