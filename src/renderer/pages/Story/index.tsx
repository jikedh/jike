import {
  BookOpenText,
  Bot,
  ChevronDown,
  ChevronLeft,
  Clapperboard,
  Download,
  Eraser,
  FileImage,
  FolderOpen,
  ImagePlus,
  Loader2,
  Music,
  Pause,
  Pencil,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  Upload,
  Video,
  WandSparkles,
  X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import debounce from "lodash/debounce";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ensureAssetOssUrl,
  getAssetOriginalDisplayUrl,
  initializeAssetStorage,
  readCombinedAssetIndex,
  type AssetRecord,
} from "service/assetStorage";
import { copyVideoUrlToOss, uploadFileToOSS, generateImageUrl } from "service/oss";
import {
  DEFAULT_ASSET_SYSTEM_PROMPT,
  DEFAULT_SPLIT_SYSTEM_PROMPT,
  createEmptyAgentData,
  identifyAssetsWithAgent,
  splitScriptWithAgent,
  storyboardStorage,
  type StoryboardAgentData,
  type StoryboardAgentStep,
  type StoryboardAssets,
  type StoryboardAssetItem,
  type StoryboardAssetKind,
  type StoryboardAssetMediaItem,
  type StoryboardProject,
  type StoryboardShot,
  type StoryboardSnippet,
} from "service/storyboardStorage";
import { Switch } from "@/components/ui/switch";
import { GenerationStatus } from "shared/constants/enum";
import {
  ADOBE_GPT_IMAGE2_MODEL,
  ADOBE_NANO_BANANA_PRO_MODEL,
  GROK_IMAGE_EDIT_MODEL,
  GROK_IMAGE_LITE_MODEL,
  GROK_IMAGE_MODEL,
  GROK_IMAGE_PRO_MODEL,
  IMAGE_MODELS,
  XIMU_GPT_IMAGE2_MODEL,
  XIMU_GPT_IMAGE2_VIP_MODEL,
  XIMU_NANO_BANANA2_MODEL,
  XIMU_NANO_BANANA_PRO_MODEL,
  getVisibleImageModels,
  isAdobeImageGenerationModel,
  isGrokImageGenerationModel,
  isXimuGptImageGenerationModel,
  isXimuImageGenerationModel,
} from "shared/constants/ai-models";
import {
  buildXimuGptImageRequest,
  buildXimuNanoBananaRequest,
  collectXimuImageUrls,
  extractXimuTaskId,
  getXimuMessage,
  getXimuResultPayload,
  resolveXimuGptAspectRatio,
  resolveXimuImageSize,
  resolveXimuNanoBanana2AspectRatio,
  resolveXimuNanoBananaProAspectRatio,
  XIMU_TASK_FAILED_STATUSES,
  XIMU_TASK_SUCCESS_STATUSES,
} from "shared/types/detail/ximu";
import { cn } from "shared/utils/utils";
import { normalizeVideoTaskResponse } from "shared/utils/video-response-normalizer";
import { toast } from "sonner";
import {
  createAdobe2ApiVideoGeneration,
  createAdobe2ApiImageGeneration,
  createDashscopeVideoSynthesis,
  createGrok2ApiImageGeneration,
  createGrok2ApiVideoGeneration,
  createImageGeneration,
  createLzVideoTask,
  createXimuGptImageGeneration,
  createXimuNanoBananaGeneration,
  getVideoRemovalStatus,
  getXimuImageResult,
  getDashscopeVideoTaskStatus,
  getImageTaskStatus,
  getLzVideoTaskStatus,
  videoRemoval,
} from "@/api/ai";
import { getUploadOssPutUrl } from "@/api/jikeGo";
import { ModelPointsBadge } from "@/components/ModelPointsBadge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VideoPlayer } from "@/components/ui/video-player";
import { useGenerationPoints } from "@/hooks/useGenerationPoints";
import { AssetLibraryDialog } from "@/pages/Canvas/components/AssetLibraryDialog";
import { AspectRatioIcon } from "@/pages/Canvas/CustomNodes/ImageNode/components/AspectRatioIcon";
import {
  GeminiParamsPanel,
  GEMINI_RESOLUTIONS,
  GEMINI_SIZES,
  GROK_IMAGE_RESOLUTIONS,
  GROK_IMAGE_SIZES,
  NANO_BANANA_RESOLUTIONS,
  NANO_BANANA_LOCAL_SIZES,
} from "@/pages/Canvas/CustomNodes/ImageNode/components/GeminiParamsPanel";
import {
  ADOBE_GPTIMAGE2_SIZES,
  GPTIMAGE2_SIZES,
  GptImage2ParamsPanel,
} from "@/pages/Canvas/CustomNodes/ImageNode/components/GptImage2ParamsPanel";
import {
  MIDJOURNEY_ASPECT_RATIOS,
  MidjourneyParamsPanel,
} from "@/pages/Canvas/CustomNodes/ImageNode/components/MidjourneyParamsPanel";
import {
  SEEDREAM_ASPECT_RATIOS,
  SEEDREAM_RESOLUTIONS,
  SeedreamParamsPanel,
} from "@/pages/Canvas/CustomNodes/ImageNode/components/SeedreamParamsPanel";
import {
  type MentionItem,
} from "@/pages/Canvas/CustomNodes/New-VideoNode/constants/mockData";
import type { VideoGenerateRequest } from "@/pages/Canvas/CustomNodes/New-VideoNode/components/BottomParamsBar";
import {
  getFirstSupportedModeForModel,
  getSupportedModesForModel,
  type VideoModeKey,
} from "@/pages/Canvas/CustomNodes/New-VideoNode/constants/videoModelCapabilities";
import {
  getVideoParamConfig,
  normalizeVideoParams,
  type VideoParamState,
} from "@/pages/Canvas/CustomNodes/New-VideoNode/constants/videoParamConfigs";
import { ReferenceThumbnails } from "@/pages/Canvas/CustomNodes/New-VideoNode/components/ReferenceThumbnails";
import { VideoPromptEditor } from "@/pages/Canvas/CustomNodes/New-VideoNode/components/VideoPromptEditor";
import { VideoTimeline } from "@/pages/Canvas/CustomNodes/New-VideoNode/components/VideoTimeline";
import { buildVideoApiRequest } from "@/pages/Canvas/CustomNodes/New-VideoNode/utils/buildVideoApiRequest";
import { PROMPT_PANEL_STYLES } from "@/pages/Canvas/CustomNodes/shared/promptPanelStyles";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";
import { useUserStore } from "@/stores/useUserStore";
import { formatDuration } from "shared/utils/getVideoDuration";

const assetKinds: Array<{ id: StoryboardAssetKind; label: string }> = [
  { id: "role", label: "角色" },
  { id: "scene", label: "场景" },
  { id: "prop", label: "道具" },
  { id: "audio", label: "音效" },
];

const assetDetailKinds = assetKinds.filter((kind) => kind.id !== "audio");

const storyAgentSteps: Array<{ id: StoryboardAgentStep; label: string }> = [
  { id: "script", label: "输入剧本" },
  { id: "assets", label: "资产详情" },
  { id: "shots", label: "分镜管理" },
  { id: "video-edit", label: "视频编辑" },
];

const scriptCategoryOptions = [
  "解说漫",
  "精品演绎剧",
  "3d",
  "2d",
  "仿真人",
];

const stepOrder: Record<StoryboardAgentStep, number> = {
  script: 0,
  assets: 1,
  shots: 2,
  "video-edit": 3,
};

const STORY_SHOT_DEFAULT_VIDEO_MODEL = "seedance-2.0-pro";

const shouldMigrateStoryShotVideoModel = (model: string | undefined) =>
  typeof model === "string" && model.startsWith("kling/");

const hasStoryShotVideoModelMigration = (data: StoryboardAgentData) =>
  (data.shots || []).some((shot) =>
    shouldMigrateStoryShotVideoModel(shot.modelInfo?.videoModel),
  );

const isStepUnlocked = (
  step: StoryboardAgentStep,
  unlockedStep: StoryboardAgentStep,
) => stepOrder[step] <= stepOrder[unlockedStep];

const getLaterStep = (
  current: StoryboardAgentStep,
  next: StoryboardAgentStep,
) => (stepOrder[next] > stepOrder[current] ? next : current);

type StorySystemPromptTarget = "asset" | "split";
type StoryNextConfirmTarget = "identify-assets" | "split-shots";

type WuhenRect = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type ViewportRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DragMode = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const DEFAULT_FPS = 30;
const FRAME_STEP_SECONDS = 1 / DEFAULT_FPS;
const TIMELINE_STEP_MS = 100;
const SUBTITLE_REMOVAL_POINTS_PER_SECOND = 0.5;
const WUHEI_MAX_RECT_AREA = 480_000;

const normalizeTaskStatus = (value?: string) => {
  return String(value || "")
    .trim()
    .toUpperCase();
};

const extractTaskStatusInfo = (response: any) => {
  const payload = response?.data ?? response;
  const nested = payload?.data ?? {};
  const output = payload?.output ?? {};

  const taskStatus = normalizeTaskStatus(
    nested?.task_status ??
      nested?.status ??
      payload?.task_status ??
      payload?.status ??
      output?.task_status,
  );

  const progressRaw = nested?.progress ?? payload?.progress ?? output?.progress;
  const numericProgress = Number(progressRaw);
  const progress = Number.isFinite(numericProgress)
    ? Math.max(0, Math.min(100, numericProgress))
    : 0;

  const taskId =
    nested?.task_id ??
    nested?.id ??
    payload?.task_id ??
    payload?.id ??
    output?.task_id ??
    "";

  return { taskStatus, progress, taskId };
};

const clamp = (value: number, minValue: number, maxValue: number) => {
  return Math.min(maxValue, Math.max(minValue, value));
};

const computeContainedRect = (
  container: ViewportRect,
  mediaWidth: number,
  mediaHeight: number,
) => {
  if (
    !mediaWidth ||
    !mediaHeight ||
    container.width <= 0 ||
    container.height <= 0
  ) {
    return { x: 0, y: 0, width: container.width, height: container.height };
  }

  const containerRatio = container.width / container.height;
  const mediaRatio = mediaWidth / mediaHeight;

  let width = container.width;
  let height = container.height;

  if (containerRatio > mediaRatio) {
    height = container.height;
    width = height * mediaRatio;
  } else {
    width = container.width;
    height = width / mediaRatio;
  }

  const x = (container.width - width) / 2;
  const y = (container.height - height) / 2;
  return { x, y, width, height };
};

const buildDefaultSubtitleRect = (bounds: ViewportRect) => {
  const width = Math.max(80, bounds.width * 0.8);
  const height = Math.max(60, bounds.height * 0.22);
  const x = clamp(
    (bounds.width - width) / 2,
    0,
    Math.max(0, bounds.width - width),
  );
  const y = clamp(bounds.height * 0.72, 0, Math.max(0, bounds.height - height));
  return { x, y, width, height };
};

const getViewportSize = () => {
  if (typeof window === "undefined") {
    return { width: 1280, height: 720 };
  }
  return { width: window.innerWidth, height: window.innerHeight };
};

const getFittedWorkspaceFrame = (
  media: { width: number; height: number } | null,
  maxWidth: number,
  maxHeight: number,
) => {
  const safeMaxWidth = Math.max(280, maxWidth);
  const safeMaxHeight = Math.max(200, maxHeight);
  const containerRatio = media?.width && media?.height
    ? media.width / media.height
    : 16 / 9;

  let width = safeMaxWidth;
  let height = width / containerRatio;

  if (height > safeMaxHeight) {
    height = safeMaxHeight;
    width = height * containerRatio;
  }

  return {
    width: Math.max(220, Math.round(width)),
    height: Math.max(140, Math.round(height)),
  };
};

const migrateStoryShotVideoModels = (data: StoryboardAgentData) => {
  let migrated = false;
  const shots = (data.shots || []).map((shot) => {
    if (!shouldMigrateStoryShotVideoModel(shot.modelInfo?.videoModel)) {
      return shot;
    }
    migrated = true;
    return {
      ...shot,
      modelInfo: {
        ...shot.modelInfo,
        videoModel: STORY_SHOT_DEFAULT_VIDEO_MODEL,
      },
    };
  });

  return migrated ? { ...data, shots } : data;
};

