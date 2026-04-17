const CANVAS_FILE_NAME = "canvas.json";

const joinPath = (...parts: string[]): string => {
  return parts.filter(Boolean).join("/").replace(/\/+/g, "/");
};

export type LocalStorageResult = {
  success: boolean;
  error?: string;
  data?: any;
};

export const localStorageService = {
  isAvailable: (): boolean => {
    return typeof window !== "undefined" && !!window.electronApi?.storage;
  },

  getStoragePath: (): string | null => {
    const settings = localStorage.getItem("canvas-chat-settings");
    if (!settings) return null;
    try {
      const parsed = JSON.parse(settings);
      return parsed.state?.storagePath || null;
    } catch {
      return null;
    }
  },

  ensureProjectDir: async (
    basePath: string,
    projectName: string,
  ): Promise<LocalStorageResult> => {
    if (!window.electronApi?.storage) {
      return { success: false, error: "Storage API not available" };
    }
    return window.electronApi.storage.ensureProjectDir(basePath, projectName);
  },

  saveCanvasData: async (
    projectId: string,
    projectName: string,
    data: any,
  ): Promise<LocalStorageResult> => {
    if (!window.electronApi?.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const basePath = localStorageService.getStoragePath();
    if (!basePath) {
      return { success: false, error: "Storage path not configured" };
    }

    const ensureResult = await localStorageService.ensureProjectDir(
      basePath,
      projectName,
    );
    if (!ensureResult.success) {
      return ensureResult;
    }

    const filePath = joinPath(basePath, projectName, CANVAS_FILE_NAME);
    return window.electronApi.storage.writeJson(filePath, data);
  },

  loadCanvasData: async (projectName: string): Promise<LocalStorageResult> => {
    if (!window.electronApi?.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const basePath = localStorageService.getStoragePath();
    if (!basePath) {
      return { success: false, error: "Storage path not configured" };
    }

    const filePath = joinPath(basePath, projectName, CANVAS_FILE_NAME);
    return window.electronApi.storage.readJson(filePath);
  },

  saveImage: async (
    projectName: string,
    fileName: string,
    buffer: ArrayBuffer,
  ): Promise<LocalStorageResult> => {
    if (!window.electronApi?.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const basePath = localStorageService.getStoragePath();
    if (!basePath) {
      return { success: false, error: "Storage path not configured" };
    }

    const filePath = joinPath(basePath, projectName, "image", fileName);
    return window.electronApi.storage.writeFile(filePath, buffer);
  },

  saveGeneratedImage: async (
    projectName: string,
    fileName: string,
    buffer: ArrayBuffer,
  ): Promise<LocalStorageResult> => {
    if (!window.electronApi?.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const basePath = localStorageService.getStoragePath();
    if (!basePath) {
      return { success: false, error: "Storage path not configured" };
    }

    const filePath = joinPath(
      basePath,
      projectName,
      "generate_image",
      fileName,
    );
    return window.electronApi.storage.writeFile(filePath, buffer);
  },

  saveVideo: async (
    projectName: string,
    fileName: string,
    buffer: ArrayBuffer,
  ): Promise<LocalStorageResult> => {
    if (!window.electronApi?.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const basePath = localStorageService.getStoragePath();
    if (!basePath) {
      return { success: false, error: "Storage path not configured" };
    }

    const filePath = joinPath(basePath, projectName, "video", fileName);
    return window.electronApi.storage.writeFile(filePath, buffer);
  },

  saveGeneratedVideo: async (
    projectName: string,
    fileName: string,
    buffer: ArrayBuffer,
  ): Promise<LocalStorageResult> => {
    if (!window.electronApi?.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const basePath = localStorageService.getStoragePath();
    if (!basePath) {
      return { success: false, error: "Storage path not configured" };
    }

    const filePath = joinPath(
      basePath,
      projectName,
      "generate_video",
      fileName,
    );
    return window.electronApi.storage.writeFile(filePath, buffer);
  },

  saveAudio: async (
    projectName: string,
    fileName: string,
    buffer: ArrayBuffer,
  ): Promise<LocalStorageResult> => {
    if (!window.electronApi?.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const basePath = localStorageService.getStoragePath();
    if (!basePath) {
      return { success: false, error: "Storage path not configured" };
    }

    const filePath = joinPath(basePath, projectName, "audio", fileName);
    return window.electronApi.storage.writeFile(filePath, buffer);
  },

  downloadImage: async (
    projectName: string,
    fileName: string,
    url: string,
  ): Promise<LocalStorageResult> => {
    if (!window.electronApi?.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const basePath = localStorageService.getStoragePath();
    if (!basePath) {
      return { success: false, error: "Storage path not configured" };
    }

    const filePath = joinPath(basePath, projectName, "image", fileName);
    return window.electronApi.storage.downloadFile(url, filePath);
  },

  downloadGeneratedImage: async (
    projectName: string,
    fileName: string,
    url: string,
  ): Promise<LocalStorageResult> => {
    if (!window.electronApi?.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const basePath = localStorageService.getStoragePath();
    if (!basePath) {
      return { success: false, error: "Storage path not configured" };
    }

    const filePath = joinPath(
      basePath,
      projectName,
      "generate_image",
      fileName,
    );
    return window.electronApi.storage.downloadFile(url, filePath);
  },

  downloadVideo: async (
    projectName: string,
    fileName: string,
    url: string,
  ): Promise<LocalStorageResult> => {
    if (!window.electronApi?.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const basePath = localStorageService.getStoragePath();
    if (!basePath) {
      return { success: false, error: "Storage path not configured" };
    }

    const filePath = joinPath(basePath, projectName, "video", fileName);
    return window.electronApi.storage.downloadFile(url, filePath);
  },

  downloadGeneratedVideo: async (
    projectName: string,
    fileName: string,
    url: string,
  ): Promise<LocalStorageResult> => {
    if (!window.electronApi?.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const basePath = localStorageService.getStoragePath();
    if (!basePath) {
      return { success: false, error: "Storage path not configured" };
    }

    const filePath = joinPath(
      basePath,
      projectName,
      "generate_video",
      fileName,
    );
    return window.electronApi.storage.downloadFile(url, filePath);
  },

  downloadAudio: async (
    projectName: string,
    fileName: string,
    url: string,
  ): Promise<LocalStorageResult> => {
    if (!window.electronApi?.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const basePath = localStorageService.getStoragePath();
    if (!basePath) {
      return { success: false, error: "Storage path not configured" };
    }

    const filePath = joinPath(basePath, projectName, "audio", fileName);
    return window.electronApi.storage.downloadFile(url, filePath);
  },

  saveCoverImage: async (
    projectName: string,
    buffer: ArrayBuffer,
    extension: string = "png",
  ): Promise<LocalStorageResult> => {
    if (!window.electronApi?.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const basePath = localStorageService.getStoragePath();
    if (!basePath) {
      return { success: false, error: "Storage path not configured" };
    }

    const filePath = joinPath(basePath, projectName, `cover.${extension}`);
    return window.electronApi.storage.writeFile(filePath, buffer);
  },

  downloadCoverImage: async (
    projectName: string,
    url: string,
  ): Promise<LocalStorageResult> => {
    if (!window.electronApi?.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const basePath = localStorageService.getStoragePath();
    if (!basePath) {
      return { success: false, error: "Storage path not configured" };
    }

    const ext = url.split(".").pop()?.toLowerCase() || "png";
    const filePath = joinPath(basePath, projectName, `cover.${ext}`);
    return window.electronApi.storage.downloadFile(url, filePath);
  },

  listImages: async (projectName: string): Promise<LocalStorageResult> => {
    if (!window.electronApi?.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const basePath = localStorageService.getStoragePath();
    if (!basePath) {
      return { success: false, error: "Storage path not configured" };
    }

    const dirPath = joinPath(basePath, projectName, "image");
    return window.electronApi.storage.listFiles(dirPath);
  },

  listGeneratedImages: async (
    projectName: string,
  ): Promise<LocalStorageResult> => {
    if (!window.electronApi?.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const basePath = localStorageService.getStoragePath();
    if (!basePath) {
      return { success: false, error: "Storage path not configured" };
    }

    const dirPath = joinPath(basePath, projectName, "generate_image");
    return window.electronApi.storage.listFiles(dirPath);
  },

  listVideos: async (projectName: string): Promise<LocalStorageResult> => {
    if (!window.electronApi?.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const basePath = localStorageService.getStoragePath();
    if (!basePath) {
      return { success: false, error: "Storage path not configured" };
    }

    const dirPath = joinPath(basePath, projectName, "video");
    return window.electronApi.storage.listFiles(dirPath);
  },

  listGeneratedVideos: async (
    projectName: string,
  ): Promise<LocalStorageResult> => {
    if (!window.electronApi?.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const basePath = localStorageService.getStoragePath();
    if (!basePath) {
      return { success: false, error: "Storage path not configured" };
    }

    const dirPath = joinPath(basePath, projectName, "generate_video");
    return window.electronApi.storage.listFiles(dirPath);
  },

  listAudio: async (projectName: string): Promise<LocalStorageResult> => {
    if (!window.electronApi?.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const basePath = localStorageService.getStoragePath();
    if (!basePath) {
      return { success: false, error: "Storage path not configured" };
    }

    const dirPath = joinPath(basePath, projectName, "audio");
    return window.electronApi.storage.listFiles(dirPath);
  },

  deleteFile: async (filePath: string): Promise<LocalStorageResult> => {
    if (!window.electronApi?.storage) {
      return { success: false, error: "Storage API not available" };
    }

    return window.electronApi.storage.deleteFile(filePath);
  },

  fileExists: async (filePath: string): Promise<boolean> => {
    if (!window.electronApi?.storage) {
      return false;
    }

    return window.electronApi.storage.fileExists(filePath);
  },

  renameProject: async (
    oldName: string,
    newName: string,
  ): Promise<LocalStorageResult> => {
    if (!window.electronApi?.storage) {
      return { success: false, error: "Storage API not available" };
    }

    const basePath = localStorageService.getStoragePath();
    if (!basePath) {
      return { success: false, error: "Storage path not configured" };
    }

    return window.electronApi.storage.renameDirectory(
      joinPath(basePath, oldName),
      joinPath(basePath, newName),
    );
  },

  getDefaultPath: async (): Promise<string> => {
    if (!window.electronApi?.storage) {
      return "";
    }

    return window.electronApi.storage.getDefaultPath();
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

// 按类型分组的预设结构
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
      console.log("[presetsService] save called with:", JSON.stringify(presets));
      localStorage.setItem(CANVAS_PRESETS_KEY, JSON.stringify(presets));
      console.log("[presetsService] saved, current localStorage:", localStorage.getItem(CANVAS_PRESETS_KEY));
    } catch (e) {
      console.error("[presetsService] save failed:", e);
    }
  },

  load(): PresetsMap | null {
    try {
      const raw = localStorage.getItem(CANVAS_PRESETS_KEY);
      console.log("[presetsService] load called, raw value:", raw);
      if (!raw) return null;
      return JSON.parse(raw) as PresetsMap;
    } catch (e) {
      console.error("[presetsService] load failed:", e);
      return null;
    }
  },
};
