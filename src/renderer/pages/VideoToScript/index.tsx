import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { exists, readFile, writeFile } from "@tauri-apps/plugin-fs";
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Download,
  Eye,
  FileText,
  FileJson,
  Link2,
  Loader2,
  PlayCircle,
  RotateCcw,
  Scissors,
  Search,
  UploadCloud,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "shared/utils/utils";
import { createDashscopeChatCompletion } from "@/api/ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalTitle,
} from "@/components/ui/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getUploadOssPutUrl,
  type UploadOssPutUrlResp,
} from "@/api/jikeGo";

type ProbeStatus = "success" | "error";
type InputMode = "hongguo" | "shot4u";
type ProbeScope = "first10" | "all";
type InputChannel = "shot4u" | "localMp4" | "search";
type VideoToScriptModel = "qwen3.5-flash" | "qwen3.7-plus";
type DownloadStatus = "idle" | "pending" | "success" | "error" | "skipped";
type UploadStatus = "idle" | "pending" | "success" | "error";
type ScriptStatus = "idle" | "pending" | "success" | "error";
type ClipStatus = "idle" | "pending" | "success" | "error" | "skipped";

type EpisodeM3u8Result = {
  episode: number;
  pageUrl: string;
  m3u8Url: string;
  mp4Url?: string;
  hongguoSourceUrl?: string;
  hongguoDecryptKey?: string;
  hongguoDefinition?: string;
  title: string;
  nextPageUrl: string;
  status: ProbeStatus;
  source: InputMode;
  referer?: string;
  origin?: string;
  localMp4Path?: string;
  remoteVideoUrl?: string;
  downloadStatus?: DownloadStatus;
  downloadMessage?: string;
  uploadStatus?: UploadStatus;
  uploadMessage?: string;
  clipStatus?: ClipStatus;
  clipMessage?: string;
  clipOutputDir?: string;
  clipCount?: number;
  clipSegmentSeconds?: number;
  clipPaths?: string[];
  scriptStatus?: ScriptStatus;
  scriptContent?: string;
  scriptError?: string;
  message?: string;
};

type PlayerPayload = {
  url?: string;
  url_next?: string;
  link?: string;
  link_next?: string;
  id?: string;
  sid?: number;
  nid?: number;
  vod_data?: {
    vod_name?: string;
  };
};

type CommandResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type M3u8ToMp4Result = {
  path: string;
  format: string;
  method: string;
  skippedSegments?: number;
  skippedUrls?: string[];
};

type SplitMp4Result = {
  outputDir: string;
  clipCount: number;
  clips: string[];
  segmentSeconds: number;
  method: string;
};

type BulkProgress = {
  current: number;
  total: number;
  success: number;
  failed: number;
  skipped: number;
  concurrency: number;
  activeEpisodes: number[];
  stopRequested: boolean;
};

type ScriptBulkProgress = {
  current: number;
  total: number;
  success: number;
  failed: number;
  skipped: number;
  concurrency: number;
  activeEpisodes: number[];
  stopRequested: boolean;
};

type FetchVideoPageResult = {
  html: string;
};

type FetchShot4uPlaylistResult = {
  assUrl: string;
  m3u8Urls: string[];
};

type Mp4DownloadResult = {
  path: string;
  format: string;
  method: string;
};

type HongguoSearchItem = {
  id: string;
  cover?: string;
  title?: string;
  rec?: string;
  intro?: string;
  episode_num?: number;
  role?: string;
  type?: string;
  score?: string;
  record_number?: string;
};

type HongguoEpisodeItem = {
  index: number;
  title?: string;
  video_id: string;
};

type HongguoVideoListItem = {
  decrypt_key?: string;
  definition?: string;
  height?: number;
  type?: string;
  url?: string;
};

type ModeDraft = {
  startUrl: string;
  maxEpisodes: string;
  results: EpisodeM3u8Result[];
};

type PersistedState = {
  activeMode?: InputMode;
  modes?: Partial<Record<InputMode, ModeDraft>>;
  bulkConcurrency?: string;
  inputMode?: InputMode;
  startUrl?: string;
  maxEpisodes?: string;
  results?: EpisodeM3u8Result[];
};

const DEFAULT_SHOT4U_URL = "https://m.shot4u.com/play/2656-0-22.html";
const DEFAULT_MAX_EPISODES = 80;
const FIRST_PROBE_EPISODE_COUNT = 10;
const DEFAULT_BULK_CONCURRENCY = 10;
const SCRIPT_BULK_CONCURRENCY = 10;
const OSS_UPLOAD_CONCURRENCY = 5;
const CLIP_SEGMENT_SECONDS = 14;
const HARD_MAX_EPISODES = 200;
const MAX_BULK_CONCURRENCY = 10;
const DEFAULT_VIDEO_TO_SCRIPT_MODEL: VideoToScriptModel = "qwen3.5-flash";
const VIDEO_TO_SCRIPT_MODELS: Array<{
  value: VideoToScriptModel;
  label: string;
}> = [
  { value: "qwen3.5-flash", label: "qwen3.5-flash" },
  { value: "qwen3.7-plus", label: "qwen3.7-plus" },
];
const INPUT_CHANNELS: Array<{
  value: InputChannel;
  label: string;
  description: string;
}> = [
  {
    value: "localMp4",
    label: "导入 MP4",
    description: "本地视频上传",
  },
  {
  value: "shot4u",
  label: "Shot4u",
  description: "播放页解析",
  },
  {
    value: "search",
    label: "搜索",
    description: "搜索短剧",
  },
];
const STORAGE_KEY = "jike.videoToScript.state.v1";
const HONGGUO_API_KEY = import.meta.env.VITE_HONGGUO_API_KEY || "";
const OSS_DIRECT_UPLOAD_TTL = 12 * 60 * 60;
const VIDEO_TO_SCRIPT_SYSTEM_PROMPT = `你是短剧成片拉片剧本整理师。你的任务是观看用户提供的单集短剧视频，只整理“剧情正文”，按短剧成片还原稿的方式整理本集内容。

只输出剧情正文，不要输出剧情梗概、人物表、二创改写要点、分析说明、Markdown 标题、表格或项目符号。

输出目标：
尽量还原成片内容，而不是写摘要。重点保留人物动作、表情反应、镜头切换、转场、屏幕文字、音效、旁白、内心 OS 和完整对白。宁可多写动作、反应和转场，也不要省略成概括句。

输出格式必须严格参照下面的样式：

第一集

1-1 山林小道 日 外
出场人物：姜晚，程泽舟，云瑶，散修头目，散修数名
▲急促的脚步声和喘息声打破林间寂静。
▲姜晚架着重伤的程泽舟，踉跄前行，额角沁汗，衣裙染血带尘。
角色A：台词。
角色B（VO）（动作｜语气｜情绪）：台词。
▲身后传来杂乱的脚步声和狞笑。散修头目带着几名散修围上。
散修头目（目光逡巡，猥琐大笑）：哈哈哈！又来个细皮嫩肉的小美人！
▲闪回
1-2 现代卧室 日 内
出场人物：姜晚
▲电脑屏幕亮着，文档标题：《斗破星河》。
姜晚（VO）（动作｜语气｜情绪）：我叫姜晚，一个勤勤恳恳的网文编辑。
▲闪回结束

具体规则：
1. 第一行必须是本集标题，格式为“第一集”“第二集”，集数使用用户提供的当前集数并转为中文数字。
2. 场头使用“X-Y 地点 日/夜 内/外”格式；X 是集数，Y 是本集场次序号，从 1 开始递增。
3. 场头下一行必须写“出场人物：”，列出本场出现或发声的角色，角色之间用中文逗号分隔。群体角色可写“护士2人”“随从若干”“路人若干”。
4. 叙事、动作、表情、镜头、转场、屏幕文字、音效、BGM 统一用“▲”开头。动作描写要具体、连续，尽量还原画面，不要只写一句概括。
5. 不要按固定时长或每个镜头硬拆场。只有地点、时间、剧情阶段、人物关系、冲突升级或闪回/想象明显变化时才新开一场。
6. 对话格式必须严格为“角色（具体标注）：台词”。括号标注必须放在角色名之后、冒号之前。标注只能写视频中能判断出的具体动作、语气或情绪词，多标签用竖线“｜”分隔，例如“唐竹筠（压低声音｜急切｜紧张）：快走！”。严禁输出“动作”“语气”“情绪”这三个占位词，严禁写成“角色（动作｜语气｜情绪）：台词”。无法确认具体标注时，直接写“角色：台词”，不要为了填格式强行编造。
7. 内心独白、画外音、旁白、广播写在角色括号里，例如“姜晚（OS）：台词”“系统（VO）：台词”“广播（VO）：台词”。不要写成“【OS】角色：台词”。
8. 回忆、闪回、想象或插入片段可用“▲闪回”“▲闪回结束”“▲想象”“▲想象结束”单独成行。
9. 台词优先还原字幕和人物原话，网络梗、口头禅、停顿、省略号、语气词也要保留；听不清或看不清时用“【听不清】”标记，不要编造。
10. 已知角色名必须保持一致。画面姓名牌、字幕或上下文已经确认姓名后，不要再写“男主”“女主”“系统猫”等泛称。无法确认姓名时，可用“男主”“女主”“母亲”“反派男”“路人”等临时称呼，但全文必须保持一致。
11. 严格基于视频内容输出，不要补写视频之外的剧情，不要解释你的判断，不要在结尾另写总结或钩子说明。`;
const SOURCE_CONFIG: Record<
  InputMode,
  { label: string; placeholder: string; referer: string; origin: string }
> = {
  hongguo: {
    label: "Shot4u 播放页",
    placeholder: DEFAULT_SHOT4U_URL,
    referer: "https://m.shot4u.com/",
    origin: "https://m.shot4u.com",
  },
  shot4u: {
    label: "Shot4u 播放页",
    placeholder: DEFAULT_SHOT4U_URL,
    referer: "https://m.shot4u.com/",
    origin: "https://m.shot4u.com",
  },
};

type NormalizedPersistedState = {
  activeMode: InputMode;
  modes: Record<InputMode, ModeDraft>;
  bulkConcurrency: string;
};

const isInputMode = (value: unknown): value is InputMode =>
  value === "shot4u";

const createDefaultModeDraft = (mode: InputMode): ModeDraft => ({
  startUrl: SOURCE_CONFIG[mode].placeholder,
  maxEpisodes: String(DEFAULT_MAX_EPISODES),
  results: [],
});

const normalizeModeDraft = (
  mode: InputMode,
  value: unknown,
): ModeDraft => {
  const fallback = createDefaultModeDraft(mode);
  if (!value || typeof value !== "object") return fallback;

  const draft = value as Partial<ModeDraft>;
  return {
    startUrl: typeof draft.startUrl === "string" ? draft.startUrl : fallback.startUrl,
    maxEpisodes:
      typeof draft.maxEpisodes === "string"
        ? draft.maxEpisodes
        : fallback.maxEpisodes,
    results: Array.isArray(draft.results) ? draft.results : fallback.results,
  };
};

const loadPersistedState = (): NormalizedPersistedState => {
  const fallback: NormalizedPersistedState = {
    activeMode: "shot4u",
    modes: {
      hongguo: createDefaultModeDraft("hongguo"),
      shot4u: createDefaultModeDraft("shot4u"),
    },
    bulkConcurrency: String(DEFAULT_BULK_CONCURRENCY),
  };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as PersistedState;
    const activeMode = isInputMode(parsed.activeMode)
      ? parsed.activeMode
      : isInputMode(parsed.inputMode)
        ? parsed.inputMode
        : fallback.activeMode;
    const modes: Record<InputMode, ModeDraft> = {
      hongguo: normalizeModeDraft("hongguo", parsed.modes?.hongguo),
      shot4u: normalizeModeDraft("shot4u", parsed.modes?.shot4u),
    };

    if (!parsed.modes && parsed.inputMode) {
      modes[activeMode] = normalizeModeDraft(activeMode, {
        startUrl: parsed.startUrl,
        maxEpisodes: parsed.maxEpisodes,
        results: parsed.results,
      });
    }

    return {
      activeMode,
      modes,
      bulkConcurrency:
        typeof parsed.bulkConcurrency === "string"
          ? String(
              Math.max(
                DEFAULT_BULK_CONCURRENCY,
                normalizeBulkConcurrency(parsed.bulkConcurrency),
              ),
            )
          : fallback.bulkConcurrency,
    };
  } catch {
    return fallback;
  }
};

const persistState = (state: NormalizedPersistedState) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable or full; parsing/downloading should still work.
  }
};

