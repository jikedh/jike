import { arrayMove } from "@dnd-kit/sortable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GenerationStatus } from "shared/constants/enum";
import { getVideoGenerationPoints } from "shared/constants/model-points";
import type { NewVideoGenerationNode } from "shared/types/flow";
import { getVideoDuration } from "shared/utils/getVideoDuration";
import { toChineseNumber } from "shared/utils/utils";
import { ModelPointsBadge } from "@/components/ModelPointsBadge";
import { PresetDropdown } from "@/components/PresetDropdown";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGenerationPoints } from "@/hooks/useGenerationPoints";
import useMessage from "@/hooks/useMessage";
import type { VideoPromptEditorHandle } from "./components/VideoPromptEditor";
import { VideoPromptEditor } from "./components/VideoPromptEditor";
import { VideoReferenceAssetsBar } from "./components/VideoReferenceAssetsBar";
import {
  getVideoLocalImageMentionId,
  getVideoParentAudioMentionId,
  getVideoParentImageMentionId,
  getVideoParentVideoMentionId,
  useVideoNodeReferences
} from "./hooks/useVideoNodeReferences";
import { useVideoReferenceActions } from "./hooks/useVideoReferenceActions";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";
import { PROMPT_PANEL_STYLES } from "../shared/promptPanelStyles";
import { handlePromptEditorWheelCapture } from "../shared/wheelEvents";
import {
  BottomParamsBar,
  type VideoGenerateRequest
} from "./components/BottomParamsBar";
import { ModeToggleBar } from "./components/ModeToggleBar";
import { ReferenceThumbnails } from "./components/ReferenceThumbnails";
import {
  type MentionItem,
  VIDEO_MODEL_OPTIONS,
  getVideoModelOptions
} from "./constants/mockData";
import {
  ALL_MODE_KEYS,
  getFirstSupportedModeForModel,
  getSupportedModesForModel,
  type VideoModeKey
} from "./constants/videoModelCapabilities";
import {
  normalizeVideoParams,
  type VideoParamState
} from "./constants/videoParamConfigs";
import { useModeAvailability } from "./hooks/useModeAvailability";
import { useVideoGenerationAvailability } from "./hooks/useVideoGenerationAvailability";
import { buildVideoApiRequest } from "./utils/buildVideoApiRequest";
import { normalizeVideoMediaReferences } from "./utils/normalizeVideoMediaReferences";
import { validateVideoGenerationCapability } from "./constants/videoModelGenerationCapabilities";

interface VideoPromptPanelProps {
  nodeId: string;
}

const isVideoModeKey = (value: unknown): value is VideoModeKey => {
  return (
    typeof value === "string" && ALL_MODE_KEYS.includes(value as VideoModeKey)
  );
};

const OVERSEAS_SEEDANCE_MODEL = "dreamina-seedance-2-0-260128";

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

const resolveEffectiveModelId = (
  value: string | undefined,
  mode?: VideoModeKey,
  modelOptions = VIDEO_MODEL_OPTIONS,
) => {
  const fallbackModel = mode
    ? getFirstSupportedModeForModel(value ?? "", mode)
    : modelOptions[0]?.value ?? VIDEO_MODEL_OPTIONS[0].value;

  const availableModelIds = new Set(
    modelOptions.map((option) => option.value),
  );

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

  return value && availableModelIds.has(value) ? value : fallbackModel;
};

