import { arrayMove } from "@dnd-kit/sortable";
import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconPhoto,
  IconX,
} from "@tabler/icons-react";
import Mention from "@tiptap/extension-mention";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImageReferenceThumbnails } from "./components/ImageReferenceThumbnails";
import { ImageModelHelpTooltip } from "./components/ImageModelHelpTooltip";
import {
  AGNES_IMAGE_21_FLASH_MODEL,
  APIMART_FLUX_2_PRO_MODEL,
  APIMART_GPT_IMAGE_25_MODEL,
  APIMART_PLATFORM,
  APIMART_QWEN_IMAGE_30_MODEL,
  IMAGE_NODE_MODELS,
  NANO_BANANA_LOCAL_MODEL,
  NANO_BANANA_LOCAL_PLATFORM,
  RUNNINGHUB_GPT_IMAGE2_MODEL,
  RUNNINGHUB_MIDJOURNEY_V81_MODEL,
  RUNNINGHUB_NANO_BANANA_PRO_MODEL,
  RUNNINGHUB_PLATFORM,
  isAPIMartImageModel as isAPIMartImageModelId,
  isAgnesImageModel as isAgnesImageModelId
} from "shared/constants/ai-models";
import { GenerationStatus } from "shared/constants/enum";
import { getImageGenerationPoints } from "shared/constants/model-points";
import type { ImageGenerationNode, NoteNodeData } from "shared/types/flow";
import { getRemoteMediaUrl } from "shared/utils/mediaPersistence";
import { cn, toChineseNumber } from "shared/utils/utils";
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
import { ResizablePromptModal } from "../shared/ResizablePromptModal";
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
import {
  MidjourneyPanel,
  type MidjourneyQuality,
} from "./components/MidjourneyPanel";
import {
  SEEDREAM_ASPECT_RATIOS,
  SEEDREAM_RESOLUTIONS,
  SeedreamParamsPanel
} from "./components/SeedreamParamsPanel";
import { COMMAND_MOCK } from "./mock";

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
const MIDJOURNEY_V81_SIZE_OPTIONS = GPTIMAGE2_SIZES.filter((item) =>
  ["1:1", "4:3", "3:2", "16:9", "3:4", "2:3", "9:16"].includes(
    item.value,
  ),
);
const MIDJOURNEY_V81_SIZE_VALUES = toOptionValueSet(
  MIDJOURNEY_V81_SIZE_OPTIONS,
);
const MIDJOURNEY_V81_RESOLUTION_VALUES = new Set(["1K", "2K"]);
const MIDJOURNEY_V81_RESOLUTION_OPTIONS = [
  { label: "1K", value: "1K", description: "标准" },
  { label: "2K", value: "2K", description: "原生高清" },
];
const AGNES_IMAGE_SIZE_OPTIONS = [
  { label: "1:1", value: "1:1", description: "正方形" },
  { label: "4:3", value: "4:3", description: "横向4:3" },
  { label: "3:4", value: "3:4", description: "竖向3:4" },
  { label: "16:9", value: "16:9", description: "横向宽屏" },
  { label: "9:16", value: "9:16", description: "竖向长图" },
];
const AGNES_IMAGE_SIZE_VALUES = toOptionValueSet(AGNES_IMAGE_SIZE_OPTIONS);
const AGNES_IMAGE_RESOLUTION_VALUES = new Set(["1K"]);
const AGNES_IMAGE_RESOLUTION_OPTIONS = [
  { label: "1K", value: "1K", description: "1024px" },
];
const AGNES_IMAGE_21_SIZE_OPTIONS = [
  ...AGNES_IMAGE_SIZE_OPTIONS,
  { label: "2:3", value: "2:3", description: "竖向2:3" },
  { label: "3:2", value: "3:2", description: "横向3:2" },
  { label: "21:9", value: "21:9", description: "超宽屏" },
];
const AGNES_IMAGE_21_SIZE_VALUES = toOptionValueSet(
  AGNES_IMAGE_21_SIZE_OPTIONS,
);
const AGNES_IMAGE_21_RESOLUTION_VALUES = new Set(["1K", "2K", "3K", "4K"]);
const AGNES_IMAGE_21_RESOLUTION_OPTIONS = [
  { label: "1K", value: "1K", description: "标准" },
  { label: "2K", value: "2K", description: "高清" },
  { label: "3K", value: "3K", description: "高精细" },
  { label: "4K", value: "4K", description: "超清" },
];
const APIMART_FLUX_SIZE_OPTIONS = GPTIMAGE2_SIZES.filter((item) =>
  ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9", "9:21"].includes(
    item.value,
  ),
);
const APIMART_FLUX_SIZE_VALUES = toOptionValueSet(APIMART_FLUX_SIZE_OPTIONS);
const APIMART_FLUX_RESOLUTION_OPTIONS = [
  { label: "1MP", value: "1MP", description: "标准" },
  { label: "2MP", value: "2MP", description: "默认" },
  { label: "3MP", value: "3MP", description: "高清" },
  { label: "4MP", value: "4MP", description: "超清" },
];
const APIMART_FLUX_RESOLUTION_VALUES = toOptionValueSet(
  APIMART_FLUX_RESOLUTION_OPTIONS,
);
const APIMART_GPT_IMAGE_25_SIZE_OPTIONS = [
  ...GPTIMAGE2_SIZES,
  { label: "3:1", value: "3:1", description: "超宽横图" },
  { label: "1:3", value: "1:3", description: "超长竖图" },
];
const APIMART_GPT_IMAGE_25_SIZE_VALUES = toOptionValueSet(
  APIMART_GPT_IMAGE_25_SIZE_OPTIONS,
);
const APIMART_GPT_IMAGE_25_RESOLUTION_OPTIONS = [
  { label: "1K", value: "1K", description: "标准" },
  { label: "2K", value: "2K", description: "高清" },
  { label: "4K", value: "4K", description: "超清" },
];
const APIMART_GPT_IMAGE_25_RESOLUTION_VALUES = toOptionValueSet(
  APIMART_GPT_IMAGE_25_RESOLUTION_OPTIONS,
);
const APIMART_GPT_IMAGE_25_QUALITY_OPTIONS = [
  { label: "自动", value: "auto" },
  { label: "低", value: "low" },
  { label: "标准", value: "medium" },
  { label: "高", value: "high" },
  { label: "超高", value: "xhigh" },
  { label: "最高", value: "max" },
];
const APIMART_GPT_IMAGE_25_QUALITY_VALUES = toOptionValueSet(
  APIMART_GPT_IMAGE_25_QUALITY_OPTIONS,
);
const APIMART_QWEN_IMAGE_30_SIZE_OPTIONS = GPTIMAGE2_SIZES.filter((item) =>
  ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"].includes(
    item.value,
  ),
);
const APIMART_QWEN_IMAGE_30_SIZE_VALUES = toOptionValueSet(
  APIMART_QWEN_IMAGE_30_SIZE_OPTIONS,
);
const APIMART_QWEN_IMAGE_30_RESOLUTION_OPTIONS = [
  { label: "1K", value: "1K", description: "标准" },
  { label: "2K", value: "2K", description: "高清" },
];
const APIMART_QWEN_IMAGE_30_RESOLUTION_VALUES = toOptionValueSet(
  APIMART_QWEN_IMAGE_30_RESOLUTION_OPTIONS,
);
const SEEDREAM_SIZE_VALUES = toOptionValueSet(SEEDREAM_ASPECT_RATIOS);
const SEEDREAM_RESOLUTION_VALUES = toOptionValueSet(SEEDREAM_RESOLUTIONS);

