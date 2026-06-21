import { arrayMove } from "@dnd-kit/sortable";
import { IconUpload, IconX } from "@tabler/icons-react";
import Mention from "@tiptap/extension-mention";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { ChangeEvent } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toChineseNumber } from "shared/utils/utils";
import { uploadFileToOSS } from "service/oss";
import { ImageReferenceThumbnails } from "./components/ImageReferenceThumbnails";
import {
  IMAGE_MODELS,
  NANO_BANANA_LOCAL_MODEL,
  NANO_BANANA_LOCAL_PLATFORM
} from "shared/constants/ai-models";
import { GenerationStatus } from "shared/constants/enum";
import { getImageGenerationPoints } from "shared/constants/model-points";
import type { ImageGenerationNode, NoteNodeData } from "shared/types/flow";
import { compressImage, MAX_IMAGE_SIZE_MB } from "shared/utils/imageCompress";
import { getRemoteMediaUrl } from "shared/utils/mediaPersistence";
import { cn } from "shared/utils/utils";
import { useShallow } from "zustand/react/shallow";
import { ModelPointsBadge } from "@/components/ModelPointsBadge";
import { PresetDropdown } from "@/components/PresetDropdown";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useGenerationPoints } from "@/hooks/useGenerationPoints";
import useMessage from "@/hooks/useMessage";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";
import { PROMPT_PANEL_STYLES } from "../shared/promptPanelStyles";
import { handlePromptEditorWheelCapture } from "../shared/wheelEvents";
import {
  GeminiParamsPanel,
  GEMINI_RESOLUTIONS,
  GEMINI_SIZES,
  NANO_BANANA_RESOLUTIONS,
  NANO_BANANA_LOCAL_SIZES
} from "./components/GeminiParamsPanel";
import {
  GPTIMAGE2_SIZES,
  GptImage2ParamsPanel
} from "./components/GptImage2ParamsPanel";
import { MidjourneyAdvancedPanel } from "./components/MidjourneyAdvancedPanel";
import {
  MIDJOURNEY_ASPECT_RATIOS,
  MidjourneyParamsPanel
} from "./components/MidjourneyParamsPanel";
import {
  SEEDREAM_ASPECT_RATIOS,
  SEEDREAM_RESOLUTIONS,
  SeedreamParamsPanel
} from "./components/SeedreamParamsPanel";
import { COMMAND_MOCK, MENTION_MOCK } from "./mock";

const ReferenceItemWrapper = ({
  children,
  onDisconnect,
  onMouseEnter,
  onMouseLeave,
  className,
}: {
  children: React.ReactNode;
  onDisconnect?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        PROMPT_PANEL_STYLES.referenceImageButton,
        "group relative",
        className,
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
      {onDisconnect && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDisconnect();
          }}
          className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-neutral-800 text-neutral-400 opacity-0 transition-opacity hover:bg-red-500 hover:text-white group-hover:opacity-100 flex items-center justify-center"
          title="断开连接"
        >
          <IconX size={10} />
        </button>
      )}
    </div>
  );
};

// 图片生成数量选项
const IMAGE_COUNT_OPTIONS = [1, 2, 4] as const;
type ImageCount = (typeof IMAGE_COUNT_OPTIONS)[number];
const DEFAULT_NANO_BANANA_SIZE = "1:1";
const LOCAL_GEMINI_BATCH_SUBMIT_DELAY_MS = 3000;
const NANO_BANANA_SIZE_VALUES = new Set(
  NANO_BANANA_LOCAL_SIZES.map((item) => item.value),
);

const toOptionValueSet = (options: Array<{ value: string }>) =>
  new Set(options.map((item) => item.value));

const GEMINI_SIZE_VALUES = toOptionValueSet(GEMINI_SIZES);
const GEMINI_RESOLUTION_VALUES = toOptionValueSet(GEMINI_RESOLUTIONS);
const NANO_BANANA_RESOLUTION_VALUES = toOptionValueSet(NANO_BANANA_RESOLUTIONS);
const GPTIMAGE2_SIZE_VALUES = toOptionValueSet(GPTIMAGE2_SIZES);
const GPTIMAGE2_RESOLUTION_VALUES = new Set(["1K", "2K", "4K"]);
const GPTIMAGE2_RESOLUTION_OPTIONS = [
  { label: "1K", value: "1K", description: "标准" },
  { label: "2K", value: "2K", description: "高清" },
  { label: "4K", value: "4K", description: "超清" },
];
const SEEDREAM_SIZE_VALUES = toOptionValueSet(SEEDREAM_ASPECT_RATIOS);
const SEEDREAM_RESOLUTION_VALUES = toOptionValueSet(SEEDREAM_RESOLUTIONS);
const MIDJOURNEY_SIZE_VALUES = toOptionValueSet(MIDJOURNEY_ASPECT_RATIOS);

type SupportedImageParams = {
  sizes?: Set<string>;
  resolutions?: Set<string>;
  defaultSize: string;
  defaultResolution?: string;
};