type ReferenceSource =
  | string
  | {
    id?: string;
    mentionId?: string;
    label?: string;
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
    label: item.label?.trim(),
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
      const originalLabel = source.label || `图片${index + 1}`;
      return {
        id: source.id,
        label: originalLabel,
        displayLabel: `图片${toChineseNumber(index + 1)}`,
        value: source.url,
        thumbnail: source.thumbnail,
        url: source.url,
        mentionId: source.mentionId,
        preserveLabel: Boolean(source.label),
        type: "image" as const,
      };
    }),
    ...videoUrls.map((item, index) => {
      const source = normalizeReferenceSource(
        item,
        `video-${index}-${typeof item === "string" ? item : item.url}`,
      );
      const originalLabel = source.label || `视频${index + 1}`;
      return {
        id: source.id,
        label: originalLabel,
        displayLabel: `视频${toChineseNumber(index + 1)}`,
        value: source.url,
        thumbnail: source.thumbnail,
        url: source.url,
        mentionId: source.mentionId,
        preserveLabel: Boolean(source.label),
        type: "video" as const,
      };
    }),
    ...audioUrls.map((item, index) => {
      const source = normalizeReferenceSource(
        item,
        `audio-${index}-${typeof item === "string" ? item : item.url}`,
      );
      const originalLabel = source.label || `音频${index + 1}`;
      return {
        id: source.id,
        label: originalLabel,
        displayLabel: `音频${toChineseNumber(index + 1)}`,
        value: source.url,
        thumbnail: source.thumbnail,
        url: source.url,
        mentionId: source.mentionId,
        preserveLabel: Boolean(source.label),
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
    // displayLabel 始终按"添加顺序"分配为"图片一/图片二/图片三…"，
    // 与原始 label（节点昵称 / 文件名 / 类型默认值）解耦，确保 Prompt 拼接文本稳定。
    const nextDisplayLabel = `${labelPrefix[item.type]}${toChineseNumber(
      counters[item.type],
    )}`;

    return {
      ...item,
      displayLabel: nextDisplayLabel,
      // 保留原始名称以供 UI 使用（缩略图悬浮 tooltip 等）。
      label:
        item.preserveLabel && item.label.trim()
          ? item.label
          : nextDisplayLabel,
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

const toStringRecord = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce(
    (acc, [key, item]) => {
      if (typeof item === "string" && item.trim()) {
        acc[key] = item;
      }
      return acc;
    },
    {} as Record<string, string>,
  );
};

const areStringRecordsEqual = (
  left: Record<string, string>,
  right: Record<string, string>,
) => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => left[key] === right[key])
  );
};

const VIDEO_GENERATION_FAKE_REQUEST_DELAY_MS = 5000;
const VIDEO_FAKE_REQUEST_PENDING_KEY = "fakeRequestPending";
const videoFakeRequestTimers = new Map<string, ReturnType<typeof setTimeout>>();

const isVideoFakeRequestPending = (data?: NewVideoGenerationNode) =>
  data?.metadata?.[VIDEO_FAKE_REQUEST_PENDING_KEY] === true;

