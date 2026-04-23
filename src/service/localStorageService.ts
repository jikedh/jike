const joinPath = (...parts: string[]): string => {
  return parts.filter(Boolean).join("/").replace(/\/+/g, "/");
};

export type LocalStorageResult = {
  success: boolean;
  error?: string;
  data?: any;
};

const requireStoragePath = (): { basePath?: string; error?: string } => {
  const settings = localStorage.getItem("canvas-chat-settings");
  if (!settings) {
    return { error: "Storage path not configured" };
  }

  try {
    const parsed = JSON.parse(settings);
    const basePath = parsed.state?.storagePath || "";

    if (!basePath) {
      return { error: "Storage path not configured" };
    }

    return { basePath };
  } catch {
    return { error: "Storage path not configured" };
  }
};

export const localStorageService = {
  isAvailable: (): boolean => {
    return typeof window !== "undefined" && !!window.storage;
  },

  getStoragePath: (): string | null => {
    const result = requireStoragePath();
    return result.basePath || null;
  },

  ensureProjectDir: async (
    basePath: string,
    projectName: string,
  ): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    return window.storage.ensureProject(basePath, projectName);
  },

  listProjects: async (): Promise<
    LocalStorageResult & {
      projects?: Array<{ name: string; createdAt: number; updatedAt: number }>;
    }
  > => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available", projects: [] };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) {
      return { success: false, error, projects: [] };
    }

    return window.storage.listProjects(basePath);
  },

  saveCanvasData: async (
    _projectId: string,
    projectName: string,
    data: any,
  ): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    const ensureResult = await localStorageService.ensureProjectDir(
      basePath,
      projectName,
    );
    if (!ensureResult.success) {
      return ensureResult;
    }

    return window.storage.saveCanvas(basePath, projectName, data);
  },

  loadCanvasData: async (projectName: string): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    return window.storage.loadCanvas(basePath, projectName);
  },

  saveImage: async (
    projectName: string,
    fileName: string,
    buffer: ArrayBuffer,
  ): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    const relativePath = joinPath(projectName, "image", fileName);
    return window.storage.saveMedia(basePath, relativePath, buffer);
  },

  saveGeneratedImage: async (
    projectName: string,
    fileName: string,
    buffer: ArrayBuffer,
  ): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    const relativePath = joinPath(projectName, "generate_image", fileName);
    return window.storage.saveMedia(basePath, relativePath, buffer);
  },

  saveVideo: async (
    projectName: string,
    fileName: string,
    buffer: ArrayBuffer,
  ): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    const relativePath = joinPath(projectName, "video", fileName);
    return window.storage.saveMedia(basePath, relativePath, buffer);
  },

  saveGeneratedVideo: async (
    projectName: string,
    fileName: string,
    buffer: ArrayBuffer,
  ): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    const relativePath = joinPath(projectName, "generate_video", fileName);
    return window.storage.saveMedia(basePath, relativePath, buffer);
  },

  saveAudio: async (
    projectName: string,
    fileName: string,
    buffer: ArrayBuffer,
  ): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    const relativePath = joinPath(projectName, "audio", fileName);
    return window.storage.saveMedia(basePath, relativePath, buffer);
  },

  downloadImage: async (
    projectName: string,
    fileName: string,
    url: string,
  ): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    const relativePath = joinPath(projectName, "image", fileName);
    return window.storage.downloadMedia(basePath, url, relativePath);
  },

  downloadGeneratedImage: async (
    projectName: string,
    fileName: string,
    url: string,
  ): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    const relativePath = joinPath(projectName, "generate_image", fileName);
    return window.storage.downloadMedia(basePath, url, relativePath);
  },

  downloadVideo: async (
    projectName: string,
    fileName: string,
    url: string,
  ): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    const relativePath = joinPath(projectName, "video", fileName);
    return window.storage.downloadMedia(basePath, url, relativePath);
  },

  downloadGeneratedVideo: async (
    projectName: string,
    fileName: string,
    url: string,
  ): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    const relativePath = joinPath(projectName, "generate_video", fileName);
    return window.storage.downloadMedia(basePath, url, relativePath);
  },

  downloadAudio: async (
    projectName: string,
    fileName: string,
    url: string,
  ): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    const relativePath = joinPath(projectName, "audio", fileName);
    return window.storage.downloadMedia(basePath, url, relativePath);
  },

  saveCoverImage: async (
    projectName: string,
    buffer: ArrayBuffer,
    extension: string = "png",
  ): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    const relativePath = joinPath(projectName, `cover.${extension}`);
    return window.storage.saveMedia(basePath, relativePath, buffer);
  },

  downloadCoverImage: async (
    projectName: string,
    url: string,
  ): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    const ext = url.split(".").pop()?.toLowerCase() || "png";
    const relativePath = joinPath(projectName, `cover.${ext}`);
    return window.storage.downloadMedia(basePath, url, relativePath);
  },

  listImages: async (projectName: string): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    return window.storage.listMedia(basePath, projectName, "image");
  },

  listGeneratedImages: async (
    projectName: string,
  ): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    return window.storage.listMedia(basePath, projectName, "generate_image");
  },

  listVideos: async (projectName: string): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    return window.storage.listMedia(basePath, projectName, "video");
  },

  listGeneratedVideos: async (
    projectName: string,
  ): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    return window.storage.listMedia(basePath, projectName, "generate_video");
  },

  listAudio: async (projectName: string): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    return window.storage.listMedia(basePath, projectName, "audio");
  },

  readMedia: async (relativePath: string): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    return window.storage.readMedia(basePath, relativePath);
  },

  deleteFile: async (relativePath: string): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    return window.storage.deleteMedia(basePath, relativePath);
  },

  fileExists: async (relativePath: string): Promise<boolean> => {
    if (!window.storage) {
      return false;
    }

    const { basePath } = requireStoragePath();
    if (!basePath) return false;

    const normalized = relativePath.replace(/\\/g, "/");
    if (normalized.endsWith("/canvas.json") || normalized === "canvas.json") {
      const projectName = normalized.split("/")[0];
      if (!projectName || projectName === "canvas.json") return false;
      const result = await window.storage.loadCanvas(basePath, projectName);
      return !!result.success;
    }

    return window.storage.mediaExists(basePath, normalized);
  },

  renameProject: async (
    oldName: string,
    newName: string,
  ): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    return window.storage.renameProject(basePath, oldName, newName);
  },

  deleteProject: async (projectName: string): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    return window.storage.deleteProject(basePath, projectName);
  },

  copyProject: async (
    srcName: string,
    destName: string,
  ): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    return window.storage.copyProject(basePath, srcName, destName);
  },

  exportProject: async (
    projectName: string,
  ): Promise<
    LocalStorageResult & {
      path?: string;
      projectName?: string;
      canceled?: boolean;
    }
  > => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    return window.storage.exportProject(basePath, projectName);
  },

  importProject: async (): Promise<
    LocalStorageResult & {
      path?: string;
      projectName?: string;
      canceled?: boolean;
    }
  > => {
    if (!window.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const { basePath, error } = requireStoragePath();
    if (!basePath) return { success: false, error };

    return window.storage.importProject(basePath);
  },

  getDefaultPath: async (): Promise<string> => {
    if (!window.storage) {
      return "";
    }

    return window.storage.getDefaultPath();
  },
};

