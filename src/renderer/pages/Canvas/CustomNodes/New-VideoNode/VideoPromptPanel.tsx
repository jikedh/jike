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
import type { VideoPromptEditorHandle } from "@/pages/Canvas/CustomNodes/VideoNode/components/VideoPromptEditor";
import { VideoPromptEditor } from "@/pages/Canvas/CustomNodes/VideoNode/components/VideoPromptEditor";
import { VideoReferenceAssetsBar } from "@/pages/Canvas/CustomNodes/VideoNode/components/VideoReferenceAssetsBar";
import {
  getVideoLocalImageMentionId,
  getVideoParentAudioMentionId,
  getVideoParentImageMentionId,
  getVideoParentVideoMentionId,
  useVideoNodeReferences,
} from "@/pages/Canvas/CustomNodes/VideoNode/hooks/useVideoNodeReferences";
import { useVideoReferenceActions } from "@/pages/Canvas/CustomNodes/VideoNode/hooks/useVideoReferenceActions";
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
  return (
    typeof value === "string" && ALL_MODE_KEYS.includes(value as VideoModeKey)
  );
};

const escapeHtml = (value: string) => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const buildPromptDraftHtml = (html?: string, text?: string) => {
  if (html && html.trim() && html !== "<p></p>") {
    return html;
  }

  const normalizedText = text?.trim();
  if (!normalizedText) {
    return "<p></p>";
  }

  // 兼容旧数据：部分节点只有纯文本草稿，没有富文本 HTML，切换模式时不能把提示词清空。
  return `<p>${escapeHtml(normalizedText).replace(/\n/g, "<br>")}</p>`;
};

