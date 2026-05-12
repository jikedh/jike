import { createChatCompletion } from "@/api/ai";
import { localStorageService } from "service/localStorageService";

const STORYBOARD_ROOT = "storyboard";
const STORYBOARD_INDEX_PATH = `${STORYBOARD_ROOT}/index.json`;
const STORYBOARD_VERSION = 1;

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
  count: number;
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

export type StoryboardAssetItem = {
  id: string;
  kind: StoryboardAssetKind;
  name: string;
  prompt: string;
  source: "upload" | "ai" | "library";
  status: "idle" | "generating" | "ready" | "failed";
  mediaUrl?: string;
  localPath?: string;
  assetId?: string;
};

export type StoryboardShot = {
  id: string;
  order: number;
  script: string;
  assetIds: string[];
  prompt: string;
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
  stylePreset: string;
  customStyle: string;
  maxShots: number;
  splitAssist: string;
  scriptContent: string;
  unlockedStep: StoryboardAgentStep;
  assets: Record<StoryboardAssetKind, StoryboardAssetItem[]>;
  shots: StoryboardShot[];
  updatedAt: number;
};

type StoryboardIndex = {
  version: number;
  projects: StoryboardProject[];
};

const emptyAssets = (): Record<StoryboardAssetKind, StoryboardAssetItem[]> => ({
  role: [],
  scene: [],
  prop: [],
  audio: [],
});

export const createEmptyAgentData = (): StoryboardAgentData => ({
  scriptTitle: "",
  stylePreset: "cinematic-realism",
  customStyle: "",
  maxShots: 20,
  splitAssist: "",
  scriptContent: "",
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
    count: number;
    description?: string;
  }): Promise<StoryboardSnippet> {
    const now = Date.now();
    const snippet: StoryboardSnippet = {
      id: createId("story_snippet"),
      projectId: input.projectId,
      name: input.name.trim(),
      count: input.count,
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

export const splitScriptWithAgent = async (input: {
  title: string;
  style: string;
  customStyle: string;
  maxShots: number;
  splitAssist: string;
  scriptContent: string;
  defaults: StoryboardShot["modelInfo"];
}): Promise<StoryboardShot[]> => {
  try {
    const response = await createChatCompletion({
      model: "deepseek-v3.2",
      stream: false,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "你是影视分镜导演。只输出 JSON 数组，不要 Markdown。每项包含 script 和 prompt 两个字段。",
        },
        {
          role: "user",
          content: [
            `剧本标题：${input.title || "未命名剧本"}`,
            `作品风格：${input.style}`,
            input.customStyle ? `自定义风格：${input.customStyle}` : "",
            `最大分镜数：${input.maxShots}`,
            input.splitAssist ? `拆镜辅助词：${input.splitAssist}` : "",
            "请把以下剧本拆成适合图生视频的一组分镜，每个分镜的 script 保留剧情内容，prompt 写成可用于生图/图生视频的中文提示词。",
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
    const parsed = JSON.parse(parseJsonBlock(String(content))) as Array<{
      script?: string;
      prompt?: string;
    }>;
    const items = Array.isArray(parsed) ? parsed : [];
    if (items.length > 0) {
      return items.slice(0, input.maxShots).map((item, index) => ({
        id: createId("shot"),
        order: index + 1,
        script: item.script || "",
        assetIds: [],
        prompt: item.prompt || item.script || "",
        modelInfo: input.defaults,
        videoStatus: "idle",
      }));
    }
  } catch (error) {
    console.warn("[storyboard] AI split failed, fallback to local split", error);
  }

  const parts = input.scriptContent
    .split(/\n{2,}|(?<=[。！？!?])/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, Math.max(1, input.maxShots));

  return parts.map((part, index) => ({
    id: createId("shot"),
    order: index + 1,
    script: part,
    assetIds: [],
    prompt: `${input.customStyle || input.style}，${part}`,
    modelInfo: input.defaults,
    videoStatus: "idle",
  }));
};