const getCurrentNewVideoData = (nodeId: string) => {
  const node = useCanvasFlowStore
    .getState()
    .nodes.find((item) => item.id === nodeId && item.type === "newVideoNode");
  return node?.data as NewVideoGenerationNode | undefined;
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
  const projectId = useCanvasFlowStore((state) => state.projectId);
  const videoModelOptions = useMemo(
    () => getVideoModelOptions(),
    [],
  );

  const currentData = useCanvasFlowStore((state) => {
    const node = state.nodes.find(
      (item) => item.id === nodeId && item.type === "newVideoNode",
    );
    return node?.data as NewVideoGenerationNode | undefined;
  });
  const isFakeRequestPending =
    isVideoFakeRequestPending(currentData) &&
    videoFakeRequestTimers.has(nodeId);

  const metadataParams = currentData?.metadata?.params as
    | VideoParamState
    | undefined;
  const initialMode = isVideoModeKey(currentData?.metadata?.mode)
    ? currentData?.metadata?.mode
    : "all-reference";
  const model = resolveEffectiveModelId(
    currentData?.model,
    initialMode,
    videoModelOptions,
  );

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

  const parentImageReferenceUrlsById = useMemo(() => {
    return parentImageNodes.reduce(
      (acc, item) => {
        acc[item.id] = item.url;
        return acc;
      },
      {} as Record<string, string>,
    );
  }, [parentImageNodes]);

  useEffect(() => {
    const metadata = (currentData?.metadata ?? {}) as Record<string, unknown>;
    const previousParentImageUrlsById = toStringRecord(
      metadata.parentImageReferenceUrls,
    );
    let nextImageUrls = [...(currentData?.image_urls ?? [])];

    for (const [parentNodeId, previousUrl] of Object.entries(
      previousParentImageUrlsById,
    )) {
      const currentParentUrl = parentImageReferenceUrlsById[parentNodeId];
      if (currentParentUrl === previousUrl) {
        continue;
      }

      const staleIndex = nextImageUrls.indexOf(previousUrl);
      if (staleIndex >= 0) {
        nextImageUrls = [
          ...nextImageUrls.slice(0, staleIndex),
          ...nextImageUrls.slice(staleIndex + 1),
        ];
      }
    }

    const imageUrlsChanged =
      nextImageUrls.length !== (currentData?.image_urls ?? []).length ||
      nextImageUrls.some((url, index) => url !== currentData?.image_urls?.[index]);
    const parentMapChanged = !areStringRecordsEqual(
      previousParentImageUrlsById,
      parentImageReferenceUrlsById,
    );

    if (!imageUrlsChanged && !parentMapChanged) {
      return;
    }

    updateNewVideoNodeData(nodeId, {
      ...(imageUrlsChanged ? { image_urls: nextImageUrls } : {}),
      metadata: {
        ...metadata,
        parentImageReferenceUrls: parentImageReferenceUrlsById,
      },
    } as Partial<NewVideoGenerationNode>);
  }, [
    currentData?.image_urls,
    currentData?.metadata,
    nodeId,
    parentImageReferenceUrlsById,
    updateNewVideoNodeData,
  ]);

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
        label: item.label,
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
        label: item.label,
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
        label: item.label,
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
  const generationVideoReferenceUrls = useMemo(
    () =>
      generationReferenceItems
        .filter((item) => item.type === "video")
        .map((item) => item.url ?? item.thumbnail ?? item.value)
        .filter((url): url is string => Boolean(url)),
    [generationReferenceItems],
  );

  const editorMentionItems = useMemo(() => {
    return generationReferenceItems.map((item) => ({
      id: item.mentionId ?? item.id,
      label: item.displayLabel,
      // 原始名保留在 mention attrs 上，供 UI 与悬浮提示使用。
      originalLabel: item.label,
      value: item.displayLabel,
      thumbnail: item.thumbnail,
      // 真实资源地址写入 mention attrs：归一化阶段会优先使用 fileUrl/value/url。
      url: item.url ?? item.value,
      fileUrl: item.fileUrl ?? item.url ?? item.value,
      source: item.source,
      scope: item.scope,
      assetId: item.assetId,
      nodeId: item.nodeId,
      primaryCategory: item.primaryCategory,
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
  const generationAvailability = useVideoGenerationAvailability({
    modelId: selectedModel,
    mode: activeMode,
    referenceItems: generationReferenceItems,
    params: selectedParams,
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
    updateNewVideoNodeData,
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
          label: item.displayLabel,
          originalLabel: item.label,
          value: item.displayLabel,
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

  const [
    overseasReferenceDurationSeconds,
    setOverseasReferenceDurationSeconds,
  ] = useState(0);
  const [
    isLoadingOverseasReferenceDuration,
    setIsLoadingOverseasReferenceDuration,
  ] = useState(false);
  const [
    overseasReferenceDurationError,
    setOverseasReferenceDurationError,
  ] = useState<string | null>(null);
  const overseasReferenceDurationKey = useMemo(
    () => generationVideoReferenceUrls.join("\n"),
    [generationVideoReferenceUrls],
  );

  useEffect(() => {
    let cancelled = false;

    if (
      selectedModel !== OVERSEAS_SEEDANCE_MODEL ||
      generationVideoReferenceUrls.length === 0
    ) {
      setOverseasReferenceDurationSeconds(0);
      setIsLoadingOverseasReferenceDuration(false);
      setOverseasReferenceDurationError(null);
      return () => {
        cancelled = true;
      };
    }

    setIsLoadingOverseasReferenceDuration(true);
    setOverseasReferenceDurationError(null);

    Promise.all(generationVideoReferenceUrls.map((url) => getVideoDuration(url)))
      .then((durations) => {
        if (cancelled) return;
        if (
          durations.some(
            (duration) =>
              duration === null ||
              !Number.isFinite(duration) ||
              duration <= 0,
          )
        ) {
          setOverseasReferenceDurationSeconds(0);
          setOverseasReferenceDurationError("无法读取视频参考时长，暂不能生成");
          return;
        }

        setOverseasReferenceDurationSeconds(
          durations.reduce((total, duration) => total + Math.ceil(duration!), 0),
        );
        setOverseasReferenceDurationError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setOverseasReferenceDurationSeconds(0);
        setOverseasReferenceDurationError("无法读取视频参考时长，暂不能生成");
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingOverseasReferenceDuration(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    generationVideoReferenceUrls.length,
    overseasReferenceDurationKey,
    selectedModel,
  ]);

  const requiredPoints = useMemo(() => {
    const perTaskPoints = normalizeRequiredPoints(
      getVideoGenerationPoints({
        model: selectedModel,
        duration: selectedParams.duration,
        resolution: selectedParams.resolution,
        hasVideoInput: generationVideoReferenceUrls.length > 0,
        videoReferenceDuration: overseasReferenceDurationSeconds,
        hasAudio: Boolean(selectedParams.generateAudio ?? true),
        fallback: Math.max(fallbackAIGenPrice, 1),
      }),
    );
    return perTaskPoints;
  }, [
    fallbackAIGenPrice,
    generationVideoReferenceUrls.length,
    normalizeRequiredPoints,
    overseasReferenceDurationSeconds,
    selectedModel,
    selectedParams.duration,
    selectedParams.generateAudio,
    selectedParams.resolution,
  ]);

  // Agnes 专属参数实时校验：仅当选中 Agnes 模型时纳入计算。
  // 详细控件与字段级错误提示内嵌在 VideoParamsPopover.AgnesAdvancedParams 中，
  // 这里只负责汇总并把"参数不合法"作为 disabledReason 透传给 BottomParamsBar。
  const agnesParamHasError = useMemo(() => {
    if (selectedModel !== "agnes-video-v2.0") return false;
    const numFrames = selectedParams.agnesNumFrames ?? 121;
    const frameRate = selectedParams.agnesFrameRate ?? 24;
    if (!Number.isFinite(numFrames) || numFrames <= 0 || numFrames > 441) {
      return true;
    }
    if ((numFrames - 1) % 8 !== 0) {
      return true;
    }
    if (!Number.isFinite(frameRate) || frameRate < 1 || frameRate > 60) {
      return true;
    }
    return false;
  }, [
    selectedModel,
    selectedParams.agnesFrameRate,
    selectedParams.agnesNumFrames,
  ]);

  const isRealRequestGenerating =
    currentData?.status === GenerationStatus.QUEUED ||
    currentData?.status === GenerationStatus.IN_PROGRESS;
  const isGenerating = isFakeRequestPending || isRealRequestGenerating;

  const handleStop = useCallback(() => {
    const timer = videoFakeRequestTimers.get(nodeId);
    if (!isFakeRequestPending || !timer) {
      return;
    }
    clearTimeout(timer);
    videoFakeRequestTimers.delete(nodeId);
    const latestData = getCurrentNewVideoData(nodeId) ?? currentData;
    updateNewVideoNodeData(nodeId, {
      status: GenerationStatus.COMPLETED,
      progress: 0,
      error: undefined,
      metadata: {
        ...(latestData?.metadata ?? {}),
        [VIDEO_FAKE_REQUEST_PENDING_KEY]: false,
      },
    });
    success("已停止生成");
  }, [
    currentData,
    isFakeRequestPending,
    nodeId,
    success,
    updateNewVideoNodeData,
  ]);

  const handleGenerate = useCallback(
    async (request: VideoGenerateRequest) => {
      if (isGenerating) {
        return;
      }
      const capabilityResult = validateVideoGenerationCapability({
        modelId: request.model,
        mode: request.mode,
        referenceItems: generationReferenceItems,
        params: request.params,
      });
      if (!capabilityResult.canGenerate) {
        warning(capabilityResult.summaryReason ?? capabilityResult.reasons[0]);
        return;
      }
      const editorText = editorRef.current?.getPlainText() ?? request.prompt;
      const editorDoc = editorRef.current?.getDocumentJSON() ?? null;
      // 媒体引用归一化：把正文 @ 提及和上方参考列表合并去重，
      // 生成 Image1/Image2/Audio1/Video1 占位符 prompt 与对应顺序的请求数组。
      const normalized = normalizeVideoMediaReferences({
        promptDoc: editorDoc,
        referenceItems: generationReferenceItems,
        promptText: editorText,
      });
      const normalizedNotePrompt = parentNoteContents
        .map((content) => content.trim())
        .filter((content) => content.length > 0)
        .join(" ");
      const mergedPrompt = [normalizedNotePrompt, normalized.prompt]
        .filter((content) => content.length > 0)
        .join(" ");

      if (!mergedPrompt) {
        warning("请输入提示词");
        return;
      }
      if (
        request.model === OVERSEAS_SEEDANCE_MODEL &&
        generationVideoReferenceUrls.length > 0
      ) {
        if (isLoadingOverseasReferenceDuration) {
          warning("正在读取视频参考时长，请稍后");
          return;
        }
        if (overseasReferenceDurationError) {
          warning(overseasReferenceDurationError);
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
        referenceItems:
          normalized.referenceItems.length > 0
            ? normalized.referenceItems
            : generationReferenceItems,
      };
      const apiRequest = buildVideoApiRequest(fullRequest);

      updateNewVideoNodeData(nodeId, {
        model: fullRequest.model,
        prompt: fullRequest.prompt,
        promptDraft: fullRequest.prompt,
        duration: fullRequest.params.duration,
        aspect_ratio: fullRequest.params.aspectRatio,
        requiredPoints,
        status: GenerationStatus.QUEUED,
        progress: 0,
        result: {
          type: "video",
          data: currentData?.result?.data ?? [],
        },
        error: undefined,
        metadata: {
          ...(currentData?.metadata ?? {}),
          params: fullRequest.params,
          mode: fullRequest.mode,
          count: 1,
          tasks: [],
          failedTasks: [],
          [VIDEO_FAKE_REQUEST_PENDING_KEY]: true,
        },
      });

      const existingTimer = videoFakeRequestTimers.get(nodeId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        if (videoFakeRequestTimers.get(nodeId) !== timer) {
          return;
        }
        const latestData = getCurrentNewVideoData(nodeId);
        if (!isVideoFakeRequestPending(latestData)) {
          videoFakeRequestTimers.delete(nodeId);
          return;
        }
        videoFakeRequestTimers.delete(nodeId);
        updateNewVideoNodeData(nodeId, {
          metadata: {
            ...(latestData?.metadata ?? {}),
            params: fullRequest.params,
            mode: fullRequest.mode,
            count: 1,
            tasks: [],
            failedTasks: [],
            [VIDEO_FAKE_REQUEST_PENDING_KEY]: false,
          },
        });
        void startNewVideoGeneration(
          nodeId,
          {
            ...apiRequest,
            requiredPoints,
            __newVideoInput: fullRequest,
          },
          1,
        )
          .then(() => {
            success("已开始生成视频");
            void refreshBalanceInfo();
          })
          .catch(() => {
            // 失败状态已由 startNewVideoGeneration 写回节点。
          });
      }, VIDEO_GENERATION_FAKE_REQUEST_DELAY_MS);
      videoFakeRequestTimers.set(nodeId, timer);
    },
    [
      currentData?.metadata,
      currentData?.result?.data,
      generationReferenceItems,
      generationVideoReferenceUrls.length,
      isGenerating,
      isLoadingOverseasReferenceDuration,
      nodeId,
      overseasReferenceDurationError,
      parentNoteContents,
      refreshBalanceInfo,
      requiredPoints,
      startNewVideoGeneration,
      success,
      updateNewVideoNodeData,
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

          <div
            className={PROMPT_PANEL_STYLES.textAreaWrap}
            onWheelCapture={handlePromptEditorWheelCapture}
          >
            <VideoPromptEditor
              ref={editorRef}
              promptDraftHtml={promptDraftHtml}
              nodeId={nodeId}
              projectId={projectId}
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
          modelOptions={videoModelOptions}
          selectedParams={selectedParams}
          prompt={promptText}
          referenceItems={generationReferenceItems}
          mode={activeMode}
          onModelChange={handleModelChange}
          onParamsChange={handleParamsChange}
          onGenerate={handleGenerate}
          onStop={handleStop}
          isGenerating={isGenerating}
          canStop={isFakeRequestPending}
          disabled={
            isUploading ||
            !generationAvailability.canGenerate ||
            (selectedModel === "agnes-video-v2.0" && agnesParamHasError)
          }
          disabledReason={
            isUploading
              ? "素材正在上传中，请稍后再生成"
              : selectedModel === "agnes-video-v2.0" && agnesParamHasError
                ? "Agnes 参数不合法，请修正后再提交"
                : generationAvailability.summaryReason
          }
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
