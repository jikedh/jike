import { createChatCompletion } from "@/api/ai";
import { localStorageService } from "service/localStorageService";

const STORYBOARD_ROOT = "storyboard";
const STORYBOARD_INDEX_PATH = `${STORYBOARD_ROOT}/index.json`;
const STORYBOARD_VERSION = 1;
const DEFAULT_PROMPT_PREFIX = "";
const DEFAULT_PROMPT_SUFFIX = "";
export const DEFAULT_ASSET_SYSTEM_PROMPT =
  [
    "你是专业的剧本内容解析分析师，负责接收单集完整剧本正文，严格识别、梳理并归类剧本内所有可用于视觉生产的核心资产。",
    "必须遵守：1. 绝对客观，只提取剧本原文中明确出现、实际出镜、被提及使用的内容，不脑补、不虚构、不添加剧情评价或推测；2. 完整全覆盖，通读完整剧本，不遗漏短暂出场配角、路人、一次性道具、临时场景、小众或短暂出现元素；3. 精准分类，严格区分角色、场景、道具，不交叉、不混淆，同一元素重复出现只统计一次；4. 细节标注，关键元素要补充简要说明，明确属性、出场形式、使用场景，便于后续生成图片或视频参考。",
    "角色识别范围：主角、配角、常驻人物、临时路人、群演、旁白、配音角色、动物或虚拟形象等只要有专属台词、动作或实际出镜都要识别。prompt 中说明其核心/次要/临时属性、身份、外观线索、戏份特点。",
    "场景识别范围：所有剧情发生地点和环境，包括固定实景、临时户外、室内空间、虚拟场景、过渡场景，以及剧本中标注的所有场景切换。prompt 中说明室内/室外/虚拟属性和该场景的核心剧情功能。",
    "道具识别范围：所有具象实物，包括人物穿戴物、手持物、场景陈设、饮食、交通工具、电子设备、武器、生活用品、装饰摆件、一次性使用道具等。排除抽象概念、情绪、剧情设定、天气、声音特效等非实物内容。",
    "禁止删减任何原文出现的有效元素；禁止主观修改名称，尽量沿用剧本原文叫法；禁止合并关键元素导致信息丢失；禁止输出多余话术、铺垫、总结、Markdown。",
    "只输出 JSON 对象，结构必须是：{ \"assets\": { \"role\": [{ \"name\": \"角色名\", \"prompt\": \"角色定位、外观/身份/戏份说明\" }], \"scene\": [{ \"name\": \"场景名\", \"prompt\": \"室内/室外/虚拟属性与核心剧情简述\" }], \"prop\": [{ \"name\": \"道具名\", \"prompt\": \"道具类别、外观用途、出现/使用场景\" }] } }。",
  ].join("\n");
export const DEFAULT_SPLIT_SYSTEM_PROMPT =
  [
    "你是专业的影视分镜拆解师，负责接收完整单集剧本，基于影视拍摄标准逐段、逐场景拆分为标准影视分镜镜头。",
    "必须严格依据剧本原文拆解，全程客观，不脑补、不杜撰剧本中未出现的人物、动作、画面、场景、道具与剧情，不修改原有剧情逻辑。",
    "核心规则：1. 逐镜拆解、无遗漏，按剧情推进顺序连续拆分，每一处人物动作、台词、场景变化、画面切换、转场、细节互动都要对应镜头，不跳镜、不合并关键剧情镜头；2. 完全贴合原文，人物动作、表情、道具、场景、互动行为都必须来自剧本；3. 符合影视镜头逻辑，合理使用远景、全景、中景、近景、特写、大特写等景别，以及固定、推、拉、摇、移、跟、升降、环绕、闪切、叠化、淡入淡出等运镜；4. 画面描述具象可视化，适合分镜绘制、动画制作、实拍参考。",
    "每个镜头都要在 prompt 中体现七类信息：镜号、景别、运镜、时长、画面内容、台词/音效、画面备注。镜号从 001 开始顺序递增；时长常规 1-5 秒，长对话或重点剧情可适当延长；无台词/音效或无备注时写“无”。",
    "画面内容必须详细描述场景环境、出镜角色、人物动作、神态表情、肢体细节、道具使用、画面构图、环境状态，描述要细致直观，不使用抽象、模糊、无法可视化的表达。",
    "对话场景要按说话人切换、表情变化、动作互动拆分，避免大段对话单一镜头；动作场景要拆成起势、过程、收尾，并用特写突出关键动作、道具细节、人物神态；空镜/过渡场景要单独拆分并说明氛围和转场作用；情绪变化、眼神、内心戏要用近景或特写凸显。",
    "每条 shot.assets 只能引用用户提供的可用资产中的名称，不能新增未列入可用资产的角色、场景、道具名称。禁止输出音效资产。",
    "只输出 JSON 对象，不要 Markdown、表格、标题、解释或总结。结构必须是：{ \"shots\": [{ \"script\": \"该镜头对应的原文剧情/台词摘要\", \"prompt\": \"镜号001；景别：...；运镜：...；时长：...s；画面内容：...；台词/音效：...；画面备注：...\", \"assets\": { \"role\": [\"本镜头涉及的角色名\"], \"scene\": [\"本镜头涉及的场景名\"], \"prop\": [\"本镜头涉及的道具名\"] } }] }。",
  ].join("\n");

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