const extractEpisodeFromUrl = (pageUrl: string) => {
  const match = pageUrl.match(/-(\d+)\.html(?:[?#].*)?$/);
  return match ? Number(match[1]) : 0;
};

const normalizeMaxEpisodes = (value: string) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return DEFAULT_MAX_EPISODES;
  return Math.max(1, Math.min(HARD_MAX_EPISODES, Math.floor(numericValue)));
};

const normalizeBulkConcurrency = (value: string) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return DEFAULT_BULK_CONCURRENCY;
  return Math.max(1, Math.min(MAX_BULK_CONCURRENCY, Math.floor(numericValue)));
};

let activeOssUploads = 0;
const pendingOssUploadStarters: Array<() => void> = [];

const acquireOssUploadSlot = () =>
  new Promise<() => void>((resolve) => {
    const start = () => {
      activeOssUploads += 1;
      let released = false;
      resolve(() => {
        if (released) return;
        released = true;
        activeOssUploads = Math.max(0, activeOssUploads - 1);
        pendingOssUploadStarters.shift()?.();
      });
    };

    if (activeOssUploads < OSS_UPLOAD_CONCURRENCY) {
      start();
    } else {
      pendingOssUploadStarters.push(start);
    }
  });

const runWithOssUploadSlot = async <T,>(task: () => Promise<T>) => {
  const release = await acquireOssUploadSlot();
  try {
    return await task();
  } finally {
    release();
  }
};

const unwrapJikeGoData = <T,>(response: any): T => {
  if (!response) {
    throw new Error("请求无响应数据");
  }
  if (typeof response.code === "number") {
    if (response.code !== 0 && response.code !== 200) {
      throw new Error(response.msg || response.message || "请求失败");
    }
    return response.data as T;
  }
  return response as T;
};

const uploadBlobToSignedPutUrl = (
  putUrl: string,
  headers: Record<string, string> | undefined,
  blob: Blob,
  onProgress?: (percent: number) => void,
) =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", putUrl, true);

    Object.entries(headers || {}).forEach(([key, value]) => {
      if (value) {
        xhr.setRequestHeader(key, value);
      }
    });

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`OSS 直传失败：HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("OSS 直传失败：网络异常或跨域配置错误"));
    xhr.onabort = () => reject(new Error("OSS 直传已取消"));
    xhr.send(blob.slice(0, blob.size, ""));
  });

const uploadVideoToOssDirect = async (
  blob: Blob,
  fileName: string,
  onProgress?: (percent: number) => void,
) => {
  const ext = fileName.split(".").pop()?.toLowerCase() || "mp4";
  const signed = unwrapJikeGoData<UploadOssPutUrlResp>(
    await getUploadOssPutUrl({
      blob_type: "video",
      ext,
      content_type: "video/mp4",
      ttl: OSS_DIRECT_UPLOAD_TTL,
    }),
  );

  if (!signed.put_url || !signed.access_url) {
    throw new Error("获取 OSS 直传地址失败");
  }

  await uploadBlobToSignedPutUrl(
    signed.put_url,
    signed.headers,
    blob,
    onProgress,
  );

  return { fileKey: signed.key, url: signed.access_url };
};

const toAbsoluteUrl = (value: string | undefined, baseUrl: string) => {
  if (!value) return "";
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return "";
  }
};

const extractPlayerPayload = (html: string): PlayerPayload => {
  const match = html.match(
    /var\s+player_aaaa\s*=\s*(\{[\s\S]*?\})\s*(?:;|<\/script>)/,
  );

  if (!match?.[1]) {
    throw new Error("页面中未找到 player_aaaa 播放数据");
  }

  try {
    return JSON.parse(match[1]) as PlayerPayload;
  } catch {
    throw new Error("player_aaaa 播放数据格式无法解析");
  }
};

const requestPageHtml = async (pageUrl: string) => {
  const response = await invoke<CommandResponse<FetchVideoPageResult>>(
    "video_fetch_play_page",
    {
      request: {
        url: pageUrl,
      },
    },
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || "页面请求失败");
  }

  return response.data.html;
};

const requestShot4uPlaylist = async (pageUrl: string) => {
  const response = await invoke<CommandResponse<FetchShot4uPlaylistResult>>(
    "video_fetch_shot4u_playlist",
    {
      request: {
        url: pageUrl,
      },
    },
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || "Shot4u 播放列表请求失败");
  }

  return response.data;
};

const requestHongguoApi = async <T,>(
  request: Record<string, string | undefined>,
) => {
  const response = await invoke<CommandResponse<T>>("video_fetch_hongguo_api", {
    request,
  });

  if (!response.success || !response.data) {
    throw new Error(response.error || "红果 API 请求失败");
  }

  return response.data;
};

const requestHongguoDecrypt = async (
  url: string,
  decryptKey: string,
) => {
  const response = await invoke<CommandResponse<{ data?: { url?: string } }>>(
    "video_decrypt_hongguo_video",
    {
      request: {
        key: HONGGUO_API_KEY,
        url: window.btoa(url),
        decrypt_key: decryptKey,
      },
    },
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || "红果云解析失败");
  }

  const mp4Url = response.data.data?.url;
  if (!mp4Url) {
    throw new Error("红果云解析未返回 MP4 地址");
  }

  return mp4Url;
};

const downloadMp4Url = async (
  url: string,
  outputPath: string,
  options?: { referer?: string; origin?: string },
) => {
  const response = await invoke<CommandResponse<Mp4DownloadResult>>(
    "video_download_mp4_url",
    {
      request: {
        url,
        outputPath,
        referer: options?.referer,
        origin: options?.origin,
      },
    },
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || "MP4 下载失败");
  }

  return response.data;
};

const definitionRank = (definition: string | undefined) => {
  const match = String(definition || "").match(/(\d+)/);
  return match?.[1] ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
};

const selectLowestQualityMp4 = (items: HongguoVideoListItem[]) => {
  const candidates = items
    .filter((item) => item.type === "mp4" && item.url && item.decrypt_key)
    .sort((a, b) => {
      const aHeight = Number.isFinite(a.height) ? Number(a.height) : definitionRank(a.definition);
      const bHeight = Number.isFinite(b.height) ? Number(b.height) : definitionRank(b.definition);
      return aHeight - bHeight;
    });

  return candidates[0];
};

const buildPlainText = (results: EpisodeM3u8Result[]) =>
  results
    .filter((item) => item.status === "success" && item.m3u8Url)
    .map((item) => `第${item.episode}集 ${item.m3u8Url}`)
    .join("\n");

const sanitizeFileName = (value: string) => {
  const normalized = value.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
  return normalized || "video";
};

const getEpisodeFileName = (item: EpisodeM3u8Result) => {
  const title = item.title ? `${item.title}_` : "";
  return sanitizeFileName(
    `${title}第${String(item.episode).padStart(2, "0")}集.mp4`,
  );
};

const joinPath = (dir: string, filename: string) => {
  const separator = dir.includes("\\") ? "\\" : "/";
  return `${dir.replace(/[\\/]+$/, "")}${separator}${filename}`;
};

const appendExtensionIfMissing = (path: string, extension: string) => {
  const normalizedExtension = extension.startsWith(".")
    ? extension.slice(1)
    : extension;
  const filename = path.split(/[\\/]/).pop() || "";
  if (filename.includes(".") || !normalizedExtension) {
    return path;
  }
  return `${path}.${normalizedExtension}`;
};

const getPathFileName = (path: string) => path.split(/[\\/]/).pop() || path;

const stripFileExtension = (filename: string) =>
  filename.replace(/\.[^.\\/]+$/, "");

const inferEpisodeFromFilePath = (path: string, fallbackEpisode: number) => {
  const filename = stripFileExtension(getPathFileName(path));
  const patterns = [
    /第\s*0*(\d+)\s*集/i,
    /(?:ep|episode|e)\s*0*(\d+)/i,
    /(?:^|[^\d])0*(\d{1,4})(?:[^\d]|$)/,
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    const episode = match?.[1] ? Number(match[1]) : 0;
    if (Number.isFinite(episode) && episode > 0) return episode;
  }

  return fallbackEpisode;
};

const getItemKey = (item: Pick<EpisodeM3u8Result, "episode" | "pageUrl">) =>
  `${item.episode}-${item.pageUrl}`;

const parseHongguoPageUrl = (pageUrl: string) => {
  const match = pageUrl.match(/^hongguo:([^:]+):(.+)$/);
  if (!match) return null;
  return {
    dramaId: match[1],
    videoId: match[2],
  };
};

const convertM3u8ToMp4 = async (
  m3u8Url: string,
  outputPath: string,
  headers?: Pick<EpisodeM3u8Result, "referer" | "origin">,
) => {
  const response = await invoke<CommandResponse<M3u8ToMp4Result>>(
    "video_download_m3u8_to_mp4",
    {
      request: {
        m3u8Url,
        outputPath,
        referer: headers?.referer,
        origin: headers?.origin,
      },
    },
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || "m3u8 转 MP4 失败");
  }

  return response.data;
};

const splitMp4BySeconds = async (
  inputPath: string,
  segmentSeconds = CLIP_SEGMENT_SECONDS,
) => {
  const response = await invoke<CommandResponse<SplitMp4Result>>(
    "video_split_mp4_by_seconds",
    {
      request: {
        inputPath,
        segmentSeconds,
      },
    },
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || "MP4 裁切失败");
  }

  return response.data;
};

const extractChatCompletionText = (response: any) => {
  const content = response?.data?.choices?.[0]?.message?.content ??
    response?.choices?.[0]?.message?.content ??
    response?.output_text ??
    "";
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((item) => item?.text || item?.content || "")
      .filter(Boolean)
      .join("")
      .trim();
  }
  return "";
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const paragraphXml = (text: string, style?: string) => {
  const styleXml = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";
  const preserve = text.trim() !== text ? ' xml:space="preserve"' : "";
  return `<w:p>${styleXml}<w:r><w:t${preserve}>${escapeXml(text)}</w:t></w:r></w:p>`;
};

const scriptToWordXml = (item: EpisodeM3u8Result) => {
  const lines = (item.scriptContent || "")
    .split(/\r?\n/)
    .filter((line, index) => index !== 0 || !/^第.+集$/.test(line.trim()));
  const blocks = [paragraphXml(`第${item.episode}集`, "Heading1")];

  for (const line of lines) {
    if (line.startsWith("### ")) {
      blocks.push(paragraphXml(line.replace(/^###\s+/, ""), "Heading3"));
    } else if (line.startsWith("## ")) {
      blocks.push(paragraphXml(line.replace(/^##\s+/, ""), "Heading2"));
    } else if (line.startsWith("# ")) {
      blocks.push(paragraphXml(line.replace(/^#\s+/, ""), "Heading1"));
    } else if (line.trim()) {
      blocks.push(paragraphXml(line));
    } else {
      blocks.push(paragraphXml(""));
    }
  }

  blocks.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
  return blocks.join("");
};

const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const uint16 = (value: number) => {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
};

const uint32 = (value: number) => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
};

const concatBytes = (parts: Uint8Array[]) => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
};

const createZip = (files: Array<{ path: string; content: string }>) => {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const data = encoder.encode(file.content);
    const checksum = crc32(data);
    const localHeader = concatBytes([
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(checksum),
      uint32(data.length),
      uint32(data.length),
      uint16(nameBytes.length),
      uint16(0),
      nameBytes,
    ]);
    localParts.push(localHeader, data);

    centralParts.push(
      concatBytes([
        uint32(0x02014b50),
        uint16(20),
        uint16(20),
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(checksum),
        uint32(data.length),
        uint32(data.length),
        uint16(nameBytes.length),
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(0),
        uint32(offset),
        nameBytes,
      ]),
    );
    offset += localHeader.length + data.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const end = concatBytes([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(files.length),
    uint16(files.length),
    uint32(centralDirectory.length),
    uint32(offset),
    uint16(0),
  ]);

  return concatBytes([...localParts, centralDirectory, end]);
};

const createScriptsDocx = (items: EpisodeM3u8Result[]) => {
  const body = items.map(scriptToWordXml).join("");
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>
</w:document>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
</w:styles>`;

  return createZip([
    {
      path: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`,
    },
    {
      path: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    },
    {
      path: "word/_rels/document.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { path: "word/document.xml", content: documentXml },
    { path: "word/styles.xml", content: stylesXml },
  ]);
};

export default function VideoToScriptPage() {
  const [initialState] = useState(loadPersistedState);
  const [inputMode, setInputMode] = useState<InputMode>(
    initialState.activeMode,
  );
  const [modeDrafts, setModeDrafts] = useState(initialState.modes);
  const [bulkConcurrency, setBulkConcurrency] = useState(
    initialState.bulkConcurrency,
  );
  const [running, setRunning] = useState(false);
  const [currentPageUrl, setCurrentPageUrl] = useState("");
  const [downloadingMap, setDownloadingMap] = useState<Record<string, boolean>>(
    {},
  );
  const [uploadingMap, setUploadingMap] = useState<Record<string, boolean>>({});
  const [scriptingMap, setScriptingMap] = useState<Record<string, boolean>>({});
  const [splittingMap, setSplittingMap] = useState<Record<string, boolean>>({});
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
  const [bulkSplitting, setBulkSplitting] = useState(false);
  const [splitBulkProgress, setSplitBulkProgress] =
    useState<BulkProgress | null>(null);
  const [scriptBulkGenerating, setScriptBulkGenerating] = useState(false);
  const [scriptBulkProgress, setScriptBulkProgress] =
    useState<ScriptBulkProgress | null>(null);
  const [viewingScriptItem, setViewingScriptItem] =
    useState<EpisodeM3u8Result | null>(null);
  const [missingScriptEpisodes, setMissingScriptEpisodes] = useState<number[]>(
    [],
  );
  const [probeScopeDialogOpen, setProbeScopeDialogOpen] = useState(false);
  const [selectedProbeScope, setSelectedProbeScope] =
    useState<ProbeScope>("first10");
  const [scriptWorkflowDialogOpen, setScriptWorkflowDialogOpen] =
    useState(false);
  const [selectedScriptWorkflowScope, setSelectedScriptWorkflowScope] =
    useState<ProbeScope>("first10");
  const [scriptWorkflowRunning, setScriptWorkflowRunning] = useState(false);
  const [videoToScriptModel, setVideoToScriptModel] =
    useState<VideoToScriptModel>(DEFAULT_VIDEO_TO_SCRIPT_MODEL);
  const [activeChannel, setActiveChannel] = useState<InputChannel>("shot4u");
  const [hongguoKeyword, setHongguoKeyword] = useState("乌龙假扮恋");
  const [hongguoPage, setHongguoPage] = useState("1");
  const [hongguoSearching, setHongguoSearching] = useState(false);
  const [hongguoSearchResults, setHongguoSearchResults] = useState<
    HongguoSearchItem[]
  >([]);
  const [hongguoSearchDialogOpen, setHongguoSearchDialogOpen] =
    useState(false);
  const stopRequestedRef = useRef(false);
  const bulkStopRequestedRef = useRef(false);
  const splitBulkStopRequestedRef = useRef(false);
  const scriptBulkStopRequestedRef = useRef(false);
  const currentDraft = modeDrafts[inputMode] || createDefaultModeDraft(inputMode);
  const { startUrl, maxEpisodes, results } = currentDraft;
  const activeChannelConfig =
    INPUT_CHANNELS.find((channel) => channel.value === activeChannel) ||
    INPUT_CHANNELS[0];

  const updateModeDraft = (
    mode: InputMode,
    updater: (draft: ModeDraft) => ModeDraft,
  ) => {
    setModeDrafts((current) => {
      const draft = current[mode] || createDefaultModeDraft(mode);
      return {
        ...current,
        [mode]: updater(draft),
      };
    });
  };

  const setModeResults = (
    mode: InputMode,
    updater:
      | EpisodeM3u8Result[]
      | ((current: EpisodeM3u8Result[]) => EpisodeM3u8Result[]),
  ) => {
    updateModeDraft(mode, (draft) => ({
      ...draft,
      results:
        typeof updater === "function" ? updater(draft.results) : updater,
    }));
  };

  const setCurrentStartUrl = (value: string) => {
    updateModeDraft(inputMode, (draft) => ({ ...draft, startUrl: value }));
  };

  const setCurrentMaxEpisodes = (value: string) => {
    updateModeDraft(inputMode, (draft) => ({ ...draft, maxEpisodes: value }));
  };

  const setCurrentResults = (
    updater:
      | EpisodeM3u8Result[]
      | ((current: EpisodeM3u8Result[]) => EpisodeM3u8Result[]),
  ) => {
    setModeResults(inputMode, updater);
  };

  const updateResultItem = (
    item: EpisodeM3u8Result,
    patch: Partial<EpisodeM3u8Result>,
  ) => {
    updateResultItemByKey(item.source, getItemKey(item), patch);
  };

  const updateResultItemByKey = (
    source: InputMode,
    itemKey: string,
    patch: Partial<EpisodeM3u8Result>,
  ) => {
    setModeResults(source, (current) =>
      current.map((resultItem) =>
        getItemKey(resultItem) === itemKey ? { ...resultItem, ...patch } : resultItem,
      ),
    );
  };

  const successCount = useMemo(
    () => results.filter((item) => item.status === "success").length,
    [results],
  );

  useEffect(() => {
    persistState({
      activeMode: inputMode,
      modes: modeDrafts,
      bulkConcurrency: String(normalizeBulkConcurrency(bulkConcurrency)),
    });
  }, [bulkConcurrency, inputMode, modeDrafts]);

  const probeEpisodeResults = async (
    scope: ProbeScope,
    modeAtStart: InputMode,
    rawStartUrl: string,
    options?: {
      onCurrentPage?: (url: string) => void;
      onItem?: (item: EpisodeM3u8Result) => void;
    },
  ) => {
    let nextPageUrl = rawStartUrl.trim();
    if (!nextPageUrl) {
      throw new Error("请输入播放页链接");
    }

    try {
      nextPageUrl = new URL(nextPageUrl).toString();
    } catch {
      throw new Error("播放页链接格式不正确");
    }

    const limit =
      scope === "first10" ? FIRST_PROBE_EPISODE_COUNT : HARD_MAX_EPISODES;
    const sourceConfig = SOURCE_CONFIG[modeAtStart];
    const visited = new Set<string>();
    const parsedItems: EpisodeM3u8Result[] = [];

    options?.onCurrentPage?.(nextPageUrl);

    if (modeAtStart === "shot4u") {
      const playlist = await requestShot4uPlaylist(nextPageUrl);
      if (stopRequestedRef.current) return parsedItems;

      const items = (scope === "first10"
        ? playlist.m3u8Urls.slice(0, FIRST_PROBE_EPISODE_COUNT)
        : playlist.m3u8Urls
      ).map((m3u8Url, index) => ({
        episode: index + 1,
        pageUrl: nextPageUrl,
        m3u8Url,
        title: "",
        nextPageUrl: "",
        status: "success" as const,
        source: modeAtStart,
        referer: sourceConfig.referer,
        origin: sourceConfig.origin,
      }));
      parsedItems.push(...items);
      options?.onCurrentPage?.(playlist.assUrl);
      return parsedItems;
    }

    for (let index = 0; index < limit; index += 1) {
      if (stopRequestedRef.current) break;
      if (!nextPageUrl || visited.has(nextPageUrl)) break;

      visited.add(nextPageUrl);
      options?.onCurrentPage?.(nextPageUrl);

      try {
        const html = await requestPageHtml(nextPageUrl);
        if (stopRequestedRef.current) break;
        const payload = extractPlayerPayload(html);
        const m3u8Url = String(payload.url || "").replace(/\\\//g, "/");
        const absoluteNextPageUrl = toAbsoluteUrl(
          payload.link_next,
          nextPageUrl,
        );
        const episode =
          Number(payload.nid) || extractEpisodeFromUrl(nextPageUrl) || index + 1;

        if (!m3u8Url || !m3u8Url.includes(".m3u8")) {
          throw new Error("当前集未解析到明文 .m3u8 地址");
        }

        const item: EpisodeM3u8Result = {
          episode,
          pageUrl: nextPageUrl,
          m3u8Url,
          title: payload.vod_data?.vod_name || "",
          nextPageUrl: absoluteNextPageUrl,
          status: "success",
          source: modeAtStart,
          referer: sourceConfig.referer,
          origin: sourceConfig.origin,
        };

        parsedItems.push(item);
        options?.onItem?.(item);

        if (!absoluteNextPageUrl || absoluteNextPageUrl === nextPageUrl) {
          break;
        }

        nextPageUrl = absoluteNextPageUrl;
      } catch (error) {
        if (stopRequestedRef.current) break;

        const item: EpisodeM3u8Result = {
          episode: extractEpisodeFromUrl(nextPageUrl) || index + 1,
          pageUrl: nextPageUrl,
          m3u8Url: "",
          title: "",
          nextPageUrl: "",
          status: "error",
          source: modeAtStart,
          referer: sourceConfig.referer,
          origin: sourceConfig.origin,
          message: error instanceof Error ? error.message : "解析失败",
        };
        parsedItems.push(item);
        options?.onItem?.(item);
        break;
      }
    }

    return parsedItems;
  };

  const runProbe = async (scope: ProbeScope) => {
    const modeAtStart = inputMode;
    stopRequestedRef.current = false;
    setRunning(true);
    setModeResults(modeAtStart, []);

    try {
      const parsedItems = await probeEpisodeResults(scope, modeAtStart, startUrl, {
        onCurrentPage: setCurrentPageUrl,
        onItem: (item) => {
          setModeResults(modeAtStart, (current) => [...current, item]);
        },
      });

      if (modeAtStart === "shot4u") {
        setModeResults(modeAtStart, parsedItems);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "解析失败");
    } finally {
      setRunning(false);
      setCurrentPageUrl("");
      stopRequestedRef.current = false;
    }
  };

  const stopProbe = () => {
    stopRequestedRef.current = true;
    setRunning(false);
    setCurrentPageUrl("");
  };

  const startProbeWithScope = (scope: ProbeScope) => {
    setProbeScopeDialogOpen(false);
    void runProbe(scope).catch((error) => {
      toast.error(error instanceof Error ? error.message : "解析失败");
    });
  };

  const copyText = async (format: "text" | "json") => {
    const content =
      format === "json"
        ? JSON.stringify(results, null, 2)
        : buildPlainText(results);
    if (!content) {
      toast.error("暂无可复制的解析结果");
      return;
    }

    await navigator.clipboard.writeText(content);
    toast.success(format === "json" ? "JSON 已复制" : "链接列表已复制");
  };

  const uploadLocalMp4 = async (item: EpisodeM3u8Result, localPath: string) => {
    const itemKey = getItemKey(item);
    setUploadingMap((current) => ({ ...current, [itemKey]: true }));
    updateResultItem(item, {
      localMp4Path: localPath,
      uploadStatus: "pending",
      uploadMessage: `等待上传 OSS（最多同时 ${OSS_UPLOAD_CONCURRENCY} 个）`,
    });

    try {
      const uploaded = await runWithOssUploadSlot(async () => {
        updateResultItem(item, {
          localMp4Path: localPath,
          uploadStatus: "pending",
          uploadMessage: "正在获取 OSS 直传地址",
        });
        const bytes = await readFile(localPath);
        const blob = new Blob([bytes], { type: "video/mp4" });
        return uploadVideoToOssDirect(
          blob,
          getEpisodeFileName(item),
          (percent) => {
            updateResultItem(item, {
              localMp4Path: localPath,
              uploadStatus: "pending",
              uploadMessage: `正在直传 OSS ${percent}%`,
            });
          },
        );
      });
      updateResultItem(item, {
        localMp4Path: localPath,
        remoteVideoUrl: uploaded.url,
        uploadStatus: "success",
        uploadMessage: "OSS 上传成功",
      });
      return uploaded.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "上传 OSS 失败";
      updateResultItem(item, {
        localMp4Path: localPath,
        uploadStatus: "error",
        uploadMessage: message,
      });
      throw error;
    } finally {
      setUploadingMap((current) => {
        const next = { ...current };
        delete next[itemKey];
        return next;
      });
    }
  };

  const ensureRemoteVideoUrl = async (item: EpisodeM3u8Result) => {
    if (item.remoteVideoUrl) return item.remoteVideoUrl;
    if (!item.localMp4Path) {
      throw new Error("请先保存 MP4");
    }
    return uploadLocalMp4(item, item.localMp4Path);
  };

  const generateScript = async (
    item: EpisodeM3u8Result,
    options?: { silent?: boolean },
  ) => {
    const itemKey = getItemKey(item);
    setScriptingMap((current) => ({ ...current, [itemKey]: true }));
    updateResultItem(item, {
      scriptStatus: "pending",
      scriptError: undefined,
    });

    try {
      const videoUrl = await ensureRemoteVideoUrl(item);
      const response = await createDashscopeChatCompletion({
        model: videoToScriptModel,
        stream: false,
        messages: [
          { role: "system", content: VIDEO_TO_SCRIPT_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "video_url",
                video_url: { url: videoUrl },
              },
              {
                type: "text",
                text: `请将这集短剧转写并整理为可用于二创/复盘的完整剧本。当前集数：第${item.episode}集。`,
              },
            ],
          },
        ],
      });
      const content = extractChatCompletionText(response);
      if (!content) {
        throw new Error("模型未返回有效剧本内容");
      }
      updateResultItem(item, {
        remoteVideoUrl: videoUrl,
        scriptStatus: "success",
        scriptContent: content,
        scriptError: undefined,
      });
      if (!options?.silent) {
        toast.success(`第${item.episode}集剧本已生成`);
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成剧本失败";
      updateResultItem(item, {
        scriptStatus: "error",
        scriptError: message,
      });
      if (!options?.silent) {
        toast.error(message);
      }
      return false;
    } finally {
      setScriptingMap((current) => {
        const next = { ...current };
        delete next[itemKey];
        return next;
      });
    }
  };

  const copyScript = async (item: EpisodeM3u8Result) => {
    if (!item.scriptContent) {
      toast.error("暂无剧本可复制");
      return;
    }
    await navigator.clipboard.writeText(item.scriptContent);
    toast.success(`第${item.episode}集剧本已复制`);
  };

  const downloadOne = async (item: EpisodeM3u8Result) => {
    if (!item.m3u8Url) return;

    const outputPath = await save({
      title: "保存 MP4",
      defaultPath: item.localMp4Path || getEpisodeFileName(item),
      filters: [{ name: "MP4 视频", extensions: ["mp4"] }],
    });
    if (!outputPath) return;
    const finalOutputPath = appendExtensionIfMissing(outputPath, "mp4");

    const itemKey = getItemKey(item);
    setDownloadingMap((current) => ({ ...current, [itemKey]: true }));
    updateResultItem(item, {
      downloadStatus: "pending",
      downloadMessage: "正在保存 MP4",
    });
    try {
      const result = await convertM3u8ToMp4(item.m3u8Url, finalOutputPath, {
        referer: item.referer,
        origin: item.origin,
      });
      updateResultItem(item, {
        localMp4Path: result.path,
        downloadStatus: "success",
        downloadMessage: result.skippedSegments
          ? `已保存，跳过 ${result.skippedSegments} 个坏分片`
          : "已保存",
      });
      try {
        await uploadLocalMp4(item, result.path);
      } catch {
        toast.error(`第${item.episode}集 MP4 已保存，但上传 OSS 失败`);
      }
      toast.success(
        result.skippedSegments
          ? `第${item.episode}集已保存，跳过 ${result.skippedSegments} 个坏分片：${result.path}`
          : `第${item.episode}集已保存：${result.path}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败";
      updateResultItem(item, {
        downloadStatus: "error",
        downloadMessage: message,
      });
      toast.error(message);
    } finally {
      setDownloadingMap((current) => {
        const next = { ...current };
        delete next[itemKey];
        return next;
      });
    }
  };

  const retryHongguoDownloadOne = async (item: EpisodeM3u8Result) => {
    if (!HONGGUO_API_KEY) {
      toast.error("未配置 VITE_HONGGUO_API_KEY");
      return;
    }
    const hongguoInfo = parseHongguoPageUrl(item.pageUrl);
    if (!hongguoInfo?.videoId) {
      toast.error("当前行缺少红果 video_id，无法重新解析");
      return;
    }

    const outputPath = await save({
      title: "保存 MP4",
      defaultPath: getEpisodeFileName(item),
      filters: [{ name: "MP4 视频", extensions: ["mp4"] }],
    });
    if (!outputPath) return;
    const finalOutputPath = appendExtensionIfMissing(outputPath, "mp4");

    const itemKey = getItemKey(item);
    setDownloadingMap((current) => ({ ...current, [itemKey]: true }));
    updateResultItem(item, {
      downloadStatus: "pending",
      downloadMessage: "正在重新解析最低画质 MP4",
    });

    try {
      let sourceUrl = item.hongguoSourceUrl;
      let decryptKey = item.hongguoDecryptKey;
      let definition = item.hongguoDefinition;

      if (!sourceUrl || !decryptKey) {
        updateResultItem(item, {
          downloadStatus: "pending",
          downloadMessage: "正在补取红果播放信息",
        });
        const videoResponse = await requestHongguoApi<{
          code?: number;
          msg?: string;
          data?: { video_lists?: HongguoVideoListItem[] };
        }>({
          key: HONGGUO_API_KEY,
          type: "video",
          video_id: hongguoInfo.videoId,
        });
        if (videoResponse.code !== 200) {
          throw new Error(videoResponse.msg || "获取分集播放链接失败");
        }

        const video = selectLowestQualityMp4(
          videoResponse.data?.video_lists || [],
        );
        if (!video?.url || !video.decrypt_key) {
          throw new Error("未找到可用 MP4 播放链接");
        }
        sourceUrl = video.url;
        decryptKey = video.decrypt_key;
        definition = video.definition;
      }

      updateResultItem(item, {
        hongguoSourceUrl: sourceUrl,
        hongguoDecryptKey: decryptKey,
        hongguoDefinition: definition,
        downloadStatus: "pending",
        downloadMessage: "正在重新调用红果云解析接口",
      });
      const mp4Url = await requestHongguoDecrypt(
        sourceUrl,
        decryptKey,
      );
      const savedItem: EpisodeM3u8Result = {
        ...item,
        mp4Url,
        hongguoSourceUrl: sourceUrl,
        hongguoDecryptKey: decryptKey,
        hongguoDefinition: definition,
        remoteVideoUrl: undefined,
        downloadStatus: "pending",
        downloadMessage: `正在下载重新解析的最低画质 ${definition || ""}`.trim(),
      };
      updateResultItem(item, savedItem);

      const result = await downloadMp4Url(mp4Url, finalOutputPath);
      const downloadedItem: EpisodeM3u8Result = {
        ...savedItem,
        localMp4Path: result.path,
        downloadStatus: "success",
        downloadMessage: "已保存",
      };
      updateResultItem(item, downloadedItem);

      try {
        await uploadLocalMp4(downloadedItem, result.path);
      } catch {
        toast.error(`第${item.episode}集 MP4 已保存，但上传 OSS 失败`);
      }
      toast.success(`第${item.episode}集已重新解析并保存：${result.path}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "重新解析失败";
      updateResultItem(item, {
        downloadStatus: "error",
        downloadMessage: message,
      });
      toast.error(message);
    } finally {
      setDownloadingMap((current) => {
        const next = { ...current };
        delete next[itemKey];
        return next;
      });
    }
  };

  const splitOne = async (
    item: EpisodeM3u8Result,
    options?: { silent?: boolean },
  ) => {
    if (!item.localMp4Path) {
      toast.error("请先保存 MP4");
      return false;
    }

    const itemKey = getItemKey(item);
    setSplittingMap((current) => ({ ...current, [itemKey]: true }));
    updateResultItem(item, {
      clipStatus: "pending",
      clipMessage: `正在按 ${CLIP_SEGMENT_SECONDS} 秒裁切`,
    });

    try {
      const result = await splitMp4BySeconds(
        item.localMp4Path,
        CLIP_SEGMENT_SECONDS,
      );
      updateResultItem(item, {
        clipStatus: "success",
        clipMessage: `已生成 ${result.clipCount} 个切片`,
        clipOutputDir: result.outputDir,
        clipCount: result.clipCount,
        clipSegmentSeconds: result.segmentSeconds,
        clipPaths: result.clips,
      });
      if (!options?.silent) {
        toast.success(
          `第${item.episode}集已裁切 ${result.clipCount} 个片段：${result.outputDir}`,
        );
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "裁切失败";
      updateResultItem(item, {
        clipStatus: "error",
        clipMessage: message,
      });
      if (!options?.silent) {
        toast.error(message);
      }
      return false;
    } finally {
      setSplittingMap((current) => {
        const next = { ...current };
        delete next[itemKey];
        return next;
      });
    }
  };

  const downloadItemsToFolder = async (
    sourceItems: EpisodeM3u8Result[],
    selected: string,
    options?: {
      autoUpload?: boolean;
      onItemSaved?: (item: EpisodeM3u8Result) => void;
      silent?: boolean;
    },
  ) => {
    const autoUpload = options?.autoUpload ?? true;
    const allDownloadableItems = sourceItems.filter(
      (item) => item.status === "success" && item.m3u8Url,
    );
    const mutableItems = allDownloadableItems.map((item) => ({ ...item }));
    const itemIndexByKey = new Map(
      mutableItems.map((item, index) => [getItemKey(item), index]),
    );

    if (allDownloadableItems.length === 0) {
      toast.error("暂无可下载的 m3u8 结果");
      return mutableItems;
    }
    if (allDownloadableItems.every((item) => item.localMp4Path)) {
      toast.success("当前表格里的 MP4 都已保存");
      return mutableItems;
    }

    const patchMutableItem = (
      item: EpisodeM3u8Result,
      patch: Partial<EpisodeM3u8Result>,
    ) => {
      const itemKey = getItemKey(item);
      const itemIndex = itemIndexByKey.get(itemKey);
      if (itemIndex !== undefined) {
        mutableItems[itemIndex] = { ...mutableItems[itemIndex], ...patch };
      }
      updateResultItemByKey(item.source, itemKey, patch);
    };

    const handleSavedItem = (item: EpisodeM3u8Result) => {
      options?.onItemSaved?.(item);
      if (!autoUpload || !item.localMp4Path) return;

      void uploadLocalMp4(item, item.localMp4Path)
        .then((remoteVideoUrl) => {
          patchMutableItem(item, { remoteVideoUrl });
        })
        .catch(() => {
          // 本地 MP4 已保存，OSS 上传失败交给行状态显示并允许手动重试。
        });
    };

    const syncedKeys = new Set<string>();
    await Promise.all(
      mutableItems
        .filter((item) => !item.localMp4Path)
        .map(async (item) => {
          const expectedPath = joinPath(selected, getEpisodeFileName(item));
          const fileExists = await exists(expectedPath).catch(() => false);
          if (!fileExists) return;

          const itemKey = getItemKey(item);
          syncedKeys.add(itemKey);
          patchMutableItem(item, {
            localMp4Path: expectedPath,
            downloadStatus: "skipped",
            downloadMessage: "目录中已存在 MP4，已自动同步",
          });
          handleSavedItem({ ...item, localMp4Path: expectedPath });
        }),
    );

    const downloadableItems = mutableItems.filter(
      (item) => !item.localMp4Path && !syncedKeys.has(getItemKey(item)),
    );
    if (downloadableItems.length === 0) {
      if (!options?.silent) {
        toast.success(`已从保存目录同步 ${syncedKeys.size} 个 MP4`);
      }
      return mutableItems;
    }

    const concurrency = normalizeBulkConcurrency(bulkConcurrency);
    bulkStopRequestedRef.current = false;
    setBulkDownloading(true);
    setCurrentResults((current) =>
      current.map((item) =>
        item.status === "success" && item.m3u8Url && item.localMp4Path
          ? {
              ...item,
              downloadStatus: "skipped",
              downloadMessage: "已有 MP4，批量保存已跳过",
            }
          : item,
      ),
    );
    setBulkProgress({
      current: 0,
      total: downloadableItems.length,
      success: 0,
      failed: 0,
      skipped: allDownloadableItems.length - downloadableItems.length,
      concurrency,
      activeEpisodes: [],
      stopRequested: false,
    });
    let skippedTotal = 0;
    let successTotal = 0;
    let failedTotal = 0;
    let completedTotal = 0;
    let nextIndex = 0;
    let stopped = false;
    const activeEpisodes = new Set<number>();

    const syncBulkProgress = () => {
      setBulkProgress({
        current: completedTotal,
        total: downloadableItems.length,
        success: successTotal,
        failed: failedTotal,
        skipped: allDownloadableItems.length - downloadableItems.length,
        concurrency,
        activeEpisodes: Array.from(activeEpisodes).sort((a, b) => a - b),
        stopRequested: bulkStopRequestedRef.current,
      });
    };

    const takeNextItem = () => {
      if (bulkStopRequestedRef.current) {
        stopped = true;
        return null;
      }

      const item = downloadableItems[nextIndex];
      nextIndex += 1;
      return item || null;
    };

    const runWorker = async () => {
      while (true) {
        const item = takeNextItem();
        if (!item) break;

        if (bulkStopRequestedRef.current) {
          stopped = true;
          break;
        }

        const itemKey = getItemKey(item);
        activeEpisodes.add(item.episode);
        syncBulkProgress();
        setDownloadingMap((current) => ({ ...current, [itemKey]: true }));
        patchMutableItem(item, {
          downloadStatus: "pending",
          downloadMessage: "正在批量保存",
        });

        try {
          const result = await convertM3u8ToMp4(
            item.m3u8Url,
            joinPath(selected, getEpisodeFileName(item)),
            {
              referer: item.referer,
              origin: item.origin,
            },
          );
          patchMutableItem(item, {
            localMp4Path: result.path,
            downloadStatus: "success",
            downloadMessage: result.skippedSegments
              ? `已保存，跳过 ${result.skippedSegments} 个坏分片`
              : "已保存",
          });
          handleSavedItem({ ...item, localMp4Path: result.path });
          skippedTotal += result.skippedSegments || 0;
          successTotal += 1;
        } catch (error) {
          failedTotal += 1;
          const message = error instanceof Error ? error.message : "保存失败";
          patchMutableItem(item, {
            downloadStatus: "error",
            downloadMessage: message,
          });
        } finally {
          completedTotal += 1;
          activeEpisodes.delete(item.episode);
          syncBulkProgress();
          setDownloadingMap((current) => {
            const next = { ...current };
            delete next[itemKey];
            return next;
          });
        }
      }
    };

    try {
      await Promise.all(
        Array.from({ length: Math.min(concurrency, downloadableItems.length) }, () =>
          runWorker(),
        ),
      );

      const wasStopped = stopped || bulkStopRequestedRef.current;
      if (wasStopped) {
        toast.info(
          `已停止派发，已开始的任务已完成：成功 ${successTotal} 个，失败 ${failedTotal} 个`,
        );
      } else if (options?.silent) {
        // 一键流程自己汇总提示。
      } else if (failedTotal > 0) {
        toast.error(`批量保存完成，成功 ${successTotal} 个，失败 ${failedTotal} 个`);
      } else {
        toast.success(
          skippedTotal > 0
            ? `已保存 ${successTotal} 个 MP4，跳过 ${skippedTotal} 个坏分片`
            : `已保存 ${successTotal} 个 MP4`,
        );
      }
    } finally {
      setBulkDownloading(false);
      bulkStopRequestedRef.current = false;
    }

    return mutableItems;
  };

  const downloadAll = async () => {
    const allDownloadableItems = results.filter(
      (item) => item.status === "success" && item.m3u8Url,
    );

    if (allDownloadableItems.length === 0) {
      toast.error("暂无可下载的 m3u8 结果");
      return;
    }
    if (allDownloadableItems.every((item) => item.localMp4Path)) {
      toast.success("当前表格里的 MP4 都已保存");
      return;
    }

    const selected = await open({
      title: "选择保存文件夹",
      directory: true,
      multiple: false,
    });
    if (!selected || Array.isArray(selected)) return;

    await downloadItemsToFolder(results, selected);
  };

  const stopBulkDownload = () => {
    bulkStopRequestedRef.current = true;
    setBulkProgress((current) =>
      current ? { ...current, stopRequested: true } : current,
    );
    toast.info("已停止派发新任务，等待运行中的任务完成");
  };

  const splitAll = async () => {
    const allSplittableItems = results.filter(
      (item) => item.status === "success" && item.localMp4Path,
    );
    const splittableItems = allSplittableItems.filter(
      (item) => !item.clipOutputDir,
    );

    if (allSplittableItems.length === 0) {
      toast.error("暂无可裁切的 MP4，请先保存 MP4");
      return;
    }
    if (splittableItems.length === 0) {
      toast.success("当前表格里的 MP4 都已裁切");
      return;
    }

    const concurrency = normalizeBulkConcurrency(bulkConcurrency);
    splitBulkStopRequestedRef.current = false;
    setBulkSplitting(true);
    setCurrentResults((current) =>
      current.map((item) =>
        item.status === "success" && item.localMp4Path && item.clipOutputDir
          ? {
              ...item,
              clipStatus: "skipped",
              clipMessage: "已有切片，批量裁切已跳过",
            }
          : item,
      ),
    );
    setSplitBulkProgress({
      current: 0,
      total: splittableItems.length,
      success: 0,
      failed: 0,
      skipped: allSplittableItems.length - splittableItems.length,
      concurrency,
      activeEpisodes: [],
      stopRequested: false,
    });

    let successTotal = 0;
    let failedTotal = 0;
    let completedTotal = 0;
    let nextIndex = 0;
    let stopped = false;
    const activeEpisodes = new Set<number>();

    const syncSplitProgress = () => {
      setSplitBulkProgress({
        current: completedTotal,
        total: splittableItems.length,
        success: successTotal,
        failed: failedTotal,
        skipped: allSplittableItems.length - splittableItems.length,
        concurrency,
        activeEpisodes: Array.from(activeEpisodes).sort((a, b) => a - b),
        stopRequested: splitBulkStopRequestedRef.current,
      });
    };

    const takeNextItem = () => {
      if (splitBulkStopRequestedRef.current) {
        stopped = true;
        return null;
      }
      const item = splittableItems[nextIndex];
      nextIndex += 1;
      return item || null;
    };

    const runWorker = async () => {
      while (true) {
        const item = takeNextItem();
        if (!item) break;
        if (splitBulkStopRequestedRef.current) {
          stopped = true;
          break;
        }

        activeEpisodes.add(item.episode);
        syncSplitProgress();
        const ok = await splitOne(item, { silent: true });
        if (ok) {
          successTotal += 1;
        } else {
          failedTotal += 1;
        }
        completedTotal += 1;
        activeEpisodes.delete(item.episode);
        syncSplitProgress();
      }
    };

    try {
      await Promise.all(
        Array.from({ length: Math.min(concurrency, splittableItems.length) }, () =>
          runWorker(),
        ),
      );

      const wasStopped = stopped || splitBulkStopRequestedRef.current;
      if (wasStopped) {
        toast.info(
          `已停止派发裁切任务，已开始的任务已完成：成功 ${successTotal} 个，失败 ${failedTotal} 个`,
        );
      } else if (failedTotal > 0) {
        toast.error(`批量裁切完成，成功 ${successTotal} 个，失败 ${failedTotal} 个`);
      } else {
        toast.success(`已裁切 ${successTotal} 个 MP4`);
      }
    } finally {
      setBulkSplitting(false);
      splitBulkStopRequestedRef.current = false;
    }
  };

  const stopBulkSplit = () => {
    splitBulkStopRequestedRef.current = true;
    setSplitBulkProgress((current) =>
      current ? { ...current, stopRequested: true } : current,
    );
    toast.info("已停止派发新裁切任务，等待运行中的任务完成");
  };

  const generateScriptsForItems = async (sourceItems: EpisodeM3u8Result[]) => {
    const allScriptableItems = sourceItems.filter(
      (item) => item.status === "success" && (item.remoteVideoUrl || item.localMp4Path),
    );
    const scriptableItems = allScriptableItems.filter(
      (item) => !item.scriptContent,
    );

    if (allScriptableItems.length === 0) {
      toast.error("暂无可生成剧本的视频，请先保存 MP4");
      return;
    }
    if (scriptableItems.length === 0) {
      toast.success("当前表格里的剧本都已生成");
      return;
    }

    scriptBulkStopRequestedRef.current = false;
    setScriptBulkGenerating(true);
    setScriptBulkProgress({
      current: 0,
      total: scriptableItems.length,
      success: 0,
      failed: 0,
      skipped: allScriptableItems.length - scriptableItems.length,
      concurrency: SCRIPT_BULK_CONCURRENCY,
      activeEpisodes: [],
      stopRequested: false,
    });

    let successTotal = 0;
    let failedTotal = 0;
    let completedTotal = 0;
    let nextIndex = 0;
    let stopped = false;
    const activeEpisodes = new Set<number>();

    const syncProgress = () => {
      setScriptBulkProgress({
        current: completedTotal,
        total: scriptableItems.length,
        success: successTotal,
        failed: failedTotal,
        skipped: allScriptableItems.length - scriptableItems.length,
        concurrency: SCRIPT_BULK_CONCURRENCY,
        activeEpisodes: Array.from(activeEpisodes).sort((a, b) => a - b),
        stopRequested: scriptBulkStopRequestedRef.current,
      });
    };

    const takeNextItem = () => {
      if (scriptBulkStopRequestedRef.current) {
        stopped = true;
        return null;
      }
      const item = scriptableItems[nextIndex];
      nextIndex += 1;
      return item || null;
    };

    const runWorker = async () => {
      while (true) {
        const item = takeNextItem();
        if (!item) break;
        if (scriptBulkStopRequestedRef.current) {
          stopped = true;
          break;
        }

        activeEpisodes.add(item.episode);
        syncProgress();
        const ok = await generateScript(item, { silent: true });
        if (ok) {
          successTotal += 1;
        } else {
          failedTotal += 1;
        }
        completedTotal += 1;
        activeEpisodes.delete(item.episode);
        syncProgress();
      }
    };

    try {
      await Promise.all(
        Array.from(
          { length: Math.min(SCRIPT_BULK_CONCURRENCY, scriptableItems.length) },
          () => runWorker(),
        ),
      );

      const wasStopped = stopped || scriptBulkStopRequestedRef.current;
      if (wasStopped) {
        toast.info(
          `已停止派发剧本任务，已开始的任务已完成：成功 ${successTotal} 个，失败 ${failedTotal} 个`,
        );
      } else if (failedTotal > 0) {
        toast.error(`批量生成完成，成功 ${successTotal} 个，失败 ${failedTotal} 个`);
      } else {
        toast.success(`已生成 ${successTotal} 集剧本`);
      }
    } finally {
      setScriptBulkGenerating(false);
      scriptBulkStopRequestedRef.current = false;
    }
  };

  const generateAllScripts = async () => {
    await generateScriptsForItems(results);
  };

  const importLocalMp4Files = async (options?: { generateAfterUpload?: boolean }) => {
    const selected = await open({
      title: options?.generateAfterUpload
        ? "选择要导入并生成剧本的 MP4"
        : "选择要导入的 MP4",
      multiple: true,
      filters: [{ name: "MP4 视频", extensions: ["mp4"] }],
    });
    if (!selected) return;

    const paths = (Array.isArray(selected) ? selected : [selected]).filter(
      (path) => path.toLowerCase().endsWith(".mp4"),
    );
    if (paths.length === 0) {
      toast.error("请选择 MP4 文件");
      return;
    }

    const usedEpisodes = new Set<number>();
    const takeEpisode = (path: string, index: number) => {
      let fallbackEpisode = index + 1;
      while (usedEpisodes.has(fallbackEpisode)) fallbackEpisode += 1;
      let episode = inferEpisodeFromFilePath(path, fallbackEpisode);
      if (usedEpisodes.has(episode)) episode = fallbackEpisode;
      usedEpisodes.add(episode);
      return episode;
    };

    const importedItems = paths
      .map((path, index): EpisodeM3u8Result => {
        const episode = takeEpisode(path, index);
        return {
          episode,
          pageUrl: path,
          m3u8Url: "",
          title: "",
          nextPageUrl: "",
          status: "success",
          source: "shot4u",
          localMp4Path: path,
          downloadStatus: "skipped",
          downloadMessage: "本地导入 MP4",
          uploadStatus: "idle",
        };
      })
      .sort((a, b) => a.episode - b.episode);

    setInputMode("shot4u");
    setModeResults("shot4u", importedItems);
    toast.success(`已导入 ${importedItems.length} 个 MP4，开始上传 OSS`);

    if (options?.generateAfterUpload) {
      scriptBulkStopRequestedRef.current = false;
      setScriptBulkGenerating(true);
      setScriptBulkProgress({
        current: 0,
        total: importedItems.length,
        success: 0,
        failed: 0,
        skipped: 0,
        concurrency: SCRIPT_BULK_CONCURRENCY,
        activeEpisodes: [],
        stopRequested: false,
      });

      let uploadSuccessTotal = 0;
      let uploadFailedTotal = 0;
      let scriptSuccessTotal = 0;
      let scriptFailedTotal = 0;
      let scriptCompletedTotal = 0;
      const scriptActiveEpisodes = new Set<number>();
      let activeScriptGenerations = 0;
      const pendingScriptGenerationStarters: Array<() => void> = [];

      const acquireImportScriptSlot = () =>
        new Promise<() => void>((resolve) => {
          const start = () => {
            activeScriptGenerations += 1;
            let released = false;
            resolve(() => {
              if (released) return;
              released = true;
              activeScriptGenerations = Math.max(0, activeScriptGenerations - 1);
              pendingScriptGenerationStarters.shift()?.();
            });
          };

          if (activeScriptGenerations < SCRIPT_BULK_CONCURRENCY) {
            start();
          } else {
            pendingScriptGenerationStarters.push(start);
          }
        });

      const syncImportScriptProgress = () => {
        setScriptBulkProgress({
          current: scriptCompletedTotal,
          total: importedItems.length,
          success: scriptSuccessTotal,
          failed: scriptFailedTotal,
          skipped: 0,
          concurrency: SCRIPT_BULK_CONCURRENCY,
          activeEpisodes: Array.from(scriptActiveEpisodes).sort((a, b) => a - b),
          stopRequested: scriptBulkStopRequestedRef.current,
        });
      };

      try {
        await Promise.all(
          importedItems.map(async (item) => {
            let remoteVideoUrl = "";
            try {
              remoteVideoUrl = await uploadLocalMp4(item, item.localMp4Path || "");
              uploadSuccessTotal += 1;
            } catch {
              uploadFailedTotal += 1;
              scriptFailedTotal += 1;
              scriptCompletedTotal += 1;
              syncImportScriptProgress();
              return;
            }

            if (scriptBulkStopRequestedRef.current) {
              scriptFailedTotal += 1;
              scriptCompletedTotal += 1;
              syncImportScriptProgress();
              return;
            }

            const releaseScriptSlot = await acquireImportScriptSlot();
            scriptActiveEpisodes.add(item.episode);
            syncImportScriptProgress();

            try {
              if (scriptBulkStopRequestedRef.current) {
                scriptFailedTotal += 1;
                return;
              }
              const ok = await generateScript(
                { ...item, remoteVideoUrl, uploadStatus: "success" },
                { silent: true },
              );
              if (ok) {
                scriptSuccessTotal += 1;
              } else {
                scriptFailedTotal += 1;
              }
            } finally {
              scriptCompletedTotal += 1;
              scriptActiveEpisodes.delete(item.episode);
              releaseScriptSlot();
              syncImportScriptProgress();
            }
          }),
        );

        const wasStopped = scriptBulkStopRequestedRef.current;
        if (wasStopped) {
          toast.info(
            `已停止派发剧本任务，上传成功 ${uploadSuccessTotal} 个，上传失败 ${uploadFailedTotal} 个，剧本成功 ${scriptSuccessTotal} 个，失败 ${scriptFailedTotal} 个`,
          );
        } else if (uploadFailedTotal > 0 || scriptFailedTotal > 0) {
          toast.error(
            `导入并生成完成，上传成功 ${uploadSuccessTotal} 个，上传失败 ${uploadFailedTotal} 个，剧本成功 ${scriptSuccessTotal} 个，失败 ${scriptFailedTotal} 个`,
          );
        } else {
          toast.success(`已上传并生成 ${scriptSuccessTotal} 个 MP4 剧本`);
        }
      } finally {
        setScriptBulkGenerating(false);
        scriptBulkStopRequestedRef.current = false;
      }
      return;
    }

    const uploadedItems = await Promise.all(
      importedItems.map(async (item) => {
        try {
          const remoteVideoUrl = await uploadLocalMp4(item, item.localMp4Path || "");
          return { ...item, remoteVideoUrl, uploadStatus: "success" as const };
        } catch {
          return { ...item, uploadStatus: "error" as const };
        }
      }),
    );

    const successCount = uploadedItems.filter(
      (item) => item.uploadStatus === "success",
    ).length;
    if (successCount === uploadedItems.length) {
      toast.success(`已上传 ${successCount} 个 MP4 到 OSS`);
    } else {
      toast.error(
        `OSS 上传完成，成功 ${successCount} 个，失败 ${
          uploadedItems.length - successCount
        } 个`,
      );
    }

  };

  const runScriptWorkflow = async (scope: ProbeScope) => {
    const modeAtStart = inputMode;
    const rawStartUrl = startUrl;
    const selected = await open({
      title: "选择 MP4 保存文件夹",
      directory: true,
      multiple: false,
    });
    if (!selected || Array.isArray(selected)) return;

    setScriptWorkflowDialogOpen(false);
    setScriptWorkflowRunning(true);
    stopRequestedRef.current = false;
    setRunning(true);
    setModeResults(modeAtStart, []);

    try {
      const parsedItems = await probeEpisodeResults(scope, modeAtStart, rawStartUrl, {
        onCurrentPage: setCurrentPageUrl,
        onItem: (item) => {
          setModeResults(modeAtStart, (current) => [...current, item]);
        },
      });

      if (modeAtStart === "shot4u") {
        setModeResults(modeAtStart, parsedItems);
      }

      if (stopRequestedRef.current) {
        toast.info("已停止一键生成剧本流程");
        return;
      }

      const parsedSuccessItems = parsedItems.filter(
        (item) => item.status === "success" && item.m3u8Url,
      );
      if (parsedSuccessItems.length === 0) {
        toast.error("解析完成，但没有可下载的视频链接");
        return;
      }

      setRunning(false);
      setCurrentPageUrl("");

      scriptBulkStopRequestedRef.current = false;
      setScriptBulkGenerating(true);
      setScriptBulkProgress({
        current: 0,
        total: parsedSuccessItems.length,
        success: 0,
        failed: 0,
        skipped: 0,
        concurrency: SCRIPT_BULK_CONCURRENCY,
        activeEpisodes: [],
        stopRequested: false,
      });

      let scriptSuccessTotal = 0;
      let scriptFailedTotal = 0;
      let scriptCompletedTotal = 0;
      const scriptActiveEpisodes = new Set<number>();
      const pipelinePromises: Array<Promise<void>> = [];
      let activeScriptGenerations = 0;
      const pendingScriptGenerationStarters: Array<() => void> = [];

      const acquireScriptGenerationSlot = () =>
        new Promise<() => void>((resolve) => {
          const start = () => {
            activeScriptGenerations += 1;
            let released = false;
            resolve(() => {
              if (released) return;
              released = true;
              activeScriptGenerations = Math.max(0, activeScriptGenerations - 1);
              pendingScriptGenerationStarters.shift()?.();
            });
          };

          if (activeScriptGenerations < SCRIPT_BULK_CONCURRENCY) {
            start();
          } else {
            pendingScriptGenerationStarters.push(start);
          }
        });

      const syncScriptPipelineProgress = () => {
        setScriptBulkProgress({
          current: scriptCompletedTotal,
          total: parsedSuccessItems.length,
          success: scriptSuccessTotal,
          failed: scriptFailedTotal,
          skipped: 0,
          concurrency: SCRIPT_BULK_CONCURRENCY,
          activeEpisodes: Array.from(scriptActiveEpisodes).sort((a, b) => a - b),
          stopRequested: scriptBulkStopRequestedRef.current,
        });
      };

      const enqueueScriptPipeline = (savedItem: EpisodeM3u8Result) => {
        const pipelineTask = (async () => {
          scriptActiveEpisodes.add(savedItem.episode);
          syncScriptPipelineProgress();
          try {
            if (scriptBulkStopRequestedRef.current) {
              scriptFailedTotal += 1;
              return;
            }
            const remoteVideoUrl = savedItem.remoteVideoUrl
              ? savedItem.remoteVideoUrl
              : await uploadLocalMp4(savedItem, savedItem.localMp4Path || "");
            if (scriptBulkStopRequestedRef.current) {
              scriptFailedTotal += 1;
              return;
            }
            const releaseScriptSlot = await acquireScriptGenerationSlot();
            let ok = false;
            try {
              if (scriptBulkStopRequestedRef.current) {
                scriptFailedTotal += 1;
                return;
              }
              ok = await generateScript(
                { ...savedItem, remoteVideoUrl },
                { silent: true },
              );
            } finally {
              releaseScriptSlot();
            }
            if (ok) {
              scriptSuccessTotal += 1;
            } else {
              scriptFailedTotal += 1;
            }
          } catch {
            scriptFailedTotal += 1;
          } finally {
            scriptCompletedTotal += 1;
            scriptActiveEpisodes.delete(savedItem.episode);
            syncScriptPipelineProgress();
          }
        })();
        pipelinePromises.push(pipelineTask);
      };

      await downloadItemsToFolder(parsedItems, selected, {
        autoUpload: false,
        onItemSaved: enqueueScriptPipeline,
        silent: true,
      });
      const notStartedTotal = parsedSuccessItems.length - pipelinePromises.length;
      if (notStartedTotal > 0) {
        scriptFailedTotal += notStartedTotal;
        scriptCompletedTotal += notStartedTotal;
        syncScriptPipelineProgress();
      }
      await Promise.all(pipelinePromises);

      if (scriptSuccessTotal === 0) {
        toast.error("MP4 保存或 OSS 上传失败，没有成功生成剧本");
      } else if (scriptFailedTotal > 0) {
        toast.error(
          `一键生成完成，成功 ${scriptSuccessTotal} 集，失败 ${scriptFailedTotal} 集`,
        );
      } else {
        toast.success(`一键生成完成，已生成 ${scriptSuccessTotal} 集剧本`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "一键生成剧本失败");
    } finally {
      setRunning(false);
      setCurrentPageUrl("");
      setScriptBulkGenerating(false);
      setScriptWorkflowRunning(false);
      stopRequestedRef.current = false;
      scriptBulkStopRequestedRef.current = false;
    }
  };

  const stopScriptBulkGenerate = () => {
    scriptBulkStopRequestedRef.current = true;
    setScriptBulkProgress((current) =>
      current ? { ...current, stopRequested: true } : current,
    );
    toast.info("已停止派发新剧本任务，等待运行中的任务完成");
  };

  const exportScriptsToWord = async (options?: { skipMissingCheck?: boolean }) => {
    if (!options?.skipMissingCheck) {
      const exportableRows = results
        .filter((item) => item.status === "success")
        .sort((a, b) => a.episode - b.episode);
      const missingEpisodes = exportableRows
        .filter((item) => !item.scriptContent)
        .map((item) => item.episode);

      if (missingEpisodes.length > 0) {
        setMissingScriptEpisodes(missingEpisodes);
        return;
      }
    }

    const scriptItems = results
      .filter((item) => item.scriptContent)
      .sort((a, b) => a.episode - b.episode);

    if (scriptItems.length === 0) {
      toast.error("暂无可导出的剧本");
      return;
    }

    const outputPath = await save({
      title: "导出剧本 Word",
      defaultPath: "短剧剧本.docx",
      filters: [{ name: "Word 文档", extensions: ["docx"] }],
    });
    if (!outputPath) return;
    const finalOutputPath = appendExtensionIfMissing(outputPath, "docx");

    try {
      const docx = createScriptsDocx(scriptItems);
      await writeFile(finalOutputPath, docx);
      toast.success(`已导出 Word：${finalOutputPath}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导出 Word 失败");
    }
  };

  const searchHongguoShortDrama = async () => {
    const keyword = hongguoKeyword.trim();
    if (!HONGGUO_API_KEY) {
      toast.error("未配置 VITE_HONGGUO_API_KEY");
      return;
    }
    if (!keyword) {
      toast.error("请输入搜索关键词");
      return;
    }

    setHongguoSearching(true);
    try {
      const response = await requestHongguoApi<{
        code?: number;
        msg?: string;
        data?: HongguoSearchItem[];
      }>({
        key: HONGGUO_API_KEY,
        type: "search",
        keyword,
        page: hongguoPage.trim() || "1",
      });

      if (response.code !== 200) {
        throw new Error(response.msg || "搜索失败");
      }

      const items = Array.isArray(response.data) ? response.data : [];
      setHongguoSearchResults(items);
      setHongguoSearchDialogOpen(true);
      if (items.length === 0) {
        toast.info("没有搜索到结果");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "搜索失败");
    } finally {
      setHongguoSearching(false);
    }
  };

  const runHongguoSearchWorkflow = async (
    item: HongguoSearchItem,
    episodeLimit?: number,
  ) => {
    if (!HONGGUO_API_KEY) {
      toast.error("未配置 VITE_HONGGUO_API_KEY");
      return;
    }
    if (!item.id) {
      toast.error("搜索结果缺少剧集 ID");
      return;
    }

    const selected = await open({
      title: "选择 MP4 保存文件夹",
      directory: true,
      multiple: false,
    });
    if (!selected || Array.isArray(selected)) return;

    setHongguoSearchDialogOpen(false);
    setScriptWorkflowRunning(true);
    setBulkDownloading(true);
    setScriptBulkGenerating(true);
    bulkStopRequestedRef.current = false;
    scriptBulkStopRequestedRef.current = false;

    try {
      const detailResponse = await requestHongguoApi<{
        code?: number;
        msg?: string;
        data?: {
          title?: string;
          lists?: HongguoEpisodeItem[];
        };
      }>({
        key: HONGGUO_API_KEY,
        type: "detail",
        id: item.id,
      });

      if (detailResponse.code !== 200) {
        throw new Error(detailResponse.msg || "获取剧集详情失败");
      }

      const dramaTitle = detailResponse.data?.title || item.title || "红果短剧";
      let episodes = (detailResponse.data?.lists || [])
        .filter((episode) => episode.video_id)
        .sort((a, b) => a.index - b.index);

      if (episodes.length === 0) {
        throw new Error("剧集详情中没有可解析的 video_id");
      }
      if (typeof episodeLimit === "number") {
        episodes = episodes.slice(0, episodeLimit);
      }

      const rows = episodes.map((episode): EpisodeM3u8Result => ({
        episode: episode.index,
        pageUrl: `hongguo:${item.id}:${episode.video_id}`,
        m3u8Url: "",
        title: dramaTitle,
        nextPageUrl: "",
        status: "success",
        source: "shot4u",
        downloadStatus: "idle",
        uploadStatus: "idle",
        scriptStatus: "idle",
      }));
      setInputMode("shot4u");
      setModeResults("shot4u", rows);

      const concurrency = normalizeBulkConcurrency(bulkConcurrency);
      setBulkProgress({
        current: 0,
        total: episodes.length,
        success: 0,
        failed: 0,
        skipped: 0,
        concurrency,
        activeEpisodes: [],
        stopRequested: false,
      });
      setScriptBulkProgress({
        current: 0,
        total: episodes.length,
        success: 0,
        failed: 0,
        skipped: 0,
        concurrency: SCRIPT_BULK_CONCURRENCY,
        activeEpisodes: [],
        stopRequested: false,
      });

      let downloadSuccessTotal = 0;
      let downloadFailedTotal = 0;
      let downloadCompletedTotal = 0;
      let scriptSuccessTotal = 0;
      let scriptFailedTotal = 0;
      let scriptCompletedTotal = 0;
      let nextIndex = 0;
      let activeScriptGenerations = 0;
      const downloadActiveEpisodes = new Set<number>();
      const scriptActiveEpisodes = new Set<number>();
      const pipelinePromises: Array<Promise<void>> = [];
      const pendingScriptGenerationStarters: Array<() => void> = [];

      const syncDownloadProgress = () => {
        setBulkProgress({
          current: downloadCompletedTotal,
          total: episodes.length,
          success: downloadSuccessTotal,
          failed: downloadFailedTotal,
          skipped: 0,
          concurrency,
          activeEpisodes: Array.from(downloadActiveEpisodes).sort((a, b) => a - b),
          stopRequested: bulkStopRequestedRef.current,
        });
      };

      const syncScriptProgress = () => {
        setScriptBulkProgress({
          current: scriptCompletedTotal,
          total: episodes.length,
          success: scriptSuccessTotal,
          failed: scriptFailedTotal,
          skipped: 0,
          concurrency: SCRIPT_BULK_CONCURRENCY,
          activeEpisodes: Array.from(scriptActiveEpisodes).sort((a, b) => a - b),
          stopRequested: scriptBulkStopRequestedRef.current,
        });
      };

      const acquireScriptGenerationSlot = () =>
        new Promise<() => void>((resolve) => {
          const start = () => {
            activeScriptGenerations += 1;
            let released = false;
            resolve(() => {
              if (released) return;
              released = true;
              activeScriptGenerations = Math.max(0, activeScriptGenerations - 1);
              pendingScriptGenerationStarters.shift()?.();
            });
          };

          if (activeScriptGenerations < SCRIPT_BULK_CONCURRENCY) {
            start();
          } else {
            pendingScriptGenerationStarters.push(start);
          }
        });

      const patchRow = (
        episode: HongguoEpisodeItem,
        patch: Partial<EpisodeM3u8Result>,
      ) => {
        updateResultItemByKey(
          "shot4u",
          `${episode.index}-hongguo:${item.id}:${episode.video_id}`,
          patch,
        );
      };

      const enqueueUploadAndScript = (
        episode: HongguoEpisodeItem,
        savedItem: EpisodeM3u8Result,
      ) => {
        const task = (async () => {
          scriptActiveEpisodes.add(episode.index);
          syncScriptProgress();
          try {
            if (scriptBulkStopRequestedRef.current) {
              scriptFailedTotal += 1;
              return;
            }
            const remoteVideoUrl = await uploadLocalMp4(
              savedItem,
              savedItem.localMp4Path || "",
            );
            if (scriptBulkStopRequestedRef.current) {
              scriptFailedTotal += 1;
              return;
            }
            const releaseScriptSlot = await acquireScriptGenerationSlot();
            let ok = false;
            try {
              if (scriptBulkStopRequestedRef.current) {
                scriptFailedTotal += 1;
                return;
              }
              ok = await generateScript(
                { ...savedItem, remoteVideoUrl },
                { silent: true },
              );
            } finally {
              releaseScriptSlot();
            }
            if (ok) {
              scriptSuccessTotal += 1;
            } else {
              scriptFailedTotal += 1;
            }
          } catch {
            scriptFailedTotal += 1;
          } finally {
            scriptCompletedTotal += 1;
            scriptActiveEpisodes.delete(episode.index);
            syncScriptProgress();
          }
        })();
        pipelinePromises.push(task);
      };

      const takeNextEpisode = () => {
        if (bulkStopRequestedRef.current) return null;
        const episode = episodes[nextIndex];
        nextIndex += 1;
        return episode || null;
      };

      const runDownloadWorker = async () => {
        while (true) {
          const episode = takeNextEpisode();
          if (!episode) break;
          const rowKey = `${episode.index}-hongguo:${item.id}:${episode.video_id}`;
          downloadActiveEpisodes.add(episode.index);
          setDownloadingMap((current) => ({ ...current, [rowKey]: true }));
          syncDownloadProgress();
          patchRow(episode, {
            downloadStatus: "pending",
            downloadMessage: "正在解析最低画质 MP4",
          });

          try {
            const videoResponse = await requestHongguoApi<{
              code?: number;
              msg?: string;
              data?: { video_lists?: HongguoVideoListItem[] };
            }>({
              key: HONGGUO_API_KEY,
              type: "video",
              video_id: episode.video_id,
            });
            if (videoResponse.code !== 200) {
              throw new Error(videoResponse.msg || "获取分集播放链接失败");
            }

            const video = selectLowestQualityMp4(
              videoResponse.data?.video_lists || [],
            );
            if (!video?.url || !video.decrypt_key) {
              throw new Error("未找到可用 MP4 播放链接");
            }

            patchRow(episode, {
              hongguoSourceUrl: video.url,
              hongguoDecryptKey: video.decrypt_key,
              hongguoDefinition: video.definition,
              downloadStatus: "pending",
              downloadMessage: "正在调用红果云解析接口",
            });
            const mp4Url = await requestHongguoDecrypt(
              video.url,
              video.decrypt_key,
            );
            patchRow(episode, {
              mp4Url,
              downloadStatus: "pending",
              downloadMessage: `正在下载最低画质 ${video.definition || ""}`.trim(),
            });

            const row: EpisodeM3u8Result = {
              episode: episode.index,
              pageUrl: `hongguo:${item.id}:${episode.video_id}`,
              m3u8Url: "",
              mp4Url,
              hongguoSourceUrl: video.url,
              hongguoDecryptKey: video.decrypt_key,
              hongguoDefinition: video.definition,
              title: dramaTitle,
              nextPageUrl: "",
              status: "success",
              source: "shot4u",
            };
            const result = await downloadMp4Url(
              mp4Url,
              joinPath(selected, getEpisodeFileName(row)),
            );
            const savedItem = {
              ...row,
              localMp4Path: result.path,
              downloadStatus: "success" as const,
              downloadMessage: "已保存",
            };
            patchRow(episode, savedItem);
            downloadSuccessTotal += 1;
            enqueueUploadAndScript(episode, savedItem);
          } catch (error) {
            downloadFailedTotal += 1;
            scriptFailedTotal += 1;
            scriptCompletedTotal += 1;
            patchRow(episode, {
              downloadStatus: "error",
              downloadMessage:
                error instanceof Error ? error.message : "下载失败",
            });
            syncScriptProgress();
          } finally {
            downloadCompletedTotal += 1;
            downloadActiveEpisodes.delete(episode.index);
            syncDownloadProgress();
            setDownloadingMap((current) => {
              const next = { ...current };
              delete next[rowKey];
              return next;
            });
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(concurrency, episodes.length) }, () =>
          runDownloadWorker(),
        ),
      );
      await Promise.all(pipelinePromises);

      if (scriptSuccessTotal === 0) {
        toast.error("搜索渠道处理完成，但没有成功生成剧本");
      } else if (scriptFailedTotal > 0) {
        toast.error(
          `搜索渠道处理完成，生成成功 ${scriptSuccessTotal} 集，失败 ${scriptFailedTotal} 集`,
        );
      } else {
        toast.success(`搜索渠道处理完成，已生成 ${scriptSuccessTotal} 集剧本`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "搜索渠道处理失败");
    } finally {
      setBulkDownloading(false);
      setScriptBulkGenerating(false);
      setScriptWorkflowRunning(false);
      bulkStopRequestedRef.current = false;
      scriptBulkStopRequestedRef.current = false;
    }
  };

  return (
    <div className="video-to-script-scrollbar-scope h-full flex-1 overflow-y-auto bg-[#09090b] text-white">
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-8 py-8">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            {/* <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[#B43FEB]">
              <Video size={18} />
              视频转剧本
            </div> */}
            <h1 className="text-3xl font-semibold tracking-wide text-white">
              视频转剧本
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">
              支持 Shot4u 播放页请求 ass.php 后按出现顺序提取
              index.m3u8，也支持直接导入本地 MP4 上传 OSS 后生成剧本。
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-center">
            <div>
              <div className="text-lg font-semibold text-white">
                {results.length}
              </div>
              <div className="mt-0.5 text-[11px] text-white/35">已处理</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-emerald-300">
                {successCount}
              </div>
              <div className="mt-0.5 text-[11px] text-white/35">成功</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-white">
                {activeChannelConfig.label}
              </div>
              <div className="mt-0.5 text-[11px] text-white/35">当前入口</div>
            </div>
          </div>
        </header>

        <section className="mb-5 rounded-xl border border-white/8 bg-[#121214] p-5">
          <div className="mb-5 flex flex-wrap gap-2">
            {INPUT_CHANNELS.map((channel) => (
              <Button
                key={channel.value}
                size="sm"
                variant={activeChannel === channel.value ? "blue" : "default"}
                disabled={running || scriptWorkflowRunning}
                onClick={() => setActiveChannel(channel.value)}
              >
                {channel.value === "shot4u" ? <PlayCircle size={14} /> : null}
                {channel.value === "localMp4" ? <UploadCloud size={14} /> : null}
                {channel.value === "search" ? <Search size={14} /> : null}
                <span>{channel.label}</span>
                <span className="text-[11px] opacity-55">
                  {channel.description}
                </span>
              </Button>
            ))}
          </div>

          {activeChannel === "shot4u" ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
              <label className="min-w-0">
                <span className="mb-2 block text-xs font-medium text-white/50">
                  Shot4u 播放页
                </span>
                <Input
                  value={startUrl}
                  onChange={(event) => setCurrentStartUrl(event.target.value)}
                  disabled={running || scriptWorkflowRunning}
                  placeholder={SOURCE_CONFIG[inputMode].placeholder}
                  className="h-10 border-white/10 bg-black/35 text-white placeholder:text-white/25"
                />
              </label>

              <div className="flex items-end gap-2">
                {running ? (
                  <Button
                    variant="default"
                    className="h-10 border-red-400/20 bg-red-500/10 text-red-100 hover:bg-red-500/15"
                    onClick={stopProbe}
                  >
                    停止
                  </Button>
                ) : (
                  <Button
                    variant="blue"
                    className="h-10"
                    disabled={scriptWorkflowRunning}
                    onClick={() => setProbeScopeDialogOpen(true)}
                  >
                    <PlayCircle size={16} />
                    开始解析
                  </Button>
                )}
                <Button
                  variant="blue"
                  className="h-10"
                  loading={scriptWorkflowRunning}
                  disabled={
                    scriptWorkflowRunning ||
                    scriptBulkGenerating ||
                    running ||
                    bulkDownloading
                  }
                  onClick={() => setScriptWorkflowDialogOpen(true)}
                >
                  <FileText size={16} />
                  一键生成剧本
                </Button>
                <Button
                  variant="default"
                  className="h-10"
                  disabled={running || results.length === 0}
                  onClick={() => setCurrentResults([])}
                  title="清空结果"
                >
                  <RotateCcw size={16} />
                </Button>
              </div>
            </div>
          ) : null}

          {activeChannel === "localMp4" ? (
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <div className="text-sm font-medium text-white/80">
                  导入本地 MP4
                </div>
                <div className="mt-1 text-xs leading-5 text-white/42">
                  支持多选 MP4。系统会优先按文件名识别集数，识别不到时按选择顺序从 1 开始。
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="default"
                  className="h-10"
                  disabled={running || bulkDownloading || scriptBulkGenerating}
                  onClick={() => {
                    void importLocalMp4Files().catch((error) => {
                      toast.error(
                        error instanceof Error ? error.message : "导入 MP4 失败",
                      );
                    });
                  }}
                >
                  <UploadCloud size={16} />
                  导入 MP4
                </Button>
                <Button
                  variant="blue"
                  className="h-10"
                  disabled={running || bulkDownloading || scriptBulkGenerating}
                  onClick={() => {
                    void importLocalMp4Files({
                      generateAfterUpload: true,
                    }).catch((error) => {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "导入并生成剧本失败",
                      );
                    });
                  }}
                >
                  <FileText size={16} />
                  导入并生成
                </Button>
                <Button
                  variant="default"
                  className="h-10"
                  disabled={running || results.length === 0}
                  onClick={() => setCurrentResults([])}
                  title="清空结果"
                >
                  <RotateCcw size={16} />
                </Button>
              </div>
            </div>
          ) : null}

          {activeChannel === "search" ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_120px_auto]">
              <label className="min-w-0">
                <span className="mb-2 block text-xs font-medium text-white/50">
                  短剧关键词
                </span>
                <Input
                  value={hongguoKeyword}
                  onChange={(event) => setHongguoKeyword(event.target.value)}
                  disabled={hongguoSearching || scriptWorkflowRunning}
                  placeholder="乌龙假扮恋"
                  className="h-10 border-white/10 bg-black/35 text-white placeholder:text-white/25"
                />
              </label>
              <label>
                <span className="mb-2 block text-xs font-medium text-white/50">
                  页码
                </span>
                <Input
                  value={hongguoPage}
                  onChange={(event) => setHongguoPage(event.target.value)}
                  disabled={hongguoSearching || scriptWorkflowRunning}
                  className="h-10 border-white/10 bg-black/35 text-white"
                />
              </label>
              <div className="flex items-end gap-2">
                <Button
                  variant="blue"
                  className="h-10"
                  loading={hongguoSearching}
                  disabled={hongguoSearching || scriptWorkflowRunning}
                  onClick={() => {
                    void searchHongguoShortDrama();
                  }}
                >
                  <Search size={16} />
                  搜索
                </Button>
                <Button
                  variant="default"
                  className="h-10"
                  disabled={running || results.length === 0}
                  onClick={() => setCurrentResults([])}
                  title="清空结果"
                >
                  <RotateCcw size={16} />
                </Button>
              </div>
            </div>
          ) : null}

          {running && currentPageUrl ? (
            <div className="mt-4 flex min-w-0 items-center gap-2 rounded-lg border border-[#B43FEB]/20 bg-[#B43FEB]/8 px-3 py-2 text-xs text-[#E9C7FF]">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              <span className="shrink-0">正在读取</span>
              <span className="truncate text-white/55">{currentPageUrl}</span>
            </div>
          ) : null}
        </section>

        <section className="min-h-0 flex-1 overflow-hidden rounded-xl border border-white/8 bg-[#121214]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
            <div>
              <h2 className="text-base font-medium text-white/90">解析结果</h2>
              <p className="mt-1 text-xs text-white/35">
                默认批量保存未生成 MP4 的行，单集失败会继续后面的任务。
              </p>
              {bulkProgress ? (
                <div className="mt-2 text-xs text-white/45">
                  {bulkDownloading && bulkProgress.stopRequested
                    ? `已停止派发，等待运行中任务完成：已完成 ${bulkProgress.current}/${bulkProgress.total}`
                    : bulkDownloading
                      ? `正在保存：已完成 ${bulkProgress.current}/${bulkProgress.total}`
                      : `上次批量：已完成 ${bulkProgress.current}/${bulkProgress.total}`}
                  {bulkProgress.activeEpisodes.length > 0
                    ? `，运行中第 ${bulkProgress.activeEpisodes.join("、")} 集`
                    : ""}
                  {`，并发 ${bulkProgress.concurrency}，成功 ${bulkProgress.success}，失败 ${bulkProgress.failed}，跳过 ${bulkProgress.skipped}`}
                </div>
              ) : null}
              {splitBulkProgress ? (
                <div className="mt-1 text-xs text-white/45">
                  {bulkSplitting && splitBulkProgress.stopRequested
                    ? `已停止派发裁切任务，等待运行中任务完成：已完成 ${splitBulkProgress.current}/${splitBulkProgress.total}`
                    : bulkSplitting
                      ? `正在裁切：已完成 ${splitBulkProgress.current}/${splitBulkProgress.total}`
                      : `上次裁切批量：已完成 ${splitBulkProgress.current}/${splitBulkProgress.total}`}
                  {splitBulkProgress.activeEpisodes.length > 0
                    ? `，运行中第 ${splitBulkProgress.activeEpisodes.join("、")} 集`
                    : ""}
                  {`，并发 ${splitBulkProgress.concurrency}，成功 ${splitBulkProgress.success}，失败 ${splitBulkProgress.failed}，跳过 ${splitBulkProgress.skipped}`}
                </div>
              ) : null}
              {scriptBulkProgress ? (
                <div className="mt-1 text-xs text-white/45">
                  {scriptBulkGenerating && scriptBulkProgress.stopRequested
                    ? `已停止派发剧本任务，等待运行中任务完成：已完成 ${scriptBulkProgress.current}/${scriptBulkProgress.total}`
                    : scriptBulkGenerating
                      ? `正在生成剧本：已完成 ${scriptBulkProgress.current}/${scriptBulkProgress.total}`
                      : `上次剧本批量：已完成 ${scriptBulkProgress.current}/${scriptBulkProgress.total}`}
                  {scriptBulkProgress.activeEpisodes.length > 0
                    ? `，运行中第 ${scriptBulkProgress.activeEpisodes.join("、")} 集`
                    : ""}
                  {`，并发 ${scriptBulkProgress.concurrency}，成功 ${scriptBulkProgress.success}，失败 ${scriptBulkProgress.failed}，跳过 ${scriptBulkProgress.skipped}`}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <label className="flex items-center gap-2 text-xs text-white/45">
                并发数
                <Input
                  type="number"
                  min={1}
                  max={MAX_BULK_CONCURRENCY}
                  value={bulkConcurrency}
                  disabled={bulkDownloading}
                  onChange={(event) =>
                    setBulkConcurrency(event.target.value)
                  }
                  onBlur={() =>
                    setBulkConcurrency(String(normalizeBulkConcurrency(bulkConcurrency)))
                  }
                  className="h-8 w-16 border-white/10 bg-black/35 text-center text-white"
                />
              </label>
              {/* <Button
                size="sm"
                disabled={results.length === 0}
                onClick={() => copyText("text")}
              >
                <Clipboard size={14} />
                复制链接
              </Button>
              <Button
                size="sm"
                disabled={results.length === 0}
                onClick={() => copyText("json")}
              >
                <FileJson size={14} />
                复制 JSON
              </Button> */}
              <Button
                size="sm"
                variant="blue"
                loading={bulkDownloading}
                disabled={
                  !results.some((item) => item.status === "success" && item.m3u8Url) ||
                  bulkDownloading
                }
                onClick={() => {
                  void downloadAll().catch((error) => {
                    toast.error(
                      error instanceof Error ? error.message : "批量保存失败",
                    );
                  });
                }}
              >
                <Download size={14} />
                全部保存 MP4
              </Button>
              {bulkDownloading ? (
                <Button
                  size="sm"
                  variant="default"
                  className="border-red-400/20 bg-red-500/10 text-red-100 hover:bg-red-500/15"
                  onClick={stopBulkDownload}
                >
                  停止保存
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="blue"
                loading={bulkSplitting}
                disabled={results.length === 0 || bulkSplitting}
                onClick={() => {
                  void splitAll().catch((error) => {
                    toast.error(
                      error instanceof Error ? error.message : "批量裁切失败",
                    );
                  });
                }}
              >
                <Scissors size={14} />
                全部裁切{CLIP_SEGMENT_SECONDS}秒
              </Button>
              {bulkSplitting ? (
                <Button
                  size="sm"
                  variant="default"
                  className="border-red-400/20 bg-red-500/10 text-red-100 hover:bg-red-500/15"
                  onClick={stopBulkSplit}
                >
                  停止裁切
                </Button>
              ) : null}
              <label className="flex items-center gap-2 text-xs text-white/45">
                模型
                <Select
                  value={videoToScriptModel}
                  onValueChange={(value) =>
                    setVideoToScriptModel(value as VideoToScriptModel)
                  }
                  disabled={scriptBulkGenerating || scriptWorkflowRunning}
                >
                  <SelectTrigger className="h-8 w-40 border-white/10 bg-black/35 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border border-white/10 bg-[#18181a] text-white">
                    {VIDEO_TO_SCRIPT_MODELS.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <Button
                size="sm"
                variant="blue"
                loading={scriptBulkGenerating}
                disabled={results.length === 0 || scriptBulkGenerating}
                onClick={() => {
                  void generateAllScripts().catch((error) => {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "批量生成剧本失败",
                    );
                  });
                }}
              >
                <FileText size={14} />
                生成剧本
              </Button>
              {scriptBulkGenerating ? (
                <Button
                  size="sm"
                  variant="default"
                  className="border-red-400/20 bg-red-500/10 text-red-100 hover:bg-red-500/15"
                  onClick={stopScriptBulkGenerate}
                >
                  停止生成
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="default"
                disabled={results.every((item) => !item.scriptContent)}
                onClick={() => {
                  void exportScriptsToWord().catch((error) => {
                    toast.error(
                      error instanceof Error ? error.message : "导出 Word 失败",
                    );
                  });
                }}
              >
                <FileText size={14} />
                导出 Word
              </Button>
            </div>
          </div>

          {results.length === 0 ? (
            <div className="flex h-80 flex-col items-center justify-center gap-3 text-white/35">
              <Link2 size={28} />
              <div className="text-sm">还没有解析结果</div>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[1480px] table-fixed border-collapse">
                <thead className="sticky top-0 bg-[#18181a] text-left text-xs text-white/45">
                  <tr>
                    <th className="w-20 px-4 py-3 font-medium">集数</th>
                    <th className="w-32 px-4 py-3 font-medium">状态</th>
                    <th className="w-44 px-4 py-3 font-medium">操作</th>
                    <th className="w-64 px-4 py-3 font-medium">MP4 视频</th>
                    <th className="w-80 px-4 py-3 font-medium">剧本</th>
                    <th className="px-4 py-3 font-medium">m3u8</th>
                    <th className="px-4 py-3 font-medium">来源</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {results.map((item) => (
                    <tr key={`${item.episode}-${item.pageUrl}`}>
                      <td className="px-4 py-3 text-white/75">
                        第{item.episode}集
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
                              item.status === "success"
                                ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                                : "border-red-400/20 bg-red-500/10 text-red-200",
                            )}
                          >
                            {item.status === "success" ? (
                              <CheckCircle2 size={13} />
                            ) : (
                              <AlertCircle size={13} />
                            )}
                            {item.status === "success"
                              ? "解析成功"
                              : item.message || "解析失败"}
                          </span>
                          {item.downloadStatus ? (
                            <div
                              className={cn(
                                "truncate text-xs",
                                item.downloadStatus === "error"
                                  ? "text-red-200"
                                  : item.downloadStatus === "pending"
                                    ? "text-[#E9C7FF]"
                                    : "text-white/40",
                              )}
                              title={item.downloadMessage}
                            >
                              {item.downloadStatus === "pending"
                                ? "保存中"
                                : item.downloadStatus === "success"
                                  ? "已保存"
                                  : item.downloadStatus === "skipped"
                                    ? "已跳过"
                                    : "保存失败"}
                              {item.downloadMessage
                                ? `：${item.downloadMessage}`
                                : ""}
                            </div>
                          ) : null}
                          {item.uploadStatus ? (
                            <div
                              className={cn(
                                "truncate text-xs",
                                item.uploadStatus === "error"
                                  ? "text-red-200"
                                  : item.uploadStatus === "pending"
                                    ? "text-[#E9C7FF]"
                                    : "text-white/40",
                              )}
                              title={item.uploadMessage}
                            >
                              {item.uploadStatus === "pending"
                                ? "上传中"
                                : item.uploadStatus === "success"
                                  ? "已上传 OSS"
                                  : "上传失败"}
                              {item.uploadMessage ? `：${item.uploadMessage}` : ""}
                            </div>
                          ) : null}
                          {item.clipStatus ? (
                            <div
                              className={cn(
                                "truncate text-xs",
                                item.clipStatus === "error"
                                  ? "text-red-200"
                                  : item.clipStatus === "pending"
                                    ? "text-[#E9C7FF]"
                                    : "text-white/40",
                              )}
                              title={item.clipMessage}
                            >
                              {item.clipStatus === "pending"
                                ? "裁切中"
                                : item.clipStatus === "success"
                                  ? "已裁切"
                                  : item.clipStatus === "skipped"
                                    ? "已跳过"
                                    : "裁切失败"}
                              {item.clipMessage ? `：${item.clipMessage}` : ""}
                            </div>
                          ) : null}
                          {item.scriptStatus ? (
                            <div
                              className={cn(
                                "truncate text-xs",
                                item.scriptStatus === "error"
                                  ? "text-red-200"
                                  : item.scriptStatus === "pending"
                                    ? "text-[#E9C7FF]"
                                    : "text-white/40",
                              )}
                              title={item.scriptError}
                            >
                              {item.scriptStatus === "pending"
                                ? "剧本生成中"
                                : item.scriptStatus === "success"
                                  ? "剧本已生成"
                                  : "剧本失败"}
                              {item.scriptError ? `：${item.scriptError}` : ""}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-2">
                          <Button
                            size="sm"
                            loading={Boolean(downloadingMap[getItemKey(item)])}
                            disabled={
                              item.status !== "success" ||
                              !item.m3u8Url ||
                              Boolean(downloadingMap[getItemKey(item)]) ||
                              bulkDownloading
                            }
                            onClick={() => {
                              void downloadOne(item).catch((error) => {
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : "保存失败",
                                );
                              });
                            }}
                          >
                            <Download size={13} />
                            {item.localMp4Path ? "重新保存" : "保存 MP4"}
                          </Button>
                          {parseHongguoPageUrl(item.pageUrl) ? (
                            <Button
                              size="sm"
                              variant="default"
                              loading={Boolean(downloadingMap[getItemKey(item)])}
                              disabled={
                                item.status !== "success" ||
                                Boolean(downloadingMap[getItemKey(item)]) ||
                                bulkDownloading
                              }
                              onClick={() => {
                                void retryHongguoDownloadOne(item).catch(
                                  (error) => {
                                    toast.error(
                                      error instanceof Error
                                        ? error.message
                                        : "重新解析失败",
                                    );
                                  },
                                );
                              }}
                            >
                              <RotateCcw size={13} />
                              重新解析
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="default"
                            loading={Boolean(uploadingMap[getItemKey(item)])}
                            disabled={
                              !item.localMp4Path ||
                              Boolean(uploadingMap[getItemKey(item)])
                            }
                            onClick={() => {
                              if (!item.localMp4Path) return;
                              void uploadLocalMp4(item, item.localMp4Path).catch(
                                (error) => {
                                  toast.error(
                                    error instanceof Error
                                      ? error.message
                                      : "上传 OSS 失败",
                                  );
                                },
                              );
                            }}
                          >
                            <UploadCloud size={13} />
                            {item.remoteVideoUrl ? "重新上传" : "上传 OSS"}
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            loading={Boolean(splittingMap[getItemKey(item)])}
                            disabled={
                              !item.localMp4Path ||
                              Boolean(splittingMap[getItemKey(item)]) ||
                              bulkSplitting
                            }
                            onClick={() => {
                              void splitOne(item).catch((error) => {
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : "裁切失败",
                                );
                              });
                            }}
                          >
                            <Scissors size={13} />
                            {item.clipOutputDir
                              ? `重新裁切${CLIP_SEGMENT_SECONDS}秒`
                              : `裁切${CLIP_SEGMENT_SECONDS}秒`}
                          </Button>
                          <Button
                            size="sm"
                            variant="blue"
                            loading={Boolean(scriptingMap[getItemKey(item)])}
                            disabled={
                              (!item.localMp4Path && !item.remoteVideoUrl) ||
                              Boolean(scriptingMap[getItemKey(item)])
                            }
                            onClick={() => {
                              void generateScript(item).catch((error) => {
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : "生成剧本失败",
                                );
                              });
                            }}
                          >
                            {item.scriptContent ? "重新生成剧本" : "生成剧本"}
                          </Button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {item.localMp4Path ? (
                          <div className="space-y-2">
                            <video
                              src={convertFileSrc(item.localMp4Path)}
                              controls
                              preload="metadata"
                              className="h-24 w-48 rounded-md border border-white/10 bg-black object-contain"
                            />
                            <div
                              className="truncate font-mono text-[11px] text-white/40"
                              title={item.localMp4Path}
                            >
                              {item.localMp4Path}
                            </div>
                            {item.remoteVideoUrl ? (
                              <div
                                className="truncate font-mono text-[11px] text-emerald-200/55"
                                title={item.remoteVideoUrl}
                              >
                                {item.remoteVideoUrl}
                              </div>
                            ) : null}
                            {item.clipOutputDir ? (
                              <div className="space-y-1">
                                <div className="text-[11px] text-white/45">
                                  切片：{item.clipCount || 0} 个 / 每段{" "}
                                  {item.clipSegmentSeconds || CLIP_SEGMENT_SECONDS} 秒
                                </div>
                                <div
                                  className="truncate font-mono text-[11px] text-[#E9C7FF]/70"
                                  title={item.clipOutputDir}
                                >
                                  {item.clipOutputDir}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-white/30">
                            未保存 MP4
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.scriptContent ? (
                          <div className="space-y-2">
                            <div className="line-clamp-4 whitespace-pre-wrap text-xs leading-5 text-white/65">
                              {item.scriptContent}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => setViewingScriptItem(item)}
                              >
                                <Eye size={13} />
                                查看剧本
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => {
                                  void copyScript(item).catch((error) => {
                                    toast.error(
                                      error instanceof Error
                                        ? error.message
                                        : "复制剧本失败",
                                    );
                                  });
                                }}
                              >
                                <Clipboard size={13} />
                                复制剧本
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-white/30">
                            未生成剧本
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="truncate font-mono text-xs text-[#DDB7FF]">
                          {item.m3u8Url || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="truncate text-xs text-white/45">
                          {item.pageUrl}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <Modal
        open={scriptWorkflowDialogOpen}
        onOpenChange={(open) => {
          if (!scriptWorkflowRunning) setScriptWorkflowDialogOpen(open);
        }}
      >
        <ModalContent className="max-w-md">
          <div className="border-b border-white/8 px-5 py-4">
            <ModalTitle>一键生成剧本</ModalTitle>
            <ModalDescription>
              选择范围后会依次解析播放页、保存 MP4、上传 OSS，并生成剧本。
            </ModalDescription>
          </div>
          <div className="space-y-3 px-5 py-4">
            <Button
              variant={
                selectedScriptWorkflowScope === "first10" ? "blue" : "default"
              }
              className="h-auto w-full justify-start px-4 py-3 text-left"
              disabled={scriptWorkflowRunning}
              onClick={() => setSelectedScriptWorkflowScope("first10")}
            >
              <div>
                <div className="text-sm font-medium">
                  生成前 {FIRST_PROBE_EPISODE_COUNT} 集
                </div>
                <div className="mt-1 text-xs font-normal text-white/55">
                  适合先验证下载、上传和模型生成是否正常。
                </div>
              </div>
            </Button>
            <Button
              variant={
                selectedScriptWorkflowScope === "all" ? "blue" : "default"
              }
              className="h-auto w-full justify-start px-4 py-3 text-left"
              disabled={scriptWorkflowRunning}
              onClick={() => setSelectedScriptWorkflowScope("all")}
            >
              <div>
                <div className="text-sm font-medium">生成全部</div>
                <div className="mt-1 text-xs font-normal text-white/55">
                  使用 ass.php 返回的全部 m3u8，随后自动保存 MP4 并生成剧本。
                </div>
              </div>
            </Button>
          </div>
          <div className="flex justify-end gap-2 border-t border-white/8 px-5 py-4">
            <Button
              size="sm"
              variant="default"
              disabled={scriptWorkflowRunning}
              onClick={() => setScriptWorkflowDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              size="sm"
              variant="blue"
              loading={scriptWorkflowRunning}
              disabled={scriptWorkflowRunning}
              onClick={() => {
                void runScriptWorkflow(selectedScriptWorkflowScope);
              }}
            >
              确认
            </Button>
          </div>
        </ModalContent>
      </Modal>
      <Modal
        open={hongguoSearchDialogOpen}
        onOpenChange={(open) => setHongguoSearchDialogOpen(open)}
      >
        <ModalContent className="flex max-h-[86vh] max-w-4xl flex-col">
          <div className="border-b border-white/8 px-5 py-4">
            <ModalTitle>搜索结果</ModalTitle>
            <ModalDescription>
              选择短剧后可解析前 10 集或全部剧集，并进入下载、上传和生成剧本流程。
            </ModalDescription>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
            {hongguoSearchResults.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-white/35">
                没有搜索结果
              </div>
            ) : (
              <div className="space-y-3">
                {hongguoSearchResults.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-4 rounded-lg border border-white/8 bg-black/20 p-3 md:grid-cols-[96px_1fr_auto]"
                  >
                    <div className="h-32 overflow-hidden rounded-md bg-white/5">
                      {item.cover ? (
                        <img
                          src={item.cover}
                          alt={item.title || ""}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-base font-medium text-white/90">
                          {item.title || "未命名短剧"}
                        </div>
                        {item.rec ? (
                          <span className="rounded border border-[#B43FEB]/25 bg-[#B43FEB]/10 px-2 py-0.5 text-xs text-[#E9C7FF]">
                            {item.rec}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-white/45">
                        总集数：{item.episode_num || "-"} · 角色：
                        {item.role || "-"}
                      </div>
                      <div className="mt-1 text-xs text-white/35">
                        {item.type || ""}
                        {item.score ? ` · 评分 ${item.score}` : ""}
                        {item.record_number ? ` · ${item.record_number}` : ""}
                      </div>
                      <div className="mt-2 line-clamp-3 text-xs leading-5 text-white/55">
                        {item.intro || "暂无简介"}
                      </div>
                    </div>
                    <div className="flex flex-col items-stretch justify-center gap-2">
                      <Button
                        size="sm"
                        variant="blue"
                        disabled={scriptWorkflowRunning}
                        onClick={() => {
                          void runHongguoSearchWorkflow(item);
                        }}
                      >
                        解析全部
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        disabled={scriptWorkflowRunning}
                        onClick={() => {
                          void runHongguoSearchWorkflow(item, 10);
                        }}
                      >
                        前10集
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end border-t border-white/8 px-5 py-4">
            <Button
              size="sm"
              variant="default"
              onClick={() => setHongguoSearchDialogOpen(false)}
            >
              关闭
            </Button>
          </div>
        </ModalContent>
      </Modal>
      <Modal
        open={probeScopeDialogOpen}
        onOpenChange={(open) => {
          if (!running) setProbeScopeDialogOpen(open);
        }}
      >
        <ModalContent className="max-w-md">
          <div className="border-b border-white/8 px-5 py-4">
            <ModalTitle>选择解析范围</ModalTitle>
            <ModalDescription>
              Shot4u 播放页会先读取 ass.php 返回的播放列表。
            </ModalDescription>
          </div>
          <div className="space-y-3 px-5 py-4">
            <Button
              variant={selectedProbeScope === "first10" ? "blue" : "default"}
              className="h-auto w-full justify-start px-4 py-3 text-left"
              onClick={() => setSelectedProbeScope("first10")}
            >
              <div>
                <div className="text-sm font-medium">
                  解析前 {FIRST_PROBE_EPISODE_COUNT} 集
                </div>
                <div className="mt-1 text-xs font-normal text-white/55">
                  快速验证链接和后续下载流程。
                </div>
              </div>
            </Button>
            <Button
              variant={selectedProbeScope === "all" ? "blue" : "default"}
              className="h-auto w-full justify-start px-4 py-3 text-left"
              onClick={() => setSelectedProbeScope("all")}
            >
              <div>
                <div className="text-sm font-medium">解析全部</div>
                <div className="mt-1 text-xs font-normal text-white/55">
                  保留 ass.php 返回的全部 m3u8。
                </div>
              </div>
            </Button>
          </div>
          <div className="flex justify-end gap-2 border-t border-white/8 px-5 py-4">
            <Button
              size="sm"
              variant="default"
              onClick={() => setProbeScopeDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              size="sm"
              variant="blue"
              disabled={running}
              onClick={() => startProbeWithScope(selectedProbeScope)}
            >
              确认
            </Button>
          </div>
        </ModalContent>
      </Modal>
      <Modal
        open={missingScriptEpisodes.length > 0}
        onOpenChange={(open) => {
          if (!open) setMissingScriptEpisodes([]);
        }}
      >
        <ModalContent className="max-w-md">
          <div className="border-b border-white/8 px-5 py-4">
            <ModalTitle>还有剧本未生成</ModalTitle>
            <ModalDescription>
              当前表格存在未生成剧本的集数，补齐后才能导出 Word。
            </ModalDescription>
          </div>
          <div className="px-5 py-4">
            <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm leading-6 text-red-100">
              缺少剧本：第 {missingScriptEpisodes.join("、")} 集
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-white/8 px-5 py-4">
            <Button
              size="sm"
              variant="default"
              onClick={() => setMissingScriptEpisodes([])}
            >
              取消
            </Button>
            <Button
              size="sm"
              variant="blue"
              onClick={() => {
                setMissingScriptEpisodes([]);
                void exportScriptsToWord({ skipMissingCheck: true }).catch(
                  (error) => {
                    toast.error(
                      error instanceof Error ? error.message : "导出 Word 失败",
                    );
                  },
                );
              }}
            >
              继续导出
            </Button>
          </div>
        </ModalContent>
      </Modal>
      <Modal
        open={Boolean(viewingScriptItem)}
        onOpenChange={(open) => {
          if (!open) setViewingScriptItem(null);
        }}
      >
        <ModalContent className="flex max-h-[86vh] flex-col">
          <div className="border-b border-white/8 px-5 py-4">
            <ModalTitle>
              {viewingScriptItem ? `第${viewingScriptItem.episode}集剧本` : "剧本"}
            </ModalTitle>
            <ModalDescription>
              {viewingScriptItem?.remoteVideoUrl || viewingScriptItem?.localMp4Path || ""}
            </ModalDescription>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
            <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-white/78">
              {viewingScriptItem?.scriptContent || ""}
            </pre>
          </div>
          <div className="flex justify-end gap-2 border-t border-white/8 px-5 py-4">
            <Button
              size="sm"
              variant="default"
              onClick={() => setViewingScriptItem(null)}
            >
              关闭
            </Button>
            <Button
              size="sm"
              variant="blue"
              disabled={!viewingScriptItem?.scriptContent}
              onClick={() => {
                if (!viewingScriptItem) return;
                void copyScript(viewingScriptItem).catch((error) => {
                  toast.error(
                    error instanceof Error ? error.message : "复制剧本失败",
                  );
                });
              }}
            >
              <Clipboard size={13} />
              复制剧本
            </Button>
          </div>
        </ModalContent>
      </Modal>
    </div>
  );
}