export const ImagePromptPanel = memo(({ nodeId }: { nodeId: string }) => {
  // 上传中态，避免重复上传触发
  const [isUploading, setIsUploading] = useState(false);
  // 图片生成数量选择
  const [imageCount, setImageCount] = useState<ImageCount>(1);
  // 正在生成的数量（用于显示进度提示）
  const [generatingCount, setGeneratingCount] = useState(0);

  const [mentionQuery, setMentionQuery] = useState("");
  const [commandQuery, setCommandQuery] = useState("");
  const [activeMode, setActiveMode] = useState<"mention" | "command" | null>(
    null,
  );
  const [activeIndex, setActiveIndex] = useState(0);

  // 消息提示（成功/失败/警告）
  const { success, error, warning } = useMessage();
  const {
    pointsEnabled,
    totalPoints,
    fallbackAIGenPrice,
    normalizeRequiredPoints,
    refreshBalanceInfo,
    validateBalanceBeforeGenerate,
  } = useGenerationPoints();

  // 画布数据：用于沿边查找父节点
  const startImageGeneration = useCanvasFlowStore(
    (state) => state.startImageGeneration,
  );
  const startGeminiPro2Generation = useCanvasFlowStore(
    (state) => state.startGeminiPro2Generation,
  );
  const stopImagePolling = useCanvasFlowStore(
    (state) => state.stopImagePolling,
  );
  const updateImageNodeData = useCanvasFlowStore(
    (state) => state.updateImageNodeData,
  );
  const setDefaultImagePreset = useChatSettingsStore(
    (state) => state.setDefaultImagePreset,
  );
  const deleteEdge = useCanvasFlowStore((state) => state.deleteEdge);
  const setReferenceHoverHighlight = useCanvasFlowStore(
    (state) => state.setReferenceHoverHighlight,
  );

  // 当前节点状态（用于禁用生成按钮）
  const currentImageData = useCanvasFlowStore((state) => {
    const node = state.nodes.find((item) => item.id === nodeId);
    if (!node || node.type !== "imageNode") {
      return null;
    }

    return node.data as ImageGenerationNode;
  });
  const visibleImageModels = useMemo(
    () => IMAGE_MODELS,
    [],
  );

  // 从 currentImageData 获取基础字段
  const model = currentImageData?.model ?? "gemini-3-pro-image-preview";
  const platform = currentImageData?.platform;

  // 根据 model 和 platform 找到对应的模型 id
  // 新建节点时 platform 为 undefined，需要回退到只按 model 匹配
  const currentModelId = (() => {
    // 优先精确匹配 model + platform
    const matched = IMAGE_MODELS.find(
      (item) => item.model === model && item.platform === platform,
    );
    if (matched) {
      return matched.id;
    }
    // 回退：只按 model 匹配（新建节点时 platform 为 undefined）
    // 由于所有 IMAGE_MODELS 中的模型都有 platform 值，这里改为按 id 回退
    // 找不到时返回 id=3（默认的"谷歌 Gemini 3 Pro"）
    const fallback = IMAGE_MODELS.find((item) => item.model === model);
    return fallback?.id ?? 3;
  })();

  // 统一使用 size 字段存储宽高比/画面比例
  const size = currentImageData?.size ?? "1:1";
  const resolution = currentImageData?.resolution ?? "2K";
  const referenceImageUrls = currentImageData?.image_urls ?? [];
  const promptDraftHtml = currentImageData?.promptDraftHtml ?? "<p></p>";

  const persistImageDefaultPreset = useCallback(
    (patch: {
      model?: string;
      platform?: string;
      size?: string;
      resolution?: string;
    }) => {
      setDefaultImagePreset({
        model: patch.model ?? currentImageData?.model ?? model,
        platform: patch.platform ?? currentImageData?.platform ?? platform,
        size: patch.size ?? size,
        resolution: patch.resolution ?? resolution,
      });
    },
    [
      currentImageData?.model,
      currentImageData?.platform,
      model,
      platform,
      resolution,
      setDefaultImagePreset,
      size,
    ],
  );

  // ========== 模型专属参数 ==========
  // 判断是否为 Midjourney 系列模型
  const isMidjourneyModel =
    model === "midjourney" || model === "midjourney-niji7";
  // 判断是否为 Seedream 5.0 模型
  const isSeedreamModel = model === "doubao-seedream-5-0";
  // 判断是否为 Gemini 3 Pro 模型（渠道一，原有模型）
  // 兼容新建节点时 platform 为 undefined 的情况（新建节点默认回退到渠道一）
  const isGeminiModel =
    model === "gemini-3-pro-image-preview" &&
    (currentImageData?.platform === "google" ||
      currentImageData?.platform === undefined);
  const isNanoBananaLocalModel =
    model === NANO_BANANA_LOCAL_MODEL &&
    currentImageData?.platform === NANO_BANANA_LOCAL_PLATFORM;
  // 判断是否为 GPT-Image-2 模型
  const isGptImage2Model = model === "gpt-image-2";
  // 判断是否为 Gemini 3 Pro 渠道二
  const isGeminiPro2Model = currentImageData?.platform === "google_pro2";
  const isLocalGeminiDirectModel =
    isGeminiPro2Model || isNanoBananaLocalModel;

  const supportedImageParams = useMemo<SupportedImageParams | null>(() => {
    if (isSeedreamModel) {
      return {
        sizes: SEEDREAM_SIZE_VALUES,
        resolutions: SEEDREAM_RESOLUTION_VALUES,
        defaultSize: "1:1",
        defaultResolution: "2K",
      };
    }

    if (isGeminiModel || isGeminiPro2Model) {
      return {
        sizes: GEMINI_SIZE_VALUES,
        resolutions: GEMINI_RESOLUTION_VALUES,
        defaultSize: "1:1",
        defaultResolution: "2K",
      };
    }

    if (isNanoBananaLocalModel) {
      return {
        sizes: NANO_BANANA_SIZE_VALUES,
        resolutions: NANO_BANANA_RESOLUTION_VALUES,
        defaultSize: DEFAULT_NANO_BANANA_SIZE,
        defaultResolution: "2K",
      };
    }

    if (isLocalGeminiDirectModel) {
      return {
        defaultSize: "1:1",
        defaultResolution: "standard",
      };
    }

    if (isGptImage2Model) {
      return {
        sizes: GPTIMAGE2_SIZE_VALUES,
        resolutions: GPTIMAGE2_RESOLUTION_VALUES,
        defaultSize: "1:1",
        defaultResolution: "2K",
      };
    }

    if (isMidjourneyModel) {
      return {
        sizes: MIDJOURNEY_SIZE_VALUES,
        defaultSize: "1:1",
      };
    }

    return null;
  }, [
    isGeminiModel,
    isGeminiPro2Model,
    isGptImage2Model,
    isMidjourneyModel,
    isLocalGeminiDirectModel,
    isNanoBananaLocalModel,
    isSeedreamModel,
  ]);

  useEffect(() => {
    if (!supportedImageParams) {
      return;
    }

    const patch: { size?: string; resolution?: string } = {};
    if (size && !supportedImageParams.sizes.has(size)) {
      patch.size = supportedImageParams.defaultSize;
    }
    if (
      supportedImageParams.resolutions &&
      resolution &&
      !supportedImageParams.resolutions.has(resolution)
    ) {
      patch.resolution = supportedImageParams.defaultResolution;
    }

    if (!patch.size && !patch.resolution) {
      return;
    }

    persistImageDefaultPreset(patch);
    updateImageNodeData(nodeId, patch);
  }, [
    nodeId,
    persistImageDefaultPreset,
    resolution,
    size,
    supportedImageParams,
    updateImageNodeData,
  ]);

  const requiredPoints = useMemo(() => {
    return normalizeRequiredPoints(
      getImageGenerationPoints({
        model,
        platform,
        count: isMidjourneyModel ? 1 : imageCount,
        fallback: fallbackAIGenPrice,
      }),
    );
  }, [
    fallbackAIGenPrice,
    imageCount,
    isMidjourneyModel,
    model,
    normalizeRequiredPoints,
    platform,
  ]);

  // Midjourney 高级参数
  const midjourneyAdvanced = currentImageData?.midjourneyAdvanced ?? {
    referenceUrls: referenceImageUrls,
    styleUrls: [],
    iw: 1,
    sw: 100,
  };

  const resetSuggestionState = () => {
    setActiveMode(null);
    setMentionQuery("");
    setCommandQuery("");
    setActiveIndex(0);
    triggerRangeRef.current = null;
  };

  const getMentionLabel = (attrs: {
    id?: string;
    label?: string;
    value?: string;
  }) => {
    return attrs.label || attrs.value || attrs.id || "";
  };

  const disableBuiltInSuggestion = {
    items: () => [],
    render: () => ({
      onStart: () => { },
      onUpdate: () => { },
      onKeyDown: () => false,
      onExit: () => { },
    }),
  };

  const mentionExtension = useMemo(() => {
    return Mention.configure({
      deleteTriggerWithBackspace: true,
      HTMLAttributes: {
        class: "image-node-mention-pill",
      },
      renderText({ options, node }) {
        const mentionLabel = getMentionLabel(node.attrs);
        return `${options.suggestion.char}${mentionLabel}`;
      },
      renderHTML({ options, node }) {
        const mentionLabel = getMentionLabel(node.attrs);
        return [
          "span",
          {
            ...options.HTMLAttributes,
            "data-mention-id": node.attrs.id,
            "data-mention-value": node.attrs.value,
            "data-mention-label": mentionLabel,
            contenteditable: "false",
          },
          `${options.suggestion.char}${mentionLabel}`,
        ];
      },
      // 这里禁用内建 suggestion UI，改为当前组件自己的下拉面板实现
      suggestion: {
        char: "@",
        ...disableBuiltInSuggestion,
      },
    });
  }, []);

  const slashCommandExtension = useMemo(() => {
    return Mention.extend({
      name: "slashCommand",
    }).configure({
      deleteTriggerWithBackspace: true,
      HTMLAttributes: {
        class: "image-node-slash-pill",
      },
      renderText({ options, node }) {
        const mentionLabel = getMentionLabel(node.attrs);
        return `${options.suggestion.char}${mentionLabel}`;
      },
      renderHTML({ options, node }) {
        const mentionLabel = getMentionLabel(node.attrs);
        return [
          "span",
          {
            ...options.HTMLAttributes,
            "data-mention-id": node.attrs.id,
            "data-mention-value": node.attrs.value,
            "data-mention-label": mentionLabel,
            contenteditable: "false",
          },
          `${options.suggestion.char}${mentionLabel}`,
        ];
      },
      suggestion: {
        char: "/",
        ...disableBuiltInSuggestion,
      },
    });
  }, []);

  // 用于粗粒度识别当前触发词位置，便于替换 @xxx 或 /xxx
  const triggerRangeRef = useRef<{ from: number; to: number } | null>(null);
  // 上传按钮对应的隐藏 input
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // 建议面板容器 ref
  const suggestionPanelRef = useRef<HTMLDivElement | null>(null);

  const insertSuggestionNode = (
    mode: "mention" | "command",
    item: (typeof MENTION_MOCK)[number] | (typeof COMMAND_MOCK)[number],
  ) => {
    if (!triggerRangeRef.current) {
      return;
    }

    if (mode === "mention") {
      const selected = item as (typeof MENTION_MOCK)[number];
      editor
        ?.chain()
        .focus()
        .insertContentAt(triggerRangeRef.current, [
          {
            type: "mention",
            attrs: {
              id: selected.id,
              label: selected.label,
              value: selected.value,
            },
          },
          {
            type: "text",
            text: " ",
          },
        ])
        .run();
      return;
    }

    const selected = item as (typeof COMMAND_MOCK)[number];

    // 根据命令自动设置 size
    const commandSizeMap: Record<string, string> = {
      "c-1": "4:3", // 角色参考图
      "c-2":
        isNanoBananaLocalModel
          ? "16:9"
          : "21:9", // 角色三视图
      "c-3": "16:9", // 多宫格电影分镜
      "c-4":
        isNanoBananaLocalModel
          ? "16:9"
          : "21:9", // VR图
    };
    const commandSize = commandSizeMap[selected.id];
    const targetSize =
      commandSize &&
        supportedImageParams &&
        !supportedImageParams.sizes.has(commandSize)
        ? supportedImageParams.defaultSize
        : commandSize;
    if (targetSize) {
      updateImageNodeData(nodeId, { size: targetSize });
    }

    // 根据命令自动设置 resolution
    const commandResolutionMap: Record<string, string | undefined> = {
      "c-3": isSeedreamModel ? "2K" : "1K", // 多宫格电影分镜
      "c-4":
        isNanoBananaLocalModel ||
          isGptImage2Model
          ? "4K"
          : "3K",
    };
    const commandResolution = commandResolutionMap[selected.id];
    const targetResolution =
      commandResolution &&
        supportedImageParams?.resolutions &&
        !supportedImageParams.resolutions.has(commandResolution)
        ? supportedImageParams.defaultResolution
        : commandResolution;
    if (targetResolution) {
      updateImageNodeData(nodeId, { resolution: targetResolution });
    }

    // 只插入 description 作为文本，不再插入 slashCommand 节点显示 label
    editor
      ?.chain()
      .focus()
      .insertContentAt(triggerRangeRef.current, [
        {
          type: "text",
          text: selected.description,
        },
      ])
      .run();
  };

  const filteredMentionItems = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();
    const all = [...MENTION_MOCK];
    if (!q) {
      return all;
    }
    return all.filter((item) => {
      return (
        item.label.toLowerCase().includes(q) ||
        item.value.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  }, [mentionQuery]);

  const filteredCommandItems = useMemo(() => {
    const q = commandQuery.trim().toLowerCase();
    const all = [...COMMAND_MOCK];
    if (!q) {
      return all;
    }
    return all.filter((item) => {
      return (
        item.label.toLowerCase().includes(q) ||
        item.command.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  }, [commandQuery]);

  // 沿着边找所有父节点，并合并其第一张图片作为参考图来源
  const parentImageEntryValues = useCanvasFlowStore(
    useShallow((state) => {
      return state.edges.flatMap((edge) => {
        if (edge.target !== nodeId) {
          return [];
        }

        const parentNode = state.nodes.find((node) => node.id === edge.source);
        if (!parentNode || parentNode.type !== "imageNode") {
          return [];
        }

        const parentData = parentNode.data as ImageGenerationNode;
        const firstItem = parentData.result?.data?.[0];
        if (!firstItem?.url) {
          return [];
        }

        return [
          edge.source,
          firstItem.url,
          firstItem.relativePath ?? "",
          firstItem.localFileName ?? "",
        ];
      });
    }),
  );

  const parentImageNodes = useMemo(() => {
    if (parentImageEntryValues.length === 0) {
      return [] as {
        id: string;
        url: string;
        relativePath?: string;
        fileName?: string;
      }[];
    }

    const result: {
      id: string;
      url: string;
      relativePath?: string;
      fileName?: string;
    }[] = [];

    for (let i = 0; i < parentImageEntryValues.length; i += 4) {
      result.push({
        id: String(parentImageEntryValues[i] ?? ""),
        url: String(parentImageEntryValues[i + 1] ?? ""),
        relativePath: String(parentImageEntryValues[i + 2] ?? "") || undefined,
        fileName: String(parentImageEntryValues[i + 3] ?? "") || undefined,
      });
    }

    return result;
  }, [parentImageEntryValues]);

  const parentImageUrls = useMemo(
    () => parentImageNodes.map((item) => item.url),
    [parentImageNodes],
  );

  // 断开连接时，同步清理 midjourneyAdvanced 中的 URL
  const handleDisconnectNode = useCallback(
    (sourceNodeId: string) => {
      const { edges, nodes } = useCanvasFlowStore.getState();
      const edgeToDelete = edges.find(
        (edge) => edge.source === sourceNodeId && edge.target === nodeId,
      );
      if (edgeToDelete) {
        deleteEdge(edgeToDelete.id);
      }

      // 从 midjourneyAdvanced 中移除断开连接的父节点图片
      // 通过 nodes 直接查找父节点，获取其第一张结果图的 URL
      const parentNode = nodes.find((node) => node.id === sourceNodeId);
      if (parentNode && parentNode.type === "imageNode") {
        const parentData = parentNode.data as ImageGenerationNode;
        const firstItem = parentData.result?.data?.[0];
        if (firstItem?.url) {
          const urlToRemove = firstItem.url;
          // 直接从最新的 nodes 状态中获取当前的 midjourneyAdvanced，避免依赖旧状态
          const currentNodeData = nodes.find((n) => n.id === nodeId);
          const currentAdvanced = (currentNodeData?.data as ImageGenerationNode)
            ?.midjourneyAdvanced;
          if (currentAdvanced) {
            const newReferenceUrls = (
              currentAdvanced.referenceUrls ?? []
            ).filter((url) => url !== urlToRemove);
            const newStyleUrls = (currentAdvanced.styleUrls ?? []).filter(
              (url) => url !== urlToRemove,
            );
            updateImageNodeData(nodeId, {
              midjourneyAdvanced: {
                ...currentAdvanced,
                referenceUrls: newReferenceUrls,
                styleUrls: newStyleUrls,
              },
            });
          }
        }
      }
    },
    [nodeId, deleteEdge, updateImageNodeData],
  );

  // 收集父级便签内容：按入边顺序去重后提取 content
  const parentNoteContents = useCanvasFlowStore(
    useShallow((state) => {
      const seenParentIds = new Set<string>();

      return state.edges
        .filter((edge) => {
          if (edge.target !== nodeId || seenParentIds.has(edge.source)) {
            return false;
          }

          seenParentIds.add(edge.source);
          return true;
        })
        .map((edge) => state.nodes.find((node) => node.id === edge.source))
        .filter((node) => node?.type === "noteNode")
        .map((node) => (node?.data as NoteNodeData).content?.trim())
        .filter((content): content is string => Boolean(content));
    }),
  );

  // 构建参考图列表：区分本地上传图片和父节点图片
  const localReferenceImageItems = useMemo(() => {
    const parentUrlCounts = new Map<string, number>();
    parentImageNodes.forEach((item) => {
      parentUrlCounts.set(item.url, (parentUrlCounts.get(item.url) ?? 0) + 1);
    });

    return (referenceImageUrls ?? []).flatMap((url, index) => {
      const count = parentUrlCounts.get(url) ?? 0;
      if (count > 0) {
        parentUrlCounts.set(url, count - 1);
        return [];
      }
      return [{ url, index }];
    });
  }, [parentImageNodes, referenceImageUrls]);

  const localReferenceImageUrls = useMemo(
    () => localReferenceImageItems.map((item) => item.url),
    [localReferenceImageItems],
  );

  const localReferenceImageIndexes = useMemo(
    () => localReferenceImageItems.map((item) => item.index),
    [localReferenceImageItems],
  );

  // 生成参考图 items（用于 ImageReferenceThumbnails）
  const generationReferenceItems = useMemo(() => {
    const items: Array<{
      id: string;
      url: string;
      label?: string;
      thumbnail?: string;
      isLocalImage?: boolean;
    }> = [];

    // 本地上传的图片
    localReferenceImageUrls.forEach((url, index) => {
      const label = `图片${toChineseNumber(index + 1)}`;
      items.push({
        id: `local-image-${localReferenceImageIndexes[index]}-${url}`,
        url,
        label,
        thumbnail: url,
        isLocalImage: true,
      });
    });

    // 父节点图片
    parentImageNodes.forEach((node) => {
      items.push({
        id: `parent-image-${node.id}`,
        url: node.url,
        label: node.fileName || node.relativePath?.split("/").pop() || "参考图",
        thumbnail: node.url,
        isLocalImage: false,
      });
    });

    return items;
  }, [localReferenceImageUrls, localReferenceImageIndexes, parentImageNodes]);

  // 参考图排序
  const handleReferenceReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;

      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= generationReferenceItems.length ||
        toIndex >= generationReferenceItems.length
      ) {
        return;
      }

      const nextItems = arrayMove(generationReferenceItems, fromIndex, toIndex);
      const nextUrls = nextItems.map((item) => item.url);

      updateImageNodeData(nodeId, {
        image_urls: nextUrls,
      });
    },
    [generationReferenceItems, nodeId, updateImageNodeData],
  );

  // 参考图删除
  const handleReferenceRemove = useCallback(
    (item: (typeof generationReferenceItems)[number]) => {
      if (item.isLocalImage) {
        // 本地上传的图片：从 image_urls 中移除
        const localIndex = localReferenceImageUrls.findIndex(
          (url, idx) =>
            item.id === `local-image-${localReferenceImageIndexes[idx]}-${url}`,
        );
        if (localIndex >= 0) {
          const urlToRemove = localReferenceImageUrls[localIndex];
          updateImageNodeData(nodeId, {
            image_urls: referenceImageUrls.filter((url) => url !== urlToRemove),
          });
        }
      } else {
        // 父节点图片：断开连接
        const nodeIdToDisconnect = item.id.replace("parent-image-", "");
        handleDisconnectNode(nodeIdToDisconnect);
      }
    },
    [
      generationReferenceItems,
      handleDisconnectNode,
      localReferenceImageIndexes,
      localReferenceImageUrls,
      nodeId,
      referenceImageUrls,
      updateImageNodeData,
    ],
  );

  // 参考图 hover 状态变化
  const handleReferenceHoverChange = useCallback(
    (item: (typeof generationReferenceItems)[number], isHovering: boolean) => {
      if (item.isLocalImage) {
        return;
      }

      const parentNodeId = item.id.replace("parent-image-", "");
      setReferenceHoverHighlight(parentNodeId, nodeId, isHovering);
    },
    [nodeId],
  );

  useEffect(() => {
    if (parentImageUrls.length === 0) {
      return;
    }

    const currentUrls = referenceImageUrls;
    const nextUrls = Array.from(new Set([...currentUrls, ...parentImageUrls]));

    const currentSet = new Set(currentUrls);
    const nextSet = new Set(nextUrls);

    const unchanged =
      currentSet.size === nextSet.size &&
      [...currentSet].every((url) => nextSet.has(url));

    if (unchanged) {
      return;
    }

    updateImageNodeData(nodeId, {
      image_urls: nextUrls,
    });
  }, [referenceImageUrls, nodeId, parentImageUrls, updateImageNodeData]);

  // 是否正在生成（用于按钮禁用态）
  const isGenerating = useMemo(() => {
    if (generatingCount > 0) {
      return true;
    }

    if (!currentImageData) {
      return false;
    }

    const status = currentImageData.status;
    return (
      status === GenerationStatus.IN_PROGRESS ||
      status === GenerationStatus.QUEUED
    );
  }, [currentImageData, generatingCount]);

  // 触发上传选择
  const handleUploadClick = () => {
    if (isUploading) {
      return;
    }
    fileInputRef.current?.click();
  };

  // 上传图片并回填到参image_urls: [...referenceImage
  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploading(true);

    try {
      // 检查文件大小，大于10MB时压缩
      let fileToUpload = file;
      if (file.size > MAX_IMAGE_SIZE_MB) {
        fileToUpload = await compressImage(file);
      }

      const result = await uploadFileToOSS(fileToUpload);
      const nextUrl = result.url;

      if (!nextUrl) {
        warning("上传成功但未返回图片地址");
        return;
      }

      updateImageNodeData(nodeId, {
        image_urls: [...referenceImageUrls, nextUrl],
      });
      success("上传成功");
    } catch (uploadError) {
      console.error("上传图片失败:", uploadError);
      error("上传失败，请重试");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const editor = useEditor({
    extensions: [StarterKit, mentionExtension, slashCommandExtension],
    content: promptDraftHtml,
    editorProps: {
      attributes: {
        class: cn(
          PROMPT_PANEL_STYLES.editorContent,
          "leading-6",
          "focus:outline-none",
        ),
        spellcheck: "false",
      },
      handleKeyDown: (_view, event) => {
        // 当焦点在图片提示词输入区时，空格仅用于输入，不向画布层冒泡。
        if (event.code === "Space" || event.key === " ") {
          event.stopPropagation();
          // 返回 false 让 TipTap 保持默认输入空格字符的行为。
          return false;
        }

        const currentItems =
          activeMode === "mention"
            ? filteredMentionItems
            : filteredCommandItems;

        if (!activeMode || currentItems.length === 0) {
          return false;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          setActiveIndex((prev) => (prev + 1) % currentItems.length);
          return true;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          setActiveIndex(
            (prev) => (prev - 1 + currentItems.length) % currentItems.length,
          );
          return true;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          resetSuggestionState();
          return true;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          if (activeMode === "mention") {
            const selected = filteredMentionItems[activeIndex];
            if (!selected) {
              return true;
            }

            insertSuggestionNode("mention", selected);
          }

          if (activeMode === "command") {
            const selected = filteredCommandItems[activeIndex];
            if (!selected) {
              return true;
            }

            insertSuggestionNode("command", selected);
          }

          resetSuggestionState();
          return true;
        }

        return false;
      },
      handleDOMEvents: {
        pointerdown: (_view, event) => {
          if (event.shiftKey && event.button === 0) {
            event.stopPropagation();
          }
          return false;
        },
        mousedown: (_view, event) => {
          if (event.shiftKey && event.button === 0) {
            event.stopPropagation();
          }
          return false;
        },
        click: (_view, event) => {
          if (event.shiftKey && event.button === 0) {
            event.stopPropagation();
          }
          return false;
        },
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      updateImageNodeData(nodeId, {
        promptDraft: currentEditor.getText(),
        promptDraftHtml: currentEditor.getHTML(),
      });

      const { from } = currentEditor.state.selection;
      const plainText = currentEditor.state.doc.textBetween(
        0,
        from,
        "\n",
        "\0",
      );
      const mentionMatch = plainText.match(/(^|\s)@([^\s@]*)$/);
      const commandMatch = plainText.match(/(^|\s)\/([^\s/]*)$/);

      if (mentionMatch) {
        setActiveMode("mention");
        setMentionQuery(mentionMatch[2] ?? "");
        setCommandQuery("");
        setActiveIndex(0);

        const triggerLength = `@${mentionMatch[2] ?? ""}`.length;
        triggerRangeRef.current = {
          from: Math.max(from - triggerLength, 0),
          to: from,
        };
        return;
      }

      if (commandMatch) {
        setActiveMode("command");
        setCommandQuery(commandMatch[2] ?? "");
        setMentionQuery("");
        setActiveIndex(0);

        const triggerLength = `/${commandMatch[2] ?? ""}`.length;
        triggerRangeRef.current = {
          from: Math.max(from - triggerLength, 0),
          to: from,
        };
        return;
      }

      resetSuggestionState();
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const currentHtml = editor.getHTML();
    if (currentHtml === promptDraftHtml) {
      return;
    }

    editor.commands.setContent(promptDraftHtml, { emitUpdate: false });
  }, [editor, promptDraftHtml]);

  const suggestionItems =
    activeMode === "mention" ? filteredMentionItems : filteredCommandItems;

  // 当 activeIndex 改变时，自动滚动到选中的选项
  useEffect(() => {
    if (
      suggestionPanelRef.current &&
      activeMode &&
      suggestionItems.length > 0
    ) {
      const activeElement = suggestionPanelRef.current.children[
        activeIndex
      ] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [activeIndex, activeMode, suggestionItems.length]);

  // 点击生成：根据数量多次调用接口创建任务
  const handleGenerate = async () => {
    const promptText = editor?.getText().trim() ?? "";
    const mergedPrompt = [...parentNoteContents, promptText]
      .map((content) => content.trim())
      .filter((content) => content.length > 0)
      .join(" ");

    if (!mergedPrompt) {
      warning("请输入提示词");
      return;
    }

    // 判断是否为 Midjourney Niji7 模型，如果是则在 prompt 最后拼接 --niji7 参数
    const isNiji7Model = model === "midjourney-niji7";
    // 构建 Midjourney 模型的最终 prompt：添加 --ar 参数
    let finalPrompt = mergedPrompt;
    if (isMidjourneyModel) {
      // Midjourney 模型：在 prompt 末尾拼接 --ar 尺寸参数
      finalPrompt = `${finalPrompt} --ar ${size}`;
      // 如果是 Niji7 模型，还需要拼接 --niji 7
      if (isNiji7Model) {
        finalPrompt = `${finalPrompt} --niji 7`;
      }
    }
    // Gemini 3 Pro 渠道二：在 prompt 末尾拼接 [尺寸:x:x] [分辨率:xK] 参数
    if (isGeminiPro2Model) {
      finalPrompt = `${finalPrompt} [尺寸:${size}] [分辨率:${resolution}]`;
    }
    // 发送给后端的 model 字段：如果是 midjourney-niji7 则改为 midjourney
    const backendModel = isNiji7Model ? "midjourney" : model;

    // image_urls 直接使用界面当前显示的参考图列表（上传 + 父节点结果）
    // 所有图片在上传时已经上传到 OSS，或是在线 URL，直接使用即可
    const latestState = useCanvasFlowStore.getState();
    const latestNode = latestState.nodes.find((node) => node.id === nodeId);
    const latestImageData =
      latestNode?.type === "imageNode"
        ? (latestNode.data as ImageGenerationNode)
        : null;
    const latestReferenceUrls = Array.isArray(latestImageData?.image_urls)
      ? latestImageData.image_urls
      : [];
    const latestParentImageUrls = latestState.edges
      .filter((edge) => edge.target === nodeId)
      .flatMap((edge) => {
        const sourceNode = latestState.nodes.find(
          (node) => node.id === edge.source,
        );
        if (sourceNode?.type !== "imageNode") {
          return [];
        }
        const sourceData = sourceNode.data as ImageGenerationNode;
        return (sourceData.result?.data ?? [])
          .map((item) => getRemoteMediaUrl(item) ?? item?.url)
          .filter((url): url is string => Boolean(url));
      });
    const imageUrls = Array.from(
      new Set(
        [
          ...referenceImageUrls,
          ...latestReferenceUrls,
          ...latestParentImageUrls,
        ]
          .map((url) => String(url || "").trim())
          .filter(Boolean),
      ),
    );

    if (
      imageUrls.length > 0 &&
      imageUrls.join("\n") !== latestReferenceUrls.join("\n")
    ) {
      updateImageNodeData(nodeId, {
        image_urls: imageUrls,
      });
    }
    const generationTaskCount = isMidjourneyModel ? 1 : imageCount;
    const perTaskRequiredPoints = requiredPoints / generationTaskCount;

    const totalScoreCost = requiredPoints;

    // 前置余额校验：避免积分不足时仍创建任务
    if (
      !(await validateBalanceBeforeGenerate({
        requiredPoints: totalScoreCost,
        warning,
      }))
    ) {
      return;
    }

    // 构建请求 payload
    const buildPayload = (): any => {
      // 基础 payload
      const basePayload: any = {
        // 请求使用 backendModel（后端统一使用 midjourney，Niji7 效果通过 prompt 参数控制）
        model: backendModel,
        // 保留原始 model 用于 UI 状态同步
        originalModel: model,
        prompt: finalPrompt,
        resolution,
        n: 1,
        image_urls: imageUrls,
        requiredPoints: perTaskRequiredPoints,
        promptDraft: editor?.getText() ?? "",
        promptDraftHtml: editor?.getHTML() ?? "<p></p>",
        metadata: {},
      };

      // 根据不同模型添加专属参数
      if (isSeedreamModel) {
        // Seedream 5.0: size 作为宽高比
        basePayload.size = size;
        basePayload.metadata = {
          resolution,
        };
      } else if (
        isGeminiModel ||
        isNanoBananaLocalModel
      ) {
        // Gemini 3 Pro: size 作为画面比例
        basePayload.size = size;
        basePayload.metadata = {
          resolution,
        };
      } else {
        // 其他模型（Midjourney 等）
        basePayload.size = size;
        basePayload.aspectRatio = currentImageData?.aspectRatio ?? "1:1";
        basePayload.metadata = {
          resolution,
        };
        if (isMidjourneyModel) {
          basePayload.midjourneyAdvanced = midjourneyAdvanced;
        }
      }

      return basePayload;
    };

    // 显示总共需要生成的图片数量
    setGeneratingCount(imageCount);

    // 记录成功和失败的数量
    let successCount = 0;
    let failCount = 0;

    // 本地 Gemini 直连：按固定节流间隔提交，遇到风控/Token 异常时停止剩余请求
    if (isLocalGeminiDirectModel) {
      let completedCount = 0;
      let submittedCount = 0;
      let shouldStopRemainingSubmissions = false;
      let stopReason = "";
      const submittedTasks: Array<Promise<void>> = [];

      for (let i = 0; i < imageCount; i++) {
        if (shouldStopRemainingSubmissions) {
          break;
        }

        const payload = buildPayload();
        submittedCount++;

        const task = startGeminiPro2Generation(nodeId, {
          ...payload,
          platform: currentImageData?.platform,
        })
          .then(() => {
            successCount++;
          })
          .catch((startError) => {
            failCount++;
            shouldStopRemainingSubmissions = true;
            stopReason =
              (startError as any)?.message || "本地 Gemini 异常";
          })
          .finally(() => {
            completedCount++;
            setGeneratingCount((prev) => Math.max(prev - 1, 0));
          });
        submittedTasks.push(task);

        if (i < imageCount - 1) {
          let remainingDelay = LOCAL_GEMINI_BATCH_SUBMIT_DELAY_MS;
          while (remainingDelay > 0) {
            if (shouldStopRemainingSubmissions) {
              break;
            }

            const chunkDelay = Math.min(remainingDelay, 200);
            await new Promise((resolve) =>
              window.setTimeout(resolve, chunkDelay),
            );
            remainingDelay -= chunkDelay;
          }
        }
      }

      const skippedCount = Math.max(imageCount - submittedCount, 0);
      if (skippedCount > 0) {
        setGeneratingCount((prev) => Math.max(prev - skippedCount, 0));
        warning(
          stopReason
            ? `${stopReason} 已停止剩余 ${skippedCount} 次提交。`
            : `检测到本地 Gemini 异常，已停止剩余 ${skippedCount} 次提交。`,
        );
      } else {
        success(`已按 3 秒间隔提交 ${submittedCount} 次生成请求`);
      }

      await Promise.allSettled(submittedTasks);

      if (submittedCount === 0) {
        setGeneratingCount(0);
        error(stopReason || "创建任务失败，请稍后再试");
        return;
      }

      const finalStoppedSuffix =
        skippedCount > 0 ? `，已停止剩余 ${skippedCount} 次提交` : "";
      if (failCount === 0) {
        success(`已生成 ${successCount} 张图片${finalStoppedSuffix}`);
        void refreshBalanceInfo();
      } else if (successCount > 0) {
        warning(
          `已生成 ${successCount} 张图片，${failCount} 张失败${finalStoppedSuffix}`,
        );
        void refreshBalanceInfo();
      } else {
        error(stopReason || "创建任务失败，请稍后再试");
      }

      return;
    }

    {
      // 多次调用接口，每次只生成 1 张图片
      for (let i = 0; i < imageCount; i++) {
        try {
          await startImageGeneration(nodeId, buildPayload());
          successCount++;
        } catch {
          // 错误已由全局拦截器处理并在 ImageContent 中展示，此处不需要重复弹窗
          failCount++;
        }
      }
    }

    // 重置进度显示
    setGeneratingCount(0);

    // 根据结果显示提示
    if (failCount === 0) {
      success(`已开始生成 ${successCount} 张图片`);
      void refreshBalanceInfo();
    } else if (successCount > 0) {
      warning(`已创建 ${successCount} 张图片，${failCount} 张创建失败`);
      void refreshBalanceInfo();
    } else {
      error("创建任务失败，请稍后再试");
    }
  };

  /**
   * 停止正在进行的图片生成轮询。
   */
  const handleStop = useCallback(() => {
    if (!isGenerating) return;
    stopImagePolling(nodeId);
    // 重置节点状态为完成，清除进度和结果
    updateImageNodeData(nodeId, {
      status: GenerationStatus.COMPLETED,
      progress: 0,
      result: undefined,
      error: undefined,
    });
    success("已停止生成");
  }, [isGenerating, stopImagePolling, nodeId, success, updateImageNodeData]);

  return (
    <div className={PROMPT_PANEL_STYLES.container}>
      <div className={PROMPT_PANEL_STYLES.inputArea}>
        <div
          className={PROMPT_PANEL_STYLES.textAreaWrap}
          onWheelCapture={handlePromptEditorWheelCapture}
        >
          <EditorContent editor={editor} />
        </div>

        <div className="nodrag nopan nowheel flex gap-2 overflow-x-auto pb-1">
          {/* 上传按钮（固定为第一个） */}
          <Button
            unstyled
            className={PROMPT_PANEL_STYLES.uploadButton}
            onClick={handleUploadClick}
            title={isUploading ? "上传中..." : "上传参考图"}
            disabled={isUploading}
          >
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px]">
              <IconUpload
                size={16}
                className="w-4 h-4 mb-1.5 group-hover:-translate-y-0.5 transition-transform"
              />
              {isUploading ? "上传中" : "上传"}
            </div>
          </Button>

          {/* 隐藏 input，用于触发文件选择 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* 参考图列表（支持拖拽排序、hover 预览、删除） */}
          {generationReferenceItems.length > 0 && (
            <ImageReferenceThumbnails
              items={generationReferenceItems}
              onReorder={handleReferenceReorder}
              onRemove={handleReferenceRemove}
              onHoverChange={handleReferenceHoverChange}
            />
          )}
        </div>
        {/* 建议面板 */}
        {activeMode && suggestionItems.length > 0 && (
          <div
            ref={suggestionPanelRef}
            className="nodrag nopan nowheel absolute right-2 bottom-full left-2 z-30 mb-5 max-h-60 overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 shadow-[0_14px_34px_rgba(0,0,0,0.45)]"
          >
            {suggestionItems.map((item, index) => {
              const isActive = index === activeIndex;
              const title = item.label;
              const desc = item.description;
              const token =
                activeMode === "mention" ? `@${item.value}` : item.command;

              return (
                <Button
                  key={item.id}
                  unstyled
                  className={cn(
                    "flex w-full items-start justify-between gap-3 border-b border-neutral-800 px-3 py-2 text-left last:border-b-0",
                    isActive
                      ? "bg-neutral-700 text-neutral-100"
                      : "text-neutral-200 hover:bg-neutral-800",
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setActiveIndex(index);

                    if (!triggerRangeRef.current) {
                      return;
                    }

                    if (activeMode === "mention") {
                      insertSuggestionNode("mention", item);
                    } else {
                      insertSuggestionNode("command", item);
                    }

                    resetSuggestionState();
                  }}
                >
                  <div>
                    <div className="text-xs font-medium">{title}</div>
                    <div className="mt-0.5 text-[11px] text-neutral-400">
                      {desc}
                    </div>
                  </div>
                  <span className="rounded-md border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300">
                    {token}
                  </span>
                </Button>
              );
            })}
          </div>
        )}
      </div>

      <div className={PROMPT_PANEL_STYLES.divider} />

      <div className={PROMPT_PANEL_STYLES.controlArea}>
        <div className="flex w-full min-w-0 items-center gap-2 overflow-hidden">
          {/* 生成模型 - 始终在最左侧 */}
          <Select
            value={String(currentModelId)}
            onValueChange={(value) => {
              const selectedModel = visibleImageModels.find(
                (item) => item.id === Number(value),
              );
              persistImageDefaultPreset({
                model: selectedModel?.model ?? value,
                platform: selectedModel?.platform,
              });
              updateImageNodeData(nodeId, {
                model: selectedModel?.model ?? value,
                platform: selectedModel?.platform,
              });
            }}
          >
            <SelectTrigger
              className={cn(
                PROMPT_PANEL_STYLES.modelSelect,
                "h-8 min-w-[136px] max-w-[42%] w-[240px] shrink overflow-hidden px-3",
                "[&_[data-slot=select-value]]:block [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate",
              )}
              title={
                visibleImageModels.find((item) => item.id === currentModelId)
                  ?.name
              }
            >
              <SelectValue placeholder="选择模型" />
            </SelectTrigger>
            <SelectContent className={PROMPT_PANEL_STYLES.modelSelectContent}>
              {visibleImageModels.map((item) => (
                <SelectItem
                  key={item.id}
                  value={String(item.id)}
                  className={PROMPT_PANEL_STYLES.modelSelectItem}
                >
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 根据模型动态渲染整合参数面板 */}
          {isSeedreamModel && (
            // Seedream 5.0 整合参数面板
            <SeedreamParamsPanel
              size={size}
              resolution={resolution}
              onSizeChange={(value) => {
                persistImageDefaultPreset({ size: value });
                updateImageNodeData(nodeId, { size: value });
              }}
              onResolutionChange={(value) => {
                persistImageDefaultPreset({ resolution: value });
                updateImageNodeData(nodeId, { resolution: value });
              }}
            />
          )}
          {isGeminiModel && (
            // Gemini 3 Pro 整合参数面板
            <GeminiParamsPanel
              size={size}
              resolution={resolution}
              onSizeChange={(value) => {
                persistImageDefaultPreset({ size: value });
                updateImageNodeData(nodeId, { size: value });
              }}
              onResolutionChange={(value) => {
                persistImageDefaultPreset({ resolution: value });
                updateImageNodeData(nodeId, { resolution: value });
              }}
            />
          )}
          {isGeminiPro2Model && (
            // Gemini 3 Pro 渠道二整合参数面板（参数拼接到提示词）
            <GeminiParamsPanel
              size={size}
              resolution={resolution}
              onSizeChange={(value) => {
                persistImageDefaultPreset({ size: value });
                updateImageNodeData(nodeId, { size: value });
              }}
              onResolutionChange={(value) => {
                persistImageDefaultPreset({ resolution: value });
                updateImageNodeData(nodeId, { resolution: value });
              }}
            />
          )}
          {isNanoBananaLocalModel && (
            <GeminiParamsPanel
              size={size}
              resolution={resolution}
              sizeOptions={NANO_BANANA_LOCAL_SIZES}
              resolutionOptions={NANO_BANANA_RESOLUTIONS}
              onSizeChange={(value) => {
                persistImageDefaultPreset({ size: value });
                updateImageNodeData(nodeId, { size: value });
              }}
              onResolutionChange={(value) => {
                persistImageDefaultPreset({ resolution: value });
                updateImageNodeData(nodeId, { resolution: value });
              }}
            />
          )}

          {isGptImage2Model && (
            // GPT-Image-2 整合参数面板
            <GptImage2ParamsPanel
              size={size}
              resolution={resolution}
              sizeOptions={GPTIMAGE2_SIZES}
              resolutionOptions={GPTIMAGE2_RESOLUTION_OPTIONS}
              onSizeChange={(value) => {
                persistImageDefaultPreset({ size: value });
                updateImageNodeData(nodeId, { size: value });
              }}
              onResolutionChange={(value) => {
                persistImageDefaultPreset({ resolution: value });
                updateImageNodeData(nodeId, { resolution: value });
              }}
            />
          )}

          {isGeminiModel && (
            <GeminiParamsPanel
              size={size}
              resolution={resolution}
              onSizeChange={(value) => {
                persistImageDefaultPreset({ size: value });
                updateImageNodeData(nodeId, { size: value });
              }}
              onResolutionChange={(value) => {
                persistImageDefaultPreset({ resolution: value });
                updateImageNodeData(nodeId, { resolution: value });
              }}
            />
          )}

          {isNanoBananaLocalModel && (
            <GeminiParamsPanel
              size={size}
              resolution={resolution}
              sizeOptions={NANO_BANANA_LOCAL_SIZES}
              resolutionOptions={NANO_BANANA_RESOLUTIONS}
              onSizeChange={(value) => {
                persistImageDefaultPreset({ size: value });
                updateImageNodeData(nodeId, { size: value });
              }}
              onResolutionChange={(value) => {
                persistImageDefaultPreset({ resolution: value });
                updateImageNodeData(nodeId, { resolution: value });
              }}
            />
          )}

          {isMidjourneyModel && (
            <MidjourneyParamsPanel
              size={size}
              onSizeChange={(value) => {
                persistImageDefaultPreset({ size: value });
                updateImageNodeData(nodeId, { size: value });
              }}
            />
          )}

          {/* Midjourney 高级选项 - 仅在选择 Midjourney 模型时显示 */}
          {isMidjourneyModel && (
            <MidjourneyAdvancedPanel
              referenceImageUrls={referenceImageUrls}
              value={midjourneyAdvanced}
              onChange={(next) => {
                updateImageNodeData(nodeId, {
                  midjourneyAdvanced: {
                    referenceUrls: next.referenceUrls ?? [],
                    styleUrls: next.styleUrls ?? [],
                    iw: next.iw ?? 1,
                    sw: next.sw ?? 100,
                  },
                });
              }}
            />
          )}

          {/* 数量选择和生成按钮 */}
          <div className="ml-auto flex shrink-0 items-center gap-3">
            {/* 预设提示词下拉 */}
            <PresetDropdown
              presetType="image"
              disabled={false}
              onSelect={(content) => {
                editor?.commands.insertContent(content);
              }}
            />

            {/* 数量选择按钮 - Midjourney 模型隐藏 */}
            {!isMidjourneyModel && (
              <button
                type="button"
                onClick={() => {
                  const currentIndex = IMAGE_COUNT_OPTIONS.indexOf(imageCount);
                  const nextIndex =
                    (currentIndex + 1) % IMAGE_COUNT_OPTIONS.length;
                  setImageCount(IMAGE_COUNT_OPTIONS[nextIndex]);
                }}
                disabled={isGenerating}
                className={cn(
                  PROMPT_PANEL_STYLES.countButton,
                  isGenerating && "opacity-50 cursor-not-allowed",
                )}
                title={`当前生成 ${imageCount} 张图片，点击切换`}
              >
                <span>×</span>
                <span>{imageCount}</span>
              </button>
            )}

            {pointsEnabled ? (
              <ModelPointsBadge
                totalPoints={totalPoints}
                requiredPoints={requiredPoints}
                title={`当前模型预计消耗 ${requiredPoints} 积分，当前余额 ${totalPoints}`}
              />
            ) : null}

            {/* 生成/停止按钮 */}
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
                {generatingCount > 0 ? `生成中 (${generatingCount})` : "生成"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

ImagePromptPanel.displayName = "ImagePromptPanel";

