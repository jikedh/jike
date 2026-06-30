import { createChatCompletion } from "@/api/ai";
import { localStorageService } from "service/localStorageService";

const STORYBOARD_ROOT = "storyboard";
const STORYBOARD_INDEX_PATH = `${STORYBOARD_ROOT}/index.json`;
const STORYBOARD_VERSION = 1;
const DEFAULT_PROMPT_PREFIX = "";
const DEFAULT_PROMPT_SUFFIX = "";
export const ASSET_SYSTEM_PROMPT_OUTPUT_REQUIREMENT =
  '只输出 JSON 对象，结构必须是：{ "assets": { "role": [{ "name": "角色名", "prompt": "角色定位、外观/身份/戏份说明" }], "scene": [{ "name": "场景名", "prompt": "室内/室外/虚拟属性与核心剧情简述" }], "prop": [{ "name": "道具名", "prompt": "道具类别、外观用途、出现/使用场景" }] } }。';
export const DEFAULT_ASSET_SYSTEM_PROMPT =
  [
    "你是专业的剧本内容解析分析师，负责接收单集完整剧本正文，严格识别、梳理并归类剧本内所有可用于视觉生产的核心资产。",
    "必须遵守：1. 绝对客观，只提取剧本原文中明确出现、实际出镜、被提及使用的内容，不脑补、不虚构、不添加剧情评价或推测；2. 完整全覆盖，通读完整剧本，不遗漏短暂出场配角、路人、一次性道具、临时场景、小众或短暂出现元素；3. 精准分类，严格区分角色、场景、道具，不交叉、不混淆，同一元素重复出现只统计一次；4. 细节标注，关键元素要补充简要说明，明确属性、出场形式、使用场景，便于后续生成图片或视频参考。",
    "角色识别范围：主角、配角、常驻人物、临时路人、群演、旁白、配音角色、动物或虚拟形象等只要有专属台词、动作或实际出镜都要识别。prompt 中说明其核心/次要/临时属性、身份、外观线索、戏份特点。",
    "场景识别范围：所有剧情发生地点和环境，包括固定实景、临时户外、室内空间、虚拟场景、过渡场景，以及剧本中标注的所有场景切换。prompt 中说明室内/室外/虚拟属性和该场景的核心剧情功能。",
    "道具识别范围：所有具象实物，包括人物穿戴物、手持物、场景陈设、饮食、交通工具、电子设备、武器、生活用品、装饰摆件、一次性使用道具等。排除抽象概念、情绪、剧情设定、天气、声音特效等非实物内容。",
    "禁止删减任何原文出现的有效元素；禁止主观修改名称，尽量沿用剧本原文叫法；禁止合并关键元素导致信息丢失；禁止输出多余话术、铺垫、总结、Markdown。",
  ].join("\n");
const buildAssetSystemPrompt = (systemPrompt: string) => {
  const trimmedPrompt = systemPrompt.trim();
  if (!trimmedPrompt) {
    return `${DEFAULT_ASSET_SYSTEM_PROMPT}\n${ASSET_SYSTEM_PROMPT_OUTPUT_REQUIREMENT}`;
  }

  const outputRequirement = ASSET_SYSTEM_PROMPT_OUTPUT_REQUIREMENT.trim();
  if (trimmedPrompt.endsWith(outputRequirement)) {
    return trimmedPrompt;
  }

  return `${trimmedPrompt}\n${outputRequirement}`;
};