const applyPromptAffixes = (prompt: string, prefix: string, suffix: string) =>
  [prefix.trim(), prompt.trim(), suffix.trim()].filter(Boolean).join("，");

const assetReferenceKeys: Record<"role" | "scene" | "prop", string[]> = {
  role: ["role", "roles", "character", "characters", "角色", "人物"],
  scene: ["scene", "scenes", "场景"],
  prop: ["prop", "props", "道具"],
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
  角色?: unknown;
  人物?: unknown;
  场景?: unknown;
  道具?: unknown;
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
    for (const kind of ["role", "scene", "prop"] as const) {
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
    promptPrefix: string;
    promptSuffix: string;
    defaults: StoryboardShot["modelInfo"];
  },
) =>
  items.slice(0, input.maxShots).map((item, index) => ({
    id: createId("shot"),
    order: index + 1,
    script: item.script || "",
    assetIds: [],
    prompt: applyPromptAffixes(
      item.prompt || item.script || "",
      input.promptPrefix,
      input.promptSuffix,
    ),
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
});

export const identifyAssetsWithAgent = async (input: {
  title: string;
  scriptCategory: string;
  scriptContent: string;
  systemPrompt: string;
}): Promise<StoryboardAgentAssetResult> => {
  try {
    const response = await createChatCompletion({
      model: "deepseek-v3.2",
      stream: false,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: input.systemPrompt || DEFAULT_ASSET_SYSTEM_PROMPT,
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

    const content =
      response?.choices?.[0]?.message?.content ||
      response?.output_text ||
      response?.content ||
      "";
    const parsed = JSON.parse(parseJsonBlock(String(content))) as {
      assets?: unknown;
    };
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
      model: "deepseek-v3.2",
      stream: false,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: input.systemPrompt || DEFAULT_SPLIT_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            `剧本标题：${input.title || "未命名剧本"}`,
            input.promptPrefix ? `提示词前缀：${input.promptPrefix}` : "",
            input.promptSuffix ? `提示词后缀：${input.promptSuffix}` : "",
            input.scriptCategory ? `剧本分类：${input.scriptCategory}` : "",
            `最大分镜数：${input.maxShots}`,
            input.splitAssist ? `拆镜辅助词：${input.splitAssist}` : "",
            `可用资产：${JSON.stringify(serializeAssetsForPrompt(input.assets))}`,
            "请返回对象：{ \"shots\": [{ \"script\": \"剧情内容\", \"prompt\": \"生图/图生视频提示词\", \"assets\": { \"role\": [\"本分镜涉及的角色名\"], \"scene\": [\"本分镜涉及的场景名\"], \"prop\": [\"本分镜涉及的道具名\"] } }] }。",
            "shots 最多不超过最大分镜数。每条 shot.assets 只能引用可用资产中已有的名称。prompt 不需要自行重复提示词前缀和提示词后缀，系统会统一拼接。不要输出音效。",
            input.scriptContent,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    });

    const content =
      response?.choices?.[0]?.message?.content ||
      response?.output_text ||
      response?.content ||
      "";
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