const normalizeAgentData = (
  data: StoryboardAgentData,
): StoryboardAgentData => {
  const empty = createEmptyAgentData();
  const inferredStep: StoryboardAgentStep = data.unlockedStep
    ? data.unlockedStep
    : data.shots?.some((shot) => shot.video?.url || shot.video?.localPath)
      ? "video-edit"
      : data.shots?.length
        ? "shots"
        : "script";

  return migrateStoryShotVideoModels({
    ...empty,
    ...data,
    unlockedStep: inferredStep,
    promptPrefix: data.promptPrefix ?? empty.promptPrefix,
    promptSuffix: data.promptSuffix ?? empty.promptSuffix,
    scriptCategory: data.scriptCategory ?? empty.scriptCategory,
    assetSystemPrompt: data.assetSystemPrompt ?? empty.assetSystemPrompt,
    splitSystemPrompt: data.splitSystemPrompt ?? empty.splitSystemPrompt,
    roleAssetPromptAffixEnabled:
      data.roleAssetPromptAffixEnabled ?? empty.roleAssetPromptAffixEnabled,
    shotPromptAffixEnabled:
      data.shotPromptAffixEnabled ?? empty.shotPromptAffixEnabled,
    roleAssetPromptPrefix:
      data.roleAssetPromptPrefix ?? empty.roleAssetPromptPrefix,
    roleAssetPromptSuffix:
      data.roleAssetPromptSuffix ?? empty.roleAssetPromptSuffix,
    assets: {
      ...empty.assets,
      ...(data.assets || {}),
    },
    shots: data.shots || [],
  });
};

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/45 px-3 py-2.5 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-[#B43FEB] focus:ring-1 focus:ring-[#B43FEB]";

const textAreaClass =
  "story-scrollbar-scope w-full resize-none rounded-lg border border-white/10 bg-black/45 px-3 py-2.5 text-sm leading-6 text-white outline-none transition-all placeholder:text-white/25 focus:border-[#B43FEB] focus:ring-1 focus:ring-[#B43FEB]";

const storyVideoOptionButtonClass = (active: boolean, className?: string) =>
  cn(
    "rounded-lg border text-xs font-medium transition-all",
    active
      ? "border-[#B43FEB] bg-[#B43FEB]/10 text-[#E9C7FF]"
      : "border-white/10 bg-white/[0.03] text-white/65 hover:border-white/20 hover:bg-white/[0.06] hover:text-white",
    className,
  );

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildPromptDraftHtml = (html?: string, text?: string) => {
  if (html && html.trim() && html !== "<p></p>") {
    return html;
  }

  const normalizedText = text?.trim();
  if (!normalizedText) {
    return "<p></p>";
  }

  return `<p>${escapeHtml(normalizedText).replace(/\n/g, "<br>")}</p>`;
};

type StoryImageModelOption = ReturnType<typeof getVisibleImageModels>[number];

const getStoryImageModelOptionId = (
  model: string | undefined,
  platform: string | undefined,
  fallbackModel: string | undefined,
  options: StoryImageModelOption[],
) => {
  const exact = options.find(
    (item) => item.model === model && item.platform === platform,
  );
  if (exact) return String(exact.id);

  const byModel = options.find((item) => item.model === model);
  if (byModel) return String(byModel.id);

  const fallback = options.find((item) => item.model === fallbackModel);
  return String(fallback?.id ?? options[0]?.id ?? IMAGE_MODELS[0]?.id ?? 7);
};

const toOptionValueSet = (options: Array<{ value: string }>) =>
  new Set(options.map((item) => item.value));

const STORY_GPTIMAGE2_RESOLUTION_OPTIONS = [
  { label: "1K", value: "1K", description: "标准" },
  { label: "2K", value: "2K", description: "高清" },
  { label: "4K", value: "4K", description: "超清" },
];

const STORY_XIMU_GPTIMAGE2_RESOLUTION_OPTIONS = [
  { label: "1K", value: "1K", description: "标准" },
];

const STORY_XIMU_GPTIMAGE2_SIZE_VALUES = new Set([
  "auto",
  "1:1",
  "3:2",
  "2:3",
  "16:9",
  "9:16",
  "5:4",
  "4:5",
  "4:3",
  "3:4",
  "21:9",
  "9:21",
  "1:3",
  "3:1",
  "2:1",
  "1:2",
]);

const STORY_XIMU_NANO_BANANA_PRO_SIZE_VALUES = new Set([
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "5:4",
  "4:5",
  "21:9",
]);

const STORY_XIMU_NANO_BANANA2_SIZE_VALUES = new Set([
  ...STORY_XIMU_NANO_BANANA_PRO_SIZE_VALUES,
  "1:4",
  "4:1",
  "1:8",
  "8:1",
]);

const STORY_XIMU_GPTIMAGE2_SIZES = [
  { label: "auto", value: "auto", description: "自动比例" },
  ...GPTIMAGE2_SIZES.filter((item) =>
    STORY_XIMU_GPTIMAGE2_SIZE_VALUES.has(item.value),
  ),
  { label: "1:3", value: "1:3", description: "竖向超长图" },
  { label: "3:1", value: "3:1", description: "横向超宽图" },
];

const STORY_XIMU_NANO_BANANA_PRO_SIZES = GPTIMAGE2_SIZES.filter((item) =>
  STORY_XIMU_NANO_BANANA_PRO_SIZE_VALUES.has(item.value),
);

const STORY_XIMU_NANO_BANANA2_SIZES = [
  ...STORY_XIMU_NANO_BANANA_PRO_SIZES,
  { label: "1:4", value: "1:4", description: "竖向超长图" },
  { label: "4:1", value: "4:1", description: "横向超宽图" },
  { label: "1:8", value: "1:8", description: "竖向极长图" },
  { label: "8:1", value: "8:1", description: "横向极宽图" },
];

const STORY_SEEDREAM_SIZE_VALUES = toOptionValueSet(SEEDREAM_ASPECT_RATIOS);
const STORY_SEEDREAM_RESOLUTION_VALUES = toOptionValueSet(SEEDREAM_RESOLUTIONS);
const STORY_GEMINI_SIZE_VALUES = toOptionValueSet(GEMINI_SIZES);
const STORY_GEMINI_RESOLUTION_VALUES = toOptionValueSet(GEMINI_RESOLUTIONS);
const STORY_NANO_BANANA_LOCAL_SIZE_VALUES = toOptionValueSet(
  NANO_BANANA_LOCAL_SIZES,
);
const STORY_NANO_BANANA_RESOLUTION_VALUES = toOptionValueSet(
  NANO_BANANA_RESOLUTIONS,
);
const STORY_GROK_IMAGE_SIZE_VALUES = toOptionValueSet(GROK_IMAGE_SIZES);
const STORY_GROK_IMAGE_RESOLUTION_VALUES = toOptionValueSet(
  GROK_IMAGE_RESOLUTIONS,
);
const STORY_GPTIMAGE2_SIZE_VALUES = toOptionValueSet(GPTIMAGE2_SIZES);
const STORY_ADOBE_GPTIMAGE2_SIZE_VALUES = toOptionValueSet(
  ADOBE_GPTIMAGE2_SIZES,
);
const STORY_GPTIMAGE2_RESOLUTION_VALUES = new Set(["1K", "2K", "4K"]);
const STORY_XIMU_GPTIMAGE2_RESOLUTION_VALUES = new Set(["1K"]);
const STORY_MIDJOURNEY_SIZE_VALUES = toOptionValueSet(MIDJOURNEY_ASPECT_RATIOS);

type StoryImageParamConfig = {
  defaultAspectRatio: string;
  defaultResolution?: string;
  aspectRatioValues: Set<string>;
  resolutionValues?: Set<string>;
};

const getStoryImageParamConfig = (model: string): StoryImageParamConfig => {
  if (model === "doubao-seedream-5-0") {
    return {
      defaultAspectRatio: "1:1",
      defaultResolution: "2K",
      aspectRatioValues: STORY_SEEDREAM_SIZE_VALUES,
      resolutionValues: STORY_SEEDREAM_RESOLUTION_VALUES,
    };
  }

  if (model === "gemini-3-pro-image-preview") {
    return {
      defaultAspectRatio: "1:1",
      defaultResolution: "2K",
      aspectRatioValues: STORY_GEMINI_SIZE_VALUES,
      resolutionValues: STORY_GEMINI_RESOLUTION_VALUES,
    };
  }

  if (model === ADOBE_GPT_IMAGE2_MODEL) {
    return {
      defaultAspectRatio: "1:1",
      defaultResolution: "2K",
      aspectRatioValues: STORY_ADOBE_GPTIMAGE2_SIZE_VALUES,
      resolutionValues: STORY_GPTIMAGE2_RESOLUTION_VALUES,
    };
  }

  if (model === ADOBE_NANO_BANANA_PRO_MODEL) {
    return {
      defaultAspectRatio: "1:1",
      defaultResolution: "2K",
      aspectRatioValues: STORY_NANO_BANANA_LOCAL_SIZE_VALUES,
      resolutionValues: STORY_NANO_BANANA_RESOLUTION_VALUES,
    };
  }

  if (model === XIMU_GPT_IMAGE2_MODEL) {
    return {
      defaultAspectRatio: "auto",
      defaultResolution: "1K",
      aspectRatioValues: STORY_XIMU_GPTIMAGE2_SIZE_VALUES,
      resolutionValues: STORY_XIMU_GPTIMAGE2_RESOLUTION_VALUES,
    };
  }

  if (model === XIMU_GPT_IMAGE2_VIP_MODEL) {
    return {
      defaultAspectRatio: "auto",
      defaultResolution: "2K",
      aspectRatioValues: STORY_XIMU_GPTIMAGE2_SIZE_VALUES,
      resolutionValues: STORY_GPTIMAGE2_RESOLUTION_VALUES,
    };
  }

  if (model === XIMU_NANO_BANANA2_MODEL) {
    return {
      defaultAspectRatio: "1:1",
      defaultResolution: "2K",
      aspectRatioValues: STORY_XIMU_NANO_BANANA2_SIZE_VALUES,
      resolutionValues: STORY_NANO_BANANA_RESOLUTION_VALUES,
    };
  }

  if (model === XIMU_NANO_BANANA_PRO_MODEL) {
    return {
      defaultAspectRatio: "1:1",
      defaultResolution: "2K",
      aspectRatioValues: STORY_XIMU_NANO_BANANA_PRO_SIZE_VALUES,
      resolutionValues: STORY_NANO_BANANA_RESOLUTION_VALUES,
    };
  }

  if (isGrokImageGenerationModel(model)) {
    return {
      defaultAspectRatio: "1:1",
      defaultResolution: "standard",
      aspectRatioValues: STORY_GROK_IMAGE_SIZE_VALUES,
      resolutionValues: STORY_GROK_IMAGE_RESOLUTION_VALUES,
    };
  }

  if (model === "midjourney" || model === "midjourney-niji7") {
    return {
      defaultAspectRatio: "1:1",
      aspectRatioValues: STORY_MIDJOURNEY_SIZE_VALUES,
    };
  }

  return {
    defaultAspectRatio: "1:1",
    defaultResolution: "2K",
    aspectRatioValues: STORY_GPTIMAGE2_SIZE_VALUES,
    resolutionValues: STORY_GPTIMAGE2_RESOLUTION_VALUES,
  };
};

const normalizeStoryImageParams = (
  model: string,
  params: { aspectRatio?: string; resolution?: string },
) => {
  const config = getStoryImageParamConfig(model);
  const aspectRatio =
    params.aspectRatio && config.aspectRatioValues.has(params.aspectRatio)
      ? params.aspectRatio
      : config.defaultAspectRatio;
  const resolution =
    params.resolution &&
    config.resolutionValues &&
    config.resolutionValues.has(params.resolution)
      ? params.resolution
      : config.defaultResolution;

  return { aspectRatio, resolution };
};

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const createId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const createAssetMediaId = (prefix = "asset_media") => createId(prefix);

const getFileExtension = (file: File, fallback: string) =>
  file.name.split(".").pop()?.toLowerCase() || fallback;

const getPathExtension = (path: string, fallback: string) =>
  path.split(".").pop()?.toLowerCase() || fallback;

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const getMimeTypeByPath = (path: string, fallback = "application/octet-stream") => {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  if (extension === "mp4") return "video/mp4";
  if (extension === "mp3") return "audio/mpeg";
  if (extension === "wav") return "audio/wav";
  return fallback;
};

const getStoryAssetMediaType = (
  item: Pick<StoryboardAssetItem, "kind" | "mediaType" | "localPath" | "mediaUrl">,
) => {
  if (item.mediaType) return item.mediaType;
  if (item.kind === "audio") return "audio";
  const source = item.localPath || item.mediaUrl || "";
  const extension = source.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase();
  if (["mp4", "webm", "mov"].includes(extension || "")) return "video";
  if (["mp3", "wav", "m4a", "aac", "ogg"].includes(extension || "")) return "audio";
  return "image";
};

const isAliyunOssUrl = (value: string | undefined) =>
  Boolean(value?.includes(".aliyuncs.com/"));

const getOssImageThumbnailUrl = (url: string) =>
  generateImageUrl(url, [
    { type: "resize", width: 256 },
    { type: "format", format: "webp" },
    { type: "ignore-error", value: 1 },
  ]);

const syncAssetPrimaryMediaFields = (
  asset: StoryboardAssetItem,
  primary?: StoryboardAssetMediaItem,
): StoryboardAssetItem => ({
  ...asset,
  source: primary?.source ?? asset.source,
  status: primary ? "ready" : asset.status,
  mediaType: primary?.mediaType ?? asset.mediaType,
  mediaUrl: primary?.mediaUrl,
  localPath: primary?.localPath,
  assetId: primary?.assetId,
  primaryMediaId: primary?.id,
});

const createMediaItemFromAssetFields = (
  asset: StoryboardAssetItem,
): StoryboardAssetMediaItem | null => {
  if (!asset.mediaUrl && !asset.localPath && !asset.assetId) return null;
  return {
    id: asset.primaryMediaId || `legacy_media_${asset.id}`,
    source: asset.source,
    mediaType: asset.mediaType ?? getStoryAssetMediaType(asset),
    mediaUrl: asset.mediaUrl,
    localPath: asset.localPath,
    assetId: asset.assetId,
    name: asset.name,
    createdAt: Date.now(),
  };
};

const getAssetMediaItems = (
  asset: StoryboardAssetItem,
): StoryboardAssetMediaItem[] => {
  const items = [...(asset.mediaItems || [])];
  const legacyItem = createMediaItemFromAssetFields(asset);
  if (legacyItem && !items.some((item) => item.id === legacyItem.id)) {
    items.unshift(legacyItem);
  }

  if (items.length <= 1) return items;

  const primaryId = asset.primaryMediaId || items[0]?.id;
  const primaryIndex = items.findIndex((item) => item.id === primaryId);
  if (primaryIndex <= 0) return items;

  const next = [...items];
  const [primary] = next.splice(primaryIndex, 1);
  next.unshift(primary);
  return next;
};

const getPrimaryAssetMediaItem = (
  asset: StoryboardAssetItem,
): StoryboardAssetMediaItem | undefined => getAssetMediaItems(asset)[0];

const appendAssetMediaItem = (
  asset: StoryboardAssetItem,
  item: StoryboardAssetMediaItem,
): StoryboardAssetItem => {
  const existing = getAssetMediaItems(asset).filter((current) => {
    if (item.assetId && current.assetId === item.assetId) return false;
    if (item.mediaUrl && current.mediaUrl === item.mediaUrl) return false;
    if (item.localPath && current.localPath === item.localPath) return false;
    return current.id !== item.id;
  });
  const mediaItems = [item, ...existing];
  return syncAssetPrimaryMediaFields(
    {
      ...asset,
      mediaItems,
    },
    item,
  );
};

const setAssetPrimaryMedia = (
  asset: StoryboardAssetItem,
  mediaId: string,
): StoryboardAssetItem => {
  const items = getAssetMediaItems(asset);
  const targetIndex = items.findIndex((item) => item.id === mediaId);
  if (targetIndex < 0) return asset;

  const nextItems = [...items];
  const [primary] = nextItems.splice(targetIndex, 1);
  nextItems.unshift(primary);
  return syncAssetPrimaryMediaFields(
    {
      ...asset,
      mediaItems: nextItems,
    },
    primary,
  );
};

const deleteAssetMediaItem = (
  asset: StoryboardAssetItem,
  mediaId: string,
): StoryboardAssetItem => {
  const mediaItems = getAssetMediaItems(asset).filter((item) => item.id !== mediaId);
  const primary = mediaItems[0];

  if (!primary) {
    return {
      ...asset,
      source: "upload",
      status: "idle",
      mediaType: undefined,
      mediaUrl: undefined,
      localPath: undefined,
      assetId: undefined,
      mediaItems: [],
      primaryMediaId: undefined,
    };
  }

  return syncAssetPrimaryMediaFields(
    {
      ...asset,
      mediaItems,
    },
    primary,
  );
};

const getMediaTypeFromFile = (
  file: File,
): NonNullable<StoryboardAssetItem["mediaType"]> => {
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  const extension = getFileExtension(file, "").toLowerCase();
  if (["mp4", "webm", "mov"].includes(extension)) return "video";
  if (["mp3", "wav", "m4a", "aac", "ogg"].includes(extension)) return "audio";
  return "image";
};

const getAssetKindFromRecord = (asset: AssetRecord): StoryboardAssetKind => {
  if (
    asset.category === "role" ||
    asset.category === "scene" ||
    asset.category === "prop" ||
    asset.category === "audio"
  ) {
    return asset.category;
  }
  return asset.mediaType === "audio" ? "audio" : "prop";
};

const createLibraryStoryboardAsset = (
  asset: AssetRecord,
  kind: StoryboardAssetKind,
  assetStoragePath: string,
): StoryboardAssetItem => {
  const mediaItem: StoryboardAssetMediaItem = {
    id: createAssetMediaId("library_media"),
    source: "library",
    mediaType: asset.mediaType,
    mediaUrl: asset.ossUrl || getAssetOriginalDisplayUrl(asset, assetStoragePath),
    localPath: undefined,
    assetId: asset.id,
    name: asset.name,
    createdAt: Date.now(),
  };

  return {
    id: createId(`library_${kind}`),
    kind,
    name: asset.name,
    prompt: "",
    source: "library",
    status: "ready",
    mediaType: mediaItem.mediaType,
    mediaUrl: mediaItem.mediaUrl,
    localPath: mediaItem.localPath,
    assetId: mediaItem.assetId,
    mediaItems: [mediaItem],
    primaryMediaId: mediaItem.id,
  };
};

const mergeIdentifiedAssets = (
  currentAssets: StoryboardAssets,
  identifiedAssets: StoryboardAssets,
): StoryboardAssets => {
  const nextAssets: StoryboardAssets = {
    role: [...currentAssets.role],
    scene: [...currentAssets.scene],
    prop: [...currentAssets.prop],
    audio: [...currentAssets.audio],
  };

  for (const kind of ["role", "scene", "prop"] as const) {
    const existingNames = new Set(
      nextAssets[kind]
        .map((item) => item.name.trim().toLowerCase())
        .filter(Boolean),
    );

    for (const asset of identifiedAssets[kind]) {
      const key = asset.name.trim().toLowerCase();
      if (!key) continue;
      if (existingNames.has(key)) {
        nextAssets[kind] = nextAssets[kind].map((item) =>
          item.name.trim().toLowerCase() === key && !item.prompt.trim()
            ? { ...item, prompt: asset.prompt }
            : item,
        );
        continue;
      }
      nextAssets[kind].push(asset);
      existingNames.add(key);
    }
  }

  return nextAssets;
};

const normalizeAssetNameKey = (name: string) => name.trim().toLowerCase();

const bindShotAssetIdsByName = (
  shots: StoryboardShot[],
  shotAssetNames: string[][],
  assets: StoryboardAssets,
): StoryboardShot[] => {
  const assetIdByName = new Map<string, string>();
  for (const asset of [
    ...assets.role,
    ...assets.scene,
    ...assets.prop,
    ...assets.audio,
  ]) {
    const key = normalizeAssetNameKey(asset.name);
    if (key && !assetIdByName.has(key)) {
      assetIdByName.set(key, asset.id);
    }
  }

  return shots.map((shot, index) => {
    const nextAssetIds = new Set(shot.assetIds);
    for (const name of shotAssetNames[index] || []) {
      const assetId = assetIdByName.get(normalizeAssetNameKey(name));
      if (assetId) nextAssetIds.add(assetId);
    }
    return {
      ...shot,
      assetIds: Array.from(nextAssetIds),
    };
  });
};

const getShotVideoParamState = (shot: StoryboardShot): VideoParamState =>
  normalizeVideoParams(
    shot.modelInfo.videoModel,
    {
      aspectRatio: shot.modelInfo.aspectRatio,
      resolution: shot.modelInfo.resolution,
      duration: shot.modelInfo.duration,
    },
    "image-to-video",
  );

const patchShotModelInfo = (
  modelInfo: StoryboardShot["modelInfo"],
  value: VideoParamState,
): StoryboardShot["modelInfo"] => ({
  ...modelInfo,
  aspectRatio: value.aspectRatio || modelInfo.aspectRatio,
  duration: value.duration,
  resolution: value.resolution ?? modelInfo.resolution,
});

const isHttpUrl = (value: string | undefined) =>
  Boolean(value?.match(/^https?:\/\//i));

type JianyingExportVideo = {
  fileName: string;
  absolutePath: string;
  durationUs: number;
};

const textEncoder = new TextEncoder();

const createJianyingId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const sanitizeFileName = (value: string, fallback: string) => {
  const sanitized = value
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  const cleaned = Array.from(sanitized)
    .map((ch) => (ch.charCodeAt(0) < 32 ? "_" : ch))
    .join("");
  return cleaned || fallback;
};

const joinDraftRelativePath = (...parts: string[]) =>
  parts
    .map((part) => part.replace(/\\/g, "/").replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");

const toWindowsPath = (basePath: string, relativePath: string) =>
  `${basePath.replace(/[\\/]+$/g, "")}\\${relativePath.replace(/\//g, "\\")}`;

const getVideoExtension = (shot: StoryboardShot) => {
  const source = shot.video?.localPath || shot.video?.url || "";
  const cleanSource = source.split("?")[0]?.split("#")[0] || "";
  const extension = cleanSource.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  return extension && extension.length <= 6 ? extension : "mp4";
};

const writeDraftTextFile = async (
  basePath: string,
  relativePath: string,
  content: string,
) => {
  const bytes = textEncoder.encode(content);
  const result = await window.storage?.writeRawFile?.(
    basePath,
    relativePath,
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  if (!result?.success) {
    throw new Error(result?.error || `写入 ${relativePath} 失败`);
  }
};

const writeDraftJsonFile = (
  basePath: string,
  relativePath: string,
  value: unknown,
) => writeDraftTextFile(basePath, relativePath, JSON.stringify(value));

const writeDraftBinaryFile = async (
  basePath: string,
  relativePath: string,
  buffer: ArrayBuffer,
) => {
  const result = await window.storage?.writeRawFile?.(
    basePath,
    relativePath,
    buffer,
  );
  if (!result?.success) {
    throw new Error(result?.error || `写入 ${relativePath} 失败`);
  }
};

const createJianyingVideoMaterial = (input: JianyingExportVideo) => {
  const materialId = createJianyingId();
  const speedId = createJianyingId();
  const canvasId = createJianyingId();
  const channelMappingId = createJianyingId();
  const segmentId = createJianyingId();

  return {
    material: {
      audio_fade: null,
      category_name: "local",
      crop: {
        lower_left_x: 0,
        lower_left_y: 1,
        lower_right_x: 1,
        lower_right_y: 1,
        upper_left_x: 0,
        upper_left_y: 0,
        upper_right_x: 1,
        upper_right_y: 0,
      },
      crop_ratio: "free",
      crop_scale: 1,
      duration: input.durationUs,
      has_audio: true,
      height: 0,
      id: materialId,
      local_material_id: materialId,
      material_name: input.fileName,
      path: input.absolutePath,
      source_platform: 0,
      type: "video",
      width: 0,
    },
    speed: {
      curve_speed: null,
      id: speedId,
      mode: 0,
      speed: 1,
      type: "speed",
    },
    canvas: {
      album_image: "",
      blur: 0,
      color: "",
      id: canvasId,
      image: "",
      image_id: "",
      image_name: "",
      source_platform: 0,
      team_id: "",
      type: "canvas_color",
    },
    channelMapping: {
      audio_channel_mapping: 0,
      id: channelMappingId,
      is_config_open: false,
      type: "none",
    },
    segment: {
      clip: {
        alpha: 1,
        flip: { horizontal: false, vertical: false },
        rotation: 0,
        scale: { x: 1, y: 1 },
        transform: { x: 0, y: 0 },
      },
      common_keyframes: [],
      enable_adjust: true,
      enable_color_curves: true,
      enable_color_wheels: true,
      enable_lut: true,
      enable_smart_color_adjust: false,
      extra_material_refs: [speedId, channelMappingId, canvasId],
      group_id: "",
      hdr_settings: { intensity: 1, mode: 1, nits: 1000 },
      id: segmentId,
      material_id: materialId,
      render_index: 0,
      reverse: false,
      source_timerange: { duration: input.durationUs, start: 0 },
      speed: 1,
      target_timerange: { duration: input.durationUs, start: 0 },
      template_id: "",
      template_scene: "default",
      track_attribute: 0,
      track_render_index: 0,
      visible: true,
      volume: 1,
    },
    metaMaterial: {
      create_time: Math.floor(Date.now() / 1000),
      duration: input.durationUs,
      extra_info: input.fileName,
      file_Path: input.absolutePath,
      height: 0,
      id: materialId,
      import_time: Math.floor(Date.now() / 1000),
      import_time_ms: Date.now() * 1000,
      md5: "",
      metetype: "video",
      roughcut_time_range: { duration: input.durationUs, start: 0 },
      sub_time_range: { duration: -1, start: -1 },
      type: 0,
      width: 0,
    },
  };
};

const createJianyingDraftFiles = (input: {
  draftId: string;
  draftName: string;
  draftPath: string;
  draftsRootPath: string;
  videos: JianyingExportVideo[];
}) => {
  const trackId = createJianyingId();
  let cursor = 0;
  const videoMaterials = input.videos.map((video) => {
    const item = createJianyingVideoMaterial(video);
    item.segment.target_timerange.start = cursor;
    cursor += item.segment.target_timerange.duration;
    return item;
  });

  const nowSeconds = Math.floor(Date.now() / 1000);
  const nowUs = Date.now() * 1000;
  const durationUs = videoMaterials.reduce(
    (total, item) => total + item.segment.target_timerange.duration,
    0,
  );

  const content = {
    canvas_config: { height: 1080, ratio: "original", width: 1920 },
    color_space: -1,
    config: {
      maintrack_adsorb: true,
      material_save_mode: 0,
      video_mute: false,
    },
    cover: null,
    create_time: nowSeconds,
    duration: durationUs,
    fps: 30,
    id: input.draftId,
    keyframe_graph_list: [],
    keyframes: {
      adjusts: [],
      audios: [],
      effects: [],
      filters: [],
      handwrites: [],
      stickers: [],
      texts: [],
      videos: [],
    },
    materials: {
      audio_balances: [],
      audio_effects: [],
      audio_fades: [],
      audios: [],
      beats: [],
      canvases: videoMaterials.map((item) => item.canvas),
      chromas: [],
      color_curves: [],
      effects: [],
      green_screens: [],
      images: [],
      masks: [],
      material_animations: [],
      placeholders: [],
      primary_color_wheels: [],
      sound_channel_mappings: videoMaterials.map((item) => item.channelMapping),
      speeds: videoMaterials.map((item) => item.speed),
      stickers: [],
      tail_leaders: [],
      text_templates: [],
      texts: [],
      transitions: [],
      video_effects: [],
      video_trackings: [],
      videos: videoMaterials.map((item) => item.material),
    },
    name: input.draftName,
    new_version: "75.0.0",
    relationships: [],
    source: "default",
    static_cover_image_path: "",
    tracks: [
      {
        attribute: 0,
        flag: 0,
        id: trackId,
        is_default_name: true,
        name: "",
        segments: videoMaterials.map((item) => item.segment),
        type: "video",
      },
    ],
    update_time: nowSeconds,
    version: 360000,
  };

  const meta = {
    draft_cover: "",
    draft_fold_path: input.draftPath.replace(/\\/g, "/"),
    draft_id: input.draftId,
    draft_materials: [
      { type: 0, value: videoMaterials.map((item) => item.metaMaterial) },
      { type: 1, value: [] },
      { type: 2, value: [] },
      { type: 3, value: [] },
      { type: 6, value: [] },
      { type: 7, value: [] },
      { type: 8, value: [] },
    ],
    draft_name: input.draftName,
    draft_new_version: "75.0.0",
    draft_removable_storage_device: input.draftsRootPath.split(":")[0] || "",
    draft_root_path: input.draftsRootPath.replace(/\//g, "\\"),
    draft_timeline_materials_size_: input.videos.length,
    tm_draft_create: nowUs,
    tm_draft_modified: nowUs,
    tm_duration: durationUs,
  };

  return { content, meta, durationUs, nowSeconds, nowUs };
};

const videoModeKeys: VideoModeKey[] = [
  "text-to-video",
  "all-reference",
  "image-to-video",
  "video-edit",
  "first-last-frame",
];

const toVideoModeKey = (value: string | undefined): VideoModeKey | undefined =>
  videoModeKeys.includes(value as VideoModeKey)
    ? (value as VideoModeKey)
    : undefined;

const isSeedanceVideoModel = (model: string | undefined) =>
  model === "seedance-2.0-fast" || model === "seedance-2.0-pro";

const toAdobeImageRatio = (
  aspectRatio: string | undefined,
  allowedValues: Set<string>,
) => {
  const normalized = aspectRatio && allowedValues.has(aspectRatio)
    ? aspectRatio
    : "1:1";
  return normalized.replace(":", "x");
};

const toAdobeImageResolution = (resolution: string | undefined) => {
  const normalized = (resolution || "2K").toLowerCase();
  return ["1k", "2k", "4k"].includes(normalized) ? normalized : "2k";
};

const resolveAdobeStoryImageModel = (
  model: string,
  aspectRatio?: string,
  resolution?: string,
) => {
  const adobeResolution = toAdobeImageResolution(resolution);
  if (model === ADOBE_GPT_IMAGE2_MODEL) {
    return `firefly-gpt-image-${adobeResolution}-${toAdobeImageRatio(
      aspectRatio,
      STORY_ADOBE_GPTIMAGE2_SIZE_VALUES,
    )}`;
  }
  if (model === ADOBE_NANO_BANANA_PRO_MODEL) {
    return `firefly-nano-banana-pro-${adobeResolution}-${toAdobeImageRatio(
      aspectRatio,
      STORY_NANO_BANANA_LOCAL_SIZE_VALUES,
    )}`;
  }
  return undefined;
};

const resolveXimuStoryImageModel = (model: string) => {
  if (model === XIMU_GPT_IMAGE2_MODEL) return "gpt-image-2" as const;
  if (model === XIMU_GPT_IMAGE2_VIP_MODEL) return "gpt-image-2-vip" as const;
  if (model === XIMU_NANO_BANANA2_MODEL) return "nano-banana-2" as const;
  if (model === XIMU_NANO_BANANA_PRO_MODEL) {
    return "nano-banana-pro" as const;
  }
  return undefined;
};

const resolveGrokStoryImageModel = (model: string) => {
  if (model === GROK_IMAGE_EDIT_MODEL) return "grok-imagine-image-pro";
  if (model === GROK_IMAGE_LITE_MODEL) return "grok-imagine-image-lite";
  if (model === GROK_IMAGE_MODEL) return "grok-imagine-image";
  if (model === GROK_IMAGE_PRO_MODEL) return "grok-imagine-image-pro";
  return undefined;
};

const resolveGrokStoryImageSize = (aspectRatio: string) =>
  (
    {
      "16:9": "1280x720",
      "9:16": "720x1280",
      "3:2": "1792x1024",
      "2:3": "1024x1792",
      "1:1": "1024x1024",
    } as const
  )[aspectRatio] ?? "1024x1024";

const isDataImageUrl = (value: string) => /^data:image\/[^;]+;base64,/i.test(value);

const looksLikeBase64Image = (value: string) => {
  const compact = value.trim();
  return (
    compact.length > 128 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(compact) &&
    compact.length % 4 === 0
  );
};

const normalizeInlineImageSource = (value: string) => {
  const trimmed = value.trim();
  if (isDataImageUrl(trimmed)) return trimmed;
  if (looksLikeBase64Image(trimmed)) return `data:image/png;base64,${trimmed}`;
  return trimmed;
};

const getDirectImageUrl = (response: any) => {
  const direct =
    response?.data?.[0]?.url ||
    response?.data?.[0]?.b64_json ||
    extractMarkdownMediaUrl(response?.choices?.[0]?.message?.content, "image") ||
    "";
  return typeof direct === "string" ? normalizeInlineImageSource(direct) : "";
};

const isAdobeVideoRequest = (payload: Record<string, unknown>) =>
  typeof payload.model === "string" &&
  (payload.model.startsWith("firefly-sora2-pro-") ||
    payload.model.startsWith("firefly-veo31-") ||
    payload.model.startsWith("firefly-veo31-fast-")) &&
  Array.isArray(payload.messages);

const isGrokVideoRequest = (payload: Record<string, unknown>) =>
  payload.model === "grok-imagine-video" &&
  Array.isArray(payload.messages) &&
  typeof payload.video_config === "object" &&
  payload.video_config !== null;

const extractMarkdownMediaUrl = (content: unknown, kind: "image" | "video") => {
  const text = Array.isArray(content)
    ? content
        .map((part) =>
          typeof part === "string"
            ? part
            : typeof part?.text === "string"
              ? part.text
              : "",
        )
        .join("\n")
    : String(content || "");
  const urlPattern =
    kind === "video"
      ? "(?:https?:\\/\\/[^)\\s\"'<>]+\\/v1\\/files\\/video\\?id=[^)\\s\"'<>]+|https?:\\/\\/[^)\\s]+?\\.(?:mp4|webm|mov)(?:\\?[^)]*)?|\\/v1\\/files\\/video\\?id=[^)\\s\"'<>]+)"
      : "https?:\\/\\/[^)\\s]+";
  const htmlPattern =
    kind === "video"
      ? /<video[^>]+src=["']([^"']+)["']/i
      : /<img[^>]+src=["']([^"']+)["']/i;
  const htmlMatch = text.match(htmlPattern);
  if (htmlMatch?.[1]) return htmlMatch[1];

  const markdownPattern = new RegExp(
    kind === "video"
      ? `\\[.*?\\]\\((${urlPattern})\\)`
      : `!\\[.*?\\]\\((${urlPattern})\\)`,
    "i",
  );
  const markdownUrl = text.match(markdownPattern)?.[1];
  if (markdownUrl) return markdownUrl;

  const bareUrlPattern = new RegExp(
    kind === "video"
      ? `(${urlPattern})`
      : "(https?:\\/\\/[^\\s\"'<>)]*)",
    "i",
  );
  return text.match(bareUrlPattern)?.[1];
};

const normalizeGrok2ApiMediaUrl = async (url: string) => {
  if (!url.startsWith("/v1/files/")) return url;

  try {
    const state = await window.grok2api?.getState();
    if (state?.baseUrl) {
      return `${state.baseUrl.replace(/\/+$/, "")}${url}`;
    }
  } catch (error) {
    console.warn("[Story] get Grok2API media base url failed", error);
  }

  return url;
};

const pickStoryVideoMode = (
  model: string,
  referenceItems: MentionItem[],
  preferredMode?: VideoModeKey,
): VideoModeKey => {
  const supportedModes = getSupportedModesForModel(model);
  const hasReference = referenceItems.length > 0;
  const hasImageReference = referenceItems.some((item) => item.type === "image");

  if (preferredMode && supportedModes.includes(preferredMode)) {
    if (preferredMode === "all-reference" && !hasReference) {
      return supportedModes.includes("text-to-video")
        ? "text-to-video"
        : getFirstSupportedModeForModel(model, "all-reference");
    }
    if (preferredMode === "text-to-video" && hasReference) {
      if (supportedModes.includes("all-reference")) return "all-reference";
      if (hasImageReference && supportedModes.includes("image-to-video")) {
        return "image-to-video";
      }
      return "text-to-video";
    }
    if (preferredMode === "image-to-video" && !hasImageReference) {
      return supportedModes.includes("text-to-video")
        ? "text-to-video"
        : getFirstSupportedModeForModel(model, "all-reference");
    }
    return preferredMode;
  }

  if (hasReference && supportedModes.includes("all-reference")) {
    return "all-reference";
  }
  if (hasImageReference && supportedModes.includes("image-to-video")) {
    return "image-to-video";
  }
  if (!hasReference && supportedModes.includes("text-to-video")) {
    return "text-to-video";
  }

  return getFirstSupportedModeForModel(model, "all-reference");
};

const isImageSuccessStatus = (status: unknown) =>
  ["completed", "SUCCESS", "SUCCEEDED", "COMPLETED"].includes(String(status));

const isImageFailureStatus = (status: unknown) =>
  ["failed", "FAILED", "FAILURE", "ERROR", "CANCEL", "CANCELED"].includes(
    String(status),
  );

const extractImageTaskUrl = (response: any) => {
  const rawData =
    response?.result?.data ??
    response?.data?.result?.data ??
    response?.data?.data ??
    response?.data?.images ??
    response?.result?.images ??
    response?.imageUrls ??
    response?.images ??
    [];
  const items = Array.isArray(rawData) ? rawData : [rawData];
  const imageSource =
    items
      .map((item: any) =>
        typeof item === "string"
          ? item
          : item?.url || item?.image_url || item?.imageUrl || item?.b64_json,
      )
      .find(Boolean) || "";
  return typeof imageSource === "string"
    ? normalizeInlineImageSource(imageSource)
    : "";
};

const getImageExtensionFromUrl = (url: string, fallback = "png") => {
  const dataMime = url.match(/^data:image\/([^;]+);base64,/i)?.[1]?.toLowerCase();
  if (dataMime) {
    if (dataMime === "jpeg") return "jpg";
    if (["jpg", "png", "webp", "gif"].includes(dataMime)) return dataMime;
  }

  try {
    const extension = new URL(url).pathname.split(".").pop()?.toLowerCase();
    if (
      extension &&
      ["jpg", "jpeg", "png", "webp", "gif"].includes(extension)
    ) {
      return extension;
    }
  } catch {
    // Ignore malformed model URLs and use the fallback extension.
  }
  return fallback;
};

const imageSourceToArrayBuffer = async (imageSource: string) => {
  const normalized = normalizeInlineImageSource(imageSource);
  const dataMatch = normalized.match(/^data:image\/[^;]+;base64,(.+)$/i);
  if (dataMatch?.[1]) {
    const binary = window.atob(dataMatch[1]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes.buffer;
  }

  if (!window.download?.imageAsBuffer) {
    return null;
  }

  const result = await window.download.imageAsBuffer(normalized);
  if (!result.success || !result.data) {
    console.warn(
      "[Story] download generated asset image failed",
      result.error,
    );
    return null;
  }

  const bytes = result.data;
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
};

const StoryHeader = ({
  title,
  icon,
  action,
  backTo,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  backTo?: string;
}) => {
  const navigate = useNavigate();


  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/5 px-6">
      <div className="flex items-center gap-3">
        {backTo && (
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft size={17} />
          </button>
        )}
        <div className="text-[#B43FEB]">{icon}</div>
        <h1 className="text-lg font-medium text-white">{title}</h1>
      </div>
      {action}
    </header>
  );
};

const StoragePathGuard = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const storagePath = useChatSettingsStore((state) => state.storagePath);
  const setStoragePath = useChatSettingsStore((state) => state.setStoragePath);
  const [selecting, setSelecting] = useState(false);

  const selectPath = useCallback(async () => {
    if (!window.storage || selecting) return;
    setSelecting(true);
    try {
      const selected = await window.storage.selectDirectory();
      if (!selected) return;
      setStoragePath(selected);
      toast.success("项目存储路径已设置");
    } catch (error) {
      console.error("[Story] select storage path failed", error);
      toast.error("设置项目存储路径失败");
    } finally {
      setSelecting(false);
    }
  }, [selecting, setStoragePath]);

  if (storagePath) {
    return <>{children}</>;
  }

  return (
    <div className="story-scrollbar-scope flex h-full flex-col bg-[#09090b] text-white">
      <StoryHeader
        title="故事创作"
        icon={<BookOpenText size={20} />}
        action={null}
      />
      <main className="flex flex-1 items-center justify-center p-8">
        <div className="flex w-[min(520px,100%)] flex-col items-center rounded-xl border border-white/10 bg-[#111113] px-8 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70">
            <FolderOpen size={22} />
          </div>
          <h2 className="mt-5 text-lg font-medium">选择项目存储路径</h2>
          <p className="mt-3 text-sm leading-6 text-white/48">
            故事创作会把项目、片段、剧本 Agent 数据和生成结果保存到项目存储路径下的
            storyboard 目录。
          </p>
          <Button
            className="mt-6"
            size="sm"
            variant="blue"
            onClick={selectPath}
            disabled={selecting}
          >
            {selecting ? <Loader2 className="animate-spin" /> : <FolderOpen />}
            {selecting ? "选择中" : "选择项目存储路径"}
          </Button>
        </div>
      </main>
    </div>
  );
};

const StoryProjectDialog = ({
  open,
  project,
  onClose,
  onSaved,
}: {
  open: boolean;
  project?: StoryboardProject | null;
  onClose: () => void;
  onSaved: (project: StoryboardProject) => void;
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setCoverFile(null);
      setCoverPreview("");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setName(project?.name || "");
    setDescription(project?.description || "");
    setCoverFile(null);
    setCoverPreview("");
    if (inputRef.current) inputRef.current.value = "";
  }, [open, project]);

  if (!open) return null;

  const isEdit = Boolean(project);

  const save = async () => {
    if (!name.trim()) {
      toast.error("项目名称不能为空");
      return;
    }

    setSaving(true);
    try {
      if (project) {
        let coverLocalPath = project.coverLocalPath;
        if (coverFile) {
          const extension = getFileExtension(coverFile, "png");
          coverLocalPath = `storyboard/projects/${project.id}/cover/cover.${extension}`;
          await storyboardStorage.saveBinary(
            coverLocalPath,
            await coverFile.arrayBuffer(),
          );
        }
        const nextProject: StoryboardProject = {
          ...project,
          name: name.trim(),
          description: description.trim(),
          coverLocalPath,
        };
        await storyboardStorage.updateProject(nextProject);
        toast.success("故事项目已更新");
        onSaved(nextProject);
      } else {
        const created = await storyboardStorage.createProject({
          name,
          description,
          coverFile,
        });
        toast.success("故事项目已创建");
        onSaved(created);
      }
      onClose();
    } catch (error) {
      console.error("[Story] save project failed", error);
      toast.error(isEdit ? "更新故事项目失败" : "创建故事项目失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#121214] shadow-2xl">
        <div className="border-b border-white/5 p-6">
          <h2 className="text-lg font-semibold text-white/90">
            {isEdit ? "编辑故事项目" : "新建故事项目"}
          </h2>
        </div>
        <div className="space-y-5 p-6">
          <label className="block">
            <span className="mb-2 block text-sm text-white/70">
              项目名称 <span className="text-[#ff4d9d]">*</span>
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              placeholder="输入项目名称"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-white/70">项目说明</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={`${textAreaClass} h-24`}
              placeholder="描述故事项目的题材、目标和产出"
            />
          </label>
          <div>
            <span className="mb-2 block text-sm text-white/70">项目封面图</span>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setCoverFile(file);
                setCoverPreview(URL.createObjectURL(file));
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex h-36 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-black/30 text-sm text-white/45 transition-colors hover:border-[#B43FEB]/60 hover:bg-[#B43FEB]/5 hover:text-white/75"
            >
              {coverPreview ? (
                <img
                  src={coverPreview}
                  alt="项目封面"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex items-center gap-2">
                  <Upload size={16} />
                  点击上传封面
                </span>
              )}
            </button>
            {isEdit && !coverPreview && project?.coverLocalPath && (
              <p className="mt-2 text-xs text-white/35">
                已有封面，重新上传后会替换当前封面
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-white/5 bg-black/20 p-5">
          <Button onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button variant="blue" onClick={save} loading={saving}>
            {isEdit ? "保存修改" : "创建项目"}
          </Button>
        </div>
      </div>
    </div>
  );
};

const StoryProjectListPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<StoryboardProject[]>([]);
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<StoryboardProject | null>(
    null,
  );
  const [projectToDelete, setProjectToDelete] =
    useState<StoryboardProject | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await storyboardStorage.listProjects());
    } catch (error) {
      console.error("[Story] load projects failed", error);
      toast.error("读取故事项目失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const openCreateDialog = () => {
    setEditingProject(null);
    setDialogOpen(true);
  };

  const openEditDialog = (
    event: React.MouseEvent,
    project: StoryboardProject,
  ) => {
    event.stopPropagation();
    setEditingProject(project);
    setDialogOpen(true);
  };

  const openDeleteDialog = (
    event: React.MouseEvent,
    project: StoryboardProject,
  ) => {
    event.stopPropagation();
    setProjectToDelete(project);
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;

    setDeleting(true);
    try {
      await storyboardStorage.removeProject(projectToDelete.id);
      await loadProjects();
      toast.success("故事项目已删除");
    } catch (error) {
      console.error("[Story] delete project failed", error);
      toast.error("删除故事项目失败");
    } finally {
      setDeleting(false);
      setProjectToDelete(null);
    }
  };

  useEffect(() => {
    let active = true;
    const urls: string[] = [];

    Promise.all(
      projects.map(async (project) => {
        const url = await storyboardStorage.readObjectUrl(project.coverLocalPath);
        if (url) urls.push(url);
        return [project.id, url] as const;
      }),
    ).then((entries) => {
      if (!active) {
        urls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      setCoverUrls(
        entries.reduce<Record<string, string>>((acc, [id, url]) => {
          if (url) acc[id] = url;
          return acc;
        }, {}),
      );
    });

    return () => {
      active = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [projects]);

  return (
    <StoragePathGuard>
      <div className="story-scrollbar-scope flex h-full flex-col overflow-hidden bg-[#09090b] text-white">
        <StoryHeader
          title="故事创作"
          icon={<BookOpenText size={20} />}
          action={
            <Button variant="blue" size="sm" onClick={openCreateDialog}>
              <Plus size={15} />
              新建项目
            </Button>
          }
        />
        <main className="min-h-0 flex-1 overflow-y-auto p-8">
          <div className="mb-8">
            <h2 className="text-xl font-semibold">故事项目</h2>
            <p className="mt-2 text-sm text-white/45">
              管理剧集、短剧或长篇故事的项目文件，进入项目后创建片段。
            </p>
          </div>
          {loading ? (
            <div className="flex h-60 items-center justify-center text-white/40">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              读取故事项目中
            </div>
          ) : projects.length === 0 ? (
            <div className="flex h-72 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-white/40">
              <BookOpenText className="mb-4 h-12 w-12 opacity-60" />
              <p className="text-base">还没有故事项目</p>
              <Button
                className="mt-5"
                variant="blue"
                size="sm"
                onClick={openCreateDialog}
              >
                <Plus size={15} />
                创建第一个故事项目
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => navigate(`/story/${project.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(`/story/${project.id}`);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className="group overflow-hidden rounded-xl border border-white/5 bg-[#121214] text-left transition-all hover:border-[#B43FEB]/45 hover:shadow-[0_0_30px_rgba(180,63,235,0.16)]"
                >
                  <div className="relative aspect-video overflow-hidden bg-white/5">
                    {coverUrls[project.id] ? (
                      <img
                        src={coverUrls[project.id]}
                        alt={project.name}
                        className="h-full w-full object-cover opacity-85 transition-all duration-500 group-hover:scale-105 group-hover:opacity-100"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-[#B43FEB]/10 to-white/[0.02]">
                        <BookOpenText className="h-11 w-11 text-white/25" />
                      </div>
                    )}
                    <div className="absolute left-3 top-3 rounded-md border border-white/10 bg-black/60 px-2 py-1 text-[10px] text-[#d8b6ff] backdrop-blur">
                      故事创作
                    </div>
                    <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(event) => openEditDialog(event, project)}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-black/50 text-white/70 backdrop-blur-md transition-colors hover:bg-black/70 hover:text-white"
                        title="编辑项目"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => openDeleteDialog(event, project)}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-black/50 text-red-400/70 backdrop-blur-md transition-colors hover:bg-red-500/20 hover:text-red-400"
                        title="删除项目"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="truncate font-medium text-white/90">
                      {project.name}
                    </h3>
                    <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-white/45">
                      {project.description || "暂无项目说明"}
                    </p>
                    <div className="mt-4 text-xs text-white/35">
                      更新于 {formatTime(project.updatedAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
        <StoryProjectDialog
          open={dialogOpen}
          project={editingProject}
          onClose={() => {
            setDialogOpen(false);
            setEditingProject(null);
          }}
          onSaved={(project) => {
            if (editingProject) {
              void loadProjects();
            } else {
              navigate(`/story/${project.id}`);
            }
          }}
        />
        {projectToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#121214] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/5 p-5">
                <h2 className="text-lg font-semibold text-white/90">
                  删除故事项目
                </h2>
                <button
                  type="button"
                  onClick={() => !deleting && setProjectToDelete(null)}
                  disabled={deleting}
                  className="cursor-pointer text-white/50 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-5">
                <p className="text-sm leading-6 text-white/60">
                  确定要删除故事项目{" "}
                  <span className="font-medium text-white">
                    “{projectToDelete.name}”
                  </span>
                  吗？删除后会从故事项目列表移除。
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-white/5 bg-black/20 p-5">
                <Button
                  onClick={() => setProjectToDelete(null)}
                  disabled={deleting}
                >
                  取消
                </Button>
                <button
                  type="button"
                  onClick={confirmDeleteProject}
                  disabled={deleting}
                  className="flex cursor-pointer items-center gap-2 rounded-lg bg-red-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {deleting ? "删除中" : "删除"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StoragePathGuard>
  );
};

const SnippetDialog = ({
  open,
  projectId,
  snippet,
  onClose,
  onSaved,
}: {
  open: boolean;
  projectId: string;
  snippet?: StoryboardSnippet | null;
  onClose: () => void;
  onSaved: (snippet: StoryboardSnippet) => void;
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      return;
    }

    setName(snippet?.name || "");
    setDescription(snippet?.description || "");
  }, [open, snippet]);

  if (!open) return null;

  const save = async () => {
    if (!name.trim()) {
      toast.error("片段名称不能为空");
      return;
    }
    setSaving(true);
    try {
      if (snippet) {
        const nextSnippet: StoryboardSnippet = {
          ...snippet,
          name: name.trim(),
          description: description.trim(),
        };
        await storyboardStorage.updateSnippet(nextSnippet);
        toast.success("片段已更新");
        onSaved(nextSnippet);
      } else {
        const created = await storyboardStorage.createSnippet({
          projectId,
          name,
          description,
        });
        toast.success("片段已创建");
        onSaved(created);
      }
      onClose();
    } catch (error) {
      console.error("[Story] save snippet failed", error);
      toast.error(snippet ? "更新片段失败" : "创建片段失败");
    } finally {
      setSaving(false);
    }
  };

  const isEdit = Boolean(snippet);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#121214] shadow-2xl">
        <div className="border-b border-white/5 p-6">
          <h2 className="text-lg font-semibold text-white/90">
            {isEdit ? "编辑片段" : "新建片段"}
          </h2>
        </div>
        <div className="space-y-5 p-6">
          <label className="block">
            <span className="mb-2 block text-sm text-white/70">片段名称</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              placeholder="例如：第 1 集 / 开场片段"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-white/70">片段说明</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={`${textAreaClass} h-24`}
              placeholder="描述片段内容、集数范围或分工说明"
            />
          </label>
        </div>
        <div className="flex justify-end gap-3 border-t border-white/5 bg-black/20 p-5">
          <Button onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button variant="blue" onClick={save} loading={saving}>
            {isEdit ? "保存修改" : "创建片段"}
          </Button>
        </div>
      </div>
    </div>
  );
};

const StorySnippetListPage = ({ projectId }: { projectId: string }) => {
  const navigate = useNavigate();
  const [project, setProject] = useState<StoryboardProject | null>(null);
  const [snippets, setSnippets] = useState<StoryboardSnippet[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<StoryboardSnippet | null>(
    null,
  );
  const [snippetToDelete, setSnippetToDelete] =
    useState<StoryboardSnippet | null>(null);
  const [deletingSnippet, setDeletingSnippet] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextProject, nextSnippets] = await Promise.all([
        storyboardStorage.getProject(projectId),
        storyboardStorage.listSnippets(projectId),
      ]);
      setProject(nextProject);
      setSnippets(nextSnippets);
    } catch (error) {
      console.error("[Story] load snippets failed", error);
      toast.error("读取片段失败");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreateSnippetDialog = () => {
    setEditingSnippet(null);
    setDialogOpen(true);
  };

  const openEditSnippetDialog = (
    event: React.MouseEvent,
    snippet: StoryboardSnippet,
  ) => {
    event.stopPropagation();
    setEditingSnippet(snippet);
    setDialogOpen(true);
  };

  const openDeleteSnippetDialog = (
    event: React.MouseEvent,
    snippet: StoryboardSnippet,
  ) => {
    event.stopPropagation();
    setSnippetToDelete(snippet);
  };

  const confirmDeleteSnippet = async () => {
    if (!snippetToDelete) return;

    setDeletingSnippet(true);
    try {
      await storyboardStorage.removeSnippet(projectId, snippetToDelete.id);
      await load();
      toast.success("片段已删除");
    } catch (error) {
      console.error("[Story] delete snippet failed", error);
      toast.error("删除片段失败");
    } finally {
      setDeletingSnippet(false);
      setSnippetToDelete(null);
    }
  };

  return (
    <StoragePathGuard>
      <div className="story-scrollbar-scope flex h-full flex-col overflow-hidden bg-[#09090b] text-white">
        <StoryHeader
          title={project?.name || "片段管理"}
          icon={<Clapperboard size={20} />}
          backTo="/story"
          action={
            <Button variant="blue" size="sm" onClick={openCreateSnippetDialog}>
              <Plus size={15} />
              新建片段
            </Button>
          }
        />
        <main className="min-h-0 flex-1 overflow-y-auto p-8">
          <div className="mb-8">
            <h2 className="text-xl font-semibold">片段管理</h2>
            <p className="mt-2 text-sm text-white/45">
              每个片段拥有独立的剧本 Agent、资产引用、分镜表格和生成结果。
            </p>
          </div>
          {loading ? (
            <div className="flex h-60 items-center justify-center text-white/40">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              读取片段中
            </div>
          ) : snippets.length === 0 ? (
            <div className="flex h-72 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-white/40">
              <Clapperboard className="mb-4 h-12 w-12 opacity-60" />
              <p className="text-base">还没有片段</p>
              <Button
                className="mt-5"
                variant="blue"
                size="sm"
                onClick={openCreateSnippetDialog}
              >
                <Plus size={15} />
                创建片段
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 2xl:grid-cols-4">
              {snippets.map((snippet) => (
                <div
                  key={snippet.id}
                  onClick={() =>
                    navigate(`/story/${projectId}/snippets/${snippet.id}/agent`)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(`/story/${projectId}/snippets/${snippet.id}/agent`);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className="group rounded-xl border border-white/5 bg-[#121214] p-5 text-left transition-all hover:border-[#B43FEB]/45 hover:bg-[#B43FEB]/5"
                >
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#d8b6ff]">
                      <Clapperboard size={22} />
                    </div>
                    <div className="flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(event) => openEditSnippetDialog(event, snippet)}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-black/50 text-white/70 backdrop-blur-md transition-colors hover:bg-black/70 hover:text-white"
                        title="编辑片段"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) =>
                          openDeleteSnippetDialog(event, snippet)
                        }
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-black/50 text-red-400/70 backdrop-blur-md transition-colors hover:bg-red-500/20 hover:text-red-400"
                        title="删除片段"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <h3 className="truncate text-base font-medium text-white/90">
                    {snippet.name}
                  </h3>
                  <p className="mt-2 line-clamp-3 min-h-15 text-sm leading-5 text-white/45">
                    {snippet.description || "暂无片段说明"}
                  </p>
                  <div className="mt-5 flex items-center justify-between text-xs text-white/40">
                    <span>{formatTime(snippet.updatedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
        <SnippetDialog
          open={dialogOpen}
          projectId={projectId}
          snippet={editingSnippet}
          onClose={() => {
            setDialogOpen(false);
            setEditingSnippet(null);
          }}
          onSaved={(snippet) => {
            if (editingSnippet) {
              void load();
            } else {
              navigate(`/story/${projectId}/snippets/${snippet.id}/agent`);
            }
          }}
        />
        {snippetToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#121214] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/5 p-5">
                <h2 className="text-lg font-semibold text-white/90">
                  删除片段
                </h2>
                <button
                  type="button"
                  onClick={() => !deletingSnippet && setSnippetToDelete(null)}
                  disabled={deletingSnippet}
                  className="cursor-pointer text-white/50 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-5">
                <p className="text-sm leading-6 text-white/60">
                  确定要删除片段{" "}
                  <span className="font-medium text-white">
                    “{snippetToDelete.name}”
                  </span>
                  吗？删除后会移除该片段的剧本 Agent 数据和生成结果。
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-white/5 bg-black/20 p-5">
                <Button
                  onClick={() => setSnippetToDelete(null)}
                  disabled={deletingSnippet}
                >
                  取消
                </Button>
                <button
                  type="button"
                  onClick={confirmDeleteSnippet}
                  disabled={deletingSnippet}
                  className="flex cursor-pointer items-center gap-2 rounded-lg bg-red-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingSnippet && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {deletingSnippet ? "删除中" : "删除"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StoragePathGuard>
  );
};

const GenerationWorkspace = () => (
  <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#111113]">
    <div className="flex h-12 items-center justify-between border-b border-white/5 px-4">
      <div className="flex items-center gap-2 text-sm font-medium text-white/80">
        <ImagePlus className="h-4 w-4 text-[#B43FEB]" />
        生图区域
      </div>
      <Button size="sm" variant="blue">
        <Sparkles size={14} />
        生成图片
      </Button>
    </div>
    <div className="grid min-h-0 flex-1 grid-cols-[360px_1fr] overflow-hidden">
      <div className="space-y-4 border-r border-white/5 p-4">
        <label className="block">
          <span className="mb-2 block text-xs text-white/45">图片提示词</span>
          <textarea
            className={`${textAreaClass} h-36`}
            placeholder="输入图片生成提示词，或从剧本 Agent 分镜提示词复制"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <select className={inputClass} defaultValue="1:1">
            <option value="1:1">1:1</option>
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
          </select>
          <select className={inputClass} defaultValue="2K">
            <option value="2K">2K</option>
            <option value="4K">4K</option>
          </select>
        </div>
        <button
          type="button"
          className="flex h-28 w-full items-center justify-center rounded-lg border border-dashed border-white/15 bg-black/25 text-sm text-white/40 transition-colors hover:border-[#B43FEB]/50 hover:text-white/70"
        >
          <Upload className="mr-2 h-4 w-4" />
          上传参考图
        </button>
      </div>
      <div className="min-h-0 overflow-auto p-4">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex aspect-video items-center justify-center rounded-lg border border-white/8 bg-black/35 text-xs text-white/30"
            >
              生成结果 {index + 1}
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

const StoryWorkspacePage = ({
  projectId,
  snippetId,
}: {
  projectId: string;
  snippetId: string;
}) => {
  const navigate = useNavigate();
  const assetStoragePath = useChatSettingsStore(
    (state) => state.assetStoragePath,
  );
  const setAssetStoragePath = useChatSettingsStore(
    (state) => state.setAssetStoragePath,
  );
  const [snippet, setSnippet] = useState<StoryboardSnippet | null>(null);
  const [selectingAssetPath, setSelectingAssetPath] = useState(false);
  const [assetRefreshKey, setAssetRefreshKey] = useState(0);

  useEffect(() => {
    storyboardStorage.getSnippet(projectId, snippetId).then(setSnippet);
  }, [projectId, snippetId]);

  const selectAssetPath = useCallback(async () => {
    if (!window.storage || selectingAssetPath) return;
    setSelectingAssetPath(true);
    try {
      const selected = await window.storage.selectDirectory();
      if (!selected) return;
      setAssetStoragePath(selected);
      await initializeAssetStorage(selected);
      setAssetRefreshKey((key) => key + 1);
      toast.success("资产库路径已设置");
    } catch (error) {
      console.error("[Story] select asset path failed", error);
      toast.error("设置资产库路径失败");
    } finally {
      setSelectingAssetPath(false);
    }
  }, [selectingAssetPath, setAssetStoragePath]);

  return (
    <StoragePathGuard>
      <div className="story-scrollbar-scope flex h-full flex-col overflow-hidden bg-[#09090b] text-white">
        <StoryHeader
          title={snippet?.name || "片段创作"}
          icon={<Clapperboard size={20} />}
          backTo={`/story/${projectId}`}
          action={
            <Button
              variant="blue"
              size="sm"
              onClick={() =>
                navigate(`/story/${projectId}/snippets/${snippetId}/agent`)
              }
            >
              <Bot size={15} />
              剧本 Agent
            </Button>
          }
        />
        <main className="grid min-h-0 flex-1 grid-cols-[minmax(520px,1fr)_minmax(420px,42%)] gap-5 p-6">
          <GenerationWorkspace />
          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#111113]">
            <div className="flex h-12 items-center justify-between border-b border-white/5 px-4">
              <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                <FolderOpen className="h-4 w-4 text-[#B43FEB]" />
                项目资产
              </div>
            </div>
            {assetStoragePath ? (
              <AssetLibraryDialog
                open
                variant="page"
                basePath={assetStoragePath}
                projectId={null}
                nodes={[]}
                refreshKey={assetRefreshKey}
                hidePreviewPane
                onClose={() => undefined}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-center">
                <div className="max-w-sm">
                  <FolderOpen className="mx-auto mb-4 h-10 w-10 text-white/30" />
                  <p className="text-sm text-white/45">
                    右侧资产管理复用资产库项目资产。请先选择资产库存储路径。
                  </p>
                  <Button
                    className="mt-5"
                    size="sm"
                    variant="blue"
                    onClick={selectAssetPath}
                    disabled={selectingAssetPath}
                  >
                    {selectingAssetPath ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <FolderOpen />
                    )}
                    选择资产库路径
                  </Button>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </StoragePathGuard>
  );
};

const StoryAssetImageParamsControl = ({
  item,
  model,
  defaultImageSize,
  defaultImageResolution,
  onChange,
}: {
  item: StoryboardAssetItem;
  model: string;
  defaultImageSize?: string;
  defaultImageResolution?: string;
  onChange: (patch: Partial<StoryboardAssetItem>) => void;
}) => {
  const params = normalizeStoryImageParams(model, {
    aspectRatio: item.aspectRatio || defaultImageSize,
    resolution: item.resolution || defaultImageResolution,
  });

  const updateAspectRatio = (aspectRatio: string) => {
    onChange({ aspectRatio });
  };
  const updateResolution = (resolution: string) => {
    onChange({ resolution });
  };

  if (model === "doubao-seedream-5-0") {
    return (
      <SeedreamParamsPanel
        size={params.aspectRatio}
        resolution={params.resolution || "2K"}
        onSizeChange={updateAspectRatio}
        onResolutionChange={updateResolution}
      />
    );
  }

  if (model === "gemini-3-pro-image-preview") {
    return (
      <GeminiParamsPanel
        size={params.aspectRatio}
        resolution={params.resolution || "2K"}
        onSizeChange={updateAspectRatio}
        onResolutionChange={updateResolution}
      />
    );
  }

  if (model === ADOBE_GPT_IMAGE2_MODEL || isXimuGptImageGenerationModel(model)) {
    return (
      <GptImage2ParamsPanel
        size={params.aspectRatio}
        resolution={params.resolution || "2K"}
        sizeOptions={
          model === ADOBE_GPT_IMAGE2_MODEL
            ? ADOBE_GPTIMAGE2_SIZES
            : STORY_XIMU_GPTIMAGE2_SIZES
        }
        resolutionOptions={
          model === XIMU_GPT_IMAGE2_MODEL
            ? STORY_XIMU_GPTIMAGE2_RESOLUTION_OPTIONS
            : STORY_GPTIMAGE2_RESOLUTION_OPTIONS
        }
        onSizeChange={updateAspectRatio}
        onResolutionChange={updateResolution}
      />
    );
  }

  if (
    model === ADOBE_NANO_BANANA_PRO_MODEL ||
    model === XIMU_NANO_BANANA2_MODEL ||
    model === XIMU_NANO_BANANA_PRO_MODEL
  ) {
    return (
      <GeminiParamsPanel
        size={params.aspectRatio}
        resolution={params.resolution || "2K"}
        sizeOptions={
          model === XIMU_NANO_BANANA2_MODEL
            ? STORY_XIMU_NANO_BANANA2_SIZES
            : model === XIMU_NANO_BANANA_PRO_MODEL
              ? STORY_XIMU_NANO_BANANA_PRO_SIZES
              : NANO_BANANA_LOCAL_SIZES
        }
        resolutionOptions={NANO_BANANA_RESOLUTIONS}
        onSizeChange={updateAspectRatio}
        onResolutionChange={updateResolution}
      />
    );
  }

  if (isGrokImageGenerationModel(model)) {
    return (
      <GeminiParamsPanel
        size={params.aspectRatio}
        resolution={params.resolution || "standard"}
        sizeOptions={GROK_IMAGE_SIZES}
        resolutionOptions={GROK_IMAGE_RESOLUTIONS}
        onSizeChange={updateAspectRatio}
        onResolutionChange={updateResolution}
      />
    );
  }

  if (model === "midjourney" || model === "midjourney-niji7") {
    return (
      <MidjourneyParamsPanel
        size={params.aspectRatio}
        onSizeChange={updateAspectRatio}
      />
    );
  }

  return (
    <GptImage2ParamsPanel
      size={params.aspectRatio}
      resolution={params.resolution || "2K"}
      onSizeChange={updateAspectRatio}
      onResolutionChange={updateResolution}
    />
  );
};

const AssetColumnItem = memo(({
  item,
  index,
  audioAssets = [],
  imageModelOptions,
  defaultImageModel,
  defaultImageSize,
  defaultImageResolution,
  onChange,
  onUpload,
  onUseLibrary,
  onBindAudio,
  onBindLocalAudio,
  onSetPrimaryMedia,
  onDeleteMedia,
  onGenerate,
  onDelete,
}: {
  item: StoryboardAssetItem;
  index: number;
  audioAssets?: StoryboardAssetItem[];
  imageModelOptions: StoryImageModelOption[];
  defaultImageModel?: string;
  defaultImageSize?: string;
  defaultImageResolution?: string;
  onChange: (patch: Partial<StoryboardAssetItem>) => void;
  onUpload: (file: File) => void;
  onUseLibrary: () => void;
  onBindAudio: () => void;
  onBindLocalAudio: (file: File) => void;
  onSetPrimaryMedia: (mediaId: string) => void;
  onDeleteMedia: (mediaId: string) => void;
  onGenerate: () => void;
  onDelete: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const [draftPrompt, setDraftPrompt] = useState(item.prompt || "");
  const promptTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setDraftPrompt(item.prompt || "");
  }, [item.prompt]);

  useEffect(() => {
    return () => {
      if (promptTimerRef.current) window.clearTimeout(promptTimerRef.current);
    };
  }, []);
  const currentImageModelId = getStoryImageModelOptionId(
    item.imageModel,
    item.imagePlatform,
    defaultImageModel,
    imageModelOptions,
  );
  const currentImageModel =
    imageModelOptions.find((option) => String(option.id) === currentImageModelId)
      ?.model ||
    item.imageModel ||
    defaultImageModel ||
    "doubao-seedream-5-0";
  const isAudioAsset = item.kind === "audio";
  const boundAudioIds = item.audioAssetIds || [];

  return (
    <div className="rounded-lg border border-white/8 bg-black/25 p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-white/35">#{index + 1}</span>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/45">
            {item.status === "generating"
              ? "生成中"
              : item.status === "ready"
                ? "已就绪"
                : item.status === "failed"
                  ? "失败"
                  : "待处理"}
          </span>
          <Button
            className="h-7 w-7 px-0 text-red-200 hover:bg-red-500/10 hover:text-red-100"
            size="sm"
            variant="ghost"
            onClick={onDelete}
            title="删除资产"
            aria-label="删除资产"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        <StoryAssetPreview
          item={item}
          onSetPrimaryMedia={onSetPrimaryMedia}
          onDeleteMedia={onDeleteMedia}
        />
        <input
          className={inputClass}
          value={item.name}
          placeholder="资产名称"
          onChange={(event) => onChange({ name: event.target.value })}
        />
        <textarea
          className={`${textAreaClass} h-20`}
          value={draftPrompt}
          placeholder={isAudioAsset ? "音效描述" : "AI 生成提示词"}
          onChange={(event) => {
            const value = event.target.value;
            setDraftPrompt(value);
            if (promptTimerRef.current) window.clearTimeout(promptTimerRef.current);
            promptTimerRef.current = window.setTimeout(() => {
              onChange({ prompt: value });
              promptTimerRef.current = null;
            }, 800);
          }}
        />
        {!isAudioAsset ? (
          <>
            <StoryAssetImageParamsControl
              item={item}
              model={currentImageModel}
              defaultImageSize={defaultImageSize}
              defaultImageResolution={defaultImageResolution}
              onChange={onChange}
            />
            <div className="flex items-center gap-2">
              <Select
                value={currentImageModelId}
                onValueChange={(value) => {
                  const selected = imageModelOptions.find(
                    (option) => option.id === Number(value),
                  );
                  if (!selected) return;
                  const nextParams = normalizeStoryImageParams(selected.model, {
                    aspectRatio: item.aspectRatio || defaultImageSize,
                    resolution: item.resolution || defaultImageResolution,
                  });
                  onChange({
                    imageModel: selected.model,
                    imagePlatform: selected.platform,
                    aspectRatio: nextParams.aspectRatio,
                    resolution: nextParams.resolution,
                  });
                }}
              >
                <SelectTrigger
                  size="sm"
                  className={cn(
                    PROMPT_PANEL_STYLES.modelSelect,
                    "h-8 min-w-0 flex-1 px-3 text-xs",
                    "[&_[data-slot=select-value]]:block [&_[data-slot=select-value]]:truncate",
                  )}
                  title={
                    imageModelOptions.find(
                      (option) => String(option.id) === currentImageModelId,
                    )?.name
                  }
                >
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent className={PROMPT_PANEL_STYLES.modelSelectContent}>
                  {imageModelOptions.map((option) => (
                    <SelectItem
                      key={option.id}
                      value={String(option.id)}
                      className={PROMPT_PANEL_STYLES.modelSelectItem}
                    >
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="blue"
                onClick={onGenerate}
                disabled={item.status === "generating"}
              >
                {item.status === "generating" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <WandSparkles size={13} />
                )}
                AI 生成
              </Button>
            </div>
          </>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={item.kind === "audio" ? "audio/*" : "image/*,video/*"}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
            }}
          />
          <Button size="sm" onClick={() => inputRef.current?.click()}>
            <Upload size={13} />
            本地上传
          </Button>
          <Button size="sm" onClick={onUseLibrary}>
            <FolderOpen size={13} />
            资产库上传
          </Button>
        </div>
        {!isAudioAsset ? (
          <div className="rounded-lg border border-white/8 bg-black/25 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-white/55">
                <Music size={13} />
                绑定音效
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onBindLocalAudio(file);
                    event.target.value = "";
                  }}
                />
                <Button size="sm" onClick={onBindAudio}>
                  <FolderOpen size={13} />
                  资产库选择
                </Button>
                <Button size="sm" onClick={() => audioInputRef.current?.click()}>
                  <Upload size={13} />
                  本地选择
                </Button>
              </div>
            </div>
            {boundAudioIds.length === 0 ? (
              <div className="text-[11px] text-white/30">
                暂无已绑定音效。
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {boundAudioIds.map((audioId) => {
                  const audio = audioAssets.find((item) => item.id === audioId);
                  return (
                    <button
                      type="button"
                      key={audioId}
                      className="rounded-full border border-[#B43FEB]/50 bg-[#B43FEB]/18 px-2.5 py-1 text-[11px] text-[#E9C7FF] transition-colors hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-100"
                      onClick={() =>
                        onChange({
                          audioAssetIds: boundAudioIds.filter(
                            (id) => id !== audioId,
                          ),
                        })
                      }
                    >
                      {audio?.name || "已绑定音效"}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}, (prev, next) => {
  const p = prev.item as StoryboardAssetItem;
  const n = next.item as StoryboardAssetItem;
  if (p.id !== n.id) return false;
  if (p.name !== n.name) return false;
  if (p.prompt !== n.prompt) return false;
  if (p.status !== n.status) return false;
  if (p.imageModel !== n.imageModel) return false;
  if (p.aspectRatio !== n.aspectRatio) return false;
  if (p.resolution !== n.resolution) return false;
  if (p.mediaType !== n.mediaType) return false;
  if (p.mediaUrl !== n.mediaUrl) return false;
  if (p.localPath !== n.localPath) return false;
  if (p.primaryMediaId !== n.primaryMediaId) return false;
  if ((p.audioAssetIds || []).length !== (n.audioAssetIds || []).length) return false;
  const pMediaItems = p.mediaItems || [];
  const nMediaItems = n.mediaItems || [];
  if (pMediaItems.length !== nMediaItems.length) return false;
  for (let i = 0; i < pMediaItems.length; i += 1) {
    const pItem = pMediaItems[i];
    const nItem = nMediaItems[i];
    if (pItem.id !== nItem.id) return false;
    if (pItem.mediaUrl !== nItem.mediaUrl) return false;
    if (pItem.localPath !== nItem.localPath) return false;
    if (pItem.mediaType !== nItem.mediaType) return false;
  }
  if (prev.index !== next.index) return false;
  if (prev.defaultImageModel !== next.defaultImageModel) return false;
  if (prev.defaultImageSize !== next.defaultImageSize) return false;
  if (prev.defaultImageResolution !== next.defaultImageResolution) return false;
  if (prev.imageModelOptions !== next.imageModelOptions) return false;
  if (prev.audioAssets !== next.audioAssets) return false;
  return true;
});

const StoryAssetPreview = ({
  item,
  compact = false,
  preferRemoteMediaUrl = false,
  onSetPrimaryMedia,
  onDeleteMedia,
}: {
  item: StoryboardAssetItem;
  compact?: boolean;
  preferRemoteMediaUrl?: boolean;
  onSetPrimaryMedia?: (mediaId: string) => void;
  onDeleteMedia?: (mediaId: string) => void;
}) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [variantObjectUrls, setVariantObjectUrls] = useState<Record<string, string>>(
    {},
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const mediaItems = getAssetMediaItems(item);
  const primaryMedia = mediaItems[0];
  const previewSource = primaryMedia
    ? {
        kind: item.kind,
        mediaType: primaryMedia.mediaType,
        mediaUrl: primaryMedia.mediaUrl,
        localPath: primaryMedia.localPath,
      }
    : item;
  const mediaType = getStoryAssetMediaType(previewSource);
  const remotePreviewUrl = primaryMedia?.mediaUrl || item.mediaUrl || "";
  const shouldUseRemoteThumbnail =
    mediaType === "image" &&
    isAliyunOssUrl(remotePreviewUrl) &&
    (preferRemoteMediaUrl || !objectUrl);
  // 稳定 OSS 图片优先走远程缩略图；第三方临时链接仍优先本地，避免过期或 404。
  const previewUrl =
    shouldUseRemoteThumbnail && remotePreviewUrl
      ? remotePreviewUrl
      : objectUrl || remotePreviewUrl;
  let displayUrl = previewUrl;
  if (shouldUseRemoteThumbnail && remotePreviewUrl) {
    try {
      displayUrl = getOssImageThumbnailUrl(remotePreviewUrl);
    } catch {
      // ignore
    }
  }

  const canOpenPreview =
    !compact && Boolean(previewUrl) && (mediaType === "image" || mediaType === "video");

  useEffect(() => {
    let active = true;
    let nextUrl: string | null = null;
    const primaryLocalPath = primaryMedia?.localPath || item.localPath;

    if (!primaryLocalPath) {
      setObjectUrl(null);
      return;
    }

    storyboardStorage.readObjectUrl(primaryLocalPath).then((url) => {
      if (!active) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      nextUrl = url;
      setObjectUrl(url);
    });

    return () => {
      active = false;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [item.localPath, primaryMedia?.localPath]);

  useEffect(() => {
    if (compact || mediaItems.length <= 1) {
      setVariantObjectUrls({});
      return;
    }

    let active = true;
    const createdUrls: string[] = [];

    const loadVariantUrls = async () => {
      const pairs = await Promise.all(
        mediaItems.map(async (media) => {
          if (!media.localPath) return [media.id, ""] as const;
          const url = await storyboardStorage.readObjectUrl(media.localPath);
          if (url) createdUrls.push(url);
          return [media.id, url || ""] as const;
        }),
      );

      if (!active) {
        createdUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      const next: Record<string, string> = {};
      for (const [id, url] of pairs) {
        if (url) next[id] = url;
      }
      setVariantObjectUrls(next);
    };

    void loadVariantUrls();

    return () => {
      active = false;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [
    compact,
    mediaItems
      .map((media) => `${media.id}:${media.localPath || media.mediaUrl || ""}`)
      .join("|"),
  ]);

  const previewContent =
    displayUrl && mediaType === "image" ? (
      <img
        src={displayUrl}
        alt={item.name || "资产预览"}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
    ) : displayUrl && mediaType === "video" ? (
      compact ? (
        <div className="flex h-full w-full items-center justify-center text-white/55">
          <Video size={18} />
        </div>
      ) : (
        <video
          src={displayUrl}
          className="h-full w-full object-cover"
          muted
          playsInline
          preload="metadata"
        />
      )
    ) : mediaType === "audio" ? (
      <div className="flex w-full flex-col items-center gap-3 px-3 text-white/55">
        <Music size={compact ? 18 : 24} />
        {previewUrl && !compact ? (
          <audio src={previewUrl} className="w-full" controls />
        ) : null}
      </div>
    ) : (
      <div className="flex flex-col items-center gap-2 text-xs text-white/35">
        <FileImage size={24} />
        未绑定预览
      </div>
    );

  const previewFrame = (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-lg border border-white/8 bg-black/35",
        compact ? "h-12 w-14" : "aspect-video w-full",
      )}
    >
      {primaryMedia && onDeleteMedia && !compact ? (
        <button
          type="button"
          className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-md border border-red-300/25 bg-black/70 text-red-100 shadow-lg backdrop-blur transition-colors hover:border-red-300/45 hover:bg-red-500/25"
          onClick={(event) => {
            event.stopPropagation();
            onDeleteMedia(primaryMedia.id);
          }}
          title="删除本张图片"
          aria-label="删除本张图片"
        >
          <Trash2 size={13} />
        </button>
      ) : null}
      {canOpenPreview ? (
        <button
          type="button"
          className="group h-full w-full cursor-zoom-in"
          onClick={() => setPreviewOpen(true)}
          aria-label="放大预览资产"
          title="点击放大预览"
        >
          {previewContent}
          <span className="pointer-events-none absolute bottom-2 right-2 rounded-md border border-white/10 bg-black/65 px-2 py-1 text-[11px] text-white/75 opacity-0 shadow-lg backdrop-blur transition-opacity group-hover:opacity-100">
            点击放大
          </span>
        </button>
      ) : (
        previewContent
      )}
      {previewOpen && canOpenPreview ? (
        <StoryAssetPreviewDialog
          title={item.name || "资产预览"}
          mediaType={mediaType as "image" | "video"}
          url={previewUrl}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </div>
  );

  if (compact) return previewFrame;

  return (
    <div className="space-y-2">
      {previewFrame}
      {mediaItems.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {mediaItems.map((media, index) => {
            const localThumbUrl = variantObjectUrls[media.id] || "";
            const remoteThumbUrl = media.mediaUrl || "";
            const thumbMediaType = getStoryAssetMediaType({
              kind: item.kind,
              mediaType: media.mediaType,
              mediaUrl: media.mediaUrl,
              localPath: media.localPath,
            });
            const shouldUseRemoteThumb =
              thumbMediaType === "image" && isAliyunOssUrl(remoteThumbUrl);
            let thumbUrl = shouldUseRemoteThumb
              ? remoteThumbUrl
              : localThumbUrl || remoteThumbUrl;
            if (shouldUseRemoteThumb && remoteThumbUrl) {
              try {
                thumbUrl = getOssImageThumbnailUrl(remoteThumbUrl);
              } catch {
                // fallback noop
              }
            }
            const isPrimary = index === 0;
            return (
              <div
                key={media.id}
                className={cn(
                  "relative h-12 w-16 shrink-0 overflow-hidden rounded-md border bg-black/40 transition-colors",
                  isPrimary
                    ? "border-[#B43FEB] ring-1 ring-[#B43FEB]/60"
                    : "border-white/10 hover:border-white/35",
                )}
              >
                <button
                  type="button"
                  className="block h-full w-full"
                  onClick={() => onSetPrimaryMedia?.(media.id)}
                  title={isPrimary ? "当前主图" : "设为主图"}
                  aria-label={isPrimary ? "当前主图" : "设为主图"}
                >
                  {thumbUrl && thumbMediaType === "image" ? (
                    <img
                      src={thumbUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : thumbUrl && thumbMediaType === "video" ? (
                    <video
                      src={thumbUrl}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/35">
                      <FileImage size={16} />
                    </div>
                  )}
                </button>
                {isPrimary ? (
                  <span className="absolute bottom-1 left-1 rounded bg-[#B43FEB]/90 px-1.5 py-0.5 text-[9px] text-white">
                    主图
                  </span>
                ) : null}
                {onDeleteMedia ? (
                  <button
                    type="button"
                    className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded border border-red-300/25 bg-black/70 text-red-100 shadow transition-colors hover:border-red-300/45 hover:bg-red-500/25"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteMedia(media.id);
                    }}
                    title="删除本张图片"
                    aria-label="删除本张图片"
                  >
                    <Trash2 size={10} />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

const StoryAssetPreviewDialog = ({
  title,
  mediaType,
  url,
  onClose,
}: {
  title: string;
  mediaType: "image" | "video";
  url: string;
  onClose: () => void;
}) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-6 backdrop-blur-md">
    <button
      type="button"
      aria-label="关闭预览"
      className="absolute inset-0 cursor-zoom-out"
      onClick={onClose}
    />
    <div className="relative z-10 flex max-h-[92vh] w-[min(1120px,94vw)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101012] shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <div className="min-w-0 truncate text-sm font-medium text-white/85">
          {title}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="关闭预览"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center bg-black p-3">
        {mediaType === "image" ? (
          <img
            src={url}
            alt={title}
            className="max-h-[82vh] max-w-full object-contain"
            decoding="async"
          />
        ) : (
          <video
            src={url}
            className="max-h-[82vh] max-w-full"
            controls
            autoPlay
            playsInline
          />
        )}
      </div>
    </div>
  </div>
);

const ScriptCategoryCombobox = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const filteredOptions = scriptCategoryOptions.filter((category) =>
    category.toLowerCase().includes(value.trim().toLowerCase()),
  );
  const optionsToShow =
    filteredOptions.length > 0 ? filteredOptions : scriptCategoryOptions;

  return (
    <div
      className="relative"
      tabIndex={-1}
      role="group"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <div className="relative">
        <input
          className={`${inputClass} pr-9`}
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          placeholder="选择或输入剧本分类"
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-white/45 transition-colors hover:bg-white/10 hover:text-white"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((current) => !current)}
          aria-label="展开剧本分类"
        >
          <ChevronDown size={15} />
        </button>
      </div>
      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-lg border border-white/10 bg-[#151517] p-1 shadow-xl">
          {optionsToShow.map((category) => (
            <button
              key={category}
              type="button"
              className={cn(
                "flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors",
                value === category
                  ? "bg-[#B43FEB]/15 text-[#E9C7FF]"
                  : "text-white/70 hover:bg-white/[0.06] hover:text-white",
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(category);
                setOpen(false);
              }}
            >
              {category}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const StorySubtitleRemovalDialog = ({
  shot,
  open,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  shot: StoryboardShot;
  open: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (rect: WuhenRect, requiredPoints: number) => Promise<void> | void;
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playButtonRef = useRef<HTMLButtonElement | null>(null);
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    startRect: ViewportRect;
  } | null>(null);
  const { pointsEnabled, totalPoints, ensureEnoughPoints, refreshBalanceInfo } =
    useGenerationPoints();

  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoSize, setVideoSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [viewportSize, setViewportSize] = useState(getViewportSize);
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [videoBounds, setVideoBounds] = useState<ViewportRect | null>(null);
  const [cropRect, setCropRect] = useState<ViewportRect | null>(null);

  const videoUrl = objectUrl || shot.video?.url || "";
  const workspaceFrame = useMemo(
    () =>
      getFittedWorkspaceFrame(
        videoSize,
        Math.min(viewportSize.width - 96, 960),
        Math.min(viewportSize.height - 420, 560),
      ),
    [videoSize, viewportSize.height, viewportSize.width],
  );
  const dialogWidth = useMemo(
    () =>
      Math.max(
        460,
        Math.min(viewportSize.width - 32, workspaceFrame.width + 40),
      ),
    [viewportSize.width, workspaceFrame.width],
  );
  const requiredPoints = useMemo(() => {
    if (!Number.isFinite(duration) || duration <= 0) {
      return 0;
    }
    return Math.max(
      1,
      Math.ceil(duration * SUBTITLE_REMOVAL_POINTS_PER_SECOND),
    );
  }, [duration]);

  useEffect(() => {
    let active = true;
    let nextUrl: string | null = null;

    if (!shot.video?.localPath) {
      setObjectUrl(null);
      return;
    }

    storyboardStorage.readObjectUrl(shot.video.localPath).then((url) => {
      if (!active) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      nextUrl = url;
      setObjectUrl(url);
    });

    return () => {
      active = false;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [shot.video?.localPath]);

  const seekTo = useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (!video) return;
      const maxTime = Number.isFinite(video.duration)
        ? video.duration
        : duration;
      const nextTime = clamp(time, 0, maxTime || 0);
      video.currentTime = nextTime;
      setCurrentTime(nextTime);
    },
    [duration],
  );

  const stepFrame = useCallback(
    (direction: 1 | -1) => {
      const video = videoRef.current;
      if (!video) return;
      if (!video.paused) {
        video.pause();
        setIsPlaying(false);
      }
      seekTo(video.currentTime + direction * FRAME_STEP_SECONDS);
      if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) {
        video.requestVideoFrameCallback(() => {
          setCurrentTime(video.currentTime);
        });
      }
    },
    [seekTo],
  );

  const togglePlayback = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      try {
        await video.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
      return;
    }
    video.pause();
    setIsPlaying(false);
  }, []);

  const syncVideoBounds = useCallback(() => {
    if (!viewportRef.current || !videoRef.current) return;

    const viewport = viewportRef.current.getBoundingClientRect();
    const container = {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
    };
    setContainerSize({ width: viewport.width, height: viewport.height });

    const contained = computeContainedRect(
      container,
      videoRef.current.videoWidth || 0,
      videoRef.current.videoHeight || 0,
    );
    setVideoBounds(contained);

    setCropRect((prev) => {
      if (!prev) {
        const initial = buildDefaultSubtitleRect(contained);
        return {
          x: contained.x + initial.x,
          y: contained.y + initial.y,
          width: initial.width,
          height: initial.height,
        };
      }

      if (!videoBounds || videoBounds.width <= 0 || videoBounds.height <= 0) {
        const fallback = buildDefaultSubtitleRect(contained);
        return {
          x: contained.x + fallback.x,
          y: contained.y + fallback.y,
          width: fallback.width,
          height: fallback.height,
        };
      }

      const nx = (prev.x - videoBounds.x) / videoBounds.width;
      const ny = (prev.y - videoBounds.y) / videoBounds.height;
      const nw = prev.width / videoBounds.width;
      const nh = prev.height / videoBounds.height;
      const nextWidth = clamp(nw * contained.width, 24, contained.width);
      const nextHeight = clamp(nh * contained.height, 24, contained.height);

      return {
        x: clamp(
          contained.x + nx * contained.width,
          contained.x,
          contained.x + contained.width - nextWidth,
        ),
        y: clamp(
          contained.y + ny * contained.height,
          contained.y,
          contained.y + contained.height - nextHeight,
        ),
        width: nextWidth,
        height: nextHeight,
      };
    });
  }, [videoBounds?.height, videoBounds?.width]);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !videoBounds) return;

      const minSize = 24;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const start = drag.startRect;
      const next: ViewportRect = { ...start };

      if (drag.mode === "move") {
        next.x = clamp(
          start.x + dx,
          videoBounds.x,
          videoBounds.x + videoBounds.width - start.width,
        );
        next.y = clamp(
          start.y + dy,
          videoBounds.y,
          videoBounds.y + videoBounds.height - start.height,
        );
        setCropRect(next);
        return;
      }

      if (drag.mode.includes("e")) {
        next.width = clamp(
          start.width + dx,
          minSize,
          videoBounds.x + videoBounds.width - start.x,
        );
      }
      if (drag.mode.includes("s")) {
        next.height = clamp(
          start.height + dy,
          minSize,
          videoBounds.y + videoBounds.height - start.y,
        );
      }
      if (drag.mode.includes("w")) {
        const nextX = clamp(
          start.x + dx,
          videoBounds.x,
          start.x + start.width - minSize,
        );
        next.width = start.width - (nextX - start.x);
        next.x = nextX;
      }
      if (drag.mode.includes("n")) {
        const nextY = clamp(
          start.y + dy,
          videoBounds.y,
          start.y + start.height - minSize,
        );
        next.height = start.height - (nextY - start.y);
        next.y = nextY;
      }

      next.width = clamp(
        next.width,
        minSize,
        videoBounds.x + videoBounds.width - next.x,
      );
      next.height = clamp(
        next.height,
        minSize,
        videoBounds.y + videoBounds.height - next.y,
      );
      setCropRect(next);
    },
    [videoBounds],
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }, [handlePointerMove]);

  const startDrag = useCallback(
    (mode: DragMode, event: React.PointerEvent<HTMLDivElement>) => {
      if (!cropRect) return;
      event.preventDefault();
      event.stopPropagation();

      dragRef.current = {
        mode,
        startX: event.clientX,
        startY: event.clientY,
        startRect: cropRect,
      };
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [cropRect, handlePointerMove, handlePointerUp],
  );

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  useEffect(() => {
    if (!open) {
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
      setIsPlaying(false);
      return;
    }
    setIsReady(false);
    setVideoSize(null);
    setVideoBounds(null);
    setCropRect(null);
    setDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
  }, [open, videoUrl]);

  useEffect(() => {
    if (open) {
      void refreshBalanceInfo();
      const timer = window.setTimeout(() => {
        playButtonRef.current?.focus();
      }, 50);
      return () => window.clearTimeout(timer);
    }
  }, [open, refreshBalanceInfo]);

  useEffect(() => {
    if (!open) return;
    const handleResize = () => {
      setViewportSize(getViewportSize());
      syncVideoBounds();
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [open, syncVideoBounds]);

  useEffect(() => {
    if (!open) return;
    const target = viewportRef.current;
    if (!target) return;

    let rafId = 0;
    const schedule = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        syncVideoBounds();
      });
    };

    schedule();
    const observer = new ResizeObserver(() => {
      schedule();
    });
    observer.observe(target);

    return () => {
      observer.disconnect();
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [open, syncVideoBounds]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (event.code === "Space" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        if (!isReady || isSubmitting) return;
        void togglePlayback();
        return;
      }

      if (target?.closest("[data-slot='slider']")) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        seekTo(currentTime - TIMELINE_STEP_MS / 1000);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        seekTo(currentTime + TIMELINE_STEP_MS / 1000);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentTime, isReady, isSubmitting, open, seekTo, togglePlayback]);

  const handleSend = useCallback(async () => {
    if (!videoBounds || !cropRect || !videoSize) return;

    if (
      !ensureEnoughPoints({
        requiredPoints,
        actionLabel: "去字幕",
        warning: toast.warning,
      })
    ) {
      return;
    }

    const scaleX = videoSize.width / videoBounds.width;
    const scaleY = videoSize.height / videoBounds.height;
    const rect: WuhenRect = {
      x1: Math.round((cropRect.x - videoBounds.x) * scaleX),
      y1: Math.round((cropRect.y - videoBounds.y) * scaleY),
      x2: Math.round((cropRect.x - videoBounds.x + cropRect.width) * scaleX),
      y2: Math.round((cropRect.y - videoBounds.y + cropRect.height) * scaleY),
    };
    const area = Math.max(0, rect.x2 - rect.x1) * Math.max(0, rect.y2 - rect.y1);
    if (area > WUHEI_MAX_RECT_AREA) {
      toast.warning(
        `选区过大（${area}），无痕AI 限制面积 <= ${WUHEI_MAX_RECT_AREA} 像素`,
      );
      return;
    }

    await onSubmit(rect, requiredPoints);
  }, [
    cropRect,
    ensureEnoughPoints,
    onSubmit,
    requiredPoints,
    videoBounds,
    videoSize,
  ]);

  if (!open) return null;

  const handleConfig = [
    { mode: "nw", className: "-left-2 -top-2 cursor-nwse-resize" },
    { mode: "n", className: "left-1/2 -top-2 -translate-x-1/2 cursor-ns-resize" },
    { mode: "ne", className: "-right-2 -top-2 cursor-nesw-resize" },
    { mode: "e", className: "-right-2 top-1/2 -translate-y-1/2 cursor-ew-resize" },
    { mode: "se", className: "-right-2 -bottom-2 cursor-nwse-resize" },
    { mode: "s", className: "left-1/2 -bottom-2 -translate-x-1/2 cursor-ns-resize" },
    { mode: "sw", className: "-left-2 -bottom-2 cursor-nesw-resize" },
    { mode: "w", className: "-left-2 top-1/2 -translate-y-1/2 cursor-ew-resize" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="关闭去字幕面板"
        className="absolute inset-0 cursor-default"
        onClick={() => {
          if (!isSubmitting) onClose();
        }}
      />
      <div
        className="relative z-10 flex max-h-[92vh] max-w-[96vw] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121214] text-white shadow-2xl"
        style={{ width: `${dialogWidth}px` }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/5 bg-[#18181b] px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-medium text-white/90">
            <Eraser size={18} />
            去字幕
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/55 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col bg-[#18181b]">
          <div className="flex min-h-0 flex-1 flex-col gap-5 p-5">
            <div className="flex justify-center">
              <div
                ref={viewportRef}
                className="relative overflow-hidden rounded-xl border border-white/8 bg-black"
                style={{
                  width: `${workspaceFrame.width}px`,
                  height: `${workspaceFrame.height}px`,
                }}
              >
                <VideoPlayer
                  ref={videoRef}
                  src={videoUrl}
                  containerClassName="h-full w-full rounded-none bg-black"
                  videoClassName="h-full w-full object-contain"
                  showDefaultControls={false}
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={(event) => {
                    const w = event.currentTarget.videoWidth || 0;
                    const h = event.currentTarget.videoHeight || 0;
                    setVideoSize({ width: w, height: h });
                    setDuration(event.currentTarget.duration || 0);
                    setCurrentTime(event.currentTarget.currentTime || 0);
                    setIsReady(true);
                    window.requestAnimationFrame(() => {
                      window.requestAnimationFrame(() => {
                        syncVideoBounds();
                      });
                    });
                  }}
                  onTimeUpdate={(event) => {
                    setCurrentTime(event.currentTarget.currentTime || 0);
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />

                {videoBounds && cropRect ? (
                  <div
                    className="absolute border border-white/90 bg-white/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                    style={{
                      left: cropRect.x,
                      top: cropRect.y,
                      width: cropRect.width,
                      height: cropRect.height,
                    }}
                    onPointerDown={(event) => startDrag("move", event)}
                  >
                    {handleConfig.map((item) => (
                      <div
                        key={item.mode}
                        className={`absolute h-4 w-4 rounded-full border border-white bg-[#B43FEB] ${item.className}`}
                        onPointerDown={(event) =>
                          startDrag(item.mode as DragMode, event)
                        }
                      />
                    ))}
                  </div>
                ) : null}

                {containerSize && videoBounds ? (
                  <>
                    <div
                      className="pointer-events-none absolute left-0 top-0 bg-black/55"
                      style={{
                        width: containerSize.width,
                        height: Math.max(0, videoBounds.y),
                      }}
                    />
                    <div
                      className="pointer-events-none absolute left-0 bg-black/55"
                      style={{
                        top: videoBounds.y + videoBounds.height,
                        width: containerSize.width,
                        height: Math.max(
                          0,
                          containerSize.height -
                            (videoBounds.y + videoBounds.height),
                        ),
                      }}
                    />
                    <div
                      className="pointer-events-none absolute top-0 bg-black/55"
                      style={{
                        left: 0,
                        top: videoBounds.y,
                        width: Math.max(0, videoBounds.x),
                        height: videoBounds.height,
                      }}
                    />
                    <div
                      className="pointer-events-none absolute top-0 bg-black/55"
                      style={{
                        left: videoBounds.x + videoBounds.width,
                        top: videoBounds.y,
                        width: Math.max(
                          0,
                          containerSize.width -
                            (videoBounds.x + videoBounds.width),
                        ),
                        height: videoBounds.height,
                      }}
                    />
                  </>
                ) : null}
              </div>
            </div>

            <VideoTimeline
              disabled={!isReady || isSubmitting}
              currentTimeMs={Math.round(currentTime * 1000)}
              durationMs={Math.round(duration * 1000)}
              stepMs={TIMELINE_STEP_MS}
              onSeek={(nextTimeMs) => {
                seekTo(nextTimeMs / 1000);
              }}
            />

            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => stepFrame(-1)}
                disabled={!isReady || isSubmitting}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#27272a] text-white/75 hover:bg-[#3f3f46] hover:text-[#B43FEB] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="快退"
              >
                <SkipBack size={18} />
              </button>
              <button
                ref={playButtonRef}
                type="button"
                onClick={() => void togglePlayback()}
                disabled={!isReady || isSubmitting}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-[#B43FEB] text-white shadow-lg shadow-[#B43FEB]/20 hover:bg-[#B43FEB]/90 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={isPlaying ? "暂停" : "播放"}
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <button
                type="button"
                onClick={() => stepFrame(1)}
                disabled={!isReady || isSubmitting}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#27272a] text-white/75 hover:bg-[#3f3f46] hover:text-[#B43FEB] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="快进"
              >
                <SkipForward size={18} />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-white/50">
                {isReady
                  ? `视频时长 ${formatDuration(duration)}（${Math.ceil(duration)} 秒）`
                  : "读取视频时长中..."}
                {pointsEnabled
                  ? ` · 单价 ${SUBTITLE_REMOVAL_POINTS_PER_SECOND} 积分/秒`
                  : ""}
              </div>
              {pointsEnabled ? (
                <ModelPointsBadge
                  totalPoints={totalPoints}
                  requiredPoints={requiredPoints}
                  title={
                    isReady
                      ? `预计消耗 ${requiredPoints} 积分（${SUBTITLE_REMOVAL_POINTS_PER_SECOND} 积分/秒，时长 ${formatDuration(duration)}），当前余额 ${totalPoints}`
                      : `预计消耗 ${requiredPoints} 积分，当前余额 ${totalPoints}`
                  }
                />
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-white/5 bg-[#18181b] px-5 py-4">
            <Button onClick={onClose} disabled={isSubmitting}>
              取消
            </Button>
            <Button
              variant="blue"
              onClick={() => void handleSend()}
              disabled={
                !isReady ||
                isSubmitting ||
                (pointsEnabled && requiredPoints <= 0)
              }
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Eraser size={14} />
              )}
              {isSubmitting ? "处理中..." : "发送并生成新视频"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const StoryAgentPage = ({
  projectId,
  snippetId,
}: {
  projectId: string;
  snippetId: string;
}) => {
  const settings = useChatSettingsStore();
  const [agent, setAgent] = useState<StoryboardAgentData>(
    createEmptyAgentData(),
  );
  const [activeStep, setActiveStep] = useState<StoryboardAgentStep>("script");
  const [editingShot, setEditingShot] = useState<StoryboardShot | null>(null);
  const [removingSubtitleShot, setRemovingSubtitleShot] =
    useState<StoryboardShot | null>(null);
  const [editingShotModel, setEditingShotModel] = useState<StoryboardShot | null>(
    null,
  );
  const [editingSystemPrompt, setEditingSystemPrompt] =
    useState<StorySystemPromptTarget | null>(null);
  const [editingRolePromptAffix, setEditingRolePromptAffix] = useState(false);
  const [editingShotPromptAffix, setEditingShotPromptAffix] = useState(false);
  const [nextConfirmTarget, setNextConfirmTarget] =
    useState<StoryNextConfirmTarget | null>(null);
  const [bulkGenerateConfirmKind, setBulkGenerateConfirmKind] =
    useState<StoryboardAssetKind | null>(null);
  const [selectingAssetShotId, setSelectingAssetShotId] = useState<string | null>(
    null,
  );
  const [selectingAssetDetailTarget, setSelectingAssetDetailTarget] =
    useState<{ kind: StoryboardAssetKind; id: string } | null>(null);
  const [selectingAudioBindTarget, setSelectingAudioBindTarget] =
    useState<{ kind: StoryboardAssetKind; id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [splitting, setSplitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportingJianying, setExportingJianying] = useState(false);
  const [bulkGeneratingKind, setBulkGeneratingKind] =
    useState<StoryboardAssetKind | null>(null);
  const [removingSubtitleShotId, setRemovingSubtitleShotId] = useState<
    string | null
  >(null);
  const agentRef = useRef(agent);

  useEffect(() => {
    agentRef.current = agent;
  }, [agent]);

  const assetCallbacksRef = useRef<Record<string, any>>({});

  const defaults = useMemo<StoryboardShot["modelInfo"]>(
    () => ({
      imageModel: settings.defaultImageModel,
      videoModel: STORY_SHOT_DEFAULT_VIDEO_MODEL,
      aspectRatio:
        settings.defaultNewVideoAspectRatio || settings.defaultVideoAspectRatio,
      duration:
        settings.defaultNewVideoDuration || settings.defaultVideoDuration || 15,
      resolution:
        settings.defaultNewVideoResolution || settings.defaultVideoResolution,
    }),
    [
      settings.defaultImageModel,
      settings.defaultNewVideoAspectRatio,
      settings.defaultVideoAspectRatio,
      settings.defaultNewVideoDuration,
      settings.defaultVideoDuration,
      settings.defaultNewVideoResolution,
      settings.defaultVideoResolution,
    ],
  );

  const visibleImageModels = useMemo(
    () =>
      getVisibleImageModels(
        settings.adobeChannelModelsEnabled,
        settings.ximuChannelModelsEnabled,
        settings.grokChannelModelsEnabled,
      ),
    [
      settings.adobeChannelModelsEnabled,
      settings.grokChannelModelsEnabled,
      settings.ximuChannelModelsEnabled,
    ],
  );

  const saveAgent = useCallback(
    async (next: StoryboardAgentData) => {
      const normalizedNext = migrateStoryShotVideoModels(next);
      agentRef.current = normalizedNext;
      setAgent(normalizedNext);
      setSaving(true);
      try {
        await storyboardStorage.saveProjectAssets(
          projectId,
          normalizedNext.assets,
        );
        await storyboardStorage.saveAgentData(
          projectId,
          snippetId,
          normalizedNext,
        );
      } catch (error) {
        console.error("[Story] save agent failed", error);
        toast.error("保存剧本 Agent 失败");
      } finally {
        setSaving(false);
      }
    },
    [projectId, snippetId],
  );
  const saveAgentSilently = useCallback(
    async (next: StoryboardAgentData) => {
      const normalizedNext = migrateStoryShotVideoModels(next);
      try {
        setSaving(true);
        await storyboardStorage.saveProjectAssets(
          projectId,
          normalizedNext.assets,
        );
        await storyboardStorage.saveAgentData(
          projectId,
          snippetId,
          normalizedNext,
        );
      } catch (error) {
        console.error("[Story] auto save agent failed", error);
        toast.error("自动保存剧本 Agent 失败");
      } finally {
        setSaving(false);
      }
    },
    [projectId, snippetId],
  );
  const skipAutoSaveRef = useRef(true);
  const saveAgentDebouncedRef = useRef<any>(null);
  useEffect(() => {
    if (!saveAgentDebouncedRef.current) {
      saveAgentDebouncedRef.current = debounce((next: StoryboardAgentData) => {
        void saveAgentSilently(next);
      }, 1000);
    }
    if (loading) return;
    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false;
      return;
    }
    saveAgentDebouncedRef.current(agentRef.current);
    return () => {
      saveAgentDebouncedRef.current?.cancel?.();
    };
  }, [agent, loading, saveAgentSilently]);
  useEffect(() => {
    skipAutoSaveRef.current = true;
    let cancelled = false;
    setLoading(true);

    const loadAgent = async () => {
      try {
        const sharedAssets = await storyboardStorage.ensureProjectAssets(projectId);
        const data = await storyboardStorage.loadAgentData(projectId, snippetId);
        const needsMigration = hasStoryShotVideoModelMigration(data);
        const next = normalizeAgentData({
          ...data,
          assets: sharedAssets,
        });
        if (cancelled) return;
        setAgent(next);
        agentRef.current = next;
        setActiveStep(next.unlockedStep);
        if (needsMigration) {
          void storyboardStorage.saveAgentData(projectId, snippetId, next);
        }
      } catch (error) {
        console.error("[Story] load agent failed", error);
        toast.error("读取剧本 Agent 失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadAgent();

    return () => {
      cancelled = true;
    };
  }, [projectId, snippetId]);

  const patchAgent = useCallback((patch: Partial<StoryboardAgentData>) => {
    setAgent((current) => {
      const next = { ...current, ...patch };
      agentRef.current = next;
      return next;
    });
  }, []);

  const persistCurrent = () => saveAgent(agent);

  // 生成自动资产说明区块（图片/音色），插入提示词最前面
  // 匹配纯文本和 HTML 中的自动资产说明区块
  const AUTO_DESC_BLOCK_RE = /^\[自动资产说明\][\s\S]*?\[\/自动资产说明\]\n*/;
  const AUTO_DESC_HTML_BLOCK_RE = /\[自动资产说明\][\s\S]*?\[\/自动资产说明\](?:<br>)?/;

  /**
   * 为单个分镜生成自动资产说明并更新 prompt / promptDraftHtml
   * HTML 中生成与 @ 一致的全量 span 结构，Tiptap 可直接解析
   */
  const applyAutoDescToShot = (
    shot: StoryboardShot,
    allAssets: StoryboardAssets,
  ): StoryboardShot => {
    // 收集 assets 完整信息
    const assetInfoMap = new Map<
      string,
      { id: string; name: string; thumbnail: string; kind: string }
    >();
    for (const kind of ["role", "scene", "prop", "audio"] as const) {
      for (const item of allAssets[kind] || []) {
        if (!item.name) continue;
        const primary = getPrimaryAssetMediaItem(item);
        const thumbnail = primary?.mediaUrl || item.mediaUrl || "";
        const isAudio = kind === "audio" || item.mediaType === "audio";
        assetInfoMap.set(item.id, {
          id: item.id,
          name: item.name.trim(),
          thumbnail,
          kind: isAudio ? "audio" : "image",
        });
      }
    }

    const mentionPairs = shot.assetIds
      .map((id) => assetInfoMap.get(id))
      .filter(Boolean) as {
      id: string;
      name: string;
      thumbnail: string;
      kind: string;
    }[];

    // 剥离旧区块
    const basePrompt = shot.prompt.replace(AUTO_DESC_BLOCK_RE, "");
    const cleanedHtml = (shot.promptDraftHtml || "").replace(
      AUTO_DESC_HTML_BLOCK_RE,
      "",
    );
    const baseHtml = cleanedHtml.trim()
      ? cleanedHtml
      : buildPromptDraftHtml(undefined, basePrompt);

    if (mentionPairs.length === 0) {
      if (basePrompt === shot.prompt && baseHtml === (shot.promptDraftHtml || ""))
        return shot;
      return {
        ...shot,
        prompt: basePrompt,
        promptDraftHtml: baseHtml === "<p></p>" ? undefined : baseHtml,
      };
    }

    // 纯文本
    const textBlock = `[自动资产说明]\n${mentionPairs.map((m) => `@${m.name}`).join("\n")}\n[/自动资产说明]\n`;
    const nextPrompt = `${textBlock}${basePrompt}`;

    // HTML 区块（与 Tiptap Mention renderHTML 完全一致）
    const mentionHtmlLines = mentionPairs.map((m) => {
      const dataAttrs = [
        `data-type="mention"`,
        `data-id="${m.id}"`,
        `data-label="${m.name}"`,
        `data-mention-suggestion-char="@"`,
        `data-mention-id="${m.id}"`,
        `data-mention-label="${m.name}"`,
        `data-mention-kind="${m.kind}"`,
        m.thumbnail ? `data-thumbnail="${m.thumbnail}"` : "",
        `contenteditable="false"`,
        `draggable="true"`,
      ]
        .filter(Boolean)
        .join(" ");

      let innerHtml: string;
      if (m.kind === "audio") {
        innerHtml = `🎵 ${m.name}`;
      } else if (m.thumbnail) {
        innerHtml = `<img class="video-node-mention-pill__thumbnail" src="${m.thumbnail}" alt="${m.name}" draggable="false"><span class="video-node-mention-pill__label">${m.name}</span>`;
      } else {
        innerHtml = m.name;
      }

      return `<span class="video-node-mention-pill" ${dataAttrs}>${innerHtml}</span>`;
    });

    const htmlBlock = `[自动资产说明]<br>${mentionHtmlLines.map((line, i) => `${line}是${mentionPairs[i].name}`).join("<br>")}<br>[/自动资产说明]<br>`;
    const nextHtml = `${htmlBlock}${baseHtml}`;

    if (nextPrompt === shot.prompt && nextHtml === (shot.promptDraftHtml || ""))
      return shot;
    return { ...shot, prompt: nextPrompt, promptDraftHtml: nextHtml };
  };

  const saveAgentWithStep = async (
    nextAgent: StoryboardAgentData,
    nextStep: StoryboardAgentStep,
  ) => {
    const unlockedStep = getLaterStep(nextAgent.unlockedStep, nextStep);
    const withStep = { ...nextAgent, unlockedStep };
    await saveAgent(withStep);
    setActiveStep(nextStep);
  };

  const selectStep = (step: StoryboardAgentStep) => {
    if (!isStepUnlocked(step, agent.unlockedStep)) {
      return;
    }
    setActiveStep(step);
  };

  const addAsset = (kind: StoryboardAssetKind) => {
    patchAgent({
      assets: {
        ...agent.assets,
        [kind]: [
          ...agent.assets[kind],
          {
            id: createId(`asset_${kind}`),
            kind,
            name: "",
            prompt: "",
            source: "upload",
            status: "idle",
          },
        ],
      },
    });
  };

  const updateAsset = useCallback(
    (
      kind: StoryboardAssetKind,
      id: string,
      patch: Partial<StoryboardAssetItem>,
    ) => {
      setAgent((current) => {
        const next = {
          ...current,
          assets: {
            ...current.assets,
            [kind]: current.assets[kind].map((item) =>
              item.id === id ? { ...item, ...patch } : item,
            ),
          },
        } as StoryboardAgentData;
        agentRef.current = next;
        return next;
      });
    },
    [],
  );

  const patchAssetState = (
    kind: StoryboardAssetKind,
    id: string,
    patch: Partial<StoryboardAssetItem>,
  ) => {
    setAgent((current) => {
      const next = {
        ...current,
        assets: {
          ...current.assets,
          [kind]: current.assets[kind].map((item) =>
            item.id === id ? { ...item, ...patch } : item,
          ),
        },
      };
      agentRef.current = next;
      return next;
    });
  };

  const setAssetPrimaryMediaById = (
    kind: StoryboardAssetKind,
    id: string,
    mediaId: string,
  ) => {
    const currentAgent = agentRef.current;
    const nextAssets = {
      ...currentAgent.assets,
      [kind]: currentAgent.assets[kind].map((item) =>
        item.id === id ? setAssetPrimaryMedia(item, mediaId) : item,
      ),
    };
    void saveAgent({
      ...currentAgent,
      assets: nextAssets,
    });
  };

  const deleteAssetMediaById = (
    kind: StoryboardAssetKind,
    id: string,
    mediaId: string,
  ) => {
    const currentAgent = agentRef.current;
    const nextAssets = {
      ...currentAgent.assets,
      [kind]: currentAgent.assets[kind].map((item) =>
        item.id === id ? deleteAssetMediaItem(item, mediaId) : item,
      ),
    };
    void saveAgent({
      ...currentAgent,
      assets: nextAssets,
    });
  };

  const deleteAsset = (kind: StoryboardAssetKind, id: string) => {
    const currentAgent = agentRef.current;
    const nextAssets = {
      ...currentAgent.assets,
      [kind]: currentAgent.assets[kind].filter((item) => item.id !== id),
    };
    if (kind === "audio") {
      for (const assetKind of ["role", "scene", "prop"] as const) {
        nextAssets[assetKind] = nextAssets[assetKind].map((item) => ({
          ...item,
          audioAssetIds: item.audioAssetIds?.filter((assetId) => assetId !== id),
        }));
      }
    }
    delete assetCallbacksRef.current[id];
    void saveAgent({
      ...currentAgent,
      assets: nextAssets,
      shots: currentAgent.shots.map((shot) =>
        applyAutoDescToShot(
          {
            ...shot,
            assetIds: shot.assetIds.filter((assetId) => assetId !== id),
          },
          nextAssets,
        ),
      ),
    });
    toast.success("资产已删除");
  };

  const saveAssetPatch = async (
    kind: StoryboardAssetKind,
    id: string,
    patch: Partial<StoryboardAssetItem>,
  ) => {
    const currentAgent = agentRef.current;
    const nextAgent = {
      ...currentAgent,
      assets: {
        ...currentAgent.assets,
        [kind]: currentAgent.assets[kind].map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      },
    };
    await saveAgent(nextAgent);
  };

  const uploadAsset = async (
    kind: StoryboardAssetKind,
    id: string,
    file: File,
  ) => {
    const extension = getFileExtension(file, kind === "audio" ? "mp3" : "png");
    const mediaId = createAssetMediaId("upload_media");
    const localPath = `storyboard/projects/${projectId}/assets/${kind}/${mediaId}.${extension}`;
    try {
      await storyboardStorage.saveBinary(localPath, await file.arrayBuffer());
      const currentAgent = agentRef.current;
      const currentList = currentAgent.assets[kind] || [];
      const target = currentList.find((item) => item.id === id);
      if (!target) {
        toast.error("当前资产项不存在");
        return false;
      }
      // 上传到 OSS（如果可行），并把 OSS 地址写入 mediaUrl
      let ossUrl = "";
      try {
        ossUrl = await ensureStoryboardLocalMediaOssUrl({
          ...target,
          localPath,
          mediaType: getMediaTypeFromFile(file),
        } as StoryboardAssetItem);
      } catch (e) {
        console.warn("[Story] ensureStoryboardLocalMediaOssUrl failed", e);
      }

      const mediaItem: StoryboardAssetMediaItem = {
        id: mediaId,
        source: "upload",
        mediaType: getMediaTypeFromFile(file),
        localPath,
        mediaUrl: ossUrl || undefined,
        name: file.name,
        createdAt: Date.now(),
      };

      const nextAsset = appendAssetMediaItem(
        {
          ...target,
          name: target.name || file.name,
        },
        mediaItem,
      );

      await saveAgent({
        ...currentAgent,
        assets: {
          ...currentAgent.assets,
          [kind]: currentList.map((item) => (item.id === id ? nextAsset : item)),
        },
      });

      toast.success("资产已上传");
    } catch (error) {
      console.error("[Story] upload asset failed", error);
      toast.error("上传资产失败");
    }
  };

  const pollStoryImageTask = async (taskId: string) => {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await wait(4000);
      const response = await getImageTaskStatus(taskId);
      const responseData = response?.data ?? response;
      const status =
        responseData?.status ??
        responseData?.result?.status ??
        response?.data?.status ??
        response?.result?.status ??
        response?.status;

      if (isImageSuccessStatus(status)) {
        const imageUrl = extractImageTaskUrl(response);
        if (!imageUrl) {
          throw new Error("image task completed but missing result url");
        }
        return imageUrl;
      }

      if (isImageFailureStatus(status)) {
        throw new Error(
          response?.message ||
            response?.data?.message ||
            response?.result?.message ||
            "image generation failed",
        );
      }
    }

    throw new Error("image generation timeout");
  };

  const waitForStoryXimuImageResult = async (taskId: string) => {
    let lastStatus = "";
    let lastMessage = "";

    for (let attempt = 0; attempt < 60; attempt += 1) {
      await wait(5000);
      const response = await getXimuImageResult(taskId);
      const payload = getXimuResultPayload(response);
      const status = String(payload.status || response?.status || "").toLowerCase();
      lastStatus = status || lastStatus;
      lastMessage = getXimuMessage(response) || lastMessage;

      if (XIMU_TASK_FAILED_STATUSES.includes(status as any)) {
        throw new Error(lastMessage || "西牧生图失败");
      }

      const urls = collectXimuImageUrls(payload);
      if (
        urls.length > 0 &&
        (!status || XIMU_TASK_SUCCESS_STATUSES.includes(status as any))
      ) {
        return urls[0];
      }

      if (XIMU_TASK_SUCCESS_STATUSES.includes(status as any)) {
        throw new Error("西牧生图已完成，但没有返回图片地址");
      }
    }

    throw new Error(
      lastStatus
        ? `西牧生图超时：${lastStatus}${lastMessage ? `，${lastMessage}` : ""}`
        : "西牧生图超时",
    );
  };

  const createStoryAssetImage = async (input: {
    model: string;
    prompt: string;
    aspectRatio: string;
    resolution?: string;
  }) => {
    if (isAdobeImageGenerationModel(input.model)) {
      const adobeModel = resolveAdobeStoryImageModel(
        input.model,
        input.aspectRatio,
        input.resolution,
      );
      if (!adobeModel) {
        throw new Error("不支持的 Adobe 图片模型");
      }
      const response = await createAdobe2ApiImageGeneration({
        model: adobeModel as any,
        prompt: input.prompt,
        response_format: "url",
      });
      const url = getDirectImageUrl(response);
      if (!url) throw new Error("Adobe2API 未返回图片地址");
      return url;
    }

    if (isXimuImageGenerationModel(input.model)) {
      const ximuModel = resolveXimuStoryImageModel(input.model);
      if (!ximuModel) {
        throw new Error("不支持的西牧图片模型");
      }
      const cardCode = settings.ximuCardCode.trim();
      if (!cardCode) {
        throw new Error("请先在模型管理的西牧渠道填写卡密");
      }
      const request = isXimuGptImageGenerationModel(input.model)
        ? buildXimuGptImageRequest({
            model: ximuModel as any,
            cardCode,
            prompt: input.prompt,
            aspectRatio: resolveXimuGptAspectRatio({
              model: ximuModel as any,
              size: input.aspectRatio,
              resolution: input.resolution || "1K",
            }),
            urls: [],
          })
        : buildXimuNanoBananaRequest({
            model: ximuModel as any,
            cardCode,
            prompt: input.prompt,
            aspectRatio:
              input.model === XIMU_NANO_BANANA2_MODEL
                ? resolveXimuNanoBanana2AspectRatio(input.aspectRatio)
                : resolveXimuNanoBananaProAspectRatio(input.aspectRatio),
            imageSize: resolveXimuImageSize(input.resolution || "2K"),
            urls: [],
          });
      const response = isXimuGptImageGenerationModel(input.model)
        ? await createXimuGptImageGeneration(request as any)
        : await createXimuNanoBananaGeneration(request as any);
      const taskId = extractXimuTaskId(response);
      if (!taskId) {
        throw new Error("西牧渠道未返回任务 ID");
      }
      return waitForStoryXimuImageResult(taskId);
    }

    if (isGrokImageGenerationModel(input.model)) {
      const grokModel = resolveGrokStoryImageModel(input.model);
      if (!grokModel) {
        throw new Error("不支持的 Grok 图片模型");
      }
      const response = await createGrok2ApiImageGeneration({
        model: grokModel as any,
        prompt: input.prompt,
        n: 1,
        size: resolveGrokStoryImageSize(input.aspectRatio),
        response_format: "url",
      });
      const url = getDirectImageUrl(response);
      if (!url) throw new Error("Grok2API 未返回图片地址");
      return url;
    }

    const response: any = await createImageGeneration({
      model: input.model,
      prompt: input.prompt,
      size: input.aspectRatio,
      resolution: input.resolution,
      n: 1,
      image_urls: [],
      metadata: { resolution: input.resolution },
    } as any);
    const taskId =
      response?.data?.task_id ??
      response?.result?.task_id ??
      response?.task_id ??
      response?.data?.taskId ??
      response?.result?.taskId ??
      response?.taskId ??
      response?.data?.id ??
      response?.result?.id ??
      response?.id;

    if (!taskId) {
      throw new Error("image task id is empty");
    }

    return pollStoryImageTask(String(taskId));
  };

  const saveStoryAssetImageUrlToLocal = async (
    kind: StoryboardAssetKind,
    mediaId: string,
    imageUrl: string,
  ) => {
    const extension = getImageExtensionFromUrl(imageUrl, "png");
    const localPath = `storyboard/projects/${projectId}/assets/${kind}/${mediaId}.${extension}`;
    try {
      const buffer = await imageSourceToArrayBuffer(imageUrl);
      if (!buffer) {
        return undefined;
      }
      await storyboardStorage.saveBinary(localPath, buffer);
      return localPath;
    } catch (error) {
      console.warn("[Story] save generated asset image to local failed", error);
      return undefined;
    }
  };

  const buildAssetGenerationPrompt = (
    kind: StoryboardAssetKind,
    asset: StoryboardAssetItem,
    currentAgent: StoryboardAgentData,
  ) => {
    const assetName = (asset.name || "").trim();
    const assetPrompt = (asset.prompt || "").trim();
    const basePrompt = [
      assetName ? `资产名称：${assetName}` : "",
      assetPrompt,
    ]
      .filter(Boolean)
      .join("\n");

    if (kind !== "role" || !currentAgent.roleAssetPromptAffixEnabled) {
      return basePrompt;
    }

    return [
      currentAgent.roleAssetPromptPrefix.trim(),
      basePrompt,
      currentAgent.roleAssetPromptSuffix.trim(),
    ]
      .filter(Boolean)
      .join("\n");
  };

  const generateAssetWithAiInternal = async (
    kind: StoryboardAssetKind,
    id: string,
    options: { showToast?: boolean } = {},
  ) => {
    const showToast = options.showToast ?? true;
    if (kind === "audio") {
      if (showToast) {
        toast.error("音效 AI 生成暂未接入音频模型，请先使用本地上传");
      }
      return false;
    }

    const sourceAgent = agentRef.current;
    const asset = sourceAgent.assets[kind].find((item) => item.id === id);
    const prompt = asset
      ? buildAssetGenerationPrompt(kind, asset, sourceAgent)
      : "";
    if (!prompt) {
      if (showToast) toast.error("请先填写资产提示词");
      return false;
    }

    patchAssetState(kind, id, { source: "ai", status: "generating" });
    try {
      const model =
        asset?.imageModel ||
        settings.defaultImageModel ||
        "doubao-seedream-5-0";
      const params = normalizeStoryImageParams(model, {
        aspectRatio: asset?.aspectRatio || settings.defaultImageSize,
        resolution: asset?.resolution || settings.defaultImageResolution,
      });
      const imageUrl = await createStoryAssetImage({
        model,
        prompt,
        aspectRatio: params.aspectRatio,
        resolution: params.resolution,
      });
      const currentAgent = agentRef.current;
      const currentList = currentAgent.assets[kind] || [];
      const target = currentList.find((item) => item.id === id);
      if (!target) {
        if (showToast) toast.error("当前资产项不存在");
        return false;
      }
      const mediaId = createAssetMediaId("ai_media");
      const localPath = await saveStoryAssetImageUrlToLocal(
        kind,
        mediaId,
        imageUrl,
      );

      // 统一处理：优先使用 OSS 地址，否则上传到 OSS
      let ossUrl: string | undefined = undefined;
      // 如果 imageUrl 已经是 OSS，则直接使用
      if (imageUrl && imageUrl.includes(".aliyuncs.com/")) {
        ossUrl = imageUrl;
      }

      // 若未是 OSS，则尝试使用本地文件上传到 OSS
      if (!ossUrl && localPath) {
        try {
          ossUrl = await ensureStoryboardLocalMediaOssUrl({
            ...target,
            localPath,
            mediaType: "image",
          } as StoryboardAssetItem);
        } catch (err) {
          console.warn("[Story] ensureStoryboardLocalMediaOssUrl failed", err);
        }
      }

      // 如果仍然没有 OSS 地址且 imageUrl 为远程可访问地址，尝试抓取并上传
      if (!ossUrl && imageUrl && isHttpUrl(imageUrl)) {
        try {
          const res = await fetch(imageUrl);
          if (res.ok) {
            const blob = await res.blob();
            const ext = blob.type.split("/")[1] || "png";
            const file = new File([blob], `${mediaId}.${ext}`);
            const uploaded = await uploadFileToOSS(file);
            if (uploaded.url) ossUrl = uploaded.url;
          }
        } catch (e) {
          console.warn("[Story] fetch-and-upload image failed", e);
        }
      }

      const mediaItem: StoryboardAssetMediaItem = {
        id: mediaId,
        source: "ai",
        mediaType: "image",
        mediaUrl: ossUrl ?? (isDataImageUrl(imageUrl) && localPath ? undefined : imageUrl),
        localPath,
        name: target.name,
        createdAt: Date.now(),
      };

      const nextAsset = appendAssetMediaItem(
        {
          ...target,
          source: "ai",
          status: "ready",
          aspectRatio: params.aspectRatio,
          resolution: params.resolution,
        },
        mediaItem,
      );

      await saveAgent({
        ...currentAgent,
        assets: {
          ...currentAgent.assets,
          [kind]: currentList.map((item) => (item.id === id ? nextAsset : item)),
        },
      });

      if (showToast) toast.success("AI 资产生成结果已回填");
      return true;
    } catch (error) {
      console.error("[Story] generate asset failed", error);
      await saveAssetPatch(kind, id, { source: "ai", status: "failed" });
      if (showToast) toast.error("AI 资产生成失败");
      return false;
    }
  };

  const generateAssetWithAi = async (
    kind: StoryboardAssetKind,
    id: string,
  ) => {
    await generateAssetWithAiInternal(kind, id);
  };

  const generateAllAssets = async (kind: StoryboardAssetKind) => {
    const items = agentRef.current.assets[kind];
    if (items.length === 0) {
      toast.error(`暂无${assetKinds.find((item) => item.id === kind)?.label || "资产"}资产`);
      return;
    }

    setBulkGenerateConfirmKind(null);
    setBulkGeneratingKind(kind);
    try {
      let skippedCount = 0;
      const generateTasks = items.flatMap((asset) => {
        const latestAsset = agentRef.current.assets[kind].find(
          (item) => item.id === asset.id,
        );
        if (
          !latestAsset ||
          !buildAssetGenerationPrompt(kind, latestAsset, agentRef.current)
        ) {
          skippedCount += 1;
          return [];
        }
        return [
          generateAssetWithAiInternal(kind, asset.id, {
            showToast: false,
          }),
        ];
      });
      const results = await Promise.all(generateTasks);
      const successCount = results.filter(Boolean).length;
      const kindLabel = assetKinds.find((item) => item.id === kind)?.label || "资产";

      if (successCount > 0) {
        toast.success(
          skippedCount > 0
            ? `已生成 ${successCount} 个${kindLabel}资产，跳过 ${skippedCount} 个空提示词${kindLabel}`
            : `已生成 ${successCount} 个${kindLabel}资产`,
        );
      } else {
        toast.error(`没有可生成的${kindLabel}资产`);
      }
    } finally {
      setBulkGeneratingKind(null);
    }
  };

  const identifyScriptAssets = async () => {
    if (!agent.scriptTitle.trim()) {
      toast.error("请先填写剧本标题");
      return;
    }
    if (!agent.scriptContent.trim()) {
      toast.error("请先输入剧本内容");
      return;
    }

    setSplitting(true);
    try {
      const result = await identifyAssetsWithAgent({
        title: agent.scriptTitle,
        scriptCategory: agent.scriptCategory,
        scriptContent: agent.scriptContent,
        systemPrompt: agent.assetSystemPrompt,
      });
      const nextAssets = mergeIdentifiedAssets(agent.assets, result.assets);
      const identifiedCount =
        result.assets.role.length +
        result.assets.scene.length +
        result.assets.prop.length;
      await saveAgentWithStep({ ...agent, assets: nextAssets }, "assets");
      toast.success(`已识别 ${identifiedCount} 个资产`);
    } catch (error) {
      console.error("[Story] identify script assets failed", error);
      toast.error("识别失败");
    } finally {
      setSplitting(false);
    }
  };

  const requestIdentifyScriptAssets = () => {
    if (isStepUnlocked("assets", agent.unlockedStep)) {
      setNextConfirmTarget("identify-assets");
      return;
    }
    void identifyScriptAssets();
  };

  const proceedToShots = async () => {
    if (!agent.scriptTitle.trim()) {
      toast.error("请先填写剧本标题");
      return;
    }
    if (!agent.scriptContent.trim()) {
      toast.error("请先输入剧本内容");
      return;
    }

    setSplitting(true);
    try {
      const result = await splitScriptWithAgent({
        title: agent.scriptTitle,
        promptPrefix: agent.promptPrefix,
        promptSuffix: agent.promptSuffix,
        scriptCategory: agent.scriptCategory,
        maxShots: agent.maxShots,
        splitAssist: agent.splitAssist,
        scriptContent: agent.scriptContent,
        systemPrompt: agent.splitSystemPrompt,
        assets: agent.assets,
        defaults,
      });
      const nextShots = bindShotAssetIdsByName(
        result.shots,
        result.shotAssetNames,
        agent.assets,
      );
      await saveAgentWithStep({ ...agent, shots: nextShots }, "shots");
      toast.success(`已生成 ${nextShots.length} 条分镜`);
    } catch (error) {
      console.error("[Story] split script failed", error);
      toast.error("拆分失败");
    } finally {
      setSplitting(false);
    }
  };

  const requestProceedToShots = () => {
    if (isStepUnlocked("shots", agent.unlockedStep)) {
      setNextConfirmTarget("split-shots");
      return;
    }
    void proceedToShots();
  };

  const confirmNextAction = () => {
    const target = nextConfirmTarget;
    setNextConfirmTarget(null);

    if (target === "identify-assets") {
      void identifyScriptAssets();
      return;
    }

    if (target === "split-shots") {
      void proceedToShots();
    }
  };

  const proceedToVideoEdit = async () => {
    await saveAgentWithStep(agent, "video-edit");
  };

  const saveSystemPrompt = async (
    target: StorySystemPromptTarget,
    value: string,
  ) => {
    const nextAgent =
      target === "asset"
        ? { ...agent, assetSystemPrompt: value }
        : { ...agent, splitSystemPrompt: value };
    await saveAgent(nextAgent);
    setEditingSystemPrompt(null);
    toast.success("系统提示词已保存");
  };

  const updateShot = (id: string, patch: Partial<StoryboardShot>) => {
    patchAgent({
      shots: agent.shots.map((shot) =>
        shot.id === id ? { ...shot, ...patch } : shot,
      ),
    });
  };

  const refreshAllShotAssetDescriptions = async () => {
    const currentAgent = agentRef.current;
    if (currentAgent.shots.length === 0) {
      toast.error("暂无可更新的分镜");
      return;
    }

    const nextAgent = {
      ...currentAgent,
      shots: currentAgent.shots.map((shot) =>
        applyAutoDescToShot(shot, currentAgent.assets),
      ),
    };
    await saveAgent(nextAgent);
    toast.success("已更新全部分镜资产说明");
  };

  const removeAssetFromShot = (shotId: string, assetId: string) => {
    const shot = agent.shots.find((s) => s.id === shotId);
    if (!shot) return;
    const nextAssetIds = shot.assetIds.filter((id) => id !== assetId);
    const nextShot = applyAutoDescToShot(
      { ...shot, assetIds: nextAssetIds },
      agent.assets,
    );
    patchAgent({
      shots: agent.shots.map((s) => (s.id === shotId ? nextShot : s)),
    });
  };

  const applyShotModelSettings = (
    shotId: string,
    value: VideoParamState,
    scope: "single" | "all",
  ) => {
    if (scope === "all") {
      patchAgent({
        shots: agent.shots.map((shot) => ({
          ...shot,
          modelInfo: patchShotModelInfo(
            shot.modelInfo,
            normalizeVideoParams(
              shot.modelInfo.videoModel,
              {
                aspectRatio: value.aspectRatio,
                resolution: value.resolution,
                duration: value.duration,
              },
              "image-to-video",
            ),
          ),
        })),
      });
      setEditingShotModel(null);
      toast.success("已更新全部分镜设置");
      return;
    }

    patchAgent({
      shots: agent.shots.map((shot) =>
        shot.id === shotId
          ? {
              ...shot,
              modelInfo: patchShotModelInfo(
                shot.modelInfo,
                normalizeVideoParams(
                  shot.modelInfo.videoModel,
                  {
                    aspectRatio: value.aspectRatio,
                    resolution: value.resolution,
                    duration: value.duration,
                  },
                  "image-to-video",
                ),
              ),
            }
          : shot,
      ),
    });
    setEditingShotModel(null);
    toast.success("已更新当前分镜设置");
  };

  const saveShotPatch = async (
    id: string,
    patch: Partial<StoryboardShot>,
  ) => {
    const currentAgent = agentRef.current;
    const nextAgent = {
      ...currentAgent,
      shots: currentAgent.shots.map((shot) =>
        shot.id === id ? { ...shot, ...patch } : shot,
      ),
    };
    await saveAgent(nextAgent);
  };

  const ensureStoryboardLocalMediaOssUrl = async (
    asset: StoryboardAssetItem,
  ) => {
    if (!asset.localPath) return "";

    const buffer = await storyboardStorage.readBinary(asset.localPath);
    if (!buffer) {
      throw new Error("asset file not found");
    }

    const mediaType = getStoryAssetMediaType(asset);
    const fallbackExtension =
      mediaType === "video" ? "mp4" : mediaType === "audio" ? "mp3" : "png";
    const extension = getPathExtension(asset.localPath, fallbackExtension);
    const file = new File([buffer], `${asset.id}.${extension}`, {
      type: getMimeTypeByPath(asset.localPath),
    });
    const uploaded = await uploadFileToOSS(file);
    if (!uploaded.url) {
      throw new Error("upload asset to oss failed");
    }

    return uploaded.url;
  };

  const buildShotReferenceItems = async (
    selectedAssets: StoryboardAssetItem[],
  ): Promise<MentionItem[]> => {
    const assetIndex =
      settings.assetStoragePath &&
      selectedAssets.some((asset) => asset.assetId)
        ? await readCombinedAssetIndex(settings.assetStoragePath)
        : null;
    const items: MentionItem[] = [];

    for (const asset of selectedAssets) {
      const primaryMedia = getPrimaryAssetMediaItem(asset);
      let url = isHttpUrl(primaryMedia?.mediaUrl)
        ? primaryMedia?.mediaUrl || ""
        : isHttpUrl(asset.mediaUrl)
          ? asset.mediaUrl || ""
          : "";
      const libraryAssetId = primaryMedia?.assetId || asset.assetId;
      const localPath = primaryMedia?.localPath || asset.localPath;

      if (!url && settings.assetStoragePath && libraryAssetId && assetIndex) {
        const libraryAsset = assetIndex.assets.find(
          (item) => item.id === libraryAssetId,
        );
        if (libraryAsset) {
          url = await ensureAssetOssUrl(settings.assetStoragePath, libraryAsset);
        }
      }

      if (!url && localPath) {
        url = await ensureStoryboardLocalMediaOssUrl({
          ...asset,
          localPath,
          mediaType: primaryMedia?.mediaType || asset.mediaType,
        });
      }

      if (!isHttpUrl(url)) {
        continue;
      }

      const mediaType = getStoryAssetMediaType({
        ...asset,
        mediaType: primaryMedia?.mediaType || asset.mediaType,
        mediaUrl: primaryMedia?.mediaUrl || asset.mediaUrl,
        localPath,
      });
      items.push({
        id: asset.id,
        mentionId: asset.id,
        label: asset.name || "未命名资产",
        value: url,
        thumbnail: url,
        url,
        type: mediaType,
      });
    }

    return items;
  };

  const getShotAssetsWithBoundAudio = (
    shot: StoryboardShot,
  ): StoryboardAssetItem[] => {
    const assetMap = new Map(
      [
        ...agent.assets.role,
        ...agent.assets.scene,
        ...agent.assets.prop,
        ...agent.assets.audio,
      ].map((asset) => [asset.id, asset]),
    );
    const selectedAssets = shot.assetIds
      .map((id) => assetMap.get(id))
      .filter(Boolean) as StoryboardAssetItem[];
    const selectedAssetIds = new Set(selectedAssets.map((asset) => asset.id));

    for (const asset of selectedAssets) {
      for (const audioAssetId of asset.audioAssetIds || []) {
        if (selectedAssetIds.has(audioAssetId)) continue;
        const audioAsset = assetMap.get(audioAssetId);
        if (!audioAsset) continue;
        selectedAssets.push(audioAsset);
        selectedAssetIds.add(audioAssetId);
      }
    }

    return selectedAssets;
  };

  const pollStoryVideoTask = async (taskId: string, isSeedance20: boolean) => {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await wait(4000);
      const response = isSeedance20
        ? await getLzVideoTaskStatus(taskId)
        : await getDashscopeVideoTaskStatus(taskId);
      const normalized = normalizeVideoTaskResponse(response);

      if (normalized.status === GenerationStatus.COMPLETED) {
        const videoUrl = normalized.videoItems[0]?.url;
        if (!videoUrl) {
          throw new Error("video task completed but missing result url");
        }
        return videoUrl;
      }

      if (normalized.status === GenerationStatus.FAILED) {
        throw new Error(normalized.errorMessage || "video generation failed");
      }
    }

    throw new Error("video generation timeout");
  };

  const createStoryVideoTask = async (
    apiRequest: ReturnType<typeof buildVideoApiRequest>,
    model: string,
  ) => {
    if (isAdobeVideoRequest(apiRequest as Record<string, unknown>)) {
      const response = await createAdobe2ApiVideoGeneration(apiRequest as any);
      const videoUrl = extractMarkdownMediaUrl(
        response?.choices?.[0]?.message?.content,
        "video",
      );
      if (!videoUrl) {
        throw new Error("Adobe2API video url is empty");
      }
      return (await copyVideoUrlToOss(videoUrl)) || videoUrl;
    }

    if (isGrokVideoRequest(apiRequest as Record<string, unknown>)) {
      const response = await createGrok2ApiVideoGeneration(apiRequest as any);
      const rawVideoUrl = extractMarkdownMediaUrl(
        response?.choices?.[0]?.message?.content,
        "video",
      );
      const videoUrl = rawVideoUrl
        ? await normalizeGrok2ApiMediaUrl(rawVideoUrl)
        : "";
      if (!videoUrl) {
        throw new Error("Grok2API video url is empty");
      }
      return (await copyVideoUrlToOss(videoUrl)) || videoUrl;
    }

    const isSeedance20 = isSeedanceVideoModel(model);
    const response: any = isSeedance20
      ? await createLzVideoTask(apiRequest as any)
      : await createDashscopeVideoSynthesis(apiRequest as any);
    const taskId =
      response?.data?.task_id ||
      response?.output?.task_id ||
      response?.task_id ||
      response?.data?.taskId ||
      response?.taskId;

    if (!taskId) {
      throw new Error("video task id is empty");
    }

    return pollStoryVideoTask(String(taskId), isSeedance20);
  };

  const generateShotVideo = async (shot: StoryboardShot) => {
    const basePrompt = (shot.prompt || shot.script || "").trim();
    if (!basePrompt) {
      toast.error("请先填写分镜提示词");
      return;
    }
    const useAffix = Boolean(agent.shotPromptAffixEnabled);
    const prefix = useAffix ? (agent.promptPrefix || "").trim() : "";
    const suffix = useAffix ? (agent.promptSuffix || "").trim() : "";
    const prompt = `${prefix}${prefix && " "}${basePrompt}${suffix && " "}${suffix}`.replace(/\s+/g, " ").trim();

    updateShot(shot.id, { videoStatus: "generating" });
    try {
      const selectedAssets = getShotAssetsWithBoundAudio(shot);
      const referenceItems = await buildShotReferenceItems(selectedAssets);
      const mode = pickStoryVideoMode(
        shot.modelInfo.videoModel,
        referenceItems,
        toVideoModeKey(settings.defaultNewVideoMode),
      );
      const generationReferenceItems =
        mode === "text-to-video"
          ? []
          : mode === "image-to-video"
            ? referenceItems.filter((item) => item.type === "image").slice(0, 1)
            : referenceItems;

      if (mode === "all-reference" && generationReferenceItems.length === 0) {
        toast.error("全能参考模式需要至少一个可用资产素材");
        await saveShotPatch(shot.id, { videoStatus: "idle" });
        return;
      }

      if (mode === "image-to-video" && generationReferenceItems.length === 0) {
        toast.error("当前模型需要至少一个图片资产素材");
        await saveShotPatch(shot.id, { videoStatus: "idle" });
        return;
      }

      const params = normalizeVideoParams(
        shot.modelInfo.videoModel,
        {
          aspectRatio: shot.modelInfo.aspectRatio,
          resolution: shot.modelInfo.resolution,
          duration: shot.modelInfo.duration,
          generateAudio: settings.defaultNewVideoGenerateAudio,
          promptExtend: settings.defaultNewVideoPromptExtend,
        },
        mode,
      );
      const request: VideoGenerateRequest = {
        model: shot.modelInfo.videoModel,
        params,
        prompt,
        referenceItems: generationReferenceItems,
        mode,
      };
      const apiRequest = buildVideoApiRequest(request);
      const videoUrl = await createStoryVideoTask(
        apiRequest,
        shot.modelInfo.videoModel,
      );
      await saveShotPatch(shot.id, {
        videoStatus: "ready",
        video: { url: videoUrl },
      });
      toast.success("生成视频结果已写回当前分镜行");
    } catch (error) {
      console.error("[Story] generate shot video failed", error);
      await saveShotPatch(shot.id, { videoStatus: "failed" });
      toast.error("生成视频失败，请检查提示词、资产和模型配置");
    }
  };

  const downloadShotVideo = async (shot: StoryboardShot) => {
    if (!shot.video?.localPath && !shot.video?.url) {
      toast.error("当前分镜还没有视频素材");
      return;
    }

    try {
      const defaultName = `shot-${shot.order}.mp4`;
      if (shot.video.localPath) {
        const buffer = await storyboardStorage.readBinary(shot.video.localPath);
        if (!buffer) {
          throw new Error("local video file not found");
        }

        if (window.storage?.saveBufferToFile) {
          const result = await window.storage.saveBufferToFile(
            defaultName,
            buffer,
          );
          if (result.success) {
            toast.success("视频已下载");
          }
          return;
        }
      }

      const link = document.createElement("a");
      link.href = shot.video.url || "";
      link.download = defaultName;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("[Story] download shot video failed", error);
      toast.error("下载视频失败");
    }
  };

  const resolveShotVideoUrl = async (shot: StoryboardShot) => {
    if (shot.video?.url) return shot.video.url;
    if (!shot.video?.localPath) return "";

    const buffer = await storyboardStorage.readBinary(shot.video.localPath);
    if (!buffer) {
      throw new Error("local video file not found");
    }

    const extension = getPathExtension(shot.video.localPath, "mp4");
    const file = new File([buffer], `shot-${shot.order}.${extension}`, {
      type: getMimeTypeByPath(shot.video.localPath, "video/mp4"),
    });
    const uploaded = await uploadFileToOSS(file);
    if (!uploaded.url) {
      throw new Error("upload video to oss failed");
    }
    return uploaded.url;
  };

  const waitForSubtitleRemovalResult = async (
    taskId: string,
    shotId: string,
    accessUrl: string,
  ) => {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await wait(10000);
      const response = await getVideoRemovalStatus(taskId);
      const { taskStatus } = extractTaskStatusInfo(response);

      if (["SUCCESS", "SUCCEEDED", "COMPLETED"].includes(taskStatus)) {
        await saveShotPatch(shotId, {
          videoStatus: "ready",
          video: { url: accessUrl },
        });
        await useUserStore.getState().fetchBalanceInfo();
        return;
      }

      if (["FAILED", "FAIL", "ERROR"].includes(taskStatus)) {
        throw new Error("去字幕失败");
      }
    }

    throw new Error("去字幕任务超时");
  };

  const removeShotSubtitles = async (
    shot: StoryboardShot,
    rect: WuhenRect,
    _requiredPoints: number,
  ) => {
    if (removingSubtitleShotId) return;

    setRemovingSubtitleShotId(shot.id);
    await saveShotPatch(shot.id, { videoStatus: "generating" });
    try {
      const videoUrl = await resolveShotVideoUrl(shot);
      if (!videoUrl) {
        throw new Error("当前分镜还没有视频素材");
      }

      const putUrlResponse = await getUploadOssPutUrl({
        blob_type: "video",
        ext: "mp4",
        content_type: "video/mp4",
        ttl: 43200,
      });
      const target = putUrlResponse?.data ?? putUrlResponse;
      const accessUrl =
        target?.access_url || target?.put_url?.split("?")[0] || "";

      if (!target?.put_url || !accessUrl) {
        throw new Error("未获取到预签名上传地址");
      }

      const response: any = await videoRemoval({
        video_url: videoUrl,
        method: "sel_area",
        rect,
        upload_url: target.put_url,
        upload_headers: target.headers,
        model: "video_removal_std",
      });
      const { taskId, taskStatus } = extractTaskStatusInfo(response);

      if (!taskId) {
        throw new Error("创建去字幕任务失败");
      }

      setRemovingSubtitleShot(null);
      if (["SUCCESS", "SUCCEEDED", "COMPLETED"].includes(taskStatus)) {
        await saveShotPatch(shot.id, {
          videoStatus: "ready",
          video: { url: accessUrl },
        });
        await useUserStore.getState().fetchBalanceInfo();
      } else {
        await waitForSubtitleRemovalResult(taskId, shot.id, accessUrl);
      }
      toast.success("去字幕结果已写回当前分镜");
    } catch (error) {
      console.error("[Story] remove shot subtitles failed", error);
      await saveShotPatch(shot.id, { videoStatus: "failed" });
      toast.error(error instanceof Error ? error.message : "去字幕失败");
    } finally {
      setRemovingSubtitleShotId(null);
    }
  };

  const deleteShotVideo = async (shot: StoryboardShot) => {
    await saveShotPatch(shot.id, {
      video: undefined,
      videoStatus: "idle",
      videoEdit: undefined,
    });
    toast.success("视频素材已删除");
  };

  const exportToJianying = async () => {
    if (!settings.jianyingDraftsPath) {
      toast.error("请先在设置的数据与版本中配置剪映草稿路径");
      return;
    }

    const storage = window.storage;
    if (!storage?.writeRawFile || !storage.downloadMedia) {
      toast.error("当前环境不支持写入剪映草稿");
      return;
    }

    const videoShots = agent.shots.filter(
      (shot) => shot.video?.localPath || shot.video?.url,
    );
    if (videoShots.length === 0) {
      toast.error("暂无可导出的已生成视频");
      return;
    }

    setExportingJianying(true);
    try {
      const draftName = sanitizeFileName(
        `${agent.scriptTitle || "剧本 Agent"}-${new Date()
          .toLocaleString("zh-CN", {
            hour12: false,
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
          .replace(/[/:]/g, "-")}`,
        "剧本 Agent",
      );
      const draftId = createJianyingId().toUpperCase();
      const draftRoot = draftName;
      const resourcesRoot = joinDraftRelativePath(draftRoot, "Resources", "media");
      const exportedVideos: JianyingExportVideo[] = [];

      for (const shot of videoShots) {
        const extension = getVideoExtension(shot);
        const fileName = sanitizeFileName(
          `shot-${String(shot.order).padStart(2, "0")}.${extension}`,
          `${shot.id}.${extension}`,
        );
        const relativePath = joinDraftRelativePath(resourcesRoot, fileName);

        if (shot.video?.localPath) {
          const buffer = await storyboardStorage.readBinary(shot.video.localPath);
          if (!buffer) {
            throw new Error(`分镜 ${shot.order} 的本地视频不存在`);
          }
          await writeDraftBinaryFile(
            settings.jianyingDraftsPath,
            relativePath,
            buffer,
          );
        } else if (shot.video?.url) {
          const result = await storage.downloadMedia(
            settings.jianyingDraftsPath,
            shot.video.url,
            relativePath,
          );
          if (!result.success) {
            throw new Error(result.error || `下载分镜 ${shot.order} 视频失败`);
          }
        }

        exportedVideos.push({
          fileName,
          absolutePath: toWindowsPath(settings.jianyingDraftsPath, relativePath),
          durationUs: Math.max(1, shot.modelInfo.duration || 5) * 1_000_000,
        });
      }

      const draftPath = toWindowsPath(settings.jianyingDraftsPath, draftRoot);
      const { content, meta, nowSeconds, nowUs } = createJianyingDraftFiles({
        draftId,
        draftName,
        draftPath,
        draftsRootPath: settings.jianyingDraftsPath,
        videos: exportedVideos,
      });

      await writeDraftJsonFile(
        settings.jianyingDraftsPath,
        joinDraftRelativePath(draftRoot, "draft_content.json"),
        content,
      );
      await writeDraftJsonFile(
        settings.jianyingDraftsPath,
        joinDraftRelativePath(
          draftRoot,
          "Timelines",
          draftId,
          "draft_content.json",
        ),
        content,
      );
      await writeDraftJsonFile(
        settings.jianyingDraftsPath,
        joinDraftRelativePath(draftRoot, "draft_meta_info.json"),
        meta,
      );
      await writeDraftTextFile(
        settings.jianyingDraftsPath,
        joinDraftRelativePath(draftRoot, "draft_settings"),
        `[General]\ncloud_last_modify_platform=windows\ndraft_create_time=${nowSeconds}\ndraft_last_edit_time=${nowSeconds}\nreal_edit_seconds=0\nreal_edit_keys=1\n`,
      );
      await writeDraftJsonFile(
        settings.jianyingDraftsPath,
        joinDraftRelativePath(draftRoot, "draft_agency_config.json"),
        {
          is_auto_agency_enabled: false,
          is_auto_agency_popup: false,
          is_single_agency_mode: false,
          marterials: null,
          use_converter: false,
          video_resolution: 1080,
        },
      );
      await writeDraftTextFile(
        settings.jianyingDraftsPath,
        joinDraftRelativePath(draftRoot, "draft_biz_config.json"),
        "",
      );
      await writeDraftJsonFile(
        settings.jianyingDraftsPath,
        joinDraftRelativePath(draftRoot, "draft_virtual_store.json"),
        { draft_materials: [], draft_virtual_store: [] },
      );
      await writeDraftJsonFile(
        settings.jianyingDraftsPath,
        joinDraftRelativePath(draftRoot, "attachment_editing.json"),
        { editing_draft: { version: "1.0.0" } },
      );
      await writeDraftJsonFile(
        settings.jianyingDraftsPath,
        joinDraftRelativePath(
          draftRoot,
          "Timelines",
          draftId,
          "attachment_editing.json",
        ),
        { editing_draft: { version: "1.0.0" } },
      );
      await writeDraftJsonFile(
        settings.jianyingDraftsPath,
        joinDraftRelativePath(draftRoot, "attachment_pc_common.json"),
        {
          ai_packaging_infos: [],
          commercial_music_category_ids: [],
          pc_feature_flag: 0,
          recognize_tasks: [],
          template_item_infos: [],
          unlock_template_ids: [],
        },
      );
      await writeDraftJsonFile(
        settings.jianyingDraftsPath,
        joinDraftRelativePath(
          draftRoot,
          "Timelines",
          draftId,
          "attachment_pc_common.json",
        ),
        {
          ai_packaging_infos: [],
          commercial_music_category_ids: [],
          pc_feature_flag: 0,
          recognize_tasks: [],
          template_item_infos: [],
          unlock_template_ids: [],
        },
      );
      await writeDraftJsonFile(
        settings.jianyingDraftsPath,
        joinDraftRelativePath(draftRoot, "performance_opt_info.json"),
        { manual_cancle_precombine_segs: null, need_auto_precombine_segs: null },
      );
      await writeDraftJsonFile(
        settings.jianyingDraftsPath,
        joinDraftRelativePath(draftRoot, "timeline_layout.json"),
        {
          activeTimeline: draftId,
          dockItems: [
            {
              dockIndex: 0,
              ratio: 1,
              timelineIds: [draftId],
              timelineNames: ["时间线 1"],
            },
          ],
          layoutOrientation: 1,
        },
      );
      await writeDraftJsonFile(
        settings.jianyingDraftsPath,
        joinDraftRelativePath(draftRoot, "Timelines", "project.json"),
        {
          config: {
            color_space: -1,
            render_index_track_mode_on: false,
            use_float_render: false,
          },
          create_time: nowUs,
          id: createJianyingId().toUpperCase(),
          main_timeline_id: draftId,
          timelines: [
            {
              create_time: nowUs,
              id: draftId,
              is_marked_delete: false,
              name: "时间线 1",
              update_time: nowUs,
            },
          ],
          update_time: nowUs,
          version: 0,
        },
      );
      await writeDraftJsonFile(
        settings.jianyingDraftsPath,
        joinDraftRelativePath(
          draftRoot,
          "common_attachment",
          "attachment_pc_timeline.json",
        ),
        {
          reference_lines_config: {
            horizontal_lines: [],
            is_lock: false,
            is_visible: false,
            vertical_lines: [],
          },
          safe_area_type: 0,
        },
      );
      await writeDraftJsonFile(
        settings.jianyingDraftsPath,
        joinDraftRelativePath(
          draftRoot,
          "Timelines",
          draftId,
          "common_attachment",
          "attachment_pc_timeline.json",
        ),
        {
          reference_lines_config: {
            horizontal_lines: [],
            is_lock: false,
            is_visible: false,
            vertical_lines: [],
          },
          safe_area_type: 0,
        },
      );
      await writeDraftJsonFile(
        settings.jianyingDraftsPath,
        joinDraftRelativePath(
          draftRoot,
          "common_attachment",
          "attachment_script_video.json",
        ),
        {
          script_video: {
            attachment_valid: false,
            language: "",
            parts: [],
            sync_subtitle: false,
            version: "1.0.0",
          },
        },
      );
      await writeDraftJsonFile(
        settings.jianyingDraftsPath,
        joinDraftRelativePath(
          draftRoot,
          "Timelines",
          draftId,
          "common_attachment",
          "attachment_script_video.json",
        ),
        {
          script_video: {
            attachment_valid: false,
            language: "",
            parts: [],
            sync_subtitle: false,
            version: "1.0.0",
          },
        },
      );

      toast.success(
        `已导出 ${exportedVideos.length} 个视频到剪映草稿：${draftName}`,
      );
    } catch (error) {
      console.error("[Story] export Jianying draft failed", error);
      toast.error(
        error instanceof Error ? error.message : "导出剪映草稿失败",
      );
    } finally {
      setExportingJianying(false);
    }
  };

  const saveVideoEdit = async (
    shotId: string,
    videoEdit: NonNullable<StoryboardShot["videoEdit"]>,
  ) => {
    await saveShotPatch(shotId, { videoEdit });
    setEditingShot(null);
    toast.success("视频编辑信息已保存");
  };

  const openAssetLibraryForShot = (shotId: string) => {
    if (!settings.assetStoragePath) {
      toast.error("请先在资源管理中设置资产库路径");
      return;
    }
    setSelectingAssetDetailTarget(null);
    setSelectingAudioBindTarget(null);
    setSelectingAssetShotId(shotId);
  };

  const openAssetLibraryForAssetDetail = (
    kind: StoryboardAssetKind,
    id: string,
  ) => {
    if (!settings.assetStoragePath) {
      toast.error("请先在资源管理中设置资产库路径");
      return;
    }
    setSelectingAssetShotId(null);
    setSelectingAudioBindTarget(null);
    setSelectingAssetDetailTarget({ kind, id });
  };

  const openAssetLibraryForAudioBind = (
    kind: StoryboardAssetKind,
    id: string,
  ) => {
    if (!settings.assetStoragePath) {
      toast.error("请先在资源管理中设置资产库路径");
      return;
    }
    setSelectingAssetShotId(null);
    setSelectingAssetDetailTarget(null);
    setSelectingAudioBindTarget({ kind, id });
  };

  const handleUseAssetDetailLibraryAssets = async (assets: AssetRecord[]) => {
    if (!selectingAssetDetailTarget || assets.length === 0) return;

    const currentAgent = agentRef.current;
    const { kind, id } = selectingAssetDetailTarget;
    const usableAssets = assets.filter((asset) => asset.mediaType !== "audio");
    if (usableAssets.length === 0) {
      toast.error("角色、场景和道具仅支持图片或视频资产");
      return;
    }

    const currentList = currentAgent.assets[kind] || [];
    const targetIndex = currentList.findIndex((item) => item.id === id);

    if (targetIndex < 0) {
      setSelectingAssetDetailTarget(null);
      toast.error("当前资产项不存在");
      return;
    }

    const target = currentList[targetIndex];
    let nextTarget = target;

    for (const asset of usableAssets) {
      const libraryItem = createLibraryStoryboardAsset(
        asset,
        kind,
        settings.assetStoragePath,
      );
      const mediaItem = getPrimaryAssetMediaItem(libraryItem);
      if (!mediaItem) continue;
      nextTarget = appendAssetMediaItem(
        {
          ...nextTarget,
          name: nextTarget.name || asset.name,
        },
        mediaItem,
      );
    }

    const nextList = currentList.map((item) =>
      item.id === id ? nextTarget : item,
    );

    await saveAgent({
      ...currentAgent,
      assets: {
        ...currentAgent.assets,
        [kind]: nextList,
      },
    });
    setSelectingAssetDetailTarget(null);
    toast.success(`已导入 ${usableAssets.length} 个资产`);
  };

  const handleBindAudioAssets = async (assets: AssetRecord[]) => {
    if (!selectingAudioBindTarget || assets.length === 0) return;

    const audioRecords = assets.filter((asset) => asset.mediaType === "audio");
    if (audioRecords.length === 0) {
      toast.error("请选择音频资产");
      return;
    }

    const currentAgent = agentRef.current;
    const { kind, id } = selectingAudioBindTarget;
    const targetList = currentAgent.assets[kind] || [];
    const target = targetList.find((item) => item.id === id);

    if (!target) {
      setSelectingAudioBindTarget(null);
      toast.error("当前资产项不存在");
      return;
    }

    // 单音效：只取第一个
    const asset = audioRecords[0];
    const nextAudioAssets = [...currentAgent.assets.audio];

    const existing = nextAudioAssets.find((item) => item.assetId === asset.id);
    let boundId: string;

    if (existing) {
      boundId = existing.id;
    } else {
      const item = createLibraryStoryboardAsset(
        asset,
        "audio",
        settings.assetStoragePath,
      );
      nextAudioAssets.push(item);
      boundId = item.id;
    }

    // 命名为 "{资产名}的音效"
    const boundAudio = nextAudioAssets.find((item) => item.id === boundId);
    if (boundAudio) {
      boundAudio.name = `${target.name || "资产"}的音效`;
    }

    await saveAgent({
      ...currentAgent,
      assets: {
        ...currentAgent.assets,
        audio: nextAudioAssets,
        [kind]: targetList.map((item) =>
          item.id === id
            ? { ...item, audioAssetIds: [boundId] }
            : item,
        ),
      },
    });
    setSelectingAudioBindTarget(null);
    toast.success("音效已绑定");
  };

  const bindLocalAudioAsset = async (
    kind: StoryboardAssetKind,
    id: string,
    file: File,
  ) => {
    if (getMediaTypeFromFile(file) !== "audio") {
      toast.error("请选择音频文件");
      return;
    }

    const currentAgent = agentRef.current;
    const targetList = currentAgent.assets[kind] || [];
    const target = targetList.find((item) => item.id === id);

    if (!target) {
      toast.error("当前资产项不存在");
      return;
    }

    const audioId = createId("asset_audio");
    const extension = getFileExtension(file, "mp3");
    const localPath = `storyboard/projects/${projectId}/assets/audio/${audioId}.${extension}`;

    try {
      await storyboardStorage.saveBinary(localPath, await file.arrayBuffer());
      const audioName = `${target.name || "资产"}的音效`;
      const audioItem: StoryboardAssetItem = {
        id: audioId,
        kind: "audio",
        name: audioName,
        prompt: "",
        source: "upload",
        status: "ready",
        mediaType: "audio",
        localPath,
      };
      // 单音效：替换旧绑定
      const nextAudioAssetIds = [audioId];

      await saveAgent({
        ...currentAgent,
        assets: {
          ...currentAgent.assets,
          audio: [...currentAgent.assets.audio, audioItem],
          [kind]: targetList.map((item) =>
            item.id === id
              ? { ...item, audioAssetIds: nextAudioAssetIds }
              : item,
          ),
        },
      });
      toast.success("本地音效已绑定");
    } catch (error) {
      console.error("[Story] bind local audio failed", error);
      toast.error("绑定本地音效失败");
    }
  };

  const handleUseLibraryAssets = async (assets: AssetRecord[]) => {
    if (!selectingAssetShotId || assets.length === 0) return;

    const currentAgent = agentRef.current;
    const nextAssets: Record<StoryboardAssetKind, StoryboardAssetItem[]> = {
      role: [...currentAgent.assets.role],
      scene: [...currentAgent.assets.scene],
      prop: [...currentAgent.assets.prop],
      audio: [...currentAgent.assets.audio],
    };
    const selectedIds: string[] = [];

    for (const asset of assets) {
      const kind = getAssetKindFromRecord(asset);
      const existing = Object.values(nextAssets)
        .flat()
        .find((item) => item.assetId === asset.id);
      if (existing) {
        selectedIds.push(existing.id);
        continue;
      }

      const item = createLibraryStoryboardAsset(
        asset,
        kind,
        settings.assetStoragePath,
      );
      nextAssets[kind].push(item);
      selectedIds.push(item.id);
    }

    const nextAgent = {
      ...currentAgent,
      assets: nextAssets,
      shots: currentAgent.shots.map((shot) => {
        if (shot.id !== selectingAssetShotId) return shot;
        const withAssetIds = {
          ...shot,
          assetIds: Array.from(new Set([...shot.assetIds, ...selectedIds])),
        };
        return applyAutoDescToShot(withAssetIds, nextAssets);
      }),
    };

    await saveAgent(nextAgent);
    setSelectingAssetShotId(null);
    toast.success(`已选择 ${assets.length} 个资产`);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#09090b] text-white/45">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        读取剧本 Agent
      </div>
    );
  }

  return (
    <StoragePathGuard>
      <div className="story-scrollbar-scope flex h-full flex-col overflow-hidden bg-[#09090b] text-white">
        <StoryHeader
          title="剧本 Agent"
          icon={<Bot size={20} />}
          backTo={`/story/${projectId}`}
          action={
            <div className="flex items-center gap-3">
              {saving && (
                <span className="flex items-center gap-1 text-xs text-white/35">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  保存中
                </span>
              )}
              <Button size="sm" onClick={persistCurrent}>
                保存
              </Button>
            </div>
          }
        />
        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mb-5 rounded-xl border border-white/10 bg-[#111113] p-2">
            <div className="grid grid-cols-4 gap-2">
              {storyAgentSteps.map((step) => {
                const unlocked = isStepUnlocked(step.id, agent.unlockedStep);
                const active = activeStep === step.id;
                return (
                  <button
                    key={step.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => selectStep(step.id)}
                    className={[
                      "flex h-11 items-center justify-center rounded-lg text-sm font-medium transition-all",
                      active
                        ? "bg-[#B43FEB] text-white shadow-[0_8px_22px_rgba(180,63,235,0.28)]"
                        : unlocked
                          ? "bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
                          : "cursor-not-allowed bg-black/25 text-white/22",
                    ].join(" ")}
                  >
                    {step.label}
                  </button>
                );
              })}
            </div>
          </div>

          {activeStep === "script" ? (
            <section className="rounded-xl border border-white/10 bg-[#111113] p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-medium text-white/90">
                  输入剧本
                </h2>
                <p className="mt-1 text-xs text-white/40">
                  填写剧本信息后，点击下一步调用大模型识别角色、场景和道具。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => setEditingSystemPrompt("asset")}>
                  <Bot size={15} />
                  系统提示词
                </Button>
                <Button
                  variant="blue"
                  onClick={requestIdentifyScriptAssets}
                  loading={splitting}
                >
                  <WandSparkles size={15} />
                  下一步
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label>
                <span className="mb-2 block text-sm text-white/65">
                  剧本标题 <span className="text-red-400">*</span>
                </span>
                <input
                  className={inputClass}
                  value={agent.scriptTitle}
                  onChange={(event) =>
                    patchAgent({ scriptTitle: event.target.value })
                  }
                  placeholder="输入剧本标题"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm text-white/65">
                  剧本最大分镜数
                </span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  className={inputClass}
                  value={agent.maxShots}
                  onChange={(event) =>
                    patchAgent({
                      maxShots: Math.max(1, Number(event.target.value) || 1),
                    })
                  }
                />
              </label>
              <label className="col-span-2">
                <span className="mb-2 block text-sm text-white/65">
                  剧本分类
                </span>
                <ScriptCategoryCombobox
                  value={agent.scriptCategory}
                  onChange={(scriptCategory) => patchAgent({ scriptCategory })}
                />
              </label>
              <label className="col-span-2">
                <span className="mb-2 block text-sm text-white/65">
                  拆镜辅助词
                </span>
                <textarea
                  className={`${textAreaClass} h-20`}
                  value={agent.splitAssist}
                  onChange={(event) =>
                    patchAgent({ splitAssist: event.target.value })
                  }
                  placeholder="可输入每集节奏、镜头偏好、角色限制等"
                />
              </label>
              <label className="col-span-2">
                <span className="mb-2 block text-sm text-white/65">
                  剧本内容
                </span>
                <textarea
                  className={`${textAreaClass} h-56`}
                  value={agent.scriptContent}
                  onChange={(event) =>
                    patchAgent({ scriptContent: event.target.value })
                  }
                  placeholder="粘贴完整剧本内容"
                />
              </label>
            </div>
            </section>
          ) : null}

          {activeStep === "assets" ? (
            <section className="rounded-xl border border-white/10 bg-[#111113] p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-medium text-white/90">
                    资产详情
                  </h2>
                  <p className="mt-1 text-xs text-white/40">
                    角色、场景、道具按列管理，点击下一步调用大模型拆分分镜。
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => setEditingSystemPrompt("split")}>
                    <Bot size={15} />
                    系统提示词
                  </Button>
                  <Button
                    variant="blue"
                    onClick={requestProceedToShots}
                    loading={splitting}
                  >
                  <WandSparkles size={15} />
                    下一步
                  </Button>
                </div>
              </div>
                <div className="grid gap-4 lg:grid-cols-3">
                {assetDetailKinds.map((kind) => (
                  <div
                    key={kind.id}
                    className="flex min-h-[520px] flex-col rounded-lg border border-white/8 bg-black/20"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
                      <h3 className="text-sm font-medium text-white/85">
                        {kind.label}
                      </h3>
                      <div className="flex flex-wrap justify-end gap-2">
                        {kind.id === "role" ? (
                          <Button
                            size="sm"
                            onClick={() => setEditingRolePromptAffix(true)}
                          >
                            <Pencil size={13} />
                            提示词前后缀
                          </Button>
                        ) : null}
                        {kind.id === "scene" || kind.id === "prop" ? (
                          <Button
                            size="sm"
                            variant="blue"
                            onClick={() => setBulkGenerateConfirmKind(kind.id)}
                            disabled={bulkGeneratingKind === kind.id}
                          >
                            {bulkGeneratingKind === kind.id ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <WandSparkles size={13} />
                            )}
                            统一生成
                          </Button>
                        ) : null}
                        {kind.id === "role" ? (
                          <Button
                            size="sm"
                            variant="blue"
                            onClick={() => setBulkGenerateConfirmKind(kind.id)}
                            disabled={bulkGeneratingKind === kind.id}
                          >
                            {bulkGeneratingKind === kind.id ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <WandSparkles size={13} />
                            )}
                            统一生成
                          </Button>
                        ) : null}
                        <Button size="sm" onClick={() => addAsset(kind.id)}>
                          <Plus size={13} />
                          新增
                        </Button>
                      </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto p-3">
                      {(() => {
                        const assetList = agent.assets[kind.id] || [];
                        if (assetList.length === 0) {
                          return (
                            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-white/10 text-sm text-white/30">
                              暂无{kind.label}资产
                            </div>
                          );
                        }

                        return assetList.map((item, index) => {
                          let cb = assetCallbacksRef.current[item.id];
                          if (!cb) {
                            cb = {
                              onChange: (patch: Partial<StoryboardAssetItem>) => updateAsset(kind.id, item.id, patch),
                              onUpload: (file: File) => void uploadAsset(kind.id, item.id, file),
                              onUseLibrary: () => openAssetLibraryForAssetDetail(kind.id, item.id),
                              onBindAudio: () => openAssetLibraryForAudioBind(kind.id, item.id),
                              onBindLocalAudio: (file: File) => void bindLocalAudioAsset(kind.id, item.id, file),
                              onSetPrimaryMedia: (mediaId: string) => setAssetPrimaryMediaById(kind.id, item.id, mediaId),
                              onDeleteMedia: (mediaId: string) => deleteAssetMediaById(kind.id, item.id, mediaId),
                              onGenerate: () => void generateAssetWithAi(kind.id, item.id),
                              onDelete: () => deleteAsset(kind.id, item.id),
                            };
                            assetCallbacksRef.current[item.id] = cb;
                          }
                          return (
                            <div key={item.id} className="mb-3">
                              <AssetColumnItem
                                item={item}
                                index={index}
                                imageModelOptions={visibleImageModels}
                                audioAssets={agent.assets.audio}
                                defaultImageModel={settings.defaultImageModel}
                                defaultImageSize={settings.defaultImageSize}
                                defaultImageResolution={settings.defaultImageResolution}
                                onChange={cb.onChange}
                                onUpload={cb.onUpload}
                                onUseLibrary={cb.onUseLibrary}
                                onBindAudio={cb.onBindAudio}
                                onBindLocalAudio={cb.onBindLocalAudio}
                                onSetPrimaryMedia={cb.onSetPrimaryMedia}
                                onDeleteMedia={cb.onDeleteMedia}
                                onGenerate={cb.onGenerate}
                                onDelete={cb.onDelete}
                              />
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activeStep === "shots" ? (
            <section className="rounded-xl border border-white/10 bg-[#111113] p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-medium text-white/90">
                  分镜管理
                </h2>
                <p className="mt-1 text-xs text-white/40">
                  生成视频直接使用当前分镜提示词和已选资产作为参考素材。
                </p>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => void refreshAllShotAssetDescriptions()}>
                  <WandSparkles size={13} />
                  更新资产说明
                </Button>
                <Button onClick={() => setEditingShotPromptAffix(true)}>
                  <Pencil size={13} />
                  提示词前后缀
                </Button>
                <Button onClick={persistCurrent}>保存分镜</Button>
                <Button variant="blue" onClick={proceedToVideoEdit}>
                  下一步
                </Button>
              </div>
            </div>
            <div className="max-h-[calc(100vh-260px)] overflow-auto rounded-lg border border-white/8">
              <table className="min-w-[1180px] w-full table-fixed">
                <thead className="sticky top-0 z-10 bg-[#171719] text-xs text-white/45">
                  <tr>
                    <th className="w-16 px-3 py-3 text-center">序号</th>
                    <th className="w-72 px-3 py-3 text-left">剧本</th>
                    <th className="w-60 px-3 py-3 text-left">资产</th>
                    <th className="w-80 px-3 py-3 text-left">提示词</th>
                    <th className="w-72 px-3 py-3 text-left">模型相关信息</th>
                    <th className="w-64 px-3 py-3 text-left">生成视频</th>
                  </tr>
                </thead>
                <tbody>
                  {agent.shots.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-12 text-center text-sm text-white/30"
                      >
                        暂无分镜。填写剧本后点击“下一步”。
                      </td>
                    </tr>
                  ) : (
                    agent.shots.map((shot) => (
                      <ShotRow
                        key={shot.id}
                        shot={shot}
                        selectedAssets={getShotAssetsWithBoundAudio(shot)}
                        onChange={(patch) => updateShot(shot.id, patch)}
                        onSelectAssets={() => openAssetLibraryForShot(shot.id)}
                        onRemoveAsset={(assetId) =>
                          removeAssetFromShot(shot.id, assetId)
                        }
                        onEditModelInfo={() => setEditingShotModel(shot)}
                        onGenerateVideo={() => void generateShotVideo(shot)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </section>
          ) : null}

          {activeStep === "video-edit" ? (
            <VideoEditTable
              shots={agent.shots}
              exporting={exportingJianying}
              removingSubtitleShotId={removingSubtitleShotId}
              onExport={() => void exportToJianying()}
              onDownload={(shot) => void downloadShotVideo(shot)}
              onRemoveSubtitles={setRemovingSubtitleShot}
              onEdit={setEditingShot}
              onDelete={(shot) => void deleteShotVideo(shot)}
            />
          ) : null}

          {editingShot ? (
            <VideoEditDrawer
              shot={editingShot}
              onClose={() => setEditingShot(null)}
              onSave={(videoEdit) => void saveVideoEdit(editingShot.id, videoEdit)}
            />
          ) : null}

          {nextConfirmTarget ? (
            <StoryNextConfirmDialog
              target={nextConfirmTarget}
              running={splitting}
              onCancel={() => setNextConfirmTarget(null)}
              onConfirm={confirmNextAction}
            />
          ) : null}

          {editingSystemPrompt ? (
            <SystemPromptDialog
              title={
                editingSystemPrompt === "asset"
                  ? "资产识别系统提示词"
                  : "分镜拆分系统提示词"
              }
              value={
                editingSystemPrompt === "asset"
                  ? agent.assetSystemPrompt
                  : agent.splitSystemPrompt
              }
              defaultValue={
                editingSystemPrompt === "asset"
                  ? DEFAULT_ASSET_SYSTEM_PROMPT
                  : DEFAULT_SPLIT_SYSTEM_PROMPT
              }
              onClose={() => setEditingSystemPrompt(null)}
              onSave={(value) =>
                void saveSystemPrompt(editingSystemPrompt, value)
              }
            />
          ) : null}

          {editingRolePromptAffix ? (
            <RolePromptAffixDialog
              enabled={agent.roleAssetPromptAffixEnabled}
              prefix={agent.roleAssetPromptPrefix}
              suffix={agent.roleAssetPromptSuffix}
              onClose={() => setEditingRolePromptAffix(false)}
              onSave={(value) => {
                void saveAgent({
                  ...agentRef.current,
                  roleAssetPromptAffixEnabled: value.enabled,
                  roleAssetPromptPrefix: value.prefix,
                  roleAssetPromptSuffix: value.suffix,
                });
                setEditingRolePromptAffix(false);
              }}
            />
          ) : null}

          {editingShotPromptAffix ? (
            <ShotPromptAffixDialog
              enabled={agent.shotPromptAffixEnabled ?? false}
              prefix={agent.promptPrefix}
              suffix={agent.promptSuffix}
              onClose={() => setEditingShotPromptAffix(false)}
              onSave={(value) => {
                void saveAgent({
                  ...agentRef.current,
                  shotPromptAffixEnabled: value.enabled,
                  promptPrefix: value.prefix,
                  promptSuffix: value.suffix,
                });
                setEditingShotPromptAffix(false);
              }}
            />
          ) : null}

          {bulkGenerateConfirmKind ? (
            <AssetGenerateConfirmDialog
              kind={bulkGenerateConfirmKind}
              count={agent.assets[bulkGenerateConfirmKind].length}
              running={bulkGeneratingKind === bulkGenerateConfirmKind}
              onCancel={() => {
                if (bulkGeneratingKind !== bulkGenerateConfirmKind) {
                  setBulkGenerateConfirmKind(null);
                }
              }}
              onConfirm={() => void generateAllAssets(bulkGenerateConfirmKind)}
            />
          ) : null}

          {editingShotModel ? (
            <ShotModelSettingsDialog
              shot={editingShotModel}
              onClose={() => setEditingShotModel(null)}
              onApplySingle={(value) =>
                applyShotModelSettings(editingShotModel.id, value, "single")
              }
              onApplyAll={(value) =>
                applyShotModelSettings(editingShotModel.id, value, "all")
              }
            />
          ) : null}

          {removingSubtitleShot ? (
            <StorySubtitleRemovalDialog
              open
              shot={removingSubtitleShot}
              isSubmitting={removingSubtitleShotId === removingSubtitleShot.id}
              onClose={() => setRemovingSubtitleShot(null)}
              onSubmit={(rect, requiredPoints) =>
                removeShotSubtitles(removingSubtitleShot, rect, requiredPoints)
              }
            />
          ) : null}

          {selectingAssetDetailTarget && settings.assetStoragePath ? (
            <AssetLibraryDialog
              open
              basePath={settings.assetStoragePath}
              projectId={null}
              nodes={[]}
              onClose={() => setSelectingAssetDetailTarget(null)}
              onUse={(asset) => void handleUseAssetDetailLibraryAssets([asset])}
              onUseMany={(assets) =>
                void handleUseAssetDetailLibraryAssets(assets)
              }
            />
          ) : null}

          {selectingAudioBindTarget && settings.assetStoragePath ? (
            <AssetLibraryDialog
              open
              basePath={settings.assetStoragePath}
              projectId={null}
              nodes={[]}
              onClose={() => setSelectingAudioBindTarget(null)}
              onUse={(asset) => void handleBindAudioAssets([asset])}
              onUseMany={(assets) => void handleBindAudioAssets(assets)}
              hidePreviewPane
            />
          ) : null}

          {selectingAssetShotId && settings.assetStoragePath ? (
            <AssetLibraryDialog
              open
              basePath={settings.assetStoragePath}
              projectId={null}
              nodes={[]}
              onClose={() => setSelectingAssetShotId(null)}
              onUse={(asset) => void handleUseLibraryAssets([asset])}
              onUseMany={(assets) => void handleUseLibraryAssets(assets)}
            />
          ) : null}
        </main>
      </div>
    </StoragePathGuard>
  );
};

const getShotConfirmedMaterial = (shot: StoryboardShot) =>
  shot.videoEdit?.confirmedMaterial ||
  (shot.assetIds.length > 0 ? `已引用 ${shot.assetIds.length} 个资产` : "未确认素材");

const VideoEditTable = ({
  shots,
  exporting,
  removingSubtitleShotId,
  onExport,
  onDownload,
  onRemoveSubtitles,
  onEdit,
  onDelete,
}: {
  shots: StoryboardShot[];
  exporting: boolean;
  removingSubtitleShotId: string | null;
  onExport: () => void;
  onDownload: (shot: StoryboardShot) => void;
  onRemoveSubtitles: (shot: StoryboardShot) => void;
  onEdit: (shot: StoryboardShot) => void;
  onDelete: (shot: StoryboardShot) => void;
}) => (
  <section className="rounded-xl border border-white/10 bg-[#111113] p-5">
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-medium text-white/90">视频编辑</h2>
        <p className="mt-1 text-xs text-white/40">
          汇总已生成的视频素材，支持下载、抽屉编辑和删除素材引用。
        </p>
      </div>
      <Button size="sm" variant="blue" onClick={onExport} disabled={exporting}>
        {exporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        导出到剪映
      </Button>
    </div>
    <div className="overflow-x-auto rounded-lg border border-white/8">
      <table className="min-w-[980px] w-full table-fixed">
        <thead className="bg-black/30 text-xs text-white/45">
          <tr>
            <th className="w-64 px-3 py-3 text-left">已确认素材</th>
            <th className="w-80 px-3 py-3 text-left">视频素材</th>
            <th className="px-3 py-3 text-left">分镜提示词</th>
            <th className="w-56 px-3 py-3 text-left">操作</th>
          </tr>
        </thead>
        <tbody>
          {shots.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-12 text-center text-sm text-white/30">
                暂无分镜。请先完成剧本拆分。
              </td>
            </tr>
          ) : (
            shots.map((shot) => {
              const hasVideo = Boolean(shot.video?.url || shot.video?.localPath);
              return (
                <tr key={shot.id} className="border-b border-white/5 align-top">
                  <td className="px-3 py-3 text-sm text-white/70">
                    <div className="rounded-lg border border-white/8 bg-black/25 p-3">
                      <div className="mb-1 text-xs text-white/35">
                        分镜 {shot.order}
                      </div>
                      {getShotConfirmedMaterial(shot)}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-white/50">
                    <div className="rounded-lg border border-white/8 bg-black/25 p-3">
                      <ShotVideoPreview shot={shot} />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-sm text-white/65">
                    <div className="line-clamp-4 rounded-lg border border-white/8 bg-black/25 p-3 leading-6">
                      {shot.videoEdit?.prompt || shot.prompt || "暂无提示词"}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => onDownload(shot)}
                        disabled={!hasVideo}
                      >
                        <Download size={13} />
                        下载
                      </Button>
                      <Button size="sm" variant="blue" onClick={() => onEdit(shot)}>
                        <Pencil size={13} />
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => onRemoveSubtitles(shot)}
                        disabled={!hasVideo || removingSubtitleShotId === shot.id}
                      >
                        {removingSubtitleShotId === shot.id ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Eraser size={13} />
                        )}
                        去字幕
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => onDelete(shot)}
                        disabled={!hasVideo}
                      >
                        <Trash2 size={13} />
                        删除
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  </section>
);

const StoryNextConfirmDialog = ({
  target,
  running,
  onCancel,
  onConfirm,
}: {
  target: StoryNextConfirmTarget;
  running: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  const isIdentify = target === "identify-assets";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="取消操作"
        className="absolute inset-0 cursor-default"
        onClick={() => {
          if (!running) onCancel();
        }}
      />
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#121214] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/5 p-5">
          <h2 className="text-lg font-semibold text-white/90">
            {isIdentify ? "重新识别资产" : "重新拆分分镜"}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={running}
            className="cursor-pointer text-white/50 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">
          <p className="text-sm leading-6 text-white/60">
            {isIdentify
              ? "当前片段已经识别过资产。确认后会再次调用大模型识别角色、场景和道具，并把新识别到的资产合并到资产详情。"
              : "当前片段已经拆分过分镜。确认后会再次调用大模型拆分分镜，并用新的分镜结果替换当前分镜列表。"}
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-white/5 bg-black/20 p-5">
          <Button onClick={onCancel} disabled={running}>
            取消
          </Button>
          <Button variant="blue" onClick={onConfirm} loading={running}>
            确认
          </Button>
        </div>
      </div>
    </div>
  );
};

const SystemPromptDialog = ({
  title,
  value,
  defaultValue,
  onClose,
  onSave,
}: {
  title: string;
  value: string;
  defaultValue: string;
  onClose: () => void;
  onSave: (value: string) => void;
}) => {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="关闭系统提示词"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-[min(620px,86vh)] w-[min(760px,94vw)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101012] shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/8 px-5 py-4">
          <div>
            <h3 className="text-base font-medium text-white/90">{title}</h3>
            <p className="mt-1 text-xs text-white/40">
              保存后会用于当前步骤的下一次 AI 调用。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 p-5">
          <textarea
            className={`${textAreaClass} h-full`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
        <div className="flex justify-between gap-3 border-t border-white/5 bg-black/20 p-5">
          <Button onClick={() => setDraft(defaultValue)}>恢复默认</Button>
          <div className="flex gap-3">
            <Button onClick={onClose}>取消</Button>
            <Button variant="blue" onClick={() => onSave(draft)}>
              保存
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const RolePromptAffixDialog = ({
  enabled,
  prefix,
  suffix,
  onClose,
  onSave,
}: {
  enabled: boolean;
  prefix: string;
  suffix: string;
  onClose: () => void;
  onSave: (value: { enabled: boolean; prefix: string; suffix: string }) => void;
}) => {
  const [draftEnabled, setDraftEnabled] = useState(enabled);
  const [draftPrefix, setDraftPrefix] = useState(prefix);
  const [draftSuffix, setDraftSuffix] = useState(suffix);

  useEffect(() => {
    setDraftEnabled(enabled);
    setDraftPrefix(prefix);
    setDraftSuffix(suffix);
  }, [enabled, prefix, suffix]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="关闭提示词前后缀"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative z-10 flex w-[min(680px,94vw)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101012] shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/8 px-5 py-4">
          <div>
            <h3 className="text-base font-medium text-white/90">
              角色提示词前后缀
            </h3>
            <p className="mt-1 text-xs text-white/40">
              开启后，仅作用于角色资产的 AI 生图提示词。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <label className="flex items-center justify-between rounded-lg border border-white/8 bg-black/25 px-4 py-3">
            <span className="text-sm text-white/75">启用前后缀</span>
            <Switch
              checked={draftEnabled}
              onCheckedChange={setDraftEnabled}
              className="data-[state=checked]:bg-[#B43FEB] data-[state=unchecked]:bg-white/20"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-white/65">提示词前缀</span>
            <textarea
              className={`${textAreaClass} h-28`}
              value={draftPrefix}
              onChange={(event) => setDraftPrefix(event.target.value)}
              placeholder="例如：统一角色设定、画风、服装要求"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-white/65">提示词后缀</span>
            <textarea
              className={`${textAreaClass} h-28`}
              value={draftSuffix}
              onChange={(event) => setDraftSuffix(event.target.value)}
              placeholder="例如：统一镜头质感、构图、无文字要求"
            />
          </label>
        </div>
        <div className="flex justify-end gap-3 border-t border-white/5 bg-black/20 p-5">
          <Button onClick={onClose}>取消</Button>
          <Button
            variant="blue"
            onClick={() =>
              onSave({
                enabled: draftEnabled,
                prefix: draftPrefix,
                suffix: draftSuffix,
              })
            }
          >
            保存
          </Button>
        </div>
      </div>
    </div>
  );
};

const ShotPromptAffixDialog = ({
  enabled,
  prefix,
  suffix,
  onClose,
  onSave,
}: {
  enabled: boolean;
  prefix: string;
  suffix: string;
  onClose: () => void;
  onSave: (value: { enabled: boolean; prefix: string; suffix: string }) => void;
}) => {
  const [draftEnabled, setDraftEnabled] = useState(enabled);
  const [draftPrefix, setDraftPrefix] = useState(prefix);
  const [draftSuffix, setDraftSuffix] = useState(suffix);

  useEffect(() => {
    setDraftEnabled(enabled);
    setDraftPrefix(prefix);
    setDraftSuffix(suffix);
  }, [enabled, prefix, suffix]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="关闭提示词前后缀"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative z-10 flex w-[min(680px,94vw)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101012] shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/8 px-5 py-4">
          <div>
            <h3 className="text-base font-medium text-white/90">分镜提示词前后缀</h3>
            <p className="mt-1 text-xs text-white/40">
              保存分镜时，会将前缀和后缀追加到每条分镜提示词。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <label className="flex items-center justify-between rounded-lg border border-white/8 bg-black/25 px-4 py-3">
            <span className="text-sm text-white/75">启用前后缀</span>
            <Switch
              checked={draftEnabled}
              onCheckedChange={setDraftEnabled}
              className="data-[state=checked]:bg-[#B43FEB] data-[state=unchecked]:bg-white/20"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-white/65">提示词前缀</span>
            <textarea
              className={`${textAreaClass} h-28`}
              value={draftPrefix}
              onChange={(event) => setDraftPrefix(event.target.value)}
              placeholder="例如：统一镜头画风、光影、人物设定"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-white/65">提示词后缀</span>
            <textarea
              className={`${textAreaClass} h-28`}
              value={draftSuffix}
              onChange={(event) => setDraftSuffix(event.target.value)}
              placeholder="例如：保持简洁、避免文字、聚焦场景氛围"
            />
          </label>
        </div>
        <div className="flex justify-end gap-3 border-t border-white/5 bg-black/20 p-5">
          <Button onClick={onClose}>取消</Button>
          <Button
            variant="blue"
            onClick={() =>
              onSave({
                enabled: draftEnabled,
                prefix: draftPrefix,
                suffix: draftSuffix,
              })
            }
          >
            保存
          </Button>
        </div>
      </div>
    </div>
  );
};

const AssetGenerateConfirmDialog = ({
  kind,
  count,
  running,
  onCancel,
  onConfirm,
}: {
  kind: StoryboardAssetKind;
  count: number;
  running: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
    <button
      type="button"
      aria-label="取消统一生成"
      className="absolute inset-0 cursor-default"
      onClick={() => {
        if (!running) onCancel();
      }}
    />
    <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#121214] shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/5 p-5">
        <h2 className="text-lg font-semibold text-white/90">
          统一生成{assetKinds.find((item) => item.id === kind)?.label || "资产"}资产
        </h2>
        <button
          type="button"
          onClick={onCancel}
          disabled={running}
          className="cursor-pointer text-white/50 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="p-5">
        <p className="text-sm leading-6 text-white/60">
          确认后会依次为当前{assetKinds.find((item) => item.id === kind)?.label || "资产"}列的 {count} 个资产调用 AI 生图，并把生成结果追加为候选图。
        </p>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-white/5 bg-black/20 p-5">
        <Button onClick={onCancel} disabled={running}>
          取消
        </Button>
        <Button
          variant="blue"
          onClick={onConfirm}
          loading={running}
          disabled={count === 0}
        >
          确认生成
        </Button>
      </div>
    </div>
  </div>
);

const VideoEditDrawer = ({
  shot,
  onClose,
  onSave,
}: {
  shot: StoryboardShot;
  onClose: () => void;
  onSave: (videoEdit: NonNullable<StoryboardShot["videoEdit"]>) => void;
}) => {
  const [confirmedMaterial, setConfirmedMaterial] = useState(
    getShotConfirmedMaterial(shot),
  );
  const [prompt, setPrompt] = useState(shot.videoEdit?.prompt || shot.prompt);

  useEffect(() => {
    setConfirmedMaterial(getShotConfirmedMaterial(shot));
    setPrompt(shot.videoEdit?.prompt || shot.prompt);
  }, [shot]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-sm">
      <button
        type="button"
        aria-label="关闭视频编辑"
        className="min-w-0 flex-1 cursor-default"
        onClick={onClose}
      />
      <aside className="flex h-full w-[min(720px,100%)] flex-col border-l border-white/10 bg-[#101012] shadow-2xl">
        <div className="flex h-16 items-center justify-between border-b border-white/5 px-5">
          <div>
            <h2 className="text-base font-medium text-white/90">
              编辑分镜 {shot.order}
            </h2>
            <p className="mt-1 text-xs text-white/40">视频剪辑 / 组合信息</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <div className="overflow-hidden rounded-xl border border-white/8 bg-black/35">
            {shot.video?.url ? (
              <video
                src={shot.video.url}
                controls
                className="aspect-video w-full bg-black object-contain"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center text-sm text-white/30">
                暂无可预览视频
              </div>
            )}
          </div>
          <label className="block">
            <span className="mb-2 block text-sm text-white/65">已确认素材</span>
            <textarea
              className={`${textAreaClass} h-28`}
              value={confirmedMaterial}
              onChange={(event) => setConfirmedMaterial(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-white/65">
              分镜提示词
            </span>
            <textarea
              className={`${textAreaClass} h-44`}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </label>
          <div className="rounded-lg border border-white/8 bg-black/25 p-3 text-xs leading-5 text-white/45">
            {shot.video?.localPath || shot.video?.url || "未生成视频素材"}
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-white/5 bg-black/20 p-5">
          <Button onClick={onClose}>取消</Button>
          <Button
            variant="blue"
            onClick={() => onSave({ confirmedMaterial, prompt })}
          >
            保存
          </Button>
        </div>
      </aside>
    </div>
  );
};

const ShotModelSettingsDialog = ({
  shot,
  onClose,
  onApplySingle,
  onApplyAll,
}: {
  shot: StoryboardShot;
  onClose: () => void;
  onApplySingle: (value: VideoParamState) => void;
  onApplyAll: (value: VideoParamState) => void;
}) => {
  const config = getVideoParamConfig(shot.modelInfo.videoModel, "image-to-video");
  const [value, setValue] = useState<VideoParamState>(() => ({
    ...getShotVideoParamState(shot),
    duration: 15,
  }));

  useEffect(() => {
    setValue((current) => ({
      ...getShotVideoParamState(shot),
      duration: 15,
    }));
  }, [shot]);

  const patchValue = (patch: Partial<VideoParamState>) => {
    setValue((current) => ({ ...current, ...patch, duration: 15 }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="关闭模型设置"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative z-10 w-[min(520px,92vw)] overflow-hidden rounded-2xl border border-white/10 bg-[#101012] shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/8 px-5 py-4">
          <div>
            <h3 className="text-base font-medium text-white/90">
              分镜 {shot.order} 模型设置
            </h3>
            <p className="mt-1 text-xs text-white/40">
              调整比例、分辨率与时长
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {config.aspectRatios ? (
            <section className="space-y-2">
              <div className="text-xs font-medium text-white/55">比例</div>
              <div className="grid grid-cols-5 gap-2">
                {config.aspectRatios.map((option) => {
                  const active = value.aspectRatio === option.value;
                  const isAuto = option.value === "adaptive";

                  return (
                    <button
                      key={String(option.value)}
                      type="button"
                      onClick={() =>
                        patchValue({ aspectRatio: String(option.value) })
                      }
                      className={storyVideoOptionButtonClass(
                        active,
                        "flex h-[54px] flex-col items-center justify-center gap-1 px-2",
                      )}
                    >
                      {isAuto ? (
                        <span
                          className={cn(
                            "h-3 w-3 rounded-[2px] border",
                            active ? "border-[#B43FEB]" : "border-white/45",
                          )}
                        />
                      ) : (
                        <AspectRatioIcon
                          ratio={String(option.value)}
                          size={18}
                          active={active}
                        />
                      )}
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {config.qualityGroup?.key === "resolution" ? (
            <section className="space-y-2">
              <div className="text-xs font-medium text-white/55">分辨率</div>
              <div className="grid grid-cols-3 gap-2">
                {config.qualityGroup.options.map((option) => {
                  const active = value.resolution === option.value;
                  return (
                    <button
                      key={String(option.value)}
                      type="button"
                      onClick={() =>
                        patchValue({
                          resolution: String(option.value),
                          quality: undefined,
                        })
                      }
                      className={storyVideoOptionButtonClass(active, "h-8 px-3")}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-white/55">视频时长</span>
              <span className="font-semibold text-[#D9B4FF]">15s（固定）</span>
            </div>

            {config.duration ? (
              <div className="flex h-8 items-center rounded-lg border border-white/8 bg-black/25 px-3 text-sm text-white/60">
                15 秒（固定）
              </div>
            ) : null}
          </section>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-white/8 bg-black/20 px-5 py-4">
          <Button onClick={onClose}>取消</Button>
          <Button onClick={() => onApplySingle(value)}>仅修改此分镜设置</Button>
          <Button variant="blue" onClick={() => onApplyAll(value)}>
            修改全部分镜设置
          </Button>
        </div>
      </div>
    </div>
  );
};

const ShotPromptPanel = ({
  shot,
  selectedAssets,
  onChange,
  onRemoveAsset,
}: {
  shot: StoryboardShot;
  selectedAssets: StoryboardAssetItem[];
  onChange: (patch: Partial<StoryboardShot>) => void;
  onRemoveAsset: (assetId: string) => void;
}) => {
  const [localPreviewUrls, setLocalPreviewUrls] = useState<Record<string, string>>(
    {},
  );
  const previewKey = selectedAssets
    .map((asset) => `${asset.id}:${asset.localPath || asset.mediaUrl || ""}`)
    .join("|");

  useEffect(() => {
    let active = true;
    const createdUrls: string[] = [];

    const loadPreviews = async () => {
      const pairs = await Promise.all(
        selectedAssets.map(async (asset) => {
          if (!asset.localPath) {
            return [asset.id, ""] as const;
          }
          const url = await storyboardStorage.readObjectUrl(asset.localPath);
          if (url) createdUrls.push(url);
          return [asset.id, url || ""] as const;
        }),
      );

      if (!active) {
        createdUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      const next: Record<string, string> = {};
      for (const [id, url] of pairs) {
        if (url) next[id] = url;
      }
      setLocalPreviewUrls(next);
    };

    void loadPreviews();

    return () => {
      active = false;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewKey]);

  const mentionItems = useMemo<MentionItem[]>(
    () =>
      selectedAssets.map((asset) => ({
        id: asset.id,
        mentionId: asset.id,
        label: asset.name || "未命名资产",
        value: asset.name || "未命名资产",
        thumbnail: asset.mediaUrl || localPreviewUrls[asset.id] || "",
        type: getStoryAssetMediaType(asset),
      })),
    [localPreviewUrls, selectedAssets],
  );

  return (
    <div className="rounded-2xl border border-white/8 bg-[#1e1e20] p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[#B43FEB]/30 bg-[#B43FEB]/10 px-2 py-1 text-[10px] font-medium text-[#E9C7FF]">
          全能参考
        </span>
        <span className="text-[11px] text-white/35">
          输入 @ 插入当前分镜资产
        </span>
      </div>

      {mentionItems.length > 0 ? (
        <div className="mb-3 overflow-x-auto">
          <ReferenceThumbnails
            items={mentionItems}
            onRemove={(item) => {
              if (shot.assetIds.includes(item.id)) {
                onRemoveAsset(item.id);
              }
            }}
          />
        </div>
      ) : (
        <div className="mb-3 rounded-xl border border-dashed border-white/10 bg-black/15 px-3 py-4 text-[11px] text-white/35">
          先在左侧资产列为当前分镜选择参考资产
        </div>
      )}

      <div
        className={cn(
          PROMPT_PANEL_STYLES.textAreaWrap,
          "rounded-xl bg-white/[0.02]",
        )}
      >
        <VideoPromptEditor
          promptDraftHtml={buildPromptDraftHtml(
            shot.promptDraftHtml,
            shot.prompt,
          )}
          mentionItems={mentionItems}
          onDraftChange={({ text, html }) =>
            onChange({ prompt: text, promptDraftHtml: html })
          }
        />
      </div>
    </div>
  );
};

const ShotVideoPreview = ({ shot }: { shot: StoryboardShot }) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const videoUrl = objectUrl || shot.video?.url || "";

  useEffect(() => {
    let active = true;
    let nextUrl: string | null = null;

    if (!shot.video?.localPath) {
      setObjectUrl(null);
      return;
    }

    storyboardStorage.readObjectUrl(shot.video.localPath).then((url) => {
      if (!active) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      nextUrl = url;
      setObjectUrl(url);
    });

    return () => {
      active = false;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [shot.video?.localPath]);

  if (videoUrl) {
    return (
      <div className="overflow-hidden rounded-lg border border-white/8 bg-black">
        <video
          src={videoUrl}
          controls
          preload="metadata"
          className="aspect-video w-full bg-black object-contain"
        />
        <div className="truncate border-t border-white/8 px-2 py-1.5 text-[10px] text-white/35">
          {shot.video?.localPath || shot.video?.url}
        </div>
      </div>
    );
  }

  return (
    <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 bg-black/25 text-xs text-white/35">
      <Video size={18} />
      未生成视频
    </div>
  );
};

const ShotRow = ({
  shot,
  selectedAssets,
  onChange,
  onSelectAssets,
  onRemoveAsset,
  onEditModelInfo,
  onGenerateVideo,
}: {
  shot: StoryboardShot;
  selectedAssets: StoryboardAssetItem[];
  onChange: (patch: Partial<StoryboardShot>) => void;
  onSelectAssets: () => void;
  onRemoveAsset: (assetId: string) => void;
  onEditModelInfo: () => void;
  onGenerateVideo: () => void;
}) => {
  return (
    <tr className="border-b border-white/5 align-top">
      <td className="px-3 py-3 text-center text-sm text-white/45">
        {shot.order}
      </td>
      <td className="px-3 py-3">
        <textarea
          className={`${textAreaClass} h-28`}
          value={shot.script}
          onChange={(event) => onChange({ script: event.target.value })}
        />
      </td>
      <td className="px-3 py-3">
        <div className="space-y-2 rounded-lg border border-white/8 bg-black/25 p-3">
          {selectedAssets.length === 0 ? (
            <div className="text-xs text-white/40">未选择资产</div>
          ) : (
            selectedAssets.map((asset) => (
              <div
                key={asset.id}
                className="grid grid-cols-[56px_1fr_auto] gap-2 rounded-md border border-white/8 bg-white/[0.03] p-2"
              >
                <StoryAssetPreview item={asset} compact preferRemoteMediaUrl />
                <div className="min-w-0">
                  <div className="truncate text-xs text-white/75">
                    {asset.name || "未命名资产"}
                  </div>
                  <div className="mt-1 text-[10px] text-white/35">
                    {asset.kind === "role"
                      ? "角色"
                      : asset.kind === "scene"
                        ? "场景"
                        : asset.kind === "prop"
                          ? "道具"
                          : "音效"}
                  </div>
                </div>
                {shot.assetIds.includes(asset.id) ? (
                  <Button
                    className="h-7 w-7 self-start px-0 text-red-200 hover:bg-red-500/10 hover:text-red-100"
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemoveAsset(asset.id)}
                    title="移除当前分镜资产"
                    aria-label="移除当前分镜资产"
                  >
                    <Trash2 size={13} />
                  </Button>
                ) : (
                  <span className="self-start rounded-full border border-[#B43FEB]/20 bg-[#B43FEB]/10 px-2 py-1 text-[10px] text-[#E9C7FF]">
                    绑定音效
                  </span>
                )}
              </div>
            ))
          )}
        </div>
        <Button className="mt-2" size="sm" onClick={onSelectAssets}>
          <Plus size={13} />
          选择资产
        </Button>
      </td>
      <td className="px-3 py-3">
        <ShotPromptPanel
          shot={shot}
          selectedAssets={selectedAssets}
          onChange={onChange}
          onRemoveAsset={onRemoveAsset}
        />
      </td>
      <td className="px-3 py-3 text-xs text-white/55">
        <div className="space-y-2 rounded-lg border border-white/8 bg-black/25 p-3">
          <div>视频：{shot.modelInfo.videoModel}</div>
          <div>
            {shot.modelInfo.aspectRatio} / {shot.modelInfo.duration}s /{" "}
            {shot.modelInfo.resolution || "默认分辨率"}
          </div>
          <Button size="sm" onClick={onEditModelInfo}>
            <Pencil size={13} />
            设置参数
          </Button>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="mb-3 space-y-2 rounded-lg border border-white/8 bg-black/25 p-3 text-xs text-white/45">
          <ShotVideoPreview shot={shot} />
          {shot.videoStatus !== "idle" && (
            <div className="flex items-center gap-2 text-[#d8b6ff]">
              <Video size={14} />
              {shot.videoStatus === "generating"
                ? "视频生成中"
                : shot.videoStatus === "ready"
                  ? "视频已写回"
                  : "生成失败"}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="blue"
            onClick={onGenerateVideo}
            disabled={shot.videoStatus === "generating"}
          >
            {shot.videoStatus === "generating" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Play size={13} />
            )}
            {shot.videoStatus === "ready" ? "重新生成" : "生成视频"}
          </Button>
        </div>
      </td>
    </tr>
  );
};

export default function StoryPage() {
  const { projectId, snippetId } = useParams();
  const location = useLocation();
  const storagePath = useChatSettingsStore((state) => state.storagePath);
  const isAgent = location.pathname.endsWith("/agent");

  if (!storagePath) {
    return <StoragePathGuard>{null}</StoragePathGuard>;
  }

  if (projectId && snippetId && isAgent) {
    return <StoryAgentPage projectId={projectId} snippetId={snippetId} />;
  }

  if (projectId && snippetId) {
    return <StoryWorkspacePage projectId={projectId} snippetId={snippetId} />;
  }

  if (projectId) {
    return <StorySnippetListPage projectId={projectId} />;
  }

  return <StoryProjectListPage />;
}