export const getAssetSystemPromptForDisplay = (systemPrompt: string) => {
  const trimmedPrompt = systemPrompt.trim();
  if (!trimmedPrompt) return DEFAULT_ASSET_SYSTEM_PROMPT;

  const outputRequirement = ASSET_SYSTEM_PROMPT_OUTPUT_REQUIREMENT.trim();
  if (!trimmedPrompt.endsWith(outputRequirement)) {
    return trimmedPrompt;
  }

  return trimmedPrompt.slice(0, -outputRequirement.length).trimEnd();
};
export const SPLIT_SYSTEM_PROMPT_OUTPUT_REQUIREMENT = [
  "每条 shturl.cc/T 只能引用用户提供的可用资产中的名称，不能新增未列入可用资产的角色、场景、道具名称。禁止输出音效资产。",
  "剧本分镜拆分规则：若单个分镜内容过长，可在剧本中添加空行，空行视为下一个分镜的开始，按空行分割为多个独立分镜。",
  '只输出 JSON 对象，不要 Markdown、表格、标题、解释或总结。结构必须是：{ "shots": [{ "script": "该镜头对应的原文剧情/台词摘要", "prompt": "分镜1：0–2s 景别：...，视角：...，运镜：...。画面自然语言描述：...", "assets": { "role": ["本镜头涉及的角色名"], "scene": ["本镜头涉及的场景名"], "prop": ["本镜头涉及的道具名"] } }] }。',
].join("\n");
export const DEFAULT_SPLIT_SYSTEM_PROMPT =
  [
    "你是一位爆款竖屏真人短剧导演、高级分镜师、AI视频提示词导演。",
    "你的任务是将用户提供的短剧剧本，转化为适合即梦生成的竖屏真人短剧连续分镜提示词。",
    "每条 shots 数组中的 item 是一个 10–15 秒的即梦生成段落，不是单个镜头。每个段落内部必须拆成 4–7 个分镜，15 秒段落优先 5 个分镜。",
    "每条 item.script 必须填写该段对应的原文剧本片段，不是摘要、不是概括、不是改写。script 与 prompt 必须一一对应：prompt 中所有分镜只能改编自同一个 item.script；script 里的剧情、对白、VO、OS 必须都能在同一个 item.prompt 的分镜中找到对应画面或声音。禁止 script 用上一段、prompt 用下一段，禁止跨段错位。",
    "每条 item.prompt 必须严格写成这种正文结构：第一行直接写本段参考资产关系，如“谢凌霜是@谢凌霜，顾砚臣是@顾砚臣，谢凌霜的声音是@谢凌霜音色，顾砚臣的声音是@顾砚臣音色，场景是@王府长廊夜景”；空一行后依次写“分镜1：0–3s”“分镜2：3–6s”等分镜正文。禁止在 prompt 里输出“序号1：”“序号2：”等序号标题。",
    "资产引用行规则：只引用用户提供的可用资产名称，必须直接使用真实资产名，不要写@图片1、@视频1、@音频1这类编号占位。角色视觉写“角色名是@角色资产名”；角色配音/声音资产写“角色名的声音是@音频资产名”；场景写“场景是@场景资产名”或“场景名是@场景资产名”；道具写“道具名是@道具资产名”。没有可用音频资产时不要凭空写声音资产。",
    "分镜正文必须像真人短剧拍摄分镜，重点不是解释人物设定，而是把每个镜头的景别、视角、运镜、人物位置关系、前景/中景/远景关系写清楚。",
    "每个分镜的格式必须是：分镜X：起止时间。下一行写“景别，视角，运镜。画面自然语言描述。”时间码使用 0–3s 这种短横线格式，并在同一个序号段内从 0 开始连续递增。",
    "禁止输出：变量统筹、场景设定、听觉设计、段尾衔接、分析、解释、表格、CHOS标签、“无音乐、无字幕、无画面文字”",
    "每个即梦生成段落控制在10–15秒。10–12秒段落：4–5个分镜；13–15秒段落：5–6个分镜；爆点密集段落：最多7个分镜；每个分镜建议1.5–3秒；单个分镜最长不超过4秒；每段时间码必须连续；如果输出多个15秒段落，直接空一行继续下一组分镜；新段落的分镜编号重新从分镜1开始，时间码也从0开始",
    "每个分镜开头必须按顺序写清：1.景别 2.视角 3.运镜；景别必须准确，禁止只写“过肩镜头”而不写景别，正确写法是：过肩中景、过肩近景、过肩特写",
    "大部分镜头优先使用固定镜头。只有在以下情况才使用运动镜头：情绪逼近：缓慢推近；关系疏离：缓慢拉远；动作跟随：跟随镜头；偷看窥探：轻微横移；爆点刺激：快速推近；失控争执：轻微手持晃动；禁止每个镜头都推拉摇移。如果画面以表演、对峙、反应为主，优先写固定镜头",
    "每个镜头必须让人物合理地存在于场景里，不能只写单个人物表情。必须写清楚：谁在前景、谁在中景、谁在远景、谁是焦点、谁虚焦、谁看向谁、谁背对谁、谁靠近谁、谁压迫谁、谁被谁看见、谁与谁形成对峙、偷看、亲密、压迫或疏离关系；如果画面没有明显前景/中景/远景，不必强行写，但人物之间的空间关系必须清楚",
    "需要体现空间关系时，优先使用以下写法：1.偷看关系：前景是XX虚焦的肩背，中景是XX，远景是XX；2.对峙关系：前景是XX，中景是XX，远景是XX；3.压迫关系：前景是XX，中景是XX，远景是XX；4.亲密关系：前景是XX，中景是XX，远景是XX；5.权力关系：前景是XX，中景是XX，远景是XX",
    "不需要每个镜头反复解释角色穿什么。只有以下情况才写服装：角色第一次出现、剧本明确换装、服装参与画面动作，例如裙摆被风吹动、衣袖擦过血迹、披风被火光掀起；否则只写人物名字和动作，不要反复写“身穿某某衣服”",
    "原文台词规则：1.原文台词一字不改，用户剧本中的对白、VO、OS、旁白必须完整保留，禁止改写、删减、扩写、合并、重排台词，标点、称呼、语气词、错字、角色名差异，均以用户原文为准，疑似错字也不得自行修正；2.禁止新增台词，不得添加原文没有的对白，不得给家仆、侍从、路人临时加台词，可添加动作、表情、镜头调度、环境声、动作音效，但不得添加新剧情事实；3.台词拆分，长台词必须按标点拆分到多个分镜，允许拆分标点：，。！？、；：，禁止在半句话中间截断，跨分镜台词必须保持声音连续",
    "只有剧本明确标注VO、vo、V.O.、OS、内心OS、旁白、画外音形式，才按画外音处理。输出时自然写入画面：谢凌霜的VO在冷风中响起：“原文台词。”等；VO画面必须绑定人物关系，不能配无意义空镜",
    "最终分镜正文中不要写“无音乐、无字幕”。但生成时默认遵守：不添加音乐、不添加BGM、不添加字幕、不添加画面文字、不添加UI、只允许环境音、动作音效、对白、VO、OS；声音要自然写进画面",
    "只写场景内真实光源，允许：卧房暖烛光、长廊冷月光、火场火光、宝库门口天光、珠玉反光、正殿窗外冷白天光、桌案反光、屏风阴影；禁止：3D、动漫、国漫、CG、渲染、PBR、游戏质感、虚拟角色、三点布光、无来源光源、空泛画质词堆砌；这是真人短剧分镜，默认真人实拍电影感",
    "以下内容视为爆点：出轨、绿茶、疯癫、此生绝不负我、亲的火热、天大的笑话、三座奢华别庄、逆你心意、你顾砚臣又能奈我何、姐姐、容不下我、脏了这府里的空气、王妃若是还没撒够气、孤都依你、鸩酒、立刻、别闹、顾家五代单传的血脉、她的命给你、好不好；爆点词出口时，画面必须同步给反应或道具冲击；反应必须具体可拍：瞳孔骤缩、下巴僵住、指尖收紧、血滴落下、酒壶震颤、火光映眼、碎玉飞溅、手心指甲陷入肉里、呼吸突然停住、嘴角冷下来、眼睫轻颤；禁止只写“震惊”“愤怒”“痛苦”",
    "虽然最终不显示段落说明，但生成时必须保证连续：上一分镜的人物位置，下一分镜必须接得上；上一分镜的前景人物，下一分镜不能突然消失；上一分镜手中道具，下一分镜必须保持状态；上一分镜视线方向，下一分镜可以自然承接；场景切换必须明确，不要让观众误解为空间跳变；跨分镜台词和VO必须声音连续；不能用黑屏、空镜、水印、字幕凑时长",
    "必须追踪重要道具状态：廊柱、卧房门、血迹、火把、三座别庄、马鞭、玉镯、珠翠、珍珠、碎瓷片、酒壶、鸩酒、桌案；每个道具必须连续：谁持有、放在哪里、是否移动、是否损坏、是否被看见、是否成为爆点；禁止道具凭空出现、凭空消失",
    "最终执行要求：1.只输出 JSON；2.每个即梦段落控制在10–15秒；3.每段必须有4–7个分镜，15秒段落优先5–6个分镜；4.item.script 必须是该段原文剧本片段，和 item.prompt 严格对应；5.item.prompt 第一行必须是资产引用行，第二部分才写分镜正文；6.prompt 中禁止出现“序号1：”“序号2：”等序号标题；7.资产引用必须使用真实资产名，禁止@图片1、@视频1、@音频1；8.每个分镜开头必须写清景别、视角、运镜；9.大部分镜头优先使用固定镜头；10.每个镜头必须写清人物在场景里的合理位置关系；11.需要时写清前景、中景、远景；不需要时不强行写；12.不反复解释角色穿什么；13.不输出变量统筹、场景设定、听觉设计、段尾衔接；14.不在正文中写“无音乐、无字幕、无画面文字”；15.默认为真人短剧实拍质感，不出现3D、动漫、国漫、CG、渲染等词；16.保证原文台词、VO、OS一字不改；17.不新增原文没有的台词；18.保证人物、道具、动作、情绪连续；19.爆点台词必须同步切反应；20.禁止解释，禁止分析，禁止询问。"
  ].join("\n");
