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
import { uploadAssetBinary } from "@/pages/Canvas/utils/remoteAssetUpload";

type ProbeStatus = "success" | "error";
type InputMode = "hongguo" | "shot4u";
type DownloadStatus = "idle" | "pending" | "success" | "error" | "skipped";
type UploadStatus = "idle" | "pending" | "success" | "error";
type ScriptStatus = "idle" | "pending" | "success" | "error";
type ClipStatus = "idle" | "pending" | "success" | "error" | "skipped";

type EpisodeM3u8Result = {
  episode: number;
  pageUrl: string;
  m3u8Url: string;
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

const DEFAULT_HONGGUO_URL =
  "https://www.hongguostudio.com/vodplay/29962-1-1.html";
const DEFAULT_SHOT4U_URL = "https://m.shot4u.com/play/2656-0-22.html";
const DEFAULT_MAX_EPISODES = 80;
const DEFAULT_BULK_CONCURRENCY = 2;
const SCRIPT_BULK_CONCURRENCY = 5;
const CLIP_SEGMENT_SECONDS = 14;
const HARD_MAX_EPISODES = 200;
const MAX_BULK_CONCURRENCY = 5;
const VIDEO_TO_SCRIPT_MODEL = "qwen3.7-plus";
const STORAGE_KEY = "jike.videoToScript.state.v1";
const VIDEO_TO_SCRIPT_SYSTEM_PROMPT = `你是短剧剧本整理师。你的任务是观看用户提供的单集短剧视频，只整理“剧情正文”，按影视剧本文本格式还原本集内容。

只输出剧情正文，不要输出剧情梗概、人物表、二创改写要点、分析说明、Markdown 标题、表格或项目符号。

输出格式必须严格参照下面的样式：

第X集

X-1 日、外、地点
人物：角色A、角色B、群演若干
△画面动作、人物走位、表情反应或剧情推进。
角色A：台词。
角色B（动作/语气）：台词。
【OS】角色A：内心独白。
【VO】角色B：画外音或广播。

【闪入】
X-2 夜、内、地点
人物：角色A、角色C
△回忆或插入画面内容。
角色C：台词。
【闪出】

具体规则：
1. 第一行必须是本集标题，格式为“第X集”，X 使用用户提供的当前集数。
2. 每场场头使用“X-Y 日/夜、内/外、地点”格式；X 是集数，Y 是本集场次序号，从 1 开始递增。
3. 场头下一行必须写“人物：”，列出本场出现或发声的角色。群体角色可写“护士*2”“随从若干”“路人若干”。
4. 叙事、动作、表情、转场、画面信息统一用“△”开头。
5. 对话格式为“角色：台词”；带动作或语气时写成“角色（动作/语气）：台词”。
6. 内心独白用“【OS】角色：台词”；画外音、广播、旁白用“【VO】角色：台词”。
7. 回忆、闪回或插入片段可用“【闪入】”“【闪出】”单独成行。
8. 分场依据是实际剧情节点、地点变化、时间变化、人物进出或冲突升级，不按固定时长硬拆。
9. 台词优先还原字幕和人物原话；听不清或看不清时用“【听不清】”标记，不要编造。
10. 严格基于视频内容输出。无法确认姓名时，可用“男主”“女主”“母亲”“反派男”“路人”等临时称呼，但全文必须保持一致。
11. 不要补写视频之外的剧情，不要解释你的判断，不要在结尾另写总结或钩子说明。`;
const SOURCE_CONFIG: Record<
  InputMode,
  { label: string; placeholder: string; referer: string; origin: string }
> = {
  hongguo: {
    label: "红果播放页",
    placeholder: DEFAULT_HONGGUO_URL,
    referer: "https://www.hongguostudio.com/",
    origin: "https://www.hongguostudio.com",
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
  value === "hongguo" || value === "shot4u";

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
    activeMode: "hongguo",
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
          ? String(normalizeBulkConcurrency(parsed.bulkConcurrency))
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

const getItemKey = (item: Pick<EpisodeM3u8Result, "episode" | "pageUrl">) =>
  `${item.episode}-${item.pageUrl}`;

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
  const stopRequestedRef = useRef(false);
  const bulkStopRequestedRef = useRef(false);
  const splitBulkStopRequestedRef = useRef(false);
  const scriptBulkStopRequestedRef = useRef(false);
  const currentDraft = modeDrafts[inputMode] || createDefaultModeDraft(inputMode);
  const { startUrl, maxEpisodes, results } = currentDraft;

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

  const runProbe = async () => {
    const modeAtStart = inputMode;
    let nextPageUrl = startUrl.trim();
    if (!nextPageUrl) {
      toast.error("请输入播放页链接");
      return;
    }

    try {
      nextPageUrl = new URL(nextPageUrl).toString();
    } catch {
      toast.error("播放页链接格式不正确");
      return;
    }

    const limit = normalizeMaxEpisodes(maxEpisodes);
    const sourceConfig = SOURCE_CONFIG[modeAtStart];
    const visited = new Set<string>();
    stopRequestedRef.current = false;
    setRunning(true);
    setModeResults(modeAtStart, []);
    setCurrentPageUrl(nextPageUrl);

    try {
      if (modeAtStart === "shot4u") {
        const playlist = await requestShot4uPlaylist(nextPageUrl);
        if (stopRequestedRef.current) return;

        setModeResults(
          modeAtStart,
          playlist.m3u8Urls.map((m3u8Url, index) => ({
            episode: index + 1,
            pageUrl: nextPageUrl,
            m3u8Url,
            title: "",
            nextPageUrl: "",
            status: "success",
            source: modeAtStart,
            referer: sourceConfig.referer,
            origin: sourceConfig.origin,
          })),
        );
        setCurrentPageUrl(playlist.assUrl);
        return;
      }

      for (let index = 0; index < limit; index += 1) {
        if (stopRequestedRef.current) break;
        if (!nextPageUrl || visited.has(nextPageUrl)) break;

        visited.add(nextPageUrl);
        setCurrentPageUrl(nextPageUrl);

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
            Number(payload.nid) ||
            extractEpisodeFromUrl(nextPageUrl) ||
            index + 1;

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

          setModeResults(modeAtStart, (current) => [...current, item]);

          if (!absoluteNextPageUrl || absoluteNextPageUrl === nextPageUrl) {
            break;
          }

          nextPageUrl = absoluteNextPageUrl;
        } catch (error) {
          if (stopRequestedRef.current) break;

          setModeResults(modeAtStart, (current) => [
            ...current,
            {
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
            },
          ]);
          break;
        }
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
      uploadMessage: "正在上传 OSS",
    });

    try {
      const bytes = await readFile(localPath);
      const blob = new Blob([bytes], { type: "video/mp4" });
      const uploaded = await uploadAssetBinary({
        blob,
        fileName: getEpisodeFileName(item),
        mimeType: "video/mp4",
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
        model: VIDEO_TO_SCRIPT_MODEL,
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
      defaultPath: getEpisodeFileName(item),
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

    const syncedKeys = new Set<string>();
    await Promise.all(
      allDownloadableItems
        .filter((item) => !item.localMp4Path)
        .map(async (item) => {
          const expectedPath = joinPath(selected, getEpisodeFileName(item));
          const fileExists = await exists(expectedPath).catch(() => false);
          if (!fileExists) return;

          const itemKey = getItemKey(item);
          syncedKeys.add(itemKey);
          updateResultItemByKey(item.source, itemKey, {
            localMp4Path: expectedPath,
            downloadStatus: "skipped",
            downloadMessage: "目录中已存在 MP4，已自动同步",
          });
        }),
    );

    const downloadableItems = allDownloadableItems.filter(
      (item) => !item.localMp4Path && !syncedKeys.has(getItemKey(item)),
    );
    if (downloadableItems.length === 0) {
      toast.success(`已从保存目录同步 ${syncedKeys.size} 个 MP4`);
      return;
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
        updateResultItem(item, {
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
            // 本地 MP4 已保存，OSS 上传失败交给行状态显示并允许手动重试。
          }
          skippedTotal += result.skippedSegments || 0;
          successTotal += 1;
        } catch (error) {
          failedTotal += 1;
          const message = error instanceof Error ? error.message : "保存失败";
          updateResultItem(item, {
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

  const generateAllScripts = async () => {
    const allScriptableItems = results.filter(
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

  const stopScriptBulkGenerate = () => {
    scriptBulkStopRequestedRef.current = true;
    setScriptBulkProgress((current) =>
      current ? { ...current, stopRequested: true } : current,
    );
    toast.info("已停止派发新剧本任务，等待运行中的任务完成");
  };

  const exportScriptsToWord = async () => {
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

  return (
    <div className="video-to-script-scrollbar-scope h-full flex-1 overflow-y-auto bg-[#09090b] text-white">
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-8 py-8">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[#B43FEB]">
              <Video size={18} />
              视频转剧本
            </div>
            <h1 className="text-3xl font-semibold tracking-wide text-white">
              播放页视频链接解析
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">
              支持红果播放页逐集提取 player_aaaa.url，也支持 Shot4u
              播放页请求 ass.php 后按出现顺序提取 index.m3u8。
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
                {inputMode === "hongguo"
                  ? normalizeMaxEpisodes(maxEpisodes)
                  : "全部"}
              </div>
              <div className="mt-0.5 text-[11px] text-white/35">
                {inputMode === "hongguo" ? "上限" : "范围"}
              </div>
            </div>
          </div>
        </header>

        <section className="mb-5 rounded-xl border border-white/8 bg-[#121214] p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {(["hongguo", "shot4u"] as const).map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant={inputMode === mode ? "blue" : "default"}
                disabled={running}
                onClick={() => {
                  setInputMode(mode);
                }}
              >
                {SOURCE_CONFIG[mode].label}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_140px_auto]">
            <label className="min-w-0">
              <span className="mb-2 block text-xs font-medium text-white/50">
                {inputMode === "hongguo" ? "第一集播放页" : "Shot4u 播放页"}
              </span>
              <Input
                value={startUrl}
                onChange={(event) => setCurrentStartUrl(event.target.value)}
                disabled={running}
                placeholder={SOURCE_CONFIG[inputMode].placeholder}
                className="h-10 border-white/10 bg-black/35 text-white placeholder:text-white/25"
              />
            </label>

            <label>
              <span className="mb-2 block text-xs font-medium text-white/50">
                {inputMode === "hongguo" ? "最大集数" : "列表上限"}
              </span>
              {inputMode === "hongguo" ? (
                <Input
                  type="number"
                  min={1}
                  max={HARD_MAX_EPISODES}
                  value={maxEpisodes}
                  onChange={(event) =>
                    setCurrentMaxEpisodes(event.target.value)
                  }
                  disabled={running}
                  className="h-10 border-white/10 bg-black/35 text-white"
                />
              ) : (
                <div className="flex h-10 items-center rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white/55">
                  按 ass.php 返回全部
                </div>
              )}
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
                  onClick={() => {
                    void runProbe().catch((error) => {
                      toast.error(
                        error instanceof Error ? error.message : "解析失败",
                      );
                    });
                  }}
                >
                  <PlayCircle size={16} />
                  开始解析
                </Button>
              )}
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
                disabled={results.length === 0 || bulkDownloading}
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
                一键生成剧本
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
                    <th className="px-4 py-3 font-medium">播放页</th>
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
