import {
  BookOpenText,
  Bot,
  ChevronDown,
  ChevronLeft,
  Clapperboard,
  Download,
  FileImage,
  FolderOpen,
  ImagePlus,
  Loader2,
  Music,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Video,
  WandSparkles,
  X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ensureAssetOssUrl,
  getAssetOriginalDisplayUrl,
  initializeAssetStorage,
  readCombinedAssetIndex,
  type AssetRecord,
} from "service/assetStorage";
import { copyVideoUrlToOss, uploadFileToOSS } from "service/oss";
import {
  createEmptyAgentData,
  splitScriptWithAgent,
  storyboardStorage,
  type StoryboardAgentData,
  type StoryboardAgentStep,
  type StoryboardAssetItem,
  type StoryboardAssetKind,
  type StoryboardProject,
  type StoryboardShot,
  type StoryboardSnippet,
} from "service/storyboardStorage";
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
  getXimuImageResult,
  getDashscopeVideoTaskStatus,
  getImageTaskStatus,
  getLzVideoTaskStatus,
} from "@/api/ai";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { AssetLibraryDialog } from "@/pages/Canvas/components/AssetLibraryDialog";
import { AspectRatioIcon } from "@/pages/Canvas/CustomNodes/ImageNode/components/AspectRatioIcon";
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
import { buildVideoApiRequest } from "@/pages/Canvas/CustomNodes/New-VideoNode/utils/buildVideoApiRequest";
import { PROMPT_PANEL_STYLES } from "@/pages/Canvas/CustomNodes/shared/promptPanelStyles";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";

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

const isStepUnlocked = (
  step: StoryboardAgentStep,
  unlockedStep: StoryboardAgentStep,
) => stepOrder[step] <= stepOrder[unlockedStep];

const getLaterStep = (
  current: StoryboardAgentStep,
  next: StoryboardAgentStep,
) => (stepOrder[next] > stepOrder[current] ? next : current);

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

  return {
    ...empty,
    ...data,
    unlockedStep: inferredStep,
    promptPrefix: data.promptPrefix ?? empty.promptPrefix,
    promptSuffix: data.promptSuffix ?? empty.promptSuffix,
    scriptCategory: data.scriptCategory ?? empty.scriptCategory,
    assets: {
      ...empty.assets,
      ...(data.assets || {}),
    },
    shots: data.shots || [],
  };
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

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const createId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

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
): StoryboardAssetItem => ({
  id: createId(`library_${kind}`),
  kind,
  name: asset.name,
  prompt: "",
  source: "library",
  status: "ready",
  mediaType: asset.mediaType,
  mediaUrl: asset.ossUrl || getAssetOriginalDisplayUrl(asset, assetStoragePath),
  localPath: undefined,
  assetId: asset.id,
});