const buildSplitSystemPrompt = (systemPrompt: string) => {
  const trimmedPrompt = systemPrompt.trim();
  if (!trimmedPrompt) {
    return `${DEFAULT_SPLIT_SYSTEM_PROMPT}\n${SPLIT_SYSTEM_PROMPT_OUTPUT_REQUIREMENT}`;
  }

  const outputRequirement = SPLIT_SYSTEM_PROMPT_OUTPUT_REQUIREMENT.trim();
  if (trimmedPrompt.endsWith(outputRequirement)) {
    return trimmedPrompt;
  }

  return `${trimmedPrompt}\n${outputRequirement}`;
};

export const getSplitSystemPromptForDisplay = (systemPrompt: string) => {
  const trimmedPrompt = systemPrompt.trim();
  if (!trimmedPrompt) return DEFAULT_SPLIT_SYSTEM_PROMPT;

  const outputRequirement = SPLIT_SYSTEM_PROMPT_OUTPUT_REQUIREMENT.trim();
  if (!trimmedPrompt.endsWith(outputRequirement)) {
    return trimmedPrompt;
  }

  return trimmedPrompt.slice(0, -outputRequirement.length).trimEnd();
};

export type StoryboardProject = {
  id: string;
  name: string;
  description: string;
  coverLocalPath?: string;
  createdAt: number;
  updatedAt: number;
};

export type StoryboardSnippet = {
  id: string;
  projectId: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
};

export type StoryboardAssetKind = "role" | "scene" | "prop" | "audio";

export type StoryboardAgentStep =
  | "script"
  | "assets"
  | "shots"
  | "video-edit";

export type StoryboardAssetMediaItem = {
  id: string;
  source: "upload" | "ai" | "library";
  mediaType?: "image" | "video" | "audio";
  mediaUrl?: string;
  localPath?: string;
  assetId?: string;
  name?: string;
  createdAt: number;
};

export type StoryboardAssetItem = {
  id: string;
  kind: StoryboardAssetKind;
  name: string;
  prompt: string;
  source: "upload" | "ai" | "library";
  status: "idle" | "generating" | "ready" | "failed";
  mediaType?: "image" | "video" | "audio";
  mediaUrl?: string;
  localPath?: string;
  assetId?: string;
  mediaItems?: StoryboardAssetMediaItem[];
  primaryMediaId?: string;
  imageModel?: string;
  imagePlatform?: string;
  aspectRatio?: string;
  resolution?: string;
  audioAssetIds?: string[];
};

export type StoryboardShot = {
  id: string;
  order: number;
  script: string;
  assetIds: string[];
  prompt: string;
  promptDraftHtml?: string;
  modelInfo: {
    imageModel: string;
    videoModel: string;
    aspectRatio: string;
    duration: number;
    resolution?: string;
  };
  image?: {
    url?: string;
    localPath?: string;
  };
  video?: {
    url?: string;
    localPath?: string;
  };
  videoEdit?: {
    confirmedMaterial?: string;
    prompt?: string;
  };
  videoStatus: "idle" | "generating" | "ready" | "failed";
};

export type StoryboardAgentData = {
  scriptTitle: string;
  shotPromptAffixEnabled?: boolean;
  promptPrefix: string;
  promptSuffix: string;
  scriptCategory: string;
  stylePreset?: string;
  customStyle?: string;
  maxShots: number;
  splitAssist: string;
  scriptContent: string;
  assetSystemPrompt: string;
  splitSystemPrompt: string;
  roleAssetPromptAffixEnabled: boolean;
  roleAssetPromptPrefix: string;
  roleAssetPromptSuffix: string;
  unlockedStep: StoryboardAgentStep;
  assets: Record<StoryboardAssetKind, StoryboardAssetItem[]>;
  shots: StoryboardShot[];
  updatedAt: number;
};

export type StoryboardAgentSplitResult = {
  shots: StoryboardShot[];
  assets: Record<StoryboardAssetKind, StoryboardAssetItem[]>;
  shotAssetNames: string[][];
};

export type StoryboardAgentAssetResult = {
  assets: Record<StoryboardAssetKind, StoryboardAssetItem[]>;
};

export type StoryboardAssets = Record<StoryboardAssetKind, StoryboardAssetItem[]>;

type StoryboardIndex = {
  version: number;
  projects: StoryboardProject[];
};

const emptyAssets = (): StoryboardAssets => ({
  role: [],
  scene: [],
  prop: [],
  audio: [],
});

export const createEmptyAgentData = (): StoryboardAgentData => ({
  scriptTitle: "",
  shotPromptAffixEnabled: false,
  promptPrefix: DEFAULT_PROMPT_PREFIX,
  promptSuffix: DEFAULT_PROMPT_SUFFIX,
  scriptCategory: "解说漫",
  maxShots: 20,
  splitAssist: "",
  scriptContent: "",
  assetSystemPrompt: DEFAULT_ASSET_SYSTEM_PROMPT,
  splitSystemPrompt: DEFAULT_SPLIT_SYSTEM_PROMPT,
  roleAssetPromptAffixEnabled: false,
  roleAssetPromptPrefix: "",
  roleAssetPromptSuffix: "",
  unlockedStep: "script",
  assets: emptyAssets(),
  shots: [],
  updatedAt: Date.now(),
});

