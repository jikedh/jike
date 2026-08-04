import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import {
  Clipboard,
  Eye,
  FileText,
  RotateCcw,
  Scissors,
  UploadCloud,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
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
import { getUploadOssPutUrl, type UploadOssPutUrlResp } from "@/api/jikeGo";

type VideoToScriptModel = "qwen3.5-flash" | "qwen3.7-plus";
type UploadStatus = "idle" | "pending" | "success" | "error";
type ScriptStatus = "idle" | "pending" | "success" | "error";
type ClipStatus = "idle" | "pending" | "success" | "error" | "skipped";

type VideoToScriptItem = {
  episode: number;
  pageUrl: string;
  title: string;
  localMp4Path: string;
  remoteVideoUrl?: string;
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
};

type CommandResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type SplitMp4Result = {
  outputDir: string;
  clipCount: number;
  clips: string[];
  segmentSeconds: number;
  method: string;
};

const SCRIPT_BULK_CONCURRENCY = 10;
const OSS_UPLOAD_CONCURRENCY = 5;
const CLIP_SEGMENT_SECONDS = 14;
const DEFAULT_VIDEO_TO_SCRIPT_MODEL: VideoToScriptModel = "qwen3.5-flash";
const VIDEO_TO_SCRIPT_MODELS: Array<{
  value: VideoToScriptModel;
  label: string;
}> = [
  { value: "qwen3.5-flash", label: "qwen3.5-flash" },
  { value: "qwen3.7-plus", label: "qwen3.7-plus" },
];
const OSS_DIRECT_UPLOAD_TTL = 12 * 60 * 60;
const VIDEO_TO_SCRIPT_SYSTEM_PROMPT = `你是短剧成片拉片剧本整理师。你的任务是观看用户提供的单集短剧视频，只整理“剧情正文”，按短剧成片还原稿的方式整理本集内容。

只输出剧情正文，不要输出剧情梗概、人物表、二创改写要点、分析说明、Markdown 标题、表格或项目符号。

输出目标：
从视频开头到结尾按时间顺序完整还原成片内容，而不是写摘要。重点保留人物动作、表情反应、镜头切换、转场、屏幕文字、音效、旁白、内心 OS 和所有可辨识对白。完整性优先于简洁，允许输出较长文本；宁可多写动作、反应和转场，也不要把连续剧情压缩成概括句。

最高优先级约束：
1. 禁止偷工减料：必须覆盖视频的开端、发展、冲突变化、关键反应和结尾。逐场、逐段记录可辨识的动作和对白，不得跳过中间过程，不得把多轮对话合并成一句，不得用“二人争执”“随后发生冲突”“经过一番交谈”等概括句替代实际内容。
2. 禁止剧情杜撰：只能写视频画面、声音、字幕、屏幕文字或明确上下文能够直接支持的内容。不得补充视频没有展示的前因后果、人物关系、身份、动机、心理、地点名、时间跨度或后续剧情；不得为了让剧情连贯而自行补桥段。信息不足时保留不确定性，不要猜测。
3. 禁止人物误认：输出前先在内部建立本集角色身份对应关系，综合姓名牌、字幕、他人称呼、服装外貌、声音和连续镜头确认人物。不同人物不得合并，同一人物不得反复改名。证据不足时使用稳定的中性称呼，如“黑衣男子A”“年轻女子B”“未知男声”，不要擅自套用姓名、亲属关系或主角身份。
4. 严格区分画内台词与画外声音：画面中出现某个人，不代表当前声音就是此人的台词。只有口型同步、连续镜头明确发声，或字幕/上下文能够明确锁定说话者时，才可归为该人物的画内台词。声音来自画外、蒙太奇、回忆解说、内心独白、系统、广播，或说话者无法确认时，必须标为 OS/VO 或未知声音，严禁把它归到当前画面人物名下。

声音归属判定：
- 人物在画面内且口型、动作与声音明确同步：写“角色：台词”。
- 已确认是某个角色的内心独白：写“角色（OS）：台词”。
- 已确认是某个角色在画外说话、回忆讲述或解说：写“角色（VO）：台词”。
- 独立旁白、系统音、广播音：分别写“旁白（VO）”“系统（VO）”“广播（VO）”。
- 只能判断声音性别、无法确认身份：写“未知男声（VO）”或“未知女声（VO）”。
- 完全无法判断说话者：写“未知声音（VO）”。不得仅凭画面正在展示某个人，就把声音标成此人的台词。

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
3. 场头下一行必须写“出场人物：”，列出本场实际出现在画面中或能够确认身份的发声角色，角色之间用中文逗号分隔。仅有声音但身份无法确认时，按“未知男声（VO）”“未知女声（VO）”“未知声音（VO）”列出，不得冒用画面人物姓名。群体角色可写“护士2人”“随从若干”“路人若干”。
4. 叙事、动作、表情、镜头、转场、屏幕文字、音效、BGM 统一用“▲”开头。动作描写要具体、连续，尽量还原画面，不要只写一句概括。
5. 不要按固定时长或每个镜头硬拆场。只有地点、时间、剧情阶段、人物关系、冲突升级或闪回/想象明显变化时才新开一场。
6. 对话格式必须严格为“角色（具体标注）：台词”。括号标注必须放在角色名之后、冒号之前。标注只能写视频中能判断出的具体动作、语气或情绪词，多标签用竖线“｜”分隔，例如“唐竹筠（压低声音｜急切｜紧张）：快走！”。严禁输出“动作”“语气”“情绪”这三个占位词，严禁写成“角色（动作｜语气｜情绪）：台词”。无法确认具体标注时，直接写“角色：台词”，不要为了填格式强行编造。
7. 内心独白、画外音、旁白、广播必须写在角色括号里，例如“姜晚（OS）：台词”“姜晚（VO）：台词”“旁白（VO）：台词”“系统（VO）：台词”“广播（VO）：台词”。不要写成“【OS】角色：台词”。无法确认画外声音身份时必须使用“未知男声（VO）”“未知女声（VO）”或“未知声音（VO）”，不得分配给画面中的人物。
8. 回忆、闪回、想象或插入片段可用“▲闪回”“▲闪回结束”“▲想象”“▲想象结束”单独成行。
9. 台词优先逐句还原字幕和人物原话，保留网络梗、口头禅、停顿、省略号和语气词。字幕与听到的声音不一致时，以能够确认的实际发声内容为主；听不清或看不清时使用“【听不清】”或“【看不清】”，不得根据剧情猜出台词。
10. 已知角色名必须保持一致。只有姓名牌、字幕、明确称呼或连续剧情能够确认姓名时才使用姓名；不要仅凭长相、服装、性别或剧情套路认定身份。无法确认姓名时，可用“黑衣男子A”“年轻女子B”“母亲”“路人”等稳定称呼，全文保持一致；后续确认姓名后再统一使用姓名。
11. 严格基于视频内容输出。镜头切换之间如果没有展示过程，不得补写人物如何到达、为何行动或发生了什么；不得把推测写成事实，不要解释你的判断，不要在结尾另写总结或钩子说明。
12. 输出前必须完成内部校验但不要输出校验过程：检查是否遗漏明显场景、关键动作、人物反应或对白；检查同一角色名称是否一致、不同角色是否被误合并；检查每条剧情是否有视听证据；检查每句声音是否正确区分画内台词、OS、VO、旁白、系统、广播或未知声音。发现无法确认的信息时改用中性称呼或不确定标记，禁止猜测。`;
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
    xhr.onerror = () =>
      reject(new Error("OSS 直传失败：网络异常或跨域配置错误"));
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

const sanitizeFileName = (value: string) => {
  const normalized = value.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
  return normalized || "video";
};

const getEpisodeFileName = (item: VideoToScriptItem) => {
  const title = item.title ? `${item.title}_` : "";
  return sanitizeFileName(
    `${title}第${String(item.episode).padStart(2, "0")}集.mp4`,
  );
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

const getItemKey = (item: Pick<VideoToScriptItem, "episode" | "pageUrl">) =>
  `${item.episode}-${item.pageUrl}`;

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
  const content =
    response?.data?.choices?.[0]?.message?.content ??
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

const scriptToWordXml = (item: VideoToScriptItem) => {
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

const createScriptsDocx = (items: VideoToScriptItem[]) => {
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
  const [results, setResults] = useState<VideoToScriptItem[]>([]);
  const [uploadingMap, setUploadingMap] = useState<Record<string, boolean>>({});
  const [scriptingMap, setScriptingMap] = useState<Record<string, boolean>>({});
  const [splittingMap, setSplittingMap] = useState<Record<string, boolean>>({});
  const [bulkSplitting, setBulkSplitting] = useState(false);
  const [scriptBulkGenerating, setScriptBulkGenerating] = useState(false);
  const [viewingScriptItem, setViewingScriptItem] =
    useState<VideoToScriptItem | null>(null);
  const [videoToScriptModel, setVideoToScriptModel] =
    useState<VideoToScriptModel>(DEFAULT_VIDEO_TO_SCRIPT_MODEL);
  const scriptBulkStopRequestedRef = useRef(false);

  const updateItem = (
    item: VideoToScriptItem,
    patch: Partial<VideoToScriptItem>,
  ) => {
    const key = getItemKey(item);
    setResults((current) =>
      current.map((currentItem) =>
        getItemKey(currentItem) === key
          ? { ...currentItem, ...patch }
          : currentItem,
      ),
    );
  };

  const uploadLocalMp4 = async (item: VideoToScriptItem) => {
    const key = getItemKey(item);
    setUploadingMap((current) => ({ ...current, [key]: true }));
    updateItem(item, {
      uploadStatus: "pending",
      uploadMessage: "正在上传 OSS",
    });

    try {
      const bytes = await readFile(item.localMp4Path);
      const uploaded = await runWithOssUploadSlot(() =>
        uploadVideoToOssDirect(
          new Blob([bytes], { type: "video/mp4" }),
          getEpisodeFileName(item),
          (percent) =>
            updateItem(item, {
              uploadStatus: "pending",
              uploadMessage: `正在上传 OSS ${percent}%`,
            }),
        ),
      );
      updateItem(item, {
        remoteVideoUrl: uploaded.url,
        uploadStatus: "success",
        uploadMessage: "OSS 上传成功",
      });
      return uploaded.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "上传 OSS 失败";
      updateItem(item, { uploadStatus: "error", uploadMessage: message });
      throw error;
    } finally {
      setUploadingMap((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  };

  const generateScript = async (
    item: VideoToScriptItem,
    options?: { silent?: boolean },
  ) => {
    const key = getItemKey(item);
    setScriptingMap((current) => ({ ...current, [key]: true }));
    updateItem(item, { scriptStatus: "pending", scriptError: undefined });

    try {
      const videoUrl = item.remoteVideoUrl || (await uploadLocalMp4(item));
      const response = await createDashscopeChatCompletion({
        model: videoToScriptModel,
        stream: false,
        messages: [
          { role: "system", content: VIDEO_TO_SCRIPT_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "video_url", video_url: { url: videoUrl } },
              {
                type: "text",
                text: `请从视频开头到结尾按时间顺序逐场转写并整理为完整剧本。当前集数：第${item.episode}集。完整保留可辨识的剧情过程、人物动作、反应和逐句对白；严格核对人物身份与声音来源，不得省略、概括、杜撰，也不得把画外音误归为画面人物台词。`,
              },
            ],
          },
        ],
      });
      const content = extractChatCompletionText(response);
      if (!content) throw new Error("模型未返回有效剧本内容");

      updateItem(item, {
        remoteVideoUrl: videoUrl,
        scriptStatus: "success",
        scriptContent: content,
        scriptError: undefined,
      });
      if (!options?.silent) toast.success(`第${item.episode}集剧本已生成`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成剧本失败";
      updateItem(item, { scriptStatus: "error", scriptError: message });
      if (!options?.silent) toast.error(message);
      return false;
    } finally {
      setScriptingMap((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  };

  const splitOne = async (item: VideoToScriptItem, silent = false) => {
    const key = getItemKey(item);
    setSplittingMap((current) => ({ ...current, [key]: true }));
    updateItem(item, { clipStatus: "pending", clipMessage: "正在裁切 MP4" });
    try {
      const result = await splitMp4BySeconds(item.localMp4Path);
      updateItem(item, {
        clipStatus: "success",
        clipMessage: `已生成 ${result.clipCount} 个片段`,
        clipOutputDir: result.outputDir,
        clipCount: result.clipCount,
        clipSegmentSeconds: result.segmentSeconds,
        clipPaths: result.clips,
      });
      if (!silent) toast.success(`第${item.episode}集已裁切`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "MP4 裁切失败";
      updateItem(item, { clipStatus: "error", clipMessage: message });
      if (!silent) toast.error(message);
      return false;
    } finally {
      setSplittingMap((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  };

  const importLocalMp4Files = async (generateAfterUpload = false) => {
    const selected = await open({
      title: generateAfterUpload ? "选择要导入并生成剧本的 MP4" : "选择 MP4",
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
    const importedItems = paths
      .map((path, index) => {
        const fallback = index + 1;
        let episode = inferEpisodeFromFilePath(path, fallback);
        while (usedEpisodes.has(episode)) episode += 1;
        usedEpisodes.add(episode);
        return {
          episode,
          pageUrl: path,
          title: "",
          localMp4Path: path,
          uploadStatus: "idle" as const,
          scriptStatus: "idle" as const,
        };
      })
      .sort((a, b) => a.episode - b.episode);

    setResults(importedItems);
    toast.success(`已导入 ${importedItems.length} 个 MP4，开始上传 OSS`);
    await Promise.all(
      importedItems.map(async (item) => {
        try {
          const url = await uploadLocalMp4(item);
          if (generateAfterUpload && !scriptBulkStopRequestedRef.current) {
            await generateScript(
              { ...item, remoteVideoUrl: url },
              { silent: true },
            );
          }
        } catch {
          // Per-item state already records the upload error.
        }
      }),
    );
    if (generateAfterUpload) toast.success("导入与剧本生成任务已完成");
  };

  const generateAllScripts = async () => {
    const pending = results.filter((item) => !item.scriptContent);
    if (pending.length === 0) {
      toast.info("没有待生成的剧本");
      return;
    }
    scriptBulkStopRequestedRef.current = false;
    setScriptBulkGenerating(true);
    try {
      const concurrency = SCRIPT_BULK_CONCURRENCY;
      let nextIndex = 0;
      const worker = async () => {
        while (!scriptBulkStopRequestedRef.current) {
          const item = pending[nextIndex++];
          if (!item) return;
          await generateScript(item, { silent: true });
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(concurrency, pending.length) }, worker),
      );
      toast.success("批量生成任务已完成");
    } finally {
      setScriptBulkGenerating(false);
      scriptBulkStopRequestedRef.current = false;
    }
  };

  const splitAll = async () => {
    const pending = results.filter((item) => !item.clipOutputDir);
    if (pending.length === 0) {
      toast.info("没有待裁切的 MP4");
      return;
    }
    setBulkSplitting(true);
    try {
      await Promise.all(pending.map((item) => splitOne(item, true)));
      toast.success("批量裁切任务已完成");
    } finally {
      setBulkSplitting(false);
    }
  };

  const exportScriptsToWord = async () => {
    const items = results
      .filter((item) => item.scriptContent)
      .sort((a, b) => a.episode - b.episode);
    if (items.length === 0) {
      toast.error("暂无可导出的剧本");
      return;
    }
    const outputPath = await save({
      title: "导出剧本 Word",
      defaultPath: "短剧剧本.docx",
      filters: [{ name: "Word 文档", extensions: ["docx"] }],
    });
    if (!outputPath) return;
    try {
      await writeFile(
        appendExtensionIfMissing(outputPath, "docx"),
        createScriptsDocx(items),
      );
      toast.success("剧本已导出为 Word");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导出 Word 失败");
    }
  };

  const copyScript = async (item: VideoToScriptItem) => {
    if (!item.scriptContent) return;
    await navigator.clipboard.writeText(item.scriptContent);
    toast.success(`第${item.episode}集剧本已复制`);
  };

  return (
    <div className="video-to-script-scrollbar-scope h-full flex-1 overflow-y-auto bg-[#09090b] text-white">
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-8 py-8">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-3xl font-semibold tracking-wide text-white">
              视频转剧本
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/45">
              导入本地 MP4，上传 OSS 后生成可用于复盘和二创的完整剧本。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-white/8 bg-white/[0.03] px-4 py-3 text-center">
            <div>
              <div className="text-lg font-semibold text-white">
                {results.length}
              </div>
              <div className="mt-0.5 text-[11px] text-white/35">已导入</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-emerald-300">
                {
                  results.filter((item) => item.scriptStatus === "success")
                    .length
                }
              </div>
              <div className="mt-0.5 text-[11px] text-white/35">剧本完成</div>
            </div>
          </div>
        </header>

        <section className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-white/8 bg-[#121214] p-5">
          <div>
            <div className="text-sm font-medium text-white/80">本地 MP4</div>
            <div className="mt-1 text-xs text-white/42">
              支持多选，优先从文件名识别集数。
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="default"
              onClick={() => void importLocalMp4Files()}
            >
              <UploadCloud size={16} />
              导入 MP4
            </Button>
            <Button
              variant="blue"
              onClick={() => void importLocalMp4Files(true)}
            >
              <FileText size={16} />
              导入并生成
            </Button>
            <Button
              variant="default"
              disabled={results.length === 0}
              onClick={() => setResults([])}
              title="清空结果"
            >
              <RotateCcw size={16} />
            </Button>
          </div>
        </section>

        <section className="min-h-0 flex-1 overflow-hidden rounded-lg border border-white/8 bg-[#121214]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
            <div>
              <h2 className="text-base font-medium text-white/90">导入结果</h2>
              <p className="mt-1 text-xs text-white/35">
                视频上传后可单集或批量生成剧本。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={videoToScriptModel}
                onValueChange={(value) =>
                  setVideoToScriptModel(value as VideoToScriptModel)
                }
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
              <Button
                size="sm"
                variant="blue"
                loading={scriptBulkGenerating}
                disabled={results.length === 0 || scriptBulkGenerating}
                onClick={() => void generateAllScripts()}
              >
                <FileText size={14} />
                生成剧本
              </Button>
              <Button
                size="sm"
                variant="blue"
                loading={bulkSplitting}
                disabled={results.length === 0 || bulkSplitting}
                onClick={() => void splitAll()}
              >
                <Scissors size={14} />
                全部裁切{CLIP_SEGMENT_SECONDS}秒
              </Button>
              <Button
                size="sm"
                variant="default"
                disabled={!results.some((item) => item.scriptContent)}
                onClick={() => void exportScriptsToWord()}
              >
                <FileText size={14} />
                导出 Word
              </Button>
            </div>
          </div>

          {results.length === 0 ? (
            <div className="flex h-80 flex-col items-center justify-center gap-3 text-white/35">
              <UploadCloud size={28} />
              <div className="text-sm">还没有导入 MP4</div>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[1120px] table-fixed border-collapse">
                <thead className="sticky top-0 bg-[#18181a] text-left text-xs text-white/45">
                  <tr>
                    <th className="w-20 px-4 py-3 font-medium">集数</th>
                    <th className="w-72 px-4 py-3 font-medium">本地 MP4</th>
                    <th className="w-80 px-4 py-3 font-medium">处理状态</th>
                    <th className="w-48 px-4 py-3 font-medium">操作</th>
                    <th className="px-4 py-3 font-medium">剧本</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {results.map((item) => {
                    const key = getItemKey(item);
                    return (
                      <tr key={key}>
                        <td className="px-4 py-3 text-white/75">
                          第{item.episode}集
                        </td>
                        <td className="px-4 py-3">
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
                              {getPathFileName(item.localMp4Path)}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1 text-xs">
                            <div
                              className={cn(
                                item.uploadStatus === "error"
                                  ? "text-red-200"
                                  : item.uploadStatus === "success"
                                    ? "text-emerald-200"
                                    : "text-white/45",
                              )}
                            >
                              {item.uploadStatus === "pending"
                                ? "上传中"
                                : item.uploadStatus === "success"
                                  ? "OSS 已上传"
                                  : item.uploadStatus === "error"
                                    ? `上传失败：${item.uploadMessage || ""}`
                                    : "待上传"}
                            </div>
                            <div
                              className={cn(
                                item.scriptStatus === "error"
                                  ? "text-red-200"
                                  : item.scriptStatus === "success"
                                    ? "text-emerald-200"
                                    : "text-white/45",
                              )}
                            >
                              {item.scriptStatus === "pending"
                                ? "剧本生成中"
                                : item.scriptStatus === "success"
                                  ? "剧本已生成"
                                  : item.scriptStatus === "error"
                                    ? `剧本失败：${item.scriptError || ""}`
                                    : "待生成"}
                            </div>
                            {item.clipStatus ? (
                              <div
                                className={
                                  item.clipStatus === "error"
                                    ? "text-red-200"
                                    : "text-white/45"
                                }
                              >
                                {item.clipMessage || "裁切中"}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              loading={Boolean(uploadingMap[key])}
                              disabled={Boolean(uploadingMap[key])}
                              onClick={() => void uploadLocalMp4(item)}
                            >
                              <UploadCloud size={13} />
                              上传 OSS
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              loading={Boolean(scriptingMap[key])}
                              disabled={Boolean(scriptingMap[key])}
                              onClick={() => void generateScript(item)}
                            >
                              <FileText size={13} />
                              生成
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              loading={Boolean(splittingMap[key])}
                              disabled={Boolean(splittingMap[key])}
                              onClick={() => void splitOne(item)}
                            >
                              <Scissors size={13} />
                              裁切
                            </Button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {item.scriptContent ? (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => setViewingScriptItem(item)}
                              >
                                <Eye size={13} />
                                查看
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => void copyScript(item)}
                              >
                                <Clipboard size={13} />
                                复制
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-white/30">
                              尚未生成
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <Modal
        open={Boolean(viewingScriptItem)}
        onOpenChange={(open) => !open && setViewingScriptItem(null)}
      >
        <ModalContent className="max-h-[80vh] max-w-4xl overflow-hidden border border-white/10 bg-[#18181a] text-white">
          <ModalTitle>第{viewingScriptItem?.episode}集剧本</ModalTitle>
          <ModalDescription>视频转写结果</ModalDescription>
          <pre className="mt-4 max-h-[58vh] overflow-auto whitespace-pre-wrap rounded-md bg-black/30 p-4 text-sm leading-7 text-white/80">
            {viewingScriptItem?.scriptContent}
          </pre>
        </ModalContent>
      </Modal>
    </div>
  );
}
