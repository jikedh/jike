import { arrayMove } from "@dnd-kit/sortable";
import { IconSparkles, IconWand } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createChatCompletion } from "@/api/ai";
import { GenerationStatus } from "shared/constants/enum";
import { getVideoGenerationPoints } from "shared/constants/model-points";
import type { NewVideoGenerationNode } from "shared/types/flow";
import { getVideoDuration } from "shared/utils/getVideoDuration";
import { toChineseNumber } from "shared/utils/utils";
import { cn } from "shared/utils/utils";
import { ModelPointsBadge } from "@/components/ModelPointsBadge";
import { PresetDropdown } from "@/components/PresetDropdown";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
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
  getVideoParentNoteMentionId,
  getVideoParentVideoMentionId,
  useVideoNodeReferences
} from "./hooks/useVideoNodeReferences";
import { useVideoReferenceActions } from "./hooks/useVideoReferenceActions";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";
import { PROMPT_PANEL_STYLES } from "../shared/promptPanelStyles";
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

// 视频节点参考缩略图统一类型：独立于 MentionItem，方便承载便签扩展字段
// （MentionItem.type 严格限定为 image/video/audio，不能反向扩展为 note）。
export type VideoReferenceDisplayItem = {
  id: string;
  label: string;
  displayLabel: string;
  value: string;
  thumbnail: string;
  url?: string;
  mentionId?: string;
  preserveLabel?: boolean;
  type: "image" | "video" | "audio" | "note";
  content?: string;
};
import {
  ALL_MODE_KEYS,
  MODE_LABELS,
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

type PendingVideoGenerateContext = {
  fullRequest: VideoGenerateRequest;
  apiRequest: ReturnType<typeof buildVideoApiRequest>;
  requiredPoints: number;
  modelLabel: string;
  modeLabel: string;
  resolution?: string;
  duration: number;
  generateAudio: boolean;
  referenceCounts: {
    image: number;
    video: number;
    audio: number;
  };
  overseasReferenceDurationSeconds: number;
};

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
const VIDEO_PROMPT_OPTIMIZE_SYSTEM_PROMPT_KEY =
  "promptOptimizeSystemPrompt";
const videoFakeRequestTimers = new Map<string, ReturnType<typeof setTimeout>>();

const DEFAULT_VIDEO_PROMPT_OPTIMIZE_SYSTEM_PROMPT = `你是资深视频生成提示词工程师。请把用户提供的提示词改写得更专业、更具画面感、便于 AI 视频模型理解。要求：
1. 保持原意，不得删减用户提到的具体动作、节奏、镜头感等关键词。
2. 保留所有 \`ImageN / AudioN / VideoN\` 占位符，但允许调整其出现顺序和出现次数；禁止新增除此之外的其他占位符，禁止删除任何占位符（即原提示词中出现的每一个占位符都必须保留，且只能在这些占位符之间调整顺序/重复次数）。
3. 不得删除、添加或引用任何媒体资产；只优化纯文本描述。
4. 使用中文回复，输出仅包含改写后的最终提示词，不要解释过程。`;

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
  const { success, warning, error } = useMessage();
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
  const [
    pendingGenerateContext,
    setPendingGenerateContext,
  ] = useState<PendingVideoGenerateContext | null>(null);
  const isGenerateConfirmOpen = pendingGenerateContext !== null;

  const storedOptimizeSystemPrompt = useMemo(() => {
    const value = (currentData?.metadata ?? {})[
      VIDEO_PROMPT_OPTIMIZE_SYSTEM_PROMPT_KEY
    ];
    return typeof value === "string"
      ? value
      : DEFAULT_VIDEO_PROMPT_OPTIMIZE_SYSTEM_PROMPT;
  }, [currentData?.metadata]);
  const [isPromptOptimizePopoverOpen, setIsPromptOptimizePopoverOpen] =
    useState(false);
  const [draftOptimizeSystemPrompt, setDraftOptimizeSystemPrompt] =
    useState(storedOptimizeSystemPrompt);
  const [isOptimizingPrompt, setIsOptimizingPrompt] = useState(false);
  const promptOptimizeAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isPromptOptimizePopoverOpen) {
      setDraftOptimizeSystemPrompt(storedOptimizeSystemPrompt);
    }
  }, [isPromptOptimizePopoverOpen, storedOptimizeSystemPrompt]);

  useEffect(() => {
    return () => {
      promptOptimizeAbortRef.current?.abort();
      promptOptimizeAbortRef.current = null;
    };
  }, []);

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
    parentNoteNodes,
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

  // 视频参考缩略图展示类型：包含文本便签项，type 字段扩展为 "note"。
  const displayReferenceItems = useMemo<VideoReferenceDisplayItem[]>(() => {
    const mediaItems: VideoReferenceDisplayItem[] = generationReferenceItems
      .filter((item) => item.type !== "image" || item.url)
      .map((item) => ({
        id: item.id,
        label: item.label,
        displayLabel: item.displayLabel,
        value: item.value,
        thumbnail: item.thumbnail,
        url: item.url,
        mentionId: item.mentionId,
        preserveLabel: item.preserveLabel,
        type: item.type,
      }));

    const noteItems: VideoReferenceDisplayItem[] = parentNoteNodes.map(
      (note, index) => {
        return {
          id: `parent-note-${note.id}`,
          mentionId: getVideoParentNoteMentionId(note.id),
          label: note.label,
          displayLabel: `便签${toChineseNumber(index + 1)}`,
          value: note.content,
          thumbnail: "",
          url: undefined,
          type: "note",
          content: note.content,
          preserveLabel: true,
        };
      },
    );

    const merged = [...mediaItems, ...noteItems];
    const order = currentData?.metadata?.referenceOrder as
      | string[]
      | undefined;
    if (Array.isArray(order) && order.length > 0) {
      const map = new Map(merged.map((item) => [item.id, item]));
      const used = new Set<string>();
      const sorted: VideoReferenceDisplayItem[] = [];
      order.forEach((id) => {
        if (typeof id !== "string" || used.has(id)) {
          return;
        }
        const item = map.get(id);
        if (item) {
          sorted.push(item);
          used.add(id);
        }
      });
      merged.forEach((item) => {
        if (!used.has(item.id)) {
          sorted.push(item);
          used.add(item.id);
        }
      });
      return sorted;
    }
    return merged;
  }, [generationReferenceItems, parentNoteNodes, currentData?.metadata?.referenceOrder]);
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
    handleDisconnectNode,
    handleRemoveReferenceImage,
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
        "parent-note-",
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
        fromIndex >= displayReferenceItems.length ||
        toIndex >= displayReferenceItems.length
      ) {
        return;
      }

      const moved = arrayMove(displayReferenceItems, fromIndex, toIndex);
      // 仅将媒体项的顺序回写到 editor mention 与 metadata.referenceOrder，便签参考保持在原位即可，避免影响后续 prompt 拼接。
      const movedMedia = moved.filter((item) => item.type !== "note");
      const nextMedia = relabelReferenceItemsByOrder(
        movedMedia as MentionItem[],
      );
      editorRef.current?.updateReferenceMentions(
        nextMedia.map((item) => ({
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
          referenceOrder: moved.map((item) => item.id),
        },
      });
    },
    [
      currentData?.metadata,
      displayReferenceItems,
      nodeId,
      updateNewVideoNodeData,
    ],
  );

  const handleSortableReferenceRemove = useCallback(
    (item: MentionItem) => {
      // 便签参考：直接断开对应便签边。
      if (item.id.startsWith("parent-note-")) {
        const noteId = item.id.slice("parent-note-".length);
        handleDisconnectNode(noteId);
        return;
      }

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

  const handleSaveOptimizeSystemPrompt = useCallback(() => {
    const trimmed = draftOptimizeSystemPrompt.trim();
    if (!trimmed) {
      warning("系统提示词不能为空");
      return;
    }
    updateNewVideoNodeData(nodeId, {
      metadata: {
        ...(currentData?.metadata ?? {}),
        [VIDEO_PROMPT_OPTIMIZE_SYSTEM_PROMPT_KEY]: trimmed,
      },
    });
    setIsPromptOptimizePopoverOpen(false);
  }, [
    currentData?.metadata,
    draftOptimizeSystemPrompt,
    nodeId,
    updateNewVideoNodeData,
    warning,
  ]);

  const handleResetOptimizeSystemPrompt = useCallback(() => {
    setDraftOptimizeSystemPrompt(DEFAULT_VIDEO_PROMPT_OPTIMIZE_SYSTEM_PROMPT);
  }, []);

  const extractOptimizedText = (response: unknown): string => {
    if (!response || typeof response !== "object") return "";
    const record = response as Record<string, unknown>;
    const data = record.data ?? record;
    const choices = (data as { choices?: unknown }).choices;
    if (!Array.isArray(choices)) return "";
    const first = choices[0] as { message?: { content?: unknown } };
    const content = first?.message?.content;
    if (typeof content === "string") return content.trim();
    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (!item || typeof item !== "object") return "";
          const text = (item as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        })
        .join("")
        .trim();
    }
    if (typeof (data as { output_text?: unknown }).output_text === "string") {
      return ((data as { output_text: string }).output_text ?? "").trim();
    }
    return "";
  };

  const handleOptimizePrompt = useCallback(async () => {
    if (isOptimizingPrompt) return;
    const editorDoc = editorRef.current?.getDocumentJSON() ?? null;
    const editorText = editorRef.current?.getPlainText() ?? promptText;
    if (!editorText.trim() && !editorDoc) {
      warning("请输入提示词后再优化");
      return;
    }
    // 先把正文 @ 提及和上方参考列表归一化为 ImageN/AudioN/VideoN，
    // 提示词模型只能看到稳定占位符文本，回写时再按位置还原 mention 节点。
    const normalized = normalizeVideoMediaReferences({
      promptDoc: editorDoc,
      referenceItems: generationReferenceItems,
      promptText: editorText,
    });
    if (!normalized.prompt.trim()) {
      warning("提示词为空，无可优化内容");
      return;
    }

    const systemPrompt =
      (typeof (currentData?.metadata ?? {})[
        VIDEO_PROMPT_OPTIMIZE_SYSTEM_PROMPT_KEY
      ] === "string"
        ? (currentData?.metadata as Record<string, string>)[
        VIDEO_PROMPT_OPTIMIZE_SYSTEM_PROMPT_KEY
        ]
        : DEFAULT_VIDEO_PROMPT_OPTIMIZE_SYSTEM_PROMPT) ||
      DEFAULT_VIDEO_PROMPT_OPTIMIZE_SYSTEM_PROMPT;

    const abortController = new AbortController();
    promptOptimizeAbortRef.current?.abort();
    promptOptimizeAbortRef.current = abortController;

    setIsOptimizingPrompt(true);
    try {
      const response = await createChatCompletion(
        {
          model: "deepseek-v4-flash",
          stream: false,
          temperature: 0.3,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: normalized.prompt },
          ],
        },
        abortController.signal,
      );
      if (abortController.signal.aborted) return;
      const optimizedText = extractOptimizedText(response);
      if (!optimizedText) {
        error("优化失败", "模型未返回有效内容");
        return;
      }
      editorRef.current?.replaceTextPreservingMentions(optimizedText);
      success("已优化提示词");
    } catch (reason) {
      if (abortController.signal.aborted) return;
      const message =
        reason instanceof Error ? reason.message : "提示词优化失败";
      error("优化失败", message);
    } finally {
      promptOptimizeAbortRef.current = null;
      setIsOptimizingPrompt(false);
    }
  }, [
    currentData?.metadata,
    editorRef,
    error,
    generationReferenceItems,
    isOptimizingPrompt,
    promptText,
    success,
    warning,
  ]);

  const executeConfirmedGenerate = useCallback(
    async (context: PendingVideoGenerateContext) => {
      if (isGenerating) {
        return;
      }
      if (
        !(await validateBalanceBeforeGenerate({
          requiredPoints: context.requiredPoints,
          warning,
        }))
      ) {
        return;
      }
      setPendingGenerateContext(null);
      const { fullRequest, apiRequest } = context;
      updateNewVideoNodeData(nodeId, {
        model: fullRequest.model,
        prompt: fullRequest.prompt,
        promptDraft: fullRequest.prompt,
        duration: fullRequest.params.duration,
        aspect_ratio: fullRequest.params.aspectRatio,
        requiredPoints: context.requiredPoints,
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
            requiredPoints: context.requiredPoints,
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
      isGenerating,
      nodeId,
      refreshBalanceInfo,
      startNewVideoGeneration,
      success,
      updateNewVideoNodeData,
      validateBalanceBeforeGenerate,
      warning,
    ],
  );

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
      const normalizedNotePrompt = (() => {
        const { nodes, edges } = useCanvasFlowStore.getState();
        const seen = new Set<string>();
        const live = edges
          .filter((edge) => {
            if (edge.target !== nodeId || seen.has(edge.source)) return false;
            seen.add(edge.source);
            return true;
          })
          .map((edge) => nodes.find((node) => node.id === edge.source))
          .filter((node): node is NonNullable<typeof node> => Boolean(node))
          .filter((node) => node.type === "noteNode")
          .map(
            (node) =>
              (node.data as { content?: string })?.content ?? "",
          )
          .filter((content) => content.trim().length > 0);
        const noteContents =
          live.length > 0 ? live : parentNoteContents;
        return noteContents
          .filter((content) => content.trim().length > 0)
          .join("\n");
      })();
      const mergedPrompt = [normalizedNotePrompt, normalized.prompt]
        .filter((content) => content.trim().length > 0)
        .join("\n");

      if (!mergedPrompt.trim()) {
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
      const referenceCounts = fullRequest.referenceItems.reduce(
        (counts, item) => ({
          ...counts,
          [item.type]: counts[item.type] + 1,
        }),
        { image: 0, video: 0, audio: 0 },
      );

      setPendingGenerateContext({
        fullRequest,
        apiRequest,
        requiredPoints,
        modelLabel:
          videoModelOptions.find((option) => option.value === fullRequest.model)
            ?.label ?? fullRequest.model,
        modeLabel: MODE_LABELS[fullRequest.mode],
        resolution: fullRequest.params.resolution,
        duration: fullRequest.params.duration,
        generateAudio: Boolean(fullRequest.params.generateAudio),
        referenceCounts,
        overseasReferenceDurationSeconds:
          fullRequest.model === OVERSEAS_SEEDANCE_MODEL
            ? overseasReferenceDurationSeconds
            : 0,
      });
    },
    [
      generationReferenceItems,
      generationVideoReferenceUrls.length,
      isGenerating,
      isLoadingOverseasReferenceDuration,
      overseasReferenceDurationError,
      overseasReferenceDurationSeconds,
      parentNoteContents,
      requiredPoints,
      validateBalanceBeforeGenerate,
      videoModelOptions,
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
            referenceImageUrls={localReferenceImageUrls}
            referenceImageIndexes={localReferenceImageIndexes}
            parentImageNodes={parentImageNodes}
            parentAudioNodes={parentAudioNodes}
            parentVideoNodes={parentVideoNodes}
            referenceContent={
              displayReferenceItems.length > 0 ? (
                <ReferenceThumbnails
                  items={displayReferenceItems}
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

          <div className={cn(PROMPT_PANEL_STYLES.textAreaWrap, "relative")}>
            <VideoPromptEditor
              ref={editorRef}
              promptDraftHtml={promptDraftHtml}
              isEditable={!isOptimizingPrompt}
              nodeId={nodeId}
              projectId={projectId}
              mentionItems={
                editorMentionItems.length > 0
                  ? editorMentionItems
                  : videoMentionItems
              }
              onDraftChange={handleDraftChange}
            />

            <div
              className="nodrag nopan nowheel pointer-events-auto absolute bottom-2 right-2 z-10"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="relative">
                <button
                  type="button"
                  aria-label="优化提示词"
                  title="左键：优化提示词；右键：编辑系统提示词"
                  disabled={isOptimizingPrompt}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (event.button === 2) return;
                    void handleOptimizePrompt();
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsPromptOptimizePopoverOpen((prev) => !prev);
                  }}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border text-white/80 transition-colors",
                    "border-white/8 bg-white/4 hover:border-[#B43FEB]/40 hover:bg-[#B43FEB]/15 hover:text-white",
                    isOptimizingPrompt
                      ? "cursor-wait opacity-60"
                      : "active:scale-95",
                  )}
                >
                  {isOptimizingPrompt ? (
                    <IconSparkles
                      size={14}
                      className="animate-pulse text-[#B43FEB]"
                    />
                  ) : (
                    <IconWand size={14} />
                  )}
                </button>

                {isPromptOptimizePopoverOpen ? (
                  <div
                    role="dialog"
                    aria-label="优化系统提示词配置"
                    className="nodrag nopan nowheel absolute bottom-12 right-0 z-9999 w-[320px] rounded-xl border border-white/8 bg-[#1e1e20] p-3 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="mb-2 text-xs font-medium text-white/80">
                      优化系统提示词
                    </div>
                    <textarea
                      className="nodrag nopan nowheel min-h-40 max-h-70 w-full resize-none rounded-lg border border-white/6 bg-white/2 p-2 text-xs leading-6 text-white/90 outline-none placeholder:text-white/30 focus:border-[#B43FEB]/40"
                      value={draftOptimizeSystemPrompt}
                      onChange={(event) =>
                        setDraftOptimizeSystemPrompt(event.target.value)
                      }
                      onClick={(event) => event.stopPropagation()}
                      onMouseDown={(event) => event.stopPropagation()}
                      placeholder="输入优化提示词时使用的系统提示词"
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={handleResetOptimizeSystemPrompt}
                        className="text-[11px] text-white/50 transition-colors hover:text-white/80"
                      >
                        恢复默认
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsPromptOptimizePopoverOpen(false)}
                          className="rounded-md border border-white/8 bg-transparent px-3 py-1 text-[11px] text-white/60 transition-colors hover:border-white/20 hover:text-white"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveOptimizeSystemPrompt}
                          className="rounded-md border border-[#B43FEB]/40 bg-[#B43FEB] px-3 py-1 text-[11px] font-medium text-white transition-colors hover:bg-[#B43FEB]/80"
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
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
            !generationAvailability.canGenerate ||
            (selectedModel === "agnes-video-v2.0" && agnesParamHasError)
          }
          disabledReason={
            selectedModel === "agnes-video-v2.0" && agnesParamHasError
              ? "Agnes 参数不合法，请修正后再提交"
              : generationAvailability.summaryReason
          }
          accessory={
            <>
              <PresetDropdown
                presetType="video"
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
        <Dialog
          open={isGenerateConfirmOpen}
          onOpenChange={(open) => {
            if (!open) {
              setPendingGenerateContext(null);
            }
          }}
        >
          <DialogContent className="w-[min(520px,92vw)] rounded-lg border border-white/[0.08] bg-[#1e1e20] p-0 text-white shadow-[0_25px_80px_-30px_rgba(0,0,0,0.8)]">
            <DialogHeader className="border-b border-white/[0.08] px-5 py-4">
              <DialogTitle className="text-base font-medium text-white">
                确认生成视频
              </DialogTitle>
              <DialogDescription className="text-xs text-white/50">
                确认后将进入 5 秒可停止窗口，窗口结束后才会创建任务并扣除积分。
              </DialogDescription>
            </DialogHeader>

            {pendingGenerateContext ? (
              <div className="px-5 py-4">
                <div className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
                  <div>
                    <div className="mb-1 text-xs text-white/40">模型</div>
                    <div className="truncate text-white/90">
                      {pendingGenerateContext.modelLabel}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-white/40">模式</div>
                    <div className="text-white/90">
                      {pendingGenerateContext.modeLabel}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-white/40">分辨率</div>
                    <div className="text-white/90">
                      {pendingGenerateContext.resolution ?? "-"}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-white/40">时长</div>
                    <div className="text-white/90">
                      {pendingGenerateContext.duration}s
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-white/40">生成音频</div>
                    <div className="text-white/90">
                      {pendingGenerateContext.generateAudio ? "是" : "否"}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-white/40">预计消耗</div>
                    <div className="font-medium text-[#B43FEB]">
                      {pendingGenerateContext.requiredPoints} 积分
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/65">
                  参考素材：图片 {pendingGenerateContext.referenceCounts.image}，
                  视频 {pendingGenerateContext.referenceCounts.video}，音频{" "}
                  {pendingGenerateContext.referenceCounts.audio}
                </div>

                {pendingGenerateContext.fullRequest.model ===
                  OVERSEAS_SEEDANCE_MODEL &&
                  pendingGenerateContext.referenceCounts.video > 0 ? (
                  <div className="mt-2 rounded-lg border border-[#B43FEB]/20 bg-[#B43FEB]/10 px-3 py-2 text-xs leading-5 text-white/70">
                    海外 Seedance 视频参考计费：生成{" "}
                    {pendingGenerateContext.duration}s + 参考视频{" "}
                    {pendingGenerateContext.overseasReferenceDurationSeconds}s。
                  </div>
                ) : null}
              </div>
            ) : null}

            <DialogFooter className="mt-0 border-t border-white/[0.08] px-5 py-4">
              <button
                type="button"
                onClick={() => setPendingGenerateContext(null)}
                className="rounded-md border border-white/[0.08] bg-transparent px-4 py-2 text-sm text-white/65 transition-colors hover:border-white/20 hover:text-white"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingGenerateContext) {
                    void executeConfirmedGenerate(pendingGenerateContext);
                  }
                }}
                className="rounded-md bg-[#B43FEB] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#9F35D4]"
              >
                确认生成
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};