const createId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8");

const normalizeBuffer = (data: unknown): ArrayBuffer | null => {
  if (!data) return null;
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView;
    const copy = new Uint8Array(view.byteLength);
    copy.set(
      new Uint8Array(
        view.buffer as ArrayBuffer,
        view.byteOffset,
        view.byteLength,
      ),
    );
    return copy.buffer;
  }
  if (Array.isArray(data)) {
    return new Uint8Array(data).buffer;
  }
  return null;
};

const getStoragePathOrThrow = () => {
  const basePath = localStorageService.getStoragePath();
  if (!basePath) {
    throw new Error("项目存储路径未配置");
  }
  if (!window.storage) {
    throw new Error("Storage API not available");
  }
  return basePath;
};

const writeStorageFile = async (relativePath: string, buffer: ArrayBuffer) => {
  const basePath = getStoragePathOrThrow();
  const storage = window.storage as typeof window.storage & {
    writeRawFile?: typeof window.storage.writeRawFile;
  };

  if (typeof storage.writeRawFile === "function") {
    try {
      const result = await storage.writeRawFile(basePath, relativePath, buffer);
      if (result.success) return result;
      console.warn(
        "[storyboard] writeRawFile failed, fallback to saveMedia",
        result.error,
      );
    } catch (error) {
      console.warn(
        "[storyboard] writeRawFile unavailable, fallback to saveMedia",
        error,
      );
    }
  }

  return window.storage.saveMedia(basePath, relativePath, buffer);
};

const readStorageFile = async (relativePath: string) => {
  const basePath = getStoragePathOrThrow();
  const storage = window.storage as typeof window.storage & {
    readRawFile?: typeof window.storage.readRawFile;
  };

  if (typeof storage.readRawFile === "function") {
    try {
      const result = await storage.readRawFile(basePath, relativePath);
      if (result.success) return result;
      console.warn(
        "[storyboard] readRawFile failed, fallback to readMedia",
        result.error,
      );
    } catch (error) {
      console.warn(
        "[storyboard] readRawFile unavailable, fallback to readMedia",
        error,
      );
    }
  }

  return window.storage.readMedia(basePath, relativePath);
};

const deleteStoragePath = async (relativePath: string) => {
  const basePath = getStoragePathOrThrow();
  const storage = window.storage as typeof window.storage & {
    deleteRawPath?: NonNullable<typeof window.storage.deleteRawPath>;
  };

  if (typeof storage.deleteRawPath === "function") {
    const result = await storage.deleteRawPath(basePath, relativePath);
    if (!result.success) {
      console.warn("[storyboard] deleteRawPath failed", result.error);
    }
  }
};

const readJson = async <T>(relativePath: string): Promise<T | null> => {
  const result = await readStorageFile(relativePath);
  if (!result.success || !result.data) return null;

  const buffer = normalizeBuffer(result.data);
  if (!buffer) return null;

  return JSON.parse(textDecoder.decode(buffer)) as T;
};

const writeJson = async (relativePath: string, data: unknown) => {
  const bytes = textEncoder.encode(JSON.stringify(data, null, 2));
  const buffer = bytes.slice().buffer as ArrayBuffer;
  const result = await writeStorageFile(relativePath, buffer);
  if (!result.success) {
    throw new Error(result.error || "保存故事创作数据失败");
  }
};

const readIndex = async (): Promise<StoryboardIndex> => {
  try {
    const index = await readJson<StoryboardIndex>(STORYBOARD_INDEX_PATH);
    if (index?.version === STORYBOARD_VERSION && Array.isArray(index.projects)) {
      return index;
    }
  } catch {
    // Missing index is a normal first-run state.
  }

  return { version: STORYBOARD_VERSION, projects: [] };
};

const writeIndex = (index: StoryboardIndex) =>
  writeJson(STORYBOARD_INDEX_PATH, index);

const projectPath = (projectId: string, fileName: string) =>
  `${STORYBOARD_ROOT}/projects/${projectId}/${fileName}`;

const snippetPath = (projectId: string, snippetId: string, fileName: string) =>
  `${STORYBOARD_ROOT}/projects/${projectId}/snippets/${snippetId}/${fileName}`;

const normalizeAssetNameKey = (asset: StoryboardAssetItem) =>
  `${asset.kind}:${asset.name.trim().toLowerCase() || asset.id}`;

const normalizeAssets = (assets?: Partial<StoryboardAssets>): StoryboardAssets => ({
  role: [...(assets?.role || [])],
  scene: [...(assets?.scene || [])],
  prop: [...(assets?.prop || [])],
  audio: [...(assets?.audio || [])],
});

const createLegacyMediaItem = (
  asset: StoryboardAssetItem,
): StoryboardAssetMediaItem | null => {
  if (!asset.mediaUrl && !asset.localPath && !asset.assetId) return null;
  return {
    id: asset.primaryMediaId || `legacy_media_${asset.id}`,
    source: asset.source,
    mediaType: asset.mediaType,
    mediaUrl: asset.mediaUrl,
    localPath: asset.localPath,
    assetId: asset.assetId,
    name: asset.name,
    createdAt: Date.now(),
  };
};

const mergeMediaItems = (
  current: StoryboardAssetItem,
  incoming: StoryboardAssetItem,
) => {
  const items = [...(current.mediaItems || [])];
  const currentLegacyItem = createLegacyMediaItem(current);
  const incomingLegacyItem = createLegacyMediaItem(incoming);

  if (currentLegacyItem && !items.some((item) => item.id === currentLegacyItem.id)) {
    items.unshift(currentLegacyItem);
  }

  for (const item of [
    ...(incoming.mediaItems || []),
    ...(incomingLegacyItem ? [incomingLegacyItem] : []),
  ]) {
    const exists = items.some((currentItem) => {
      if (item.assetId && currentItem.assetId === item.assetId) return true;
      if (item.mediaUrl && currentItem.mediaUrl === item.mediaUrl) return true;
      if (item.localPath && currentItem.localPath === item.localPath) return true;
      return currentItem.id === item.id;
    });
    if (!exists) items.push(item);
  }
  return items;
};