export const generateFileName = (prefix: string, extension: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}.${extension}`;
};

export const generateSimpleFileName = (extension: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}_${random}.${extension}`;
};

export const getImageLocalPath = (
  basePath: string,
  projectName: string,
  fileName: string,
): string => {
  return joinPath(basePath, projectName, "image", fileName);
};

export const getGeneratedImageLocalPath = (
  basePath: string,
  projectName: string,
  fileName: string,
): string => {
  return joinPath(basePath, projectName, "generate_image", fileName);
};

export const getVideoLocalPath = (
  basePath: string,
  projectName: string,
  fileName: string,
): string => {
  return joinPath(basePath, projectName, "video", fileName);
};

export const getGeneratedVideoLocalPath = (
  basePath: string,
  projectName: string,
  fileName: string,
): string => {
  return joinPath(basePath, projectName, "generate_video", fileName);
};

export const getAudioLocalPath = (
  basePath: string,
  projectName: string,
  fileName: string,
): string => {
  return joinPath(basePath, projectName, "audio", fileName);
};

export const getCoverImagePath = (
  basePath: string,
  projectName: string,
  extension: string = "png",
): string => {
  return joinPath(basePath, projectName, `cover.${extension}`);
};

// ========== 预设提示词库 ==========
const CANVAS_PRESETS_KEY = "canvas-presets";

export type PresetItem = {
  id: string;
  name: string;
  content: string;
  enabled: boolean;
};

export type PresetsMap = {
  general: PresetItem[];
  image: PresetItem[];
  video: PresetItem[];
};

export const defaultPresets: PresetsMap = {
  general: [
    {
      id: "2",
      name: "赛博朋克风格",
      content:
        "Cyberpunk aesthetic, neon lights, rainy streets, futuristic city, high contrast",
      enabled: false,
    },
  ],
  image: [
    {
      id: "1",
      name: "电影感光效",
      content:
        "Cinematic lighting, volumetric fog, 8k resolution, highly detailed, anamorphic lens flare",
      enabled: true,
    },
  ],
  video: [
    {
      id: "3",
      name: "慢动作特写",
      content:
        "Slow motion, extreme close up, shallow depth of field, 120fps style",
      enabled: true,
    },
  ],
};

export const presetsService = {
  save(presets: PresetsMap): void {
    try {
      localStorage.setItem(CANVAS_PRESETS_KEY, JSON.stringify(presets));
    } catch (e) {
      console.error("[presetsService] save failed:", e);
    }
  },

  load(): PresetsMap | null {
    try {
      const raw = localStorage.getItem(CANVAS_PRESETS_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as PresetsMap;
    } catch (e) {
      console.error("[presetsService] load failed:", e);
      return null;
    }
  },
};