type SupportedImageParams = {
  sizes?: Set<string>;
  resolutions?: Set<string>;
  defaultSize: string;
  defaultResolution?: string;
};

export const ImagePromptPanel = memo(({ nodeId }: { nodeId: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);
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
  const [mentionPreview, setMentionPreview] = useState<{
    src: string;
    label: string;
    left: number;
    top: number;
  } | null>(null);

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
    () => IMAGE_NODE_MODELS,
    [],
  );

  // 从 currentImageData 获取基础字段
  const model = currentImageData?.model ?? "gemini-3-pro-image-preview";
  const platform = currentImageData?.platform;

  // 根据 model 和 platform 找到对应的模型 id
  // 新建节点时 platform 为 undefined，需要回退到只按 model 匹配
  const currentModelId = (() => {
    // 优先精确匹配 model + platform
    const matched = IMAGE_NODE_MODELS.find(
      (item) => item.model === model && item.platform === platform,
    );
    if (matched) {
      return matched.id;
    }
    // 回退：只按 model 匹配（新建节点时 platform 为 undefined）
    // 由于所有图片节点模型都有 platform 值，这里改为按 id 回退
    // 找不到时返回 id=3（默认的"谷歌 Gemini 3 Pro"）
    const fallback = IMAGE_NODE_MODELS.find((item) => item.model === model);
    return fallback?.id ?? 3;
  })();

  // 统一使用 size 字段存储宽高比/画面比例
  const size = currentImageData?.size ?? "1:1";
  const resolution = currentImageData?.resolution ?? "2K";
  const chaos = currentImageData?.chaos ?? 0;
  const stylize = currentImageData?.stylize ?? 0;
  const imageWeight = currentImageData?.iw ?? 1;
  const midjourneyQuality: MidjourneyQuality =
    currentImageData?.quality === "4" ? "4" : "1";
  const raw = currentImageData?.raw ?? false;
  const apimartQuality = APIMART_GPT_IMAGE_25_QUALITY_VALUES.has(
    currentImageData?.quality ?? "",
  )
    ? currentImageData?.quality ?? "medium"
    : "medium";
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
  const isRunningHubGptImage2Model =
    model === RUNNINGHUB_GPT_IMAGE2_MODEL &&
    currentImageData?.platform === RUNNINGHUB_PLATFORM;
  const isRunningHubNanoBananaProModel =
    model === RUNNINGHUB_NANO_BANANA_PRO_MODEL &&
    currentImageData?.platform === RUNNINGHUB_PLATFORM;
  const isRunningHubMidjourneyV81Model =
    model === RUNNINGHUB_MIDJOURNEY_V81_MODEL &&
    currentImageData?.platform === RUNNINGHUB_PLATFORM;
  const isNanoBananaParamsModel =
    isNanoBananaLocalModel || isRunningHubNanoBananaProModel;
  // 判断是否为 GPT-Image-2 模型
  const isGptImage2Model = model === "gpt-image-2" || isRunningHubGptImage2Model;
  const isAgnesImageModel = isAgnesImageModelId(model);
  const isAgnesImage21Model = model === AGNES_IMAGE_21_FLASH_MODEL;
  const isAPIMartImageModel =
    isAPIMartImageModelId(model) && currentImageData?.platform === APIMART_PLATFORM;
  const isAPIMartFluxModel =
    isAPIMartImageModel && model === APIMART_FLUX_2_PRO_MODEL;
  const isAPIMartGptImage25Model =
    isAPIMartImageModel && model === APIMART_GPT_IMAGE_25_MODEL;
  const isAPIMartQwenImage30Model =
    isAPIMartImageModel && model === APIMART_QWEN_IMAGE_30_MODEL;
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

    if (isNanoBananaParamsModel) {
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

    if (isRunningHubMidjourneyV81Model) {
      return {
        sizes: MIDJOURNEY_V81_SIZE_VALUES,
        resolutions: MIDJOURNEY_V81_RESOLUTION_VALUES,
        defaultSize: "1:1",
        defaultResolution: "1K",
      };
    }

    if (isAgnesImageModel) {
      return {
        sizes: isAgnesImage21Model
          ? AGNES_IMAGE_21_SIZE_VALUES
          : AGNES_IMAGE_SIZE_VALUES,
        resolutions: isAgnesImage21Model
          ? AGNES_IMAGE_21_RESOLUTION_VALUES
          : AGNES_IMAGE_RESOLUTION_VALUES,
        defaultSize: "1:1",
        defaultResolution: isAgnesImage21Model ? "2K" : "1K",
      };
    }

    if (isAPIMartFluxModel) {
      return {
        sizes: APIMART_FLUX_SIZE_VALUES,
        resolutions: APIMART_FLUX_RESOLUTION_VALUES,
        defaultSize: "1:1",
        defaultResolution: "2MP",
      };
    }

    if (isAPIMartGptImage25Model) {
      return {
        sizes: APIMART_GPT_IMAGE_25_SIZE_VALUES,
        resolutions: APIMART_GPT_IMAGE_25_RESOLUTION_VALUES,
        defaultSize: "1:1",
        defaultResolution: "1K",
      };
    }

    if (isAPIMartQwenImage30Model) {
      return {
        sizes: APIMART_QWEN_IMAGE_30_SIZE_VALUES,
        resolutions: APIMART_QWEN_IMAGE_30_RESOLUTION_VALUES,
        defaultSize: "1:1",
        defaultResolution: "1K",
      };
    }

    return null;
  }, [
    isGeminiModel,
    isGeminiPro2Model,
    isGptImage2Model,
    isAgnesImage21Model,
    isAgnesImageModel,
    isAPIMartFluxModel,
    isAPIMartGptImage25Model,
    isAPIMartQwenImage30Model,
    isLocalGeminiDirectModel,
    isNanoBananaParamsModel,
    isRunningHubMidjourneyV81Model,
    isSeedreamModel,
  ]);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

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
        resolution,
        quality: isAPIMartGptImage25Model ? apimartQuality : undefined,
        count: imageCount,
        fallback: fallbackAIGenPrice,
      }),
    );
  }, [
    fallbackAIGenPrice,
    imageCount,
    isAPIMartGptImage25Model,
    model,
    normalizeRequiredPoints,
    platform,
    resolution,
    apimartQuality,
  ]);

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
    displayLabel?: string;
    value?: string;
  }) => {
    return attrs.displayLabel || attrs.label || attrs.value || attrs.id || "";
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
    return Mention.extend({
      parseHTML() {
        return [{ tag: "span[data-mention-id]" }];
      },
      addAttributes() {
        return {
          ...this.parent?.(),
          thumbnail: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-thumbnail"),
            renderHTML: (attributes) =>
              attributes.thumbnail
                ? { "data-thumbnail": attributes.thumbnail }
                : {},
          },
          originalLabel: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute("data-mention-original-label"),
            renderHTML: (attributes) =>
              attributes.originalLabel
                ? { "data-mention-original-label": attributes.originalLabel }
                : {},
          },
          displayLabel: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute("data-mention-display-label"),
            renderHTML: (attributes) =>
              attributes.displayLabel
                ? { "data-mention-display-label": attributes.displayLabel }
                : {},
          },
          type: {
            default: "image",
            parseHTML: (element) =>
              element.getAttribute("data-mention-kind") || "image",
            renderHTML: (attributes) => ({
              "data-mention-kind": attributes.type || "image",
            }),
          },
          url: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-url"),
            renderHTML: (attributes) =>
              attributes.url ? { "data-url": attributes.url } : {},
          },
        };
      },
      draggable: true,
    }).configure({
      deleteTriggerWithBackspace: true,
      HTMLAttributes: {
        class: "video-node-mention-pill",
        draggable: "true",
      },
      renderText({ node }) {
        const mentionLabel = getMentionLabel(node.attrs);
        return mentionLabel;
      },
      renderHTML({ options, node }) {
        const mentionLabel = getMentionLabel(node.attrs);
        const originalLabel =
          (node.attrs.originalLabel as string | undefined) ?? mentionLabel;
        const thumbnail = node.attrs.thumbnail as string | undefined;

        const children: any[] = [];
        if (thumbnail) {
          children.push([
            "img",
            {
              class: "video-node-mention-pill__thumbnail",
              src: thumbnail,
              alt: originalLabel,
              draggable: "false",
            },
          ]);
        }
        children.push([
          "span",
          { class: "video-node-mention-pill__label" },
          mentionLabel,
        ]);

        return [
          "span",
          {
            ...options.HTMLAttributes,
            "data-mention-id": node.attrs.id,
            "data-mention-value": node.attrs.value,
            "data-mention-label": mentionLabel,
            "data-mention-display-label": mentionLabel,
            "data-mention-original-label": originalLabel,
            "data-thumbnail": thumbnail,
            "data-url": node.attrs.url,
            contenteditable: "false",
            draggable: "true",
            title: originalLabel,
          },
          ...children,
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
  // 建议面板容器 ref
  const suggestionPanelRef = useRef<HTMLDivElement | null>(null);

  const insertSuggestionNode = (
    mode: "mention" | "command",
    item:
      | {
        id: string;
        label: string;
        displayLabel: string;
        value: string;
        thumbnail: string;
      }
      | (typeof COMMAND_MOCK)[number],
  ) => {
    if (!triggerRangeRef.current) {
      return;
    }

    if (mode === "mention") {
      const selected = item as {
        id: string;
        label: string;
        displayLabel: string;
        value: string;
        thumbnail: string;
      };

      editor
        ?.chain()
        .focus()
        .insertContentAt(triggerRangeRef.current, [
          {
            type: "mention",
            attrs: {
              id: selected.id,
              label: selected.displayLabel,
              displayLabel: selected.displayLabel,
              originalLabel: selected.label,
              value: selected.value,
              thumbnail: selected.thumbnail,
              type: "image",
              url: selected.value,
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
        isNanoBananaParamsModel || isRunningHubMidjourneyV81Model
          ? "16:9"
          : "21:9", // 角色三视图
      "c-3": "16:9", // 多宫格电影分镜
      "c-4":
        isNanoBananaParamsModel || isRunningHubMidjourneyV81Model
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
        isRunningHubMidjourneyV81Model
          ? "2K"
          : isNanoBananaParamsModel ||
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
        ];
      });
    }),
  );

  const parentImageNodes = useMemo(() => {
    if (parentImageEntryValues.length === 0) {
      return [] as {
        id: string;
        url: string;
      }[];
    }

    const result: {
      id: string;
      url: string;
    }[] = [];

    for (let i = 0; i < parentImageEntryValues.length; i += 2) {
      result.push({
        id: String(parentImageEntryValues[i] ?? ""),
        url: String(parentImageEntryValues[i + 1] ?? ""),
      });
    }

    return result;
  }, [parentImageEntryValues]);

  const parentImageUrls = useMemo(
    () => parentImageNodes.map((item) => item.url),
    [parentImageNodes],
  );

  const imageMentionItems = useMemo(
    () =>
      parentImageNodes.map((item, index) => ({
        id: `parent-image-${item.id}`,
        label: "参考图",
        displayLabel: `图片${toChineseNumber(index + 1)}`,
        value: item.url,
        thumbnail: item.url,
      })),
    [parentImageNodes],
  );

  const filteredMentionItems = useMemo(() => {
    const query = mentionQuery.trim().toLowerCase();
    if (!query) {
      return imageMentionItems;
    }

    return imageMentionItems.filter((item) =>
      [item.label, item.displayLabel].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [imageMentionItems, mentionQuery]);

  const handleDisconnectNode = useCallback(
    (sourceNodeId: string) => {
      const { edges } = useCanvasFlowStore.getState();
      const edgeToDelete = edges.find(
        (edge) => edge.source === sourceNodeId && edge.target === nodeId,
      );
      if (edgeToDelete) {
        deleteEdge(edgeToDelete.id);
      }
    },
    [nodeId, deleteEdge],
  );

  // 收集父级便签节点：selector 只返回扁平 primitive 数组，避免 React 19 对新对象快照触发无限更新。
  const parentNoteEntryValues = useCanvasFlowStore(
    useShallow((state) => {
      const seenParentIds = new Set<string>();

      return state.edges.flatMap((edge) => {
        if (edge.target !== nodeId || seenParentIds.has(edge.source)) {
          return [];
        }

        seenParentIds.add(edge.source);
        const sourceNode = state.nodes.find(
          (node) => node.id === edge.source,
        );
        if (sourceNode?.type !== "noteNode") {
          return [];
        }
        const data = sourceNode.data as NoteNodeData;
        const content = data?.content?.trim() ?? "";
        if (!content) {
          return [];
        }
        const nickname =
          (data as { nickname?: string })?.nickname?.trim() ||
          "便签节点";

        return [sourceNode.id, content, nickname];
      });
    }),
  );

  const parentNoteNodes = useMemo(() => {
    const result: Array<{
      id: string;
      content: string;
      label: string;
    }> = [];

    for (let i = 0; i < parentNoteEntryValues.length; i += 3) {
      result.push({
        id: String(parentNoteEntryValues[i] ?? ""),
        content: String(parentNoteEntryValues[i + 1] ?? ""),
        label: String(parentNoteEntryValues[i + 2] ?? "便签节点"),
      });
    }

    return result.filter((item) => item.id && item.content);
  }, [parentNoteEntryValues]);

  const parentNoteContents = useMemo(
    () => parentNoteNodes.map((item) => item.content),
    [parentNoteNodes],
  );

  // 生成参考图 items（用于 ImageReferenceThumbnails）
  const generationReferenceItems = useMemo(() => {
    const items: Array<{
      id: string;
      url: string;
      label?: string;
      thumbnail?: string;
      isLocalImage?: boolean;
      type?: "image" | "note";
      content?: string;
    }> = [];

    // 父节点图片
    parentImageNodes.forEach((node) => {
      items.push({
        id: `parent-image-${node.id}`,
        url: node.url,
        label: "参考图",
        thumbnail: node.url,
        isLocalImage: false,
        type: "image",
      });
    });

    // 父级便签（文本参考）
    parentNoteNodes.forEach((note) => {
      const summary = note.content.length > 12
        ? `${note.content.slice(0, 12)}…`
        : note.content;
      items.push({
        id: `parent-note-${note.id}`,
        url: "",
        label: note.label || "便签节点",
        thumbnail: undefined,
        isLocalImage: false,
        type: "note",
        content: note.content,
      });
      // 摘要暂存到首个元素的 label：用于无 content 场景显示
      if (!summary) {
        // no-op
      }
    });

    return items;
  }, [
    parentImageNodes,
    parentNoteNodes,
  ]);

  // 参考图排序：纯图片按 image_urls 持久化；混合图文顺序写入 metadata.referenceOrder
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

      const hasNonImageItem = nextItems.some((item) => item.type !== "image");
      const nextImageUrls = nextItems
        .filter((item) => item.type === "image")
        .map((item) => item.url);

      const currentMetadata =
        (currentImageData as { metadata?: Record<string, unknown> } | null)
          ?.metadata ?? {};

      updateImageNodeData(nodeId, {
        image_urls: hasNonImageItem
          ? Array.from(new Set(nextImageUrls))
          : nextImageUrls,
        metadata: hasNonImageItem
          ? {
            ...currentMetadata,
            referenceOrder: nextItems.map((item) => item.id),
          }
          : currentMetadata,
      });
    },
    [generationReferenceItems, currentImageData, nodeId, updateImageNodeData],
  );

  // 参考图删除
  const handleReferenceRemove = useCallback(
    (item: (typeof generationReferenceItems)[number]) => {
      if (item.type === "note") {
        const noteId = item.id.replace("parent-note-", "");
        handleDisconnectNode(noteId);
        return;
      }

      // 父节点图片：断开连接
      const nodeIdToDisconnect = item.id.replace("parent-image-", "");
      handleDisconnectNode(nodeIdToDisconnect);
    },
    [
      generationReferenceItems,
      handleDisconnectNode,
      nodeId,
    ],
  );

  // 参考图 hover 状态变化
  const handleReferenceHoverChange = useCallback(
    (item: (typeof generationReferenceItems)[number], isHovering: boolean) => {
      if (item.isLocalImage) {
        return;
      }

      let parentNodeId = "";
      if (item.type === "note") {
        parentNodeId = item.id.replace("parent-note-", "");
      } else {
        parentNodeId = item.id.replace("parent-image-", "");
      }
      if (!parentNodeId) {
        return;
      }
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
          const selected = currentItems[activeIndex];
          if (!selected) {
            return true;
          }

          insertSuggestionNode(activeMode, selected);
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
      const mentionMatch = plainText.match(/@([^\s@]*)$/);
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

  useEffect(() => {
    if (!editor || imageMentionItems.length === 0) {
      return;
    }

    const mentionMap = new Map(imageMentionItems.map((item) => [item.id, item]));
    let transaction = editor.state.tr;
    let changed = false;

    editor.state.doc.descendants((node, pos) => {
      if (node.type.name !== "mention") {
        return true;
      }

      const item = mentionMap.get(String(node.attrs.id ?? ""));
      if (!item) {
        return true;
      }

      if (
        node.attrs.displayLabel === item.displayLabel &&
        node.attrs.label === item.displayLabel &&
        node.attrs.thumbnail === item.thumbnail &&
        node.attrs.url === item.value
      ) {
        return true;
      }

      transaction = transaction.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        label: item.displayLabel,
        displayLabel: item.displayLabel,
        originalLabel: item.label,
        value: item.value,
        thumbnail: item.thumbnail,
        type: "image",
        url: item.value,
      });
      changed = true;
      return true;
    });

    if (changed) {
      editor.view.dispatch(transaction);
    }
  }, [editor, imageMentionItems]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const editorDom = editor.view.dom;

    const getMentionPill = (target: EventTarget | null) => {
      if (!(target instanceof Element)) {
        return null;
      }

      const mentionPill = target.closest(".video-node-mention-pill");
      if (!(mentionPill instanceof HTMLElement)) {
        return null;
      }

      const thumbnail =
        mentionPill.dataset.thumbnail ||
        mentionPill.querySelector<HTMLImageElement>(
          ".video-node-mention-pill__thumbnail",
        )?.src;
      if (!thumbnail) {
        return null;
      }

      return { element: mentionPill, thumbnail };
    };

    const handleMouseOver = (event: MouseEvent) => {
      const result = getMentionPill(event.target);
      if (!result) {
        return;
      }

      if (
        event.relatedTarget instanceof Node &&
        result.element.contains(event.relatedTarget)
      ) {
        return;
      }

      const rect = result.element.getBoundingClientRect();
      setMentionPreview({
        src: result.thumbnail,
        label: result.element.dataset.mentionOriginalLabel || "提及图片",
        left: rect.left + rect.width / 2,
        top: Math.max(12, rect.top - 8),
      });
    };

    const handleMouseOut = (event: MouseEvent) => {
      const result = getMentionPill(event.target);
      if (!result) {
        return;
      }

      if (
        event.relatedTarget instanceof Node &&
        result.element.contains(event.relatedTarget)
      ) {
        return;
      }

      setMentionPreview(null);
    };

    const handleDragStart = (event: DragEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const mentionPill = target.closest(".video-node-mention-pill");
      if (mentionPill) {
        mentionPill.classList.add("dragging");
        event.dataTransfer?.setData(
          "text/plain",
          mentionPill.getAttribute("data-mention-id") || "",
        );
      }
    };

    const handleDragEnd = (event: DragEvent) => {
      const target = event.target;
      if (target instanceof Element) {
        target.closest(".video-node-mention-pill")?.classList.remove("dragging");
      }

      editorDom
        .querySelectorAll(".video-node-mention-pill.dragging")
        .forEach((element) => {
          element.classList.remove("dragging");
        });
    };

    editorDom.addEventListener("dragstart", handleDragStart);
    editorDom.addEventListener("dragend", handleDragEnd);
    editorDom.addEventListener("mouseover", handleMouseOver);
    editorDom.addEventListener("mouseout", handleMouseOut);

    return () => {
      editorDom.removeEventListener("dragstart", handleDragStart);
      editorDom.removeEventListener("dragend", handleDragEnd);
      editorDom.removeEventListener("mouseover", handleMouseOver);
      editorDom.removeEventListener("mouseout", handleMouseOut);
    };
  }, [editor]);

  const mentionSuggestionItems = activeMode === "mention" ? filteredMentionItems : [];
  const commandSuggestionItems = activeMode === "command" ? filteredCommandItems : [];

  // 当 activeIndex 改变时，自动滚动到选中的选项
  useEffect(() => {
    if (
      suggestionPanelRef.current &&
      activeMode &&
      commandSuggestionItems.length > 0
    ) {
      const activeElement = suggestionPanelRef.current.children[
        activeIndex
      ] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [activeIndex, activeMode, commandSuggestionItems.length]);

  // 点击生成：根据数量多次调用接口创建任务
  const handleGenerate = async () => {
    if (isExpanded) {
      setIsExpanded(false);
    }

    const promptText = editor?.getText().trim() ?? "";
    // 优先使用最新 store 中的便签内容，避免父级便签节点刚连接时 parentNoteNodes 缓存未刷新。
    const liveNoteContents = (() => {
      const { nodes, edges } = useCanvasFlowStore.getState();
      const seen = new Set<string>();
      return edges
        .filter((edge) => {
          if (edge.target !== nodeId || seen.has(edge.source)) return false;
          seen.add(edge.source);
          return true;
        })
        .map((edge) =>
          nodes.find((node) => node.id === edge.source),
        )
        .filter((node): node is NonNullable<typeof node> => Boolean(node))
        .filter((node) => node.type === "noteNode")
        .map(
          (node) =>
            ((node.data as NoteNodeData)?.content ?? "").toString().trim(),
        )
        .filter((content) => content.length > 0);
    })();
    const noteContents =
      liveNoteContents.length > 0 ? liveNoteContents : parentNoteContents;
    const mergedPrompt = [...noteContents, promptText]
      .map((content) => content.trim())
      .filter((content) => content.length > 0)
      .join(" ");

    if (!mergedPrompt) {
      warning("请输入提示词");
      return;
    }

    let finalPrompt = mergedPrompt;
    // Gemini 3 Pro 渠道二：在 prompt 末尾拼接 [尺寸:x:x] [分辨率:xK] 参数
    if (isGeminiPro2Model) {
      finalPrompt = `${finalPrompt} [尺寸:${size}] [分辨率:${resolution}]`;
    }

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
    const generationTaskCount = imageCount;
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
        model,
        originalModel: model,
        platform: currentImageData?.platform,
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
        isNanoBananaParamsModel
      ) {
        // Gemini 3 Pro: size 作为画面比例
        basePayload.size = size;
        basePayload.metadata = {
          resolution,
        };
      } else {
        // 其他模型
        basePayload.size = size;
        basePayload.aspectRatio = currentImageData?.aspectRatio ?? "1:1";
        basePayload.metadata = {
          resolution,
        };
      }

      if (isRunningHubMidjourneyV81Model) {
        basePayload.quality = midjourneyQuality;
        basePayload.raw = raw;
        basePayload.chaos = currentImageData?.chaos ?? 0;
        basePayload.stylize = currentImageData?.stylize ?? 0;
        basePayload.iw = currentImageData?.iw ?? 1;
      }

      if (isAPIMartGptImage25Model) {
        basePayload.quality = apimartQuality;
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

  const panelContent = (
    <div
      className={cn(
        PROMPT_PANEL_STYLES.container,
        isExpanded && "h-full min-h-0 min-w-0 overflow-hidden",
      )}
      style={isExpanded ? { width: "100%", height: "100%" } : undefined}
    >
      <div
        className={cn(
          PROMPT_PANEL_STYLES.inputArea,
          isExpanded && "min-h-0 flex-1",
        )}
      >
        {isExpanded && (
          <div className="nodrag nopan nowheel flex shrink-0 gap-2 overflow-x-auto pb-1">
            {generationReferenceItems.length > 0 && (
              <ImageReferenceThumbnails
                items={generationReferenceItems}
                onReorder={handleReferenceReorder}
                onRemove={handleReferenceRemove}
                onHoverChange={handleReferenceHoverChange}
              />
            )}
          </div>
        )}
        <div
          className={cn(
            PROMPT_PANEL_STYLES.textAreaWrap,
            isExpanded &&
            "relative flex min-h-0 flex-1 flex-col [&>div]:min-h-0 [&>div]:flex-1 [&_.ProseMirror]:h-full [&_.ProseMirror]:max-h-none",
          )}
        >
          <EditorContent editor={editor} />
        </div>
        <button
          type="button"
          aria-label={isExpanded ? "缩小图片提示词面板" : "放大图片提示词面板"}
          title={isExpanded ? "缩小图片提示词面板" : "放大图片提示词面板"}
          className="nodrag nopan nowheel absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/4 text-white/55 transition-colors hover:border-[#B43FEB]/40 hover:bg-[#B43FEB]/15 hover:text-white"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            setIsExpanded((current) => !current);
          }}
        >
          {isExpanded ? (
            <IconArrowsMinimize size={16} />
          ) : (
            <IconArrowsMaximize size={16} />
          )}
        </button>
        {mentionPreview &&
          createPortal(
            <div
              className="pointer-events-none fixed z-9999"
              style={{
                left: mentionPreview.left,
                top: mentionPreview.top,
                transform: "translate(-50%, -100%)",
              }}
            >
              <div className="flex w-60 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-neutral-900 shadow-2xl transition-opacity duration-150">
                <img
                  src={mentionPreview.src}
                  alt={mentionPreview.label}
                  className="h-auto w-full rounded-xl object-contain"
                />
              </div>
            </div>,
            document.body,
          )}

        {!isExpanded && (
          <div className="nodrag nopan nowheel flex gap-2 overflow-x-auto pb-1">
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
        )}
        {/* @ mention 建议面板 */}
        {activeMode === "mention" && (
          <div
            ref={suggestionPanelRef}
            className="nodrag nopan nowheel absolute right-2 bottom-full left-2 z-30 mb-5 max-h-60 overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 shadow-[0_14px_34px_rgba(0,0,0,0.45)]"
          >
            {mentionSuggestionItems.length === 0 ? (
              <div className="p-3 text-center text-sm text-neutral-400">
                暂无可提及图片
              </div>
            ) : mentionSuggestionItems.map((item, index) => {
              const isActive = index === activeIndex;
              const title = item.label;
              const token = item.displayLabel;

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

                    insertSuggestionNode("mention", item);

                    resetSuggestionState();
                  }}
                >
                  <img
                    src={item.thumbnail}
                    alt={title}
                    className="h-8 w-8 shrink-0 rounded-md object-cover"
                    loading="lazy"
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="truncate text-xs font-medium">{title}</div>
                    <div className="mt-0.5 truncate text-[11px] text-neutral-400">
                      {item.displayLabel}
                    </div>
                  </div>
                  <IconPhoto size={14} className="shrink-0 text-neutral-500" />
                  <span className="rounded-md border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300">
                    {token}
                  </span>
                </Button>
              );
            })}
          </div>
        )}

        {/* / 命令建议面板 */}
        {activeMode === "command" && commandSuggestionItems.length > 0 && (
          <div
            ref={suggestionPanelRef}
            className="nodrag nopan nowheel absolute right-2 bottom-full left-2 z-30 mb-5 max-h-60 overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 shadow-[0_14px_34px_rgba(0,0,0,0.45)]"
          >
            {commandSuggestionItems.map((item, index) => {
              const isActive = index === activeIndex;
              const title = item.label;
              const desc = item.description;
              const token = item.command;

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

                    insertSuggestionNode("command", item);

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

      <div
        className={cn(
          PROMPT_PANEL_STYLES.divider,
          isExpanded && "shrink-0",
        )}
      />

      <div
        className={cn(
          PROMPT_PANEL_STYLES.controlArea,
          isExpanded && "shrink-0",
        )}
      >
        <div className="flex w-full min-w-0 items-center gap-2 overflow-hidden">
          <ImageModelHelpTooltip modelId={model} />
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
                "h-8 min-w-34 max-w-[42%] w-60 shrink overflow-hidden px-3",
                "**:data-[slot=select-value]:block **:data-[slot=select-value]:min-w-0 **:data-[slot=select-value]:truncate",
              )}
              title={
                visibleImageModels.find((item) => item.id === currentModelId)
                  ?.name
              }
            >
              <SelectValue placeholder="选择模型" />
            </SelectTrigger>
            <SelectContent
              className={cn(
                PROMPT_PANEL_STYLES.modelSelectContent,
                "z-10000",
              )}
            >
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
          {isNanoBananaParamsModel && (
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

          {isRunningHubMidjourneyV81Model && (
            <MidjourneyPanel
              size={size}
              resolution={resolution}
              quality={midjourneyQuality}
              raw={raw}
              chaos={chaos}
              stylize={stylize}
              imageWeight={imageWeight}
              sizeOptions={MIDJOURNEY_V81_SIZE_OPTIONS}
              resolutionOptions={MIDJOURNEY_V81_RESOLUTION_OPTIONS}
              onSizeChange={(value) => {
                persistImageDefaultPreset({ size: value });
                updateImageNodeData(nodeId, { size: value });
              }}
              onResolutionChange={(value) => {
                persistImageDefaultPreset({ resolution: value });
                updateImageNodeData(nodeId, { resolution: value });
              }}
              onQualityChange={(value) => {
                updateImageNodeData(nodeId, { quality: value });
              }}
              onRawChange={(value) => {
                updateImageNodeData(nodeId, { raw: value });
              }}
              onChaosChange={(value) => {
                updateImageNodeData(nodeId, { chaos: value });
              }}
              onStylizeChange={(value) => {
                updateImageNodeData(nodeId, { stylize: value });
              }}
              onImageWeightChange={(value) => {
                updateImageNodeData(nodeId, { iw: value });
              }}
            />
          )}

          {isAgnesImageModel && (
            <GptImage2ParamsPanel
              size={size}
              resolution={resolution}
              sizeOptions={
                isAgnesImage21Model
                  ? AGNES_IMAGE_21_SIZE_OPTIONS
                  : AGNES_IMAGE_SIZE_OPTIONS
              }
              resolutionOptions={
                isAgnesImage21Model
                  ? AGNES_IMAGE_21_RESOLUTION_OPTIONS
                  : AGNES_IMAGE_RESOLUTION_OPTIONS
              }
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
          {isAPIMartFluxModel && (
            <GptImage2ParamsPanel
              size={size}
              resolution={resolution}
              sizeOptions={APIMART_FLUX_SIZE_OPTIONS}
              resolutionOptions={APIMART_FLUX_RESOLUTION_OPTIONS}
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
          {isAPIMartGptImage25Model && (
            <GptImage2ParamsPanel
              size={size}
              resolution={resolution}
              sizeOptions={APIMART_GPT_IMAGE_25_SIZE_OPTIONS}
              resolutionOptions={APIMART_GPT_IMAGE_25_RESOLUTION_OPTIONS}
              quality={apimartQuality}
              qualityOptions={APIMART_GPT_IMAGE_25_QUALITY_OPTIONS}
              onSizeChange={(value) => {
                persistImageDefaultPreset({ size: value });
                updateImageNodeData(nodeId, { size: value });
              }}
              onResolutionChange={(value) => {
                persistImageDefaultPreset({ resolution: value });
                updateImageNodeData(nodeId, { resolution: value });
              }}
              onQualityChange={(value) => {
                updateImageNodeData(nodeId, { quality: value });
              }}
            />
          )}
          {isAPIMartQwenImage30Model && (
            <GptImage2ParamsPanel
              size={size}
              resolution={resolution}
              sizeOptions={APIMART_QWEN_IMAGE_30_SIZE_OPTIONS}
              resolutionOptions={APIMART_QWEN_IMAGE_30_RESOLUTION_OPTIONS}
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
                onClick={(event) => event.stopPropagation()}
              >
                停止
              </Button>
            ) : (
              <Button
                type="button"
                unstyled
                className={PROMPT_PANEL_STYLES.generateButton}
                onClick={handleGenerate}
              >
                {generatingCount > 0 ? `生成中 (${generatingCount})` : "生成"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return isExpanded
    ? createPortal(
      <ResizablePromptModal>{panelContent}</ResizablePromptModal>,
      document.body,
    )
    : panelContent;
});

ImagePromptPanel.displayName = "ImagePromptPanel";