const mergeAssetItem = (
  current: StoryboardAssetItem,
  incoming: StoryboardAssetItem,
): StoryboardAssetItem => {
  const mediaItems = mergeMediaItems(current, incoming);
  return {
    ...current,
    prompt: current.prompt || incoming.prompt,
    source: current.source || incoming.source,
    status: current.status === "idle" ? incoming.status : current.status,
    mediaType: current.mediaType || incoming.mediaType,
    mediaUrl: current.mediaUrl || incoming.mediaUrl,
    localPath: current.localPath || incoming.localPath,
    assetId: current.assetId || incoming.assetId,
    mediaItems: mediaItems.length > 0 ? mediaItems : current.mediaItems,
    primaryMediaId: current.primaryMediaId || incoming.primaryMediaId,
    imageModel: current.imageModel || incoming.imageModel,
    imagePlatform: current.imagePlatform || incoming.imagePlatform,
    aspectRatio: current.aspectRatio || incoming.aspectRatio,
    resolution: current.resolution || incoming.resolution,
    audioAssetIds: Array.from(
      new Set([
        ...(current.audioAssetIds || []),
        ...(incoming.audioAssetIds || []),
      ]),
    ),
  };
};

const mergeAssets = (
  currentAssets: StoryboardAssets,
  incomingAssets?: Partial<StoryboardAssets>,
) => {
  const nextAssets = normalizeAssets(currentAssets);
  const idMap = new Map<string, string>();

  for (const kind of ["role", "scene", "prop", "audio"] as const) {
    const existingIndexByName = new Map<string, number>();
    nextAssets[kind].forEach((asset, index) => {
      existingIndexByName.set(normalizeAssetNameKey(asset), index);
      idMap.set(asset.id, asset.id);
    });

    for (const asset of incomingAssets?.[kind] || []) {
      const key = normalizeAssetNameKey(asset);
      const existingIndex = existingIndexByName.get(key);
      if (existingIndex === undefined) {
        nextAssets[kind].push(asset);
        existingIndexByName.set(key, nextAssets[kind].length - 1);
        idMap.set(asset.id, asset.id);
        continue;
      }

      const existing = nextAssets[kind][existingIndex];
      nextAssets[kind][existingIndex] = mergeAssetItem(existing, asset);
      idMap.set(asset.id, existing.id);
    }
  }

  return { assets: nextAssets, idMap };
};

const remapAssetIds = (ids: string[] | undefined, idMap: Map<string, string>) =>
  Array.from(new Set((ids || []).map((id) => idMap.get(id) || id)));

const remapAgentAssetReferences = (
  agent: StoryboardAgentData,
  sharedAssets: StoryboardAssets,
  idMap: Map<string, string>,
): StoryboardAgentData => ({
  ...agent,
  assets: sharedAssets,
  shots: (agent.shots || []).map((shot) => ({
    ...shot,
    assetIds: remapAssetIds(shot.assetIds, idMap),
  })),
});

const remapSharedAssetReferences = (
  assets: StoryboardAssets,
  idMap: Map<string, string>,
): StoryboardAssets => ({
  ...assets,
  role: assets.role.map((asset) => ({
    ...asset,
    audioAssetIds: remapAssetIds(asset.audioAssetIds, idMap),
  })),
  scene: assets.scene.map((asset) => ({
    ...asset,
    audioAssetIds: remapAssetIds(asset.audioAssetIds, idMap),
  })),
  prop: assets.prop.map((asset) => ({
    ...asset,
    audioAssetIds: remapAssetIds(asset.audioAssetIds, idMap),
  })),
});

const isLegacySnippetAssetPath = (projectId: string, localPath?: string) =>
  Boolean(
    localPath?.startsWith(`${STORYBOARD_ROOT}/projects/${projectId}/snippets/`) &&
    localPath.includes("/assets/"),
  );

const getPathExtension = (path: string, fallback: string) =>
  path.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase() || fallback;

const getAssetFileFallbackExtension = (
  mediaType?: StoryboardAssetItem["mediaType"],
) => {
  if (mediaType === "video") return "mp4";
  if (mediaType === "audio") return "mp3";
  return "png";
};

const migrateProjectAssetLocalPaths = async (
  projectId: string,
  assets: StoryboardAssets,
): Promise<{ assets: StoryboardAssets; changed: boolean }> => {
  let changed = false;
  const copiedPathMap = new Map<string, string>();

  const copyLegacyPath = async (
    localPath: string | undefined,
    kind: StoryboardAssetKind,
    id: string,
    mediaType?: StoryboardAssetItem["mediaType"],
  ) => {
    if (!isLegacySnippetAssetPath(projectId, localPath) || !localPath) {
      return localPath;
    }

    const cachedPath = copiedPathMap.get(localPath);
    if (cachedPath) return cachedPath;

    const readResult = await readStorageFile(localPath);
    const buffer = readResult.success ? normalizeBuffer(readResult.data) : null;
    if (!buffer) {
      console.warn("[storyboard] legacy asset file missing", localPath);
      return localPath;
    }

    const extension = getPathExtension(
      localPath,
      getAssetFileFallbackExtension(mediaType),
    );
    const nextPath = `${STORYBOARD_ROOT}/projects/${projectId}/assets/${kind}/${id}.${extension}`;
    const writeResult = await writeStorageFile(nextPath, buffer);
    if (!writeResult.success) {
      console.warn(
        "[storyboard] migrate legacy asset file failed",
        localPath,
        writeResult.error,
      );
      return localPath;
    }

    const migratedPath = writeResult.path || nextPath;
    copiedPathMap.set(localPath, migratedPath);
    changed = true;
    return migratedPath;
  };

  const nextAssets = normalizeAssets();
  for (const kind of ["role", "scene", "prop", "audio"] as const) {
    nextAssets[kind] = await Promise.all(
      assets[kind].map(async (asset) => {
        const mediaItems = asset.mediaItems
          ? await Promise.all(
            asset.mediaItems.map(async (item) => ({
              ...item,
              localPath: await copyLegacyPath(
                item.localPath,
                kind,
                item.id,
                item.mediaType,
              ),
            })),
          )
          : asset.mediaItems;

        const localPath = await copyLegacyPath(
          asset.localPath,
          kind,
          asset.primaryMediaId || asset.id,
          asset.mediaType,
        );

        return {
          ...asset,
          localPath,
          mediaItems,
        };
      }),
    );
  }

  return { assets: nextAssets, changed };
};