const normalizeNewVideoModelId = (
  value: string | undefined,
  mode?: VideoModeKey,
) => {
  const availableModelIds = new Set(
    VIDEO_MODEL_OPTIONS.map((option) => option.value),
  );
  const fallbackModel = availableModelIds.has("adobe-sora2-pro")
    ? "adobe-sora2-pro"
    : VIDEO_MODEL_OPTIONS[0].value;

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
  if (value === "adobe-veo31" || value === "adobe-veo31-fast") {
    return fallbackModel;
  }
  return value && availableModelIds.has(value) ? value : fallbackModel;
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

type ReferenceSource =
  | string
  | {
    id?: string;
    mentionId?: string;
    url: string;
    thumbnail?: string;
  };

const normalizeReferenceSource = (
  item: ReferenceSource,
  fallbackId: string,
) => {
  if (typeof item === "string") {
    return {
      id: fallbackId,
      mentionId: undefined,
      url: item,
      thumbnail: item,
    };
  }

  return {
    id: item.id ?? fallbackId,
    mentionId: item.mentionId,
    url: item.url,
    thumbnail: item.thumbnail ?? item.url,
  };
};

const buildOrderedReferenceItems = (
  imageUrls: ReferenceSource[] = [],
  videoUrls: ReferenceSource[] = [],
  audioUrls: ReferenceSource[] = [],
): MentionItem[] => [
    ...imageUrls.map((item, index) => {
      const source = normalizeReferenceSource(
        item,
        `image-${index}-${typeof item === "string" ? item : item.url}`,
      );
      return {
        id: source.id,
        label: `图片${index + 1}`,
        value: source.url,
        thumbnail: source.thumbnail,
        url: source.url,
        mentionId: source.mentionId,
        type: "image" as const,
      };
    }),
    ...videoUrls.map((item, index) => {
      const source = normalizeReferenceSource(
        item,
        `video-${index}-${typeof item === "string" ? item : item.url}`,
      );
      return {
        id: source.id,
        label: `视频${index + 1}`,
        value: source.url,
        thumbnail: source.thumbnail,
        url: source.url,
        mentionId: source.mentionId,
        type: "video" as const,
      };
    }),
    ...audioUrls.map((item, index) => {
      const source = normalizeReferenceSource(
        item,
        `audio-${index}-${typeof item === "string" ? item : item.url}`,
      );
      return {
        id: source.id,
        label: `音频${index + 1}`,
        value: source.url,
        thumbnail: source.thumbnail,
        url: source.url,
        mentionId: source.mentionId,
        type: "audio" as const,
      };
    }),
  ];

const relabelReferenceItemsByOrder = (items: MentionItem[]) => {
  const counters: Record<MentionItem["type"], number> = {
    image: 0,
    video: 0,
    audio: 0,
  };
  const labelPrefix: Record<MentionItem["type"], string> = {
    image: "图片",
    video: "视频",
    audio: "音频",
  };

  return items.map((item) => {
    counters[item.type] += 1;
    return {
      ...item,
      label: `${labelPrefix[item.type]}${counters[item.type]}`,
    };
  });
};

const orderReferenceItems = (
  items: MentionItem[],
  order: unknown,
): MentionItem[] => {
  if (!Array.isArray(order) || order.length === 0) {
    return items;
  }

  const itemMap = new Map(items.map((item) => [item.id, item]));
  const usedIds = new Set<string>();
  const orderedItems = order.flatMap((id) => {
    if (typeof id !== "string" || usedIds.has(id)) {
      return [];
    }
    const item = itemMap.get(id);
    if (!item) {
      return [];
    }
    usedIds.add(id);
    return [item];
  });

  return [...orderedItems, ...items.filter((item) => !usedIds.has(item.id))];
};

export const VideoPromptPanel = ({ nodeId }: VideoPromptPanelProps) => {
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

  const startNewVideoGeneration = useCanvasFlowStore(
    (state) => state.startNewVideoGeneration,
  );
  const stopVideoPolling = useCanvasFlowStore(
    (state) => state.stopVideoPolling,
  );
  const updateNewVideoNodeData = useCanvasFlowStore(
    (state) => state.updateNewVideoNodeData,
  );
  const syncNodeSelection = useCanvasFlowStore((state) => state.onNodesChange);
  const deleteEdge = useCanvasFlowStore((state) => state.deleteEdge);
  const setReferenceHoverHighlight = useCanvasFlowStore(
    (state) => state.setReferenceHoverHighlight,
  );
  const setDefaultNewVideoPreset = useChatSettingsStore(
    (state) => state.setDefaultNewVideoPreset,
  );

  const currentData = useCanvasFlowStore((state) => {
    const node = state.nodes.find(
      (item) => item.id === nodeId && item.type === "newVideoNode",
    );
    return node?.data as NewVideoGenerationNode | undefined;
  });

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
  const promptDraftHtml = useMemo(
    () =>
      buildPromptDraftHtml(
        (currentData as { promptDraftHtml?: string } | undefined)
          ?.promptDraftHtml,
        currentData?.promptDraft ?? currentData?.prompt,
      ),
    [
      currentData?.prompt,
      currentData?.promptDraft,
      (currentData as any)?.promptDraftHtml,
    ],
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
    parentNoteContents,
    videoMentionItems,
    localReferenceImageUrls,
    localReferenceImageIndexes,
    allVideoUrls,
    allAudioUrls,
  } = useVideoNodeReferences({
    nodeId,
    referenceImageUrls: currentData?.image_urls ?? [],
  });

  // 兼容两种来源：连线带来的父节点引用，以及粘贴/历史数据里已经落到节点字段的媒体 URL。
  const mergedVideoUrls = useMemo(
    () => [...(currentData?.video_urls ?? []), ...allVideoUrls],
    [allVideoUrls, currentData?.video_urls],
  );
  const mergedAudioUrls = useMemo(
    () => [...(currentData?.audio_urls ?? []), ...allAudioUrls],
    [allAudioUrls, currentData?.audio_urls],
  );

  const imageReferenceSources = useMemo<ReferenceSource[]>(() => {
    return [
      ...localReferenceImageUrls.map((url, index) => ({
        id: `local-image-${localReferenceImageIndexes[index]}-${url}`,
        mentionId: getVideoLocalImageMentionId(url),
        url,
        thumbnail: url,
      })),
      ...parentImageNodes.map((item) => ({
        id: `parent-image-${item.id}`,
        mentionId: getVideoParentImageMentionId(item.id),
        url: item.url,
        thumbnail: item.displayUrl ?? item.url,
      })),
    ];
  }, [localReferenceImageIndexes, localReferenceImageUrls, parentImageNodes]);

  const videoReferenceSources = useMemo<ReferenceSource[]>(() => {
    const parentVideoUrlCounts = new Map<string, number>();
    parentVideoNodes.forEach((item) => {
      parentVideoUrlCounts.set(
        item.url,
        (parentVideoUrlCounts.get(item.url) ?? 0) + 1,
      );
    });
    const localVideoUrls = (currentData?.video_urls ?? []).flatMap((url) => {
      const parentCount = parentVideoUrlCounts.get(url) ?? 0;
      if (parentCount > 0) {
        parentVideoUrlCounts.set(url, parentCount - 1);
        return [];
      }
      return [url];
    });

    return [
      ...localVideoUrls.map((url, index) => ({
        id: `local-video-${index}-${url}`,
        url,
        thumbnail: url,
      })),
      ...parentVideoNodes.map((item) => ({
        id: `parent-video-${item.id}`,
        mentionId: getVideoParentVideoMentionId(item.id),
        url: item.url,
        thumbnail: item.url,
      })),
    ];
  }, [currentData?.video_urls, parentVideoNodes]);

  const audioReferenceSources = useMemo<ReferenceSource[]>(() => {
    const parentAudioUrlCounts = new Map<string, number>();
    parentAudioNodes.forEach((item) => {
      parentAudioUrlCounts.set(
        item.url,
        (parentAudioUrlCounts.get(item.url) ?? 0) + 1,
      );
    });
    const localAudioUrls = (currentData?.audio_urls ?? []).flatMap((url) => {
      const parentCount = parentAudioUrlCounts.get(url) ?? 0;
      if (parentCount > 0) {
        parentAudioUrlCounts.set(url, parentCount - 1);
        return [];
      }
      return [url];
    });

    return [
      ...localAudioUrls.map((url, index) => ({
        id: `local-audio-${index}-${url}`,
        url,
        thumbnail: "/audio-icon.svg",
      })),
      ...parentAudioNodes.map((item) => ({
        id: `parent-audio-${item.id}`,
        mentionId: getVideoParentAudioMentionId(item.id),
        url: item.url,
        thumbnail: "/audio-icon.svg",
      })),
    ];
  }, [currentData?.audio_urls, parentAudioNodes]);

  const generationReferenceItems = useMemo(() => {
    // 新版视频节点独立维护参考素材顺序：UI 缩略图可以是低清图，但传参始终使用 url 字段里的真实资源地址。
    const items = buildOrderedReferenceItems(
      imageReferenceSources,
      videoReferenceSources,
      audioReferenceSources,
    );
    return relabelReferenceItemsByOrder(
      orderReferenceItems(items, currentData?.metadata?.referenceOrder),
    );
  }, [
    currentData?.metadata?.referenceOrder,
    audioReferenceSources,
    imageReferenceSources,
    videoReferenceSources,
  ]);

  const sortableReferenceItems = generationReferenceItems;

  const editorMentionItems = useMemo(() => {
    return generationReferenceItems.map((item) => ({
      id: item.mentionId ?? item.id,
      label: item.label,
      value: item.label,
      thumbnail: item.thumbnail,
      type: item.type,
    }));
  }, [generationReferenceItems]);

  useEffect(() => {
    editorRef.current?.updateReferenceMentions(editorMentionItems);
  }, [editorMentionItems]);

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
    videoReferenceCount: generationReferenceItems.filter(
      (item) => item.type === "video",
    ).length,
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
    return (
      firstEnabled?.key ??
      getFirstSupportedModeForModel(selectedModel, activeMode)
    );
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
      const { nodes } = useCanvasFlowStore.getState();
      const selectionChanges = nodes.flatMap((node) => {
        if (node.id === nodeId) {
          return node.selected
            ? []
            : [{ id: node.id, type: "select" as const, selected: true }];
        }

        return node.selected
          ? [{ id: node.id, type: "select" as const, selected: false }]
          : [];
      });

      if (selectionChanges.length > 0) {
        /* 同步选中态，避免切换模型时关闭提示词面板。 */
        syncNodeSelection(selectionChanges);
      }

      updateNewVideoNodeData(nodeId, patch);
    },
    [nodeId, syncNodeSelection, updateNewVideoNodeData],
  );

  const persistVideoDefaultPreset = useCallback(
    (params: {
      model?: string;
      mode?: VideoModeKey;
      videoParams?: VideoParamState;
    }) => {
      const nextParams = params.videoParams ?? selectedParams;
      // 与老版保持一致：用户调整模型/参数后立即记忆，下次新建生成视频节点沿用这组常用配置。
      // 新版视频节点使用独立记忆，避免和老版视频节点的模型/模式/参数互相覆盖。
      setDefaultNewVideoPreset({
        model: params.model ?? selectedModel,
        aspectRatio:
          nextParams.aspectRatio ?? currentData?.aspect_ratio ?? "16:9",
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
      setDefaultNewVideoPreset,
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
    [
      currentData?.metadata,
      modeStates,
      persistPanelPatch,
      persistVideoDefaultPreset,
    ],
  );

  const handleModelChange = useCallback(
    (modelId: string) => {
      const supportedModes = getSupportedModesForModel(modelId);
      // 对 Vidu Q2 Pro 这类单能力模型，切换模型时同步切到它支持的模式，避免 UI 和请求模式短暂错位。
      const nextMode = supportedModes.includes(activeMode)
        ? activeMode
        : getFirstSupportedModeForModel(modelId, activeMode);
      const nextParams = normalizeVideoParams(
        modelId,
        selectedParams,
        nextMode,
      );
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
        aspect_ratio:
          nextParams.aspectRatio ?? currentData?.aspect_ratio ?? "16:9",
        metadata: {
          ...(currentData?.metadata ?? {}),
          params: nextParams,
          mode: nextMode,
        },
      });
    },
    [
      activeMode,
      currentData?.aspect_ratio,
      currentData?.metadata,
      persistPanelPatch,
      persistVideoDefaultPreset,
      selectedParams,
    ],
  );

  const handleParamsChange = useCallback(
    (params: VideoParamState) => {
      const nextParams = normalizeVideoParams(
        selectedModel,
        params,
        activeMode,
      );
      setSelectedParams(nextParams);
      persistVideoDefaultPreset({ videoParams: nextParams });
      persistPanelPatch({
        duration: nextParams.duration,
        aspect_ratio:
          nextParams.aspectRatio ?? currentData?.aspect_ratio ?? "16:9",
        metadata: {
          ...(currentData?.metadata ?? {}),
          params: nextParams,
          mode: activeMode,
        },
      });
    },
    [
      activeMode,
      currentData?.aspect_ratio,
      currentData?.metadata,
      persistPanelPatch,
      persistVideoDefaultPreset,
      selectedModel,
    ],
  );

  const handleDraftChange = useCallback(
    (payload: { text: string; html: string }) => {
      setPromptText(payload.text);
      const { nodes } = useCanvasFlowStore.getState();
      const currentNodeSelected = nodes.some(
        (node) => node.id === nodeId && node.selected,
      );

      if (!currentNodeSelected) {
        /* 同步选中态，避免输入草稿时提示词面板被关闭。 */
        syncNodeSelection([
          { id: nodeId, type: "select" as const, selected: true },
        ]);
      }
      // 新版恢复旧版的富文本草稿持久化，节点收起、保存工程和撤销重做都能找回输入。
      updateNewVideoNodeData(nodeId, {
        promptDraft: payload.text,
        promptDraftHtml: payload.html,
      } as Partial<NewVideoGenerationNode>);
    },
    [nodeId, syncNodeSelection, updateNewVideoNodeData],
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
      const parentImage = parentImageNodes.find(
        (item) => item.id === sourceNodeId,
      );
      if (parentImage) {
        removeReferenceMentions([
          { ids: [getVideoParentImageMentionId(sourceNodeId)], type: "image" },
        ]);
        return;
      }

      const parentVideo = parentVideoNodes.find(
        (item) => item.id === sourceNodeId,
      );
      if (parentVideo) {
        removeReferenceMentions([
          { ids: [getVideoParentVideoMentionId(sourceNodeId)], type: "video" },
        ]);
        return;
      }

      const parentAudio = parentAudioNodes.find(
        (item) => item.id === sourceNodeId,
      );
      if (parentAudio) {
        removeReferenceMentions([
          { ids: [getVideoParentAudioMentionId(sourceNodeId)], type: "audio" },
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

  const handleSortableReferenceHoverChange = useCallback(
    (item: MentionItem, isHovering: boolean) => {
      const parentPrefixes = [
        "parent-image-",
        "parent-video-",
        "parent-audio-",
      ];
      const matchedPrefix = parentPrefixes.find((prefix) =>
        item.id.startsWith(prefix),
      );

      if (!matchedPrefix) {
        return;
      }

      // 新版可排序缩略图替代原父节点缩略图后，悬浮时仍需要高亮对应连线。
      handleReferenceHoverChange(
        item.id.slice(matchedPrefix.length),
        isHovering,
      );
    },
    [handleReferenceHoverChange],
  );

  const handleReferenceReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;

      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= sortableReferenceItems.length ||
        toIndex >= sortableReferenceItems.length
      ) {
        return;
      }

      const nextItems = relabelReferenceItemsByOrder(
        arrayMove(sortableReferenceItems, fromIndex, toIndex),
      );
      editorRef.current?.updateReferenceMentions(
        nextItems.map((item) => ({
          id: item.mentionId ?? item.id,
          label: item.label,
          value: item.label,
          thumbnail: item.thumbnail,
          type: item.type,
        })),
      );
      // 新版视频节点的参考素材支持图片/视频/音频跨类型排序，顺序单独记录在 metadata.referenceOrder。
      updateNewVideoNodeData(nodeId, {
        metadata: {
          ...(currentData?.metadata ?? {}),
          referenceOrder: nextItems.map((item) => item.id),
        },
      });
    },
    [
      currentData?.metadata,
      nodeId,
      sortableReferenceItems,
      updateNewVideoNodeData,
    ],
  );

  const handleSortableReferenceRemove = useCallback(
    (item: MentionItem) => {
      const localImageIndex = localReferenceImageUrls.findIndex(
        (url, index) => {
          return (
            item.id ===
            `local-image-${localReferenceImageIndexes[index]}-${url}`
          );
        },
      );

      if (localImageIndex >= 0) {
        // 新版排序缩略图替代原素材缩略图后，仍然要保留本地参考图的移除能力。
        handleRemoveReferenceImage(
          localReferenceImageUrls[localImageIndex],
          localReferenceImageIndexes[localImageIndex] ?? localImageIndex,
        );
        return;
      }

      const parentPrefixes = [
        "parent-image-",
        "parent-video-",
        "parent-audio-",
      ];
      const matchedPrefix = parentPrefixes.find((prefix) =>
        item.id.startsWith(prefix),
      );

      if (matchedPrefix) {
        handleDisconnectNode(item.id.slice(matchedPrefix.length));
      }
    },
    [
      handleDisconnectNode,
      handleRemoveReferenceImage,
      localReferenceImageIndexes,
      localReferenceImageUrls,
    ],
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
        request.mode === "all-reference" &&
        generationReferenceItems.length === 0
      ) {
        // 全能参考模式默认保持可选，但真正生成前必须至少有一个图片/视频/音频参考素材。
        warning("全能参考模式需要至少上传或连接一个参考素材");
        return;
      }

      if (request.model === "adobe-sora2-pro") {
        const imageCount = generationReferenceItems.filter(
          (item) => item.type === "image",
        ).length;
        const allImages =
          generationReferenceItems.length === 0 ||
          generationReferenceItems.every((item) => item.type === "image");
        if (!allImages) {
          warning("Sora2Pro（Adobe版本）仅支持图片参考素材");
          return;
        }
        if (request.mode === "text-to-video" && imageCount > 0) {
          warning("Sora2Pro（Adobe版本）文生视频请不要传参考图");
          return;
        }
        if (request.mode !== "text-to-video" && imageCount < 1) {
          warning("Sora2Pro（Adobe版本）图生视频请上传或连接 1 张参考图");
          return;
        }
      }

      if (
        request.model === "adobe-veo31" ||
        request.model === "adobe-veo31-fast"
      ) {
        const imageCount = generationReferenceItems.filter(
          (item) => item.type === "image",
        ).length;
        const allImages =
          generationReferenceItems.length === 0 ||
          generationReferenceItems.every((item) => item.type === "image");

        if (request.mode === "text-to-video" && generationReferenceItems.length > 0) {
          warning("Veo3.1 文生视频请不要传参考图");
          return;
        }

        if (request.mode === "image-to-video" && (imageCount !== 1 || !allImages)) {
          warning("Veo3.1 图生视频需要且仅支持 1 张参考图");
          return;
        }

        if (
          request.mode === "first-last-frame" &&
          (imageCount !== 2 || !allImages)
        ) {
          warning("Veo3.1 首尾帧需要且仅支持 2 张参考图");
          return;
        }

        if (request.mode === "all-reference") {
          if (request.model === "adobe-veo31-fast") {
            warning("Veo3.1 Fast 不支持全能参考");
            return;
          }

          if (imageCount < 1 || imageCount > 3 || !allImages) {
            warning("该模型只支持1~3图片做为参考图");
            return;
          }
        }
      }

      if (request.model === "happyhorse") {
        const imageCount = generationReferenceItems.filter(
          (item) => item.type === "image",
        ).length;
        const videoCount = generationReferenceItems.filter(
          (item) => item.type === "video",
        ).length;

        if (request.mode === "all-reference" && imageCount === 0) {
          warning("HappyHores 参考生视频需要至少 1 张参考图");
          return;
        }

        if (request.mode === "image-to-video" && imageCount !== 1) {
          warning("HappyHores 图生视频需要且仅支持 1 张首帧图");
          return;
        }

        if (request.mode === "video-edit" && videoCount !== 1) {
          warning("HappyHores 视频编辑需要且仅支持 1 个视频素材");
          return;
        }
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
          </div>

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
            referenceContent={
              sortableReferenceItems.length > 0 ? (
                <ReferenceThumbnails
                  items={sortableReferenceItems}
                  onReorder={handleReferenceReorder}
                  onRemove={handleSortableReferenceRemove}
                  onHoverChange={handleSortableReferenceHoverChange}
                />
              ) : undefined
            }
            onDisconnectNode={handleDisconnectNode}
            onRemoveReferenceImage={handleRemoveReferenceImage}
            onReferenceHoverChange={handleReferenceHoverChange}
          />

          <div className={PROMPT_PANEL_STYLES.textAreaWrap}>
            <VideoPromptEditor
              ref={editorRef}
              promptDraftHtml={promptDraftHtml}
              mentionItems={
                editorMentionItems.length > 0
                  ? editorMentionItems
                  : videoMentionItems
              }
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