const mergeIdentifiedAssets = (
  currentAssets: StoryboardAgentData["assets"],
  identifiedAssets: StoryboardAgentData["assets"],
): StoryboardAgentData["assets"] => {
  const nextAssets: StoryboardAgentData["assets"] = {
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
      if (!key || existingNames.has(key)) continue;
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
  assets: StoryboardAgentData["assets"],
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

const resolveAdobeStoryImageModel = (model: string) => {
  if (model === ADOBE_GPT_IMAGE2_MODEL) {
    return "firefly-gpt-image-2k-1x1";
  }
  if (model === ADOBE_NANO_BANANA_PRO_MODEL) {
    return "firefly-nano-banana-pro-2k-1x1";
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

const getDirectImageUrl = (response: any) =>
  response?.data?.[0]?.url ||
  extractMarkdownMediaUrl(response?.choices?.[0]?.message?.content, "image") ||
  "";

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
  return (
    items
      .map((item: any) =>
        typeof item === "string"
          ? item
          : item?.url || item?.image_url || item?.imageUrl || item?.b64_json,
      )
      .find(Boolean) || ""
  );
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
  onClose,
  onCreated,
}: {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onCreated: (snippet: StoryboardSnippet) => void;
}) => {
  const [name, setName] = useState("");
  const [count, setCount] = useState(1);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setCount(1);
      setDescription("");
    }
  }, [open]);

  if (!open) return null;

  const save = async () => {
    if (!name.trim()) {
      toast.error("片段名称不能为空");
      return;
    }
    setSaving(true);
    try {
      const snippet = await storyboardStorage.createSnippet({
        projectId,
        name,
        count,
        description,
      });
      toast.success("片段已创建");
      onCreated(snippet);
      onClose();
    } catch (error) {
      console.error("[Story] create snippet failed", error);
      toast.error("创建片段失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#121214] shadow-2xl">
        <div className="border-b border-white/5 p-6">
          <h2 className="text-lg font-semibold text-white/90">新建片段</h2>
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
            <span className="mb-2 block text-sm text-white/70">片段数量</span>
            <input
              type="number"
              min={1}
              value={count}
              onChange={(event) =>
                setCount(Math.max(1, Number(event.target.value) || 1))
              }
              className={inputClass}
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
            创建片段
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

  return (
    <StoragePathGuard>
      <div className="story-scrollbar-scope flex h-full flex-col overflow-hidden bg-[#09090b] text-white">
        <StoryHeader
          title={project?.name || "片段管理"}
          icon={<Clapperboard size={20} />}
          backTo="/story"
          action={
            <Button variant="blue" size="sm" onClick={() => setDialogOpen(true)}>
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
                onClick={() => setDialogOpen(true)}
              >
                <Plus size={15} />
                创建片段
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 2xl:grid-cols-4">
              {snippets.map((snippet) => (
                <button
                  key={snippet.id}
                  type="button"
                  onClick={() =>
                    navigate(`/story/${projectId}/snippets/${snippet.id}/agent`)
                  }
                  className="group rounded-xl border border-white/5 bg-[#121214] p-5 text-left transition-all hover:border-[#B43FEB]/45 hover:bg-[#B43FEB]/5"
                >
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#d8b6ff]">
                    <Clapperboard size={22} />
                  </div>
                  <h3 className="truncate text-base font-medium text-white/90">
                    {snippet.name}
                  </h3>
                  <p className="mt-2 line-clamp-3 min-h-15 text-sm leading-5 text-white/45">
                    {snippet.description || "暂无片段说明"}
                  </p>
                  <div className="mt-5 flex items-center justify-between text-xs text-white/40">
                    <span>{snippet.count} 个片段</span>
                    <span>{formatTime(snippet.updatedAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </main>
        <SnippetDialog
          open={dialogOpen}
          projectId={projectId}
          onClose={() => setDialogOpen(false)}
          onCreated={(snippet) =>
            navigate(`/story/${projectId}/snippets/${snippet.id}/agent`)
          }
        />
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

const AssetColumnItem = ({
  item,
  index,
  imageModelOptions,
  defaultImageModel,
  onChange,
  onUpload,
  onUseLibrary,
  onGenerate,
  onDelete,
}: {
  item: StoryboardAssetItem;
  index: number;
  imageModelOptions: StoryImageModelOption[];
  defaultImageModel?: string;
  onChange: (patch: Partial<StoryboardAssetItem>) => void;
  onUpload: (file: File) => void;
  onUseLibrary: () => void;
  onGenerate: () => void;
  onDelete: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const currentImageModelId = getStoryImageModelOptionId(
    item.imageModel,
    item.imagePlatform,
    defaultImageModel,
    imageModelOptions,
  );

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
        <StoryAssetPreview item={item} />
        <input
          className={inputClass}
          value={item.name}
          placeholder="资产名称"
          onChange={(event) => onChange({ name: event.target.value })}
        />
        <textarea
          className={`${textAreaClass} h-20`}
          value={item.prompt}
          placeholder="AI 生成提示词"
          onChange={(event) => onChange({ prompt: event.target.value })}
        />
        <div className="flex items-center gap-2">
          <Select
            value={currentImageModelId}
            onValueChange={(value) => {
              const selected = imageModelOptions.find(
                (option) => option.id === Number(value),
              );
              if (!selected) return;
              onChange({
                imageModel: selected.model,
                imagePlatform: selected.platform,
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
      </div>
    </div>
  );
};

const StoryAssetPreview = ({
  item,
  compact = false,
}: {
  item: StoryboardAssetItem;
  compact?: boolean;
}) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const mediaType = getStoryAssetMediaType(item);
  const previewUrl = objectUrl || item.mediaUrl || "";

  useEffect(() => {
    let active = true;
    let nextUrl: string | null = null;

    if (!item.localPath) {
      setObjectUrl(null);
      return;
    }

    storyboardStorage.readObjectUrl(item.localPath).then((url) => {
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
  }, [item.localPath]);

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-lg border border-white/8 bg-black/35",
        compact ? "h-12 w-14" : "aspect-video w-full",
      )}
    >
      {previewUrl && mediaType === "image" ? (
        <img
          src={previewUrl}
          alt={item.name || "资产预览"}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : previewUrl && mediaType === "video" ? (
        compact ? (
          <div className="flex h-full w-full items-center justify-center text-white/55">
            <Video size={18} />
          </div>
        ) : (
          <video src={previewUrl} className="h-full w-full object-cover" controls />
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
      )}
    </div>
  );
};

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

const StoryAgentPage = ({
  projectId,
  snippetId,
}: {
  projectId: string;
  snippetId: string;
}) => {
  const navigate = useNavigate();
  const settings = useChatSettingsStore();
  const [agent, setAgent] = useState<StoryboardAgentData>(
    createEmptyAgentData(),
  );
  const [activeStep, setActiveStep] = useState<StoryboardAgentStep>("script");
  const [editingShot, setEditingShot] = useState<StoryboardShot | null>(null);
  const [editingShotModel, setEditingShotModel] = useState<StoryboardShot | null>(
    null,
  );
  const [selectingAssetShotId, setSelectingAssetShotId] = useState<string | null>(
    null,
  );
  const [selectingAssetDetailTarget, setSelectingAssetDetailTarget] =
    useState<{ kind: StoryboardAssetKind; id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [splitting, setSplitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const agentRef = useRef(agent);

  useEffect(() => {
    agentRef.current = agent;
  }, [agent]);

  const defaults = useMemo<StoryboardShot["modelInfo"]>(
    () => ({
      imageModel: settings.defaultImageModel,
      videoModel: settings.defaultNewVideoModel || settings.defaultVideoModel,
      aspectRatio:
        settings.defaultNewVideoAspectRatio || settings.defaultVideoAspectRatio,
      duration:
        settings.defaultNewVideoDuration || settings.defaultVideoDuration || 5,
      resolution:
        settings.defaultNewVideoResolution || settings.defaultVideoResolution,
    }),
    [
      settings.defaultImageModel,
      settings.defaultNewVideoModel,
      settings.defaultVideoModel,
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

  const agentAssetMap = useMemo(() => {
    const map = new Map<string, StoryboardAssetItem>();
    for (const list of Object.values(agent.assets)) {
      for (const item of list) {
        map.set(item.id, item);
      }
    }
    return map;
  }, [agent.assets]);

  const saveAgent = useCallback(
    async (next: StoryboardAgentData) => {
      agentRef.current = next;
      setAgent(next);
      setSaving(true);
      try {
        await storyboardStorage.saveAgentData(projectId, snippetId, next);
      } catch (error) {
        console.error("[Story] save agent failed", error);
        toast.error("保存剧本 Agent 失败");
      } finally {
        setSaving(false);
      }
    },
    [projectId, snippetId],
  );

  useEffect(() => {
    setLoading(true);
    storyboardStorage
      .loadAgentData(projectId, snippetId)
      .then((data) => {
        const next = normalizeAgentData(data);
        setAgent(next);
        agentRef.current = next;
        setActiveStep(next.unlockedStep);
      })
      .finally(() => setLoading(false));
  }, [projectId, snippetId]);

  const patchAgent = (patch: Partial<StoryboardAgentData>) => {
    setAgent((current) => {
      const next = { ...current, ...patch };
      agentRef.current = next;
      return next;
    });
  };

  const persistCurrent = () => saveAgent(agent);

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

  const updateAsset = (
    kind: StoryboardAssetKind,
    id: string,
    patch: Partial<StoryboardAssetItem>,
  ) => {
    patchAgent({
      assets: {
        ...agent.assets,
        [kind]: agent.assets[kind].map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      },
    });
  };

  const deleteAsset = (kind: StoryboardAssetKind, id: string) => {
    patchAgent({
      assets: {
        ...agent.assets,
        [kind]: agent.assets[kind].filter((item) => item.id !== id),
      },
      shots: agent.shots.map((shot) => ({
        ...shot,
        assetIds: shot.assetIds.filter((assetId) => assetId !== id),
      })),
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
    const localPath = `storyboard/projects/${projectId}/snippets/${snippetId}/assets/${kind}/${id}.${extension}`;
    try {
      await storyboardStorage.saveBinary(localPath, await file.arrayBuffer());
      updateAsset(kind, id, {
        name: agent.assets[kind].find((item) => item.id === id)?.name || file.name,
        source: "upload",
        status: "ready",
        mediaType: getMediaTypeFromFile(file),
        localPath,
      });
      toast.success("资产已上传");
    } catch (error) {
      console.error("[Story] upload asset failed", error);
      toast.error("上传资产失败");
    }
  };

  const generateAsset = async (kind: StoryboardAssetKind, id: string) => {
    updateAsset(kind, id, { source: "ai", status: "generating" });
    window.setTimeout(() => {
      updateAsset(kind, id, { status: "ready", source: "ai" });
      toast.success("AI 资产生成结果已回填");
    }, 600);
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
  }) => {
    if (isAdobeImageGenerationModel(input.model)) {
      const adobeModel = resolveAdobeStoryImageModel(input.model);
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
              size: "1:1",
              resolution: "1K",
            }),
            urls: [],
          })
        : buildXimuNanoBananaRequest({
            model: ximuModel as any,
            cardCode,
            prompt: input.prompt,
            aspectRatio:
              input.model === XIMU_NANO_BANANA2_MODEL
                ? resolveXimuNanoBanana2AspectRatio("1:1")
                : resolveXimuNanoBananaProAspectRatio("1:1"),
            imageSize: resolveXimuImageSize("2K"),
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
        size: "1024x1024",
        response_format: "url",
      });
      const url = getDirectImageUrl(response);
      if (!url) throw new Error("Grok2API 未返回图片地址");
      return url;
    }

    const response: any = await createImageGeneration({
      model: input.model,
      prompt: input.prompt,
      size: "1:1",
      n: 1,
      image_urls: [],
      metadata: { resolution: "2K" },
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

  const generateAssetWithAi = async (
    kind: StoryboardAssetKind,
    id: string,
  ) => {
    if (kind === "audio") {
      toast.error("音效 AI 生成暂未接入音频模型，请先使用本地上传");
      return;
    }

    const asset = agent.assets[kind].find((item) => item.id === id);
    const prompt = (asset?.prompt || asset?.name || "").trim();
    if (!prompt) {
      toast.error("请先填写资产提示词");
      return;
    }

    updateAsset(kind, id, { source: "ai", status: "generating" });
    try {
      const imageUrl = await createStoryAssetImage({
        model:
          asset?.imageModel ||
          settings.defaultImageModel ||
          "doubao-seedream-5-0",
        prompt,
      });
      await saveAssetPatch(kind, id, {
        source: "ai",
        status: "ready",
        mediaType: "image",
        mediaUrl: imageUrl,
      });
      toast.success("AI 资产生成结果已回填");
    } catch (error) {
      console.error("[Story] generate asset failed", error);
      await saveAssetPatch(kind, id, { source: "ai", status: "failed" });
      toast.error("AI 资产生成失败");
    }
  };

  const splitScript = async () => {
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
        defaults,
      });
      const nextAssets = mergeIdentifiedAssets(agent.assets, result.assets);
      const nextShots = bindShotAssetIdsByName(
        result.shots,
        result.shotAssetNames,
        nextAssets,
      );
      const identifiedCount =
        result.assets.role.length +
        result.assets.scene.length +
        result.assets.prop.length;
      await saveAgentWithStep(
        { ...agent, shots: nextShots, assets: nextAssets },
        "assets",
      );
      toast.success(
        `已生成 ${nextShots.length} 条分镜，识别 ${identifiedCount} 个资产`,
      );
    } catch (error) {
      console.error("[Story] split script failed", error);
      toast.error("拆分剧本失败");
    } finally {
      setSplitting(false);
    }
  };

  const proceedToShots = async () => {
    await saveAgentWithStep(agent, "shots");
  };

  const proceedToVideoEdit = async () => {
    await saveAgentWithStep(agent, "video-edit");
  };

  const updateShot = (id: string, patch: Partial<StoryboardShot>) => {
    patchAgent({
      shots: agent.shots.map((shot) =>
        shot.id === id ? { ...shot, ...patch } : shot,
      ),
    });
  };

  const removeAssetFromShot = (shotId: string, assetId: string) => {
    updateShot(shotId, {
      assetIds:
        agent.shots
          .find((shot) => shot.id === shotId)
          ?.assetIds.filter((id) => id !== assetId) ?? [],
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
      let url = isHttpUrl(asset.mediaUrl) ? asset.mediaUrl || "" : "";

      if (!url && settings.assetStoragePath && asset.assetId && assetIndex) {
        const libraryAsset = assetIndex.assets.find(
          (item) => item.id === asset.assetId,
        );
        if (libraryAsset) {
          url = await ensureAssetOssUrl(settings.assetStoragePath, libraryAsset);
        }
      }

      if (!url && asset.localPath) {
        url = await ensureStoryboardLocalMediaOssUrl(asset);
      }

      if (!isHttpUrl(url)) {
        continue;
      }

      const mediaType = getStoryAssetMediaType(asset);
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
    const prompt = (shot.prompt || shot.script || "").trim();
    if (!prompt) {
      toast.error("请先填写分镜提示词");
      return;
    }

    updateShot(shot.id, { videoStatus: "generating" });
    try {
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

  const deleteShotVideo = async (shot: StoryboardShot) => {
    await saveShotPatch(shot.id, {
      video: undefined,
      videoStatus: "idle",
      videoEdit: undefined,
    });
    toast.success("视频素材已删除");
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
    setSelectingAssetDetailTarget({ kind, id });
  };

  const handleUseAssetDetailLibraryAssets = async (assets: AssetRecord[]) => {
    if (!selectingAssetDetailTarget || assets.length === 0) return;

    const usableAssets = assets.filter((asset) => asset.mediaType !== "audio");
    if (usableAssets.length === 0) {
      toast.error("资产详情仅支持图片或视频资产");
      return;
    }

    const currentAgent = agentRef.current;
    const { kind, id } = selectingAssetDetailTarget;
    const currentList = currentAgent.assets[kind] || [];
    const targetIndex = currentList.findIndex((item) => item.id === id);

    if (targetIndex < 0) {
      setSelectingAssetDetailTarget(null);
      toast.error("当前资产项不存在");
      return;
    }

    const nextList = [...currentList];
    const firstAsset = usableAssets[0];
    const firstItem = createLibraryStoryboardAsset(
      firstAsset,
      kind,
      settings.assetStoragePath,
    );
    nextList[targetIndex] = {
      ...nextList[targetIndex],
      ...firstItem,
      id,
      kind,
    };

    const existingAssetIds = new Set(
      nextList
        .map((item) => item.assetId)
        .filter((assetId): assetId is string => Boolean(assetId)),
    );

    for (const asset of usableAssets.slice(1)) {
      if (existingAssetIds.has(asset.id)) continue;
      const item = createLibraryStoryboardAsset(
        asset,
        kind,
        settings.assetStoragePath,
      );
      nextList.push(item);
      existingAssetIds.add(asset.id);
    }

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
      shots: currentAgent.shots.map((shot) =>
        shot.id === selectingAssetShotId
          ? {
              ...shot,
              assetIds: Array.from(new Set([...shot.assetIds, ...selectedIds])),
            }
          : shot,
      ),
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
                  填写剧本信息后，点击下一步调用大模型拆分生成分镜表格。
                </p>
              </div>
              <Button variant="blue" onClick={splitScript} loading={splitting}>
                <WandSparkles size={15} />
                下一步
              </Button>
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
              <label>
                <span className="mb-2 block text-sm text-white/65">
                  提示词前缀
                </span>
                <input
                  className={inputClass}
                  value={agent.promptPrefix}
                  onChange={(event) =>
                    patchAgent({ promptPrefix: event.target.value })
                  }
                  placeholder="默认：全程无字幕"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm text-white/65">
                  提示词后缀
                </span>
                <input
                  className={inputClass}
                  value={agent.promptSuffix}
                  onChange={(event) =>
                    patchAgent({ promptSuffix: event.target.value })
                  }
                  placeholder="默认：现实写实风格"
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
                    角色、场景、道具按列管理，每列是独立资产列表。
                  </p>
                </div>
                <Button variant="blue" onClick={proceedToShots}>
                  下一步
                </Button>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                {assetDetailKinds.map((kind) => (
                  <div
                    key={kind.id}
                    className="flex min-h-[520px] flex-col rounded-lg border border-white/8 bg-black/20"
                  >
                    <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                      <h3 className="text-sm font-medium text-white/85">
                        {kind.label}
                      </h3>
                      <Button size="sm" onClick={() => addAsset(kind.id)}>
                        <Plus size={13} />
                        新增
                      </Button>
                    </div>
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                      {agent.assets[kind.id].length === 0 ? (
                        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-white/10 text-sm text-white/30">
                          暂无{kind.label}资产
                        </div>
                      ) : (
                        agent.assets[kind.id].map((item, index) => (
                          <AssetColumnItem
                            key={item.id}
                            item={item}
                            index={index}
                            imageModelOptions={visibleImageModels}
                            defaultImageModel={settings.defaultImageModel}
                            onChange={(patch) =>
                              updateAsset(kind.id, item.id, patch)
                            }
                            onUpload={(file) =>
                              void uploadAsset(kind.id, item.id, file)
                            }
                            onUseLibrary={() =>
                              openAssetLibraryForAssetDetail(kind.id, item.id)
                            }
                            onGenerate={() =>
                              void generateAssetWithAi(kind.id, item.id)
                            }
                            onDelete={() => deleteAsset(kind.id, item.id)}
                          />
                        ))
                      )}
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
                <Button onClick={persistCurrent}>保存分镜</Button>
                <Button variant="blue" onClick={proceedToVideoEdit}>
                  下一步
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-white/8">
              <table className="min-w-[1180px] w-full table-fixed">
                <thead className="bg-black/30 text-xs text-white/45">
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
                        selectedAssets={shot.assetIds
                          .map((id) => agentAssetMap.get(id))
                          .filter(Boolean) as StoryboardAssetItem[]}
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
              onDownload={(shot) => void downloadShotVideo(shot)}
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
  onDownload,
  onEdit,
  onDelete,
}: {
  shots: StoryboardShot[];
  onDownload: (shot: StoryboardShot) => void;
  onEdit: (shot: StoryboardShot) => void;
  onDelete: (shot: StoryboardShot) => void;
}) => (
  <section className="rounded-xl border border-white/10 bg-[#111113] p-5">
    <div className="mb-5">
      <h2 className="text-base font-medium text-white/90">视频编辑</h2>
      <p className="mt-1 text-xs text-white/40">
        汇总已生成的视频素材，支持下载、抽屉编辑和删除素材引用。
      </p>
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
  const [value, setValue] = useState<VideoParamState>(() => getShotVideoParamState(shot));

  useEffect(() => {
    setValue(getShotVideoParamState(shot));
  }, [shot]);

  const patchValue = (patch: Partial<VideoParamState>) => {
    setValue((current) => ({ ...current, ...patch }));
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
              <span className="font-semibold text-[#D9B4FF]">{value.duration}s</span>
            </div>

            {config.duration.type === "slider" ? (
              <div className="space-y-2">
                <Slider
                  value={[value.duration]}
                  min={config.duration.min}
                  max={config.duration.max}
                  step={config.duration.step ?? 1}
                  onValueChange={(values) => patchValue({ duration: values[0] })}
                  className="[&_[data-slot=slider-range]]:bg-[#B43FEB] [&_[data-slot=slider-thumb]]:border-[#B43FEB]"
                />
                <div className="flex justify-between text-[11px] text-white/35">
                  <span>{config.duration.min}s</span>
                  <span>{config.duration.max}s</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {config.duration.options.map((option) => {
                  const active = value.duration === Number(option.value);
                  return (
                    <button
                      key={String(option.value)}
                      type="button"
                      onClick={() =>
                        patchValue({ duration: Number(option.value) })
                      }
                      className={storyVideoOptionButtonClass(active, "h-8 px-3")}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            )}
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
        thumbnail: localPreviewUrls[asset.id] || asset.mediaUrl || "",
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
        <div className="mb-3">
          <ReferenceThumbnails
            items={mentionItems}
            onRemove={(item) => onRemoveAsset(item.id)}
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
                <StoryAssetPreview item={asset} compact />
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