export const storyboardStorage = {
  hasStoragePath: () => Boolean(localStorageService.getStoragePath()),

  async listProjects(): Promise<StoryboardProject[]> {
    const index = await readIndex();
    return [...index.projects].sort(
      (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
    );
  },

  async getProject(projectId: string): Promise<StoryboardProject | null> {
    const fromFile = await readJson<StoryboardProject>(
      projectPath(projectId, "project.json"),
    );
    if (fromFile) return fromFile;

    const index = await readIndex();
    return index.projects.find((project) => project.id === projectId) || null;
  },

  async createProject(input: {
    name: string;
    description?: string;
    coverFile?: File | null;
  }): Promise<StoryboardProject> {
    const now = Date.now();
    const project: StoryboardProject = {
      id: createId("story_project"),
      name: input.name.trim(),
      description: input.description?.trim() || "",
      createdAt: now,
      updatedAt: now,
    };

    if (input.coverFile) {
      const extension = input.coverFile.name.split(".").pop() || "png";
      const coverPath = projectPath(project.id, `cover/cover.${extension}`);
      await this.saveBinary(coverPath, await input.coverFile.arrayBuffer());
      project.coverLocalPath = coverPath;
    }

    await writeJson(projectPath(project.id, "project.json"), project);
    await writeJson(projectPath(project.id, "assets.json"), emptyAssets());

    const index = await readIndex();
    index.projects = [project, ...index.projects];
    await writeIndex(index);

    return project;
  },

  async updateProject(project: StoryboardProject): Promise<void> {
    const next = { ...project, updatedAt: Date.now() };
    await writeJson(projectPath(next.id, "project.json"), next);

    const index = await readIndex();
    index.projects = index.projects.map((item) =>
      item.id === next.id ? next : item,
    );
    await writeIndex(index);
  },

  async removeProject(projectId: string): Promise<void> {
    const index = await readIndex();
    index.projects = index.projects.filter((project) => project.id !== projectId);
    await writeIndex(index);
    await deleteStoragePath(`${STORYBOARD_ROOT}/projects/${projectId}`);
  },

  async listSnippets(projectId: string): Promise<StoryboardSnippet[]> {
    const snippets =
      (await readJson<StoryboardSnippet[]>(
        projectPath(projectId, "snippets.json"),
      )) || [];
    return snippets.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },

  async getSnippet(
    projectId: string,
    snippetId: string,
  ): Promise<StoryboardSnippet | null> {
    return readJson<StoryboardSnippet>(
      snippetPath(projectId, snippetId, "snippet.json"),
    );
  },

  async createSnippet(input: {
    projectId: string;
    name: string;
    description?: string;
  }): Promise<StoryboardSnippet> {
    const now = Date.now();
    const snippet: StoryboardSnippet = {
      id: createId("story_snippet"),
      projectId: input.projectId,
      name: input.name.trim(),
      description: input.description?.trim() || "",
      createdAt: now,
      updatedAt: now,
    };

    await writeJson(
      snippetPath(input.projectId, snippet.id, "snippet.json"),
      snippet,
    );
    await writeJson(
      snippetPath(input.projectId, snippet.id, "agent.json"),
      createEmptyAgentData(),
    );

    const snippets = await this.listSnippets(input.projectId);
    await writeJson(projectPath(input.projectId, "snippets.json"), [
      snippet,
      ...snippets,
    ]);

    const project = await this.getProject(input.projectId);
    if (project) {
      await this.updateProject(project);
    }

    return snippet;
  },

  async updateSnippet(snippet: StoryboardSnippet): Promise<void> {
    const next = { ...snippet, updatedAt: Date.now() };
    await writeJson(
      snippetPath(next.projectId, next.id, "snippet.json"),
      next,
    );

    const snippets = await this.listSnippets(next.projectId);
    await writeJson(
      projectPath(next.projectId, "snippets.json"),
      snippets.map((item) => (item.id === next.id ? next : item)),
    );
  },

  async removeSnippet(projectId: string, snippetId: string): Promise<void> {
    const snippets = await this.listSnippets(projectId);
    await writeJson(
      projectPath(projectId, "snippets.json"),
      snippets.filter((snippet) => snippet.id !== snippetId),
    );
    await deleteStoragePath(
      `${STORYBOARD_ROOT}/projects/${projectId}/snippets/${snippetId}`,
    );

    const project = await this.getProject(projectId);
    if (project) {
      await this.updateProject(project);
    }
  },

  async loadProjectAssets(projectId: string): Promise<StoryboardAssets> {
    const assets = await readJson<Partial<StoryboardAssets>>(
      projectPath(projectId, "assets.json"),
    );
    return normalizeAssets(assets || emptyAssets());
  },

  async saveProjectAssets(
    projectId: string,
    assets: StoryboardAssets,
  ): Promise<void> {
    const migrated = await migrateProjectAssetLocalPaths(
      projectId,
      normalizeAssets(assets),
    );
    await writeJson(projectPath(projectId, "assets.json"), migrated.assets);
  },

  async ensureProjectAssets(projectId: string): Promise<StoryboardAssets> {
    const existing = await readJson<Partial<StoryboardAssets>>(
      projectPath(projectId, "assets.json"),
    );
    if (existing) {
      const migrated = await migrateProjectAssetLocalPaths(
        projectId,
        normalizeAssets(existing),
      );
      if (migrated.changed) {
        await writeJson(projectPath(projectId, "assets.json"), migrated.assets);
      }
      return migrated.assets;
    }

    const snippets = await this.listSnippets(projectId);
    const loadedAgents: Array<{
      snippetId: string;
      agent: StoryboardAgentData;
    }> = [];
    let sharedAssets = emptyAssets();
    const globalIdMap = new Map<string, string>();

    for (const snippet of snippets) {
      const agent = await this.loadAgentData(projectId, snippet.id);
      loadedAgents.push({ snippetId: snippet.id, agent });
      const merged = mergeAssets(sharedAssets, agent.assets);
      sharedAssets = merged.assets;
      for (const [fromId, toId] of merged.idMap) {
        globalIdMap.set(fromId, toId);
      }
    }

    sharedAssets = remapSharedAssetReferences(sharedAssets, globalIdMap);
    const migrated = await migrateProjectAssetLocalPaths(projectId, sharedAssets);
    sharedAssets = migrated.assets;
    await this.saveProjectAssets(projectId, sharedAssets);

    for (const { snippetId, agent } of loadedAgents) {
      await this.saveAgentData(
        projectId,
        snippetId,
        remapAgentAssetReferences(agent, sharedAssets, globalIdMap),
      );
    }

    return sharedAssets;
  },

  async loadAgentData(
    projectId: string,
    snippetId: string,
  ): Promise<StoryboardAgentData> {
    return (
      (await readJson<StoryboardAgentData>(
        snippetPath(projectId, snippetId, "agent.json"),
      )) || createEmptyAgentData()
    );
  },

  async saveAgentData(
    projectId: string,
    snippetId: string,
    data: StoryboardAgentData,
  ): Promise<void> {
    await writeJson(snippetPath(projectId, snippetId, "agent.json"), {
      ...data,
      updatedAt: Date.now(),
    });
  },

  async saveBinary(relativePath: string, buffer: ArrayBuffer): Promise<string> {
    const result = await writeStorageFile(relativePath, buffer);
    if (!result.success) {
      throw new Error(result.error || "保存文件失败");
    }
    return result.path || relativePath;
  },

  async readBinary(relativePath?: string): Promise<ArrayBuffer | null> {
    if (!relativePath) return null;
    const result = await readStorageFile(relativePath);
    if (!result.success || !result.data) return null;
    return normalizeBuffer(result.data);
  },

  async readObjectUrl(relativePath?: string): Promise<string | null> {
    if (!relativePath) return null;
    const buffer = await this.readBinary(relativePath);
    if (!buffer) return null;

    const extension = relativePath.split(".").pop()?.toLowerCase();
    const mime =
      extension === "jpg" || extension === "jpeg"
        ? "image/jpeg"
        : extension === "webp"
          ? "image/webp"
          : extension === "gif"
            ? "image/gif"
            : extension === "mp3"
              ? "audio/mpeg"
              : extension === "wav"
                ? "audio/wav"
                : extension === "mp4"
                  ? "video/mp4"
                  : "image/png";
    return URL.createObjectURL(new Blob([buffer], { type: mime }));
  },
};

const parseJsonBlock = (value: string) => {
  const trimmed = value.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced?.[1]?.trim() || trimmed;
};

const extractChatCompletionContent = (response: any) => {
  const payload = response?.data ?? response;
  const nestedPayload = payload?.data ?? {};
  return (
    nestedPayload?.choices?.[0]?.message?.content ||
    nestedPayload?.output_text ||
    nestedPayload?.content ||
    payload?.choices?.[0]?.message?.content ||
    payload?.output_text ||
    payload?.content ||
    response?.choices?.[0]?.message?.content ||
    response?.output_text ||
    response?.content ||
    ""
  );
};

const assetReferenceKeys: Record<StoryboardAssetKind, string[]> = {
  role: ["role", "roles", "character", "characters", "角色", "人物"],
  scene: ["scene", "scenes", "场景"],
  prop: ["prop", "props", "道具"],
  audio: ["audio", "audios", "voice", "voices", "音频", "声音", "音色"],
};

const createIdentifiedAsset = (
  kind: StoryboardAssetKind,
  value: unknown,
): StoryboardAssetItem | null => {
  const source =
    typeof value === "string" ? { name: value, prompt: value } : value;
  if (!source || typeof source !== "object") return null;

  const record = source as {
    name?: unknown;
    prompt?: unknown;
    description?: unknown;
  };
  const name = String(record.name || "").trim();
  const prompt = String(record.prompt || record.description || name).trim();
  if (!name) return null;

  return {
    id: createId(`asset_${kind}`),
    kind,
    name,
    prompt,
    source: "ai",
    status: "idle",
  };
};

const normalizeIdentifiedAssets = (
  value: unknown,
): Record<StoryboardAssetKind, StoryboardAssetItem[]> => {
  const source = value && typeof value === "object" ? value : {};
  const record = source as Record<string, unknown>;
  const result = emptyAssets();

  for (const kind of ["role", "scene", "prop"] as const) {
    const list =
      assetReferenceKeys[kind]
        .map((key) => record[key])
        .find((item): item is unknown[] => Array.isArray(item)) || [];
    const seen = new Set<string>();
    result[kind] = list
      .map((item) => createIdentifiedAsset(kind, item))
      .filter((item): item is StoryboardAssetItem => Boolean(item))
      .filter((item) => {
        const key = item.name.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  return result;
};

type RawSplitShotItem = {
  script?: string;
  prompt?: string;
  assets?: unknown;
  assetRefs?: unknown;
  assetNames?: unknown;
  role?: unknown;
  roles?: unknown;
  scene?: unknown;
  scenes?: unknown;
  prop?: unknown;
  props?: unknown;
  audio?: unknown;
  audios?: unknown;
  voice?: unknown;
  voices?: unknown;
  角色?: unknown;
  人物?: unknown;
  场景?: unknown;
  道具?: unknown;
  音频?: unknown;
  声音?: unknown;
  音色?: unknown;
};

const normalizeAssetNameList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const record = item as { name?: unknown };
        return String(record.name || "").trim();
      }
      return "";
    })
    .filter(Boolean);
};

const extractShotAssetNames = (item: RawSplitShotItem): string[] => {
  const sources = [
    item.assets,
    item.assetRefs,
    item.assetNames,
    item,
  ].filter((source) => source && typeof source === "object") as Array<
    Record<string, unknown>
  >;
  const names: string[] = [];

  for (const source of sources) {
    for (const kind of ["role", "scene", "prop", "audio"] as const) {
      const value = assetReferenceKeys[kind]
        .map((key) => source[key])
        .find((candidate) => Array.isArray(candidate));
      names.push(...normalizeAssetNameList(value));
    }
  }

  return Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));
};

const createShotsFromItems = (
  items: RawSplitShotItem[],
  input: {
    maxShots: number;
    defaults: StoryboardShot["modelInfo"];
  },
) =>
  items.slice(0, input.maxShots).map((item, index) => ({
    id: createId("shot"),
    order: index + 1,
    script: item.script || "",
    assetIds: [],
    prompt: String(item.prompt || item.script || "").trim(),
    modelInfo: input.defaults,
    videoStatus: "idle" as const,
  }));

const createShotAssetNamesFromItems = (
  items: RawSplitShotItem[],
  maxShots: number,
) => items.slice(0, maxShots).map(extractShotAssetNames);

const serializeAssetsForPrompt = (
  assets: Record<StoryboardAssetKind, StoryboardAssetItem[]>,
) => ({
  role: assets.role.map((asset) => ({
    name: asset.name,
    prompt: asset.prompt,
  })),
  scene: assets.scene.map((asset) => ({
    name: asset.name,
    prompt: asset.prompt,
  })),
  prop: assets.prop.map((asset) => ({
    name: asset.name,
    prompt: asset.prompt,
  })),
  audio: assets.audio.map((asset) => ({
    name: asset.name,
    prompt: asset.prompt,
  })),
});

export const identifyAssetsWithAgent = async (input: {
  title: string;
  scriptCategory: string;
  scriptContent: string;
  systemPrompt: string;
}): Promise<StoryboardAgentAssetResult> => {
  try {
    const response = await createChatCompletion({
      model: "deepseek-v4-flash",
      stream: false,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: buildAssetSystemPrompt(
            input.systemPrompt || DEFAULT_ASSET_SYSTEM_PROMPT,
          ),
        },
        {
          role: "user",
          content: [
            `剧本标题：${input.title || "未命名剧本"}`,
            input.scriptCategory ? `剧本分类：${input.scriptCategory}` : "",
            "请从剧本中识别全局资产，只返回对象：{ \"assets\": { \"role\": [{ \"name\": \"角色名\", \"prompt\": \"外观与性格描述\" }], \"scene\": [{ \"name\": \"场景名\", \"prompt\": \"环境描述\" }], \"prop\": [{ \"name\": \"道具名\", \"prompt\": \"外观用途描述\" }] } }。",
            "assets 只识别角色、场景、道具，不要输出音效。相同资产只输出一次，name 要短且稳定，prompt 用于后续图片生成。",
            input.scriptContent,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    });
    const rawContent = extractChatCompletionContent(response);
    const content = rawContent?.trim() || "";
    if (!content) {
      throw new Error("AI 返回内容为空，请检查网络或 API 配置");
    }
    let parsed: any;
    try {
      parsed = JSON.parse(parseJsonBlock(content));
    } catch (parseError) {
      const errMsg = parseError instanceof Error ? parseError.message : String(parseError);
      throw new Error(`JSON 解析失败: ${errMsg}，原始内容: ${content.slice(0, 200)}`);
    }
    const assets = normalizeIdentifiedAssets(parsed.assets ?? parsed);
    const assetCount = assets.role.length + assets.scene.length + assets.prop.length;
    if (assetCount === 0) {
      throw new Error("AI 未返回可用资产识别结果");
    }
    return { assets };
  } catch (error) {
    console.warn("[storyboard] AI asset identification failed", error);
    throw error instanceof Error ? error : new Error("AI 资产识别失败");
  }
};

export const splitScriptWithAgent = async (input: {
  title: string;
  promptPrefix: string;
  promptSuffix: string;
  scriptCategory: string;
  maxShots: number;
  splitAssist: string;
  scriptContent: string;
  systemPrompt: string;
  assets: Record<StoryboardAssetKind, StoryboardAssetItem[]>;
  defaults: StoryboardShot["modelInfo"];
}): Promise<StoryboardAgentSplitResult> => {
  try {
    const response = await createChatCompletion({
      model: "deepseek-v4-flash",
      stream: false,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: buildSplitSystemPrompt(
            input.systemPrompt || DEFAULT_SPLIT_SYSTEM_PROMPT,
          ),
        },
        {
          role: "user",
          content: [
            `剧本标题：${input.title || "未命名剧本"}`,
            input.scriptCategory ? `剧本分类：${input.scriptCategory}` : "",
            `最大分镜数：${input.maxShots}`,
            input.splitAssist ? `拆镜辅助词：${input.splitAssist}` : "",
            `可用资产：${JSON.stringify(serializeAssetsForPrompt(input.assets))}`,
            "请返回对象：{ \"shots\": [{ \"script\": \"该段对应的原文剧本文字，按原文顺序保留对白、VO、OS和关键动作，不要摘要\", \"prompt\": \"角色A是@角色A资产，角色A的声音是@角色A音色，场景是@场景资产\\n\\n分镜1：0–3s\\n\\n中景，正面平视，固定镜头。画面自然语言描述。\", \"assets\": { \"role\": [\"本段涉及的角色名\"], \"scene\": [\"本段涉及的场景名\"], \"prop\": [\"本段涉及的道具名\"], \"audio\": [\"本段涉及的音频资产名，可为空数组\"] } }] }。",
            "必须先按剧本顺序切段，再为每段生成对应 prompt。每个 shot.script 和 shot.prompt 必须是一一对应关系，不能错位、不能跨段混用、不能只写摘要。",
            "shots 最多不超过最大分镜数。每条 shot.assets 只能引用可用资产中已有的名称。prompt 不需要自行重复提示词前缀和提示词后缀，系统只会在点击生成视频时临时拼接。prompt 第一行直接用真实资产名做 @ 引用，禁止写序号标题，禁止写@图片1、@视频1、@音频1。只有可用资产里存在音频时，才允许在 assets.audio 和 prompt 资产引用行里写音频；不要新增未提供的音效或声音资产。",
            input.scriptContent,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    });

    const content = extractChatCompletionContent(response);
    if (!String(content).trim()) {
      throw new Error("AI 返回内容为空，请检查网络或 API 配置");
    }
    const parsed = JSON.parse(parseJsonBlock(String(content))) as
      | RawSplitShotItem[]
      | {
        shots?: RawSplitShotItem[];
        assets?: unknown;
      };
    const items = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.shots)
        ? parsed.shots
        : [];
    if (items.length > 0) {
      return {
        shots: createShotsFromItems(items, input),
        assets: emptyAssets(),
        shotAssetNames: createShotAssetNamesFromItems(items, input.maxShots),
      };
    }
    throw new Error("AI 未返回可用分镜结果");
  } catch (error) {
    console.warn("[storyboard] AI split failed", error);
    throw error instanceof Error ? error : new Error("AI 拆分分镜失败");
  }
};
