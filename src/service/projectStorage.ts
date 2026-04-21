import {
  generateSimpleFileName,
  localStorageService,
} from "service/localStorageService";

const PROJECT_LIST_KEY = "canvas-projects";
const CANVAS_DATA_PREFIX = "canvas-flow-data-";

export type ProjectMeta = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  coverUrl?: string;
  coverLocalPath?: string;
  description?: string;
  type: "video" | "script";
};

type ProjectList = {
  version: number;
  nextId: number;
  projects: ProjectMeta[];
};

const STORAGE_VERSION = 2;

export type MediaRef = {
  url: string;
  localName?: string;
  localPath?: string;
};

export const getProjectList = (): ProjectMeta[] => {
  try {
    const raw = localStorage.getItem(PROJECT_LIST_KEY);
    if (!raw) return [];

    const data = JSON.parse(raw) as ProjectList;
    if (data.version !== STORAGE_VERSION) return [];

    return data.projects.sort((a, b) => {
      const timeA = a.updatedAt || a.createdAt;
      const timeB = b.updatedAt || b.createdAt;
      return timeB - timeA;
    });
  } catch {
    return [];
  }
};

export const getProjectListAsync = async (): Promise<ProjectMeta[]> => {
  const localStorageProjects = getProjectList();

  const localFileProjects: ProjectMeta[] = [];

  if (localStorageService.isAvailable()) {
    try {
      const listResult = await localStorageService.listProjects();
      if (listResult.success && listResult.projects) {
        for (const item of listResult.projects) {
          const readResult = await localStorageService.loadCanvasData(item.name);
          if (!readResult.success || !readResult.data) {
            continue;
          }

          const canvasData = readResult.data;
          const existingProject = localStorageProjects.find(
            (p) => p.name === item.name,
          );

          if (!existingProject) {
            const newProject: ProjectMeta = {
              id: canvasData.projectId || `local-${item.name}`,
              name: canvasData.projectName || item.name,
              createdAt: canvasData.savedAt || item.createdAt || Date.now(),
              updatedAt: canvasData.savedAt || item.updatedAt || Date.now(),
              description: canvasData.description,
              coverLocalPath: canvasData.coverLocalPath,
              type: canvasData.type || "video",
            };

            localFileProjects.push(newProject);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to load local projects from store:", err);
    }
  }

  if (localFileProjects.length > 0) {
    const maxId = Math.max(
      ...localStorageProjects.map((p) => parseInt(p.id) || 0),
      ...localFileProjects.map(
        (p) => parseInt(p.id.replace("local-", "")) || 0,
      ),
      0,
    );
    const allProjects = [...localStorageProjects, ...localFileProjects];
    saveProjectList(allProjects, maxId + 1);
  }

  const allProjects = [...localStorageProjects, ...localFileProjects];

  const uniqueProjects = allProjects.reduce((acc: ProjectMeta[], project) => {
    if (!acc.find((p) => p.name === project.name)) {
      acc.push(project);
    }
    return acc;
  }, []);

  return uniqueProjects.sort((a, b) => {
    const timeA = a.updatedAt || a.createdAt;
    const timeB = b.updatedAt || b.createdAt;
    return timeB - timeA;
  });
};

const saveProjectList = (projects: ProjectMeta[], nextId: number): void => {
  const data: ProjectList = {
    version: STORAGE_VERSION,
    nextId,
    projects,
  };
  localStorage.setItem(PROJECT_LIST_KEY, JSON.stringify(data));
};

export const clearProjectList = (): void => {
  localStorage.removeItem(PROJECT_LIST_KEY);
};

const getNextId = (): number => {
  try {
    const raw = localStorage.getItem(PROJECT_LIST_KEY);
    if (!raw) return 1;

    const data = JSON.parse(raw) as ProjectList;
    return data.nextId || data.projects.length + 1;
  } catch {
    return 1;
  }
};

export const createProject = async (
  name?: string,
  coverUrl?: string,
  description?: string,
  type: "video" | "script" = "video",
): Promise<ProjectMeta> => {
  const now = Date.now();
  const existingProjects = await getProjectListAsync();
  const nextId = getNextId();

  let projectName = name || `项目 ${nextId}`;

  const existingNames = existingProjects.map((p) => p.name);
  if (existingNames.includes(projectName)) {
    let counter = 1;
    while (existingNames.includes(`${projectName} (${counter})`)) {
      counter++;
    }
    projectName = `${projectName} (${counter})`;
  }

  const newProject: ProjectMeta = {
    id: String(nextId),
    name: projectName,
    createdAt: now,
    updatedAt: now,
    coverUrl,
    description,
    type,
  };

  const localStorageProjects = getProjectList();
  localStorageProjects.push(newProject);
  saveProjectList(localStorageProjects, nextId + 1);

  localStorage.removeItem(getCanvasDataKey(String(nextId)));

  if (localStorageService.isAvailable()) {
    const basePath = localStorageService.getStoragePath();
    if (basePath) {
      await localStorageService.ensureProjectDir(basePath, projectName);

      const emptyCanvasData = {
        version: 1,
        savedAt: now,
        projectId: String(nextId),
        projectName: projectName,
        description: description,
        nodes: [],
        edges: [],
        nodeIdCounters: {
          note: 1,
          image: 1,
          video: 1,
          agent: 1,
          panorama: 1,
          audio: 1,
          table: 1,
        },
      };
      await localStorageService.saveCanvasData(
        String(nextId),
        projectName,
        emptyCanvasData,
      );
    }
  }

  return newProject;
};

export const updateProject = (
  projectId: string,
  updates: Partial<Omit<ProjectMeta, "id" | "createdAt">>,
): void => {
  try {
    const raw = localStorage.getItem(PROJECT_LIST_KEY);
    if (!raw) return;

    const data = JSON.parse(raw) as ProjectList;
    const projectIndex = data.projects.findIndex((p) => p.id === projectId);

    if (projectIndex !== -1) {
      data.projects[projectIndex] = {
        ...data.projects[projectIndex],
        ...updates,
        updatedAt: Date.now(),
      };
      saveProjectList(data.projects, data.nextId);
    }
  } catch (error: any) {
    console.error("Failed to update project:", error);
  }
};

export const renameProject = async (
  projectId: string,
  newName: string,
): Promise<boolean> => {
  try {
    const raw = localStorage.getItem(PROJECT_LIST_KEY);
    if (!raw) return false;

    const data = JSON.parse(raw) as ProjectList;
    const projectIndex = data.projects.findIndex((p) => p.id === projectId);

    if (projectIndex === -1) return false;

    const oldName = data.projects[projectIndex].name;

    const existingNames = data.projects
      .filter((p) => p.id !== projectId)
      .map((p) => p.name);
    if (existingNames.includes(newName)) {
      console.warn("Project name already exists:", newName);
      return false;
    }

    if (localStorageService.isAvailable()) {
      const renameResult = await localStorageService.renameProject(
        oldName,
        newName,
      );
      if (!renameResult.success) {
        console.error("Failed to rename project folder:", renameResult.error);
        return false;
      }
    }

    data.projects[projectIndex] = {
      ...data.projects[projectIndex],
      name: newName,
      updatedAt: Date.now(),
    };
    saveProjectList(data.projects, data.nextId);

    const canvasDataRaw = localStorage.getItem(getCanvasDataKey(projectId));
    if (canvasDataRaw) {
      try {
        const canvasData = JSON.parse(canvasDataRaw);
        canvasData.projectName = newName;
        await saveCanvasData(projectId, canvasData);
      } catch (e) {
        console.warn("Failed to update canvas data with new name:", e);
      }
    }

    return true;
  } catch (error: any) {
    console.error("Failed to rename project:", error);
    return false;
  }
};

export const deleteProject = async (id: string): Promise<boolean> => {
  try {
    const raw = localStorage.getItem(PROJECT_LIST_KEY);
    if (!raw) return false;

    const data = JSON.parse(raw) as ProjectList;
    const index = data.projects.findIndex((p) => p.id === id);

    if (index === -1) return false;

    const project = data.projects[index];
    const projectName = project.name;

    if (localStorageService.isAvailable()) {
      const deleteResult = await localStorageService.deleteProject(projectName);
      if (!deleteResult.success) {
        console.error("Failed to delete project data:", deleteResult.error);
      }
    }

    data.projects.splice(index, 1);
    localStorage.setItem(PROJECT_LIST_KEY, JSON.stringify(data));

    localStorage.removeItem(getCanvasDataKey(id));

    return true;
  } catch {
    return false;
  }
};

export const getCanvasDataKey = (projectId: string): string => {
  return `${CANVAS_DATA_PREFIX}${projectId}`;
};

export const projectExists = (id: string): boolean => {
  const projects = getProjectList();
  return projects.some((p) => p.id === id);
};

export const getProjectById = (id: string): ProjectMeta | undefined => {
  const projects = getProjectList();
  return projects.find((p) => p.id === id);
};

export const getProjectByName = (name: string): ProjectMeta | undefined => {
  const projects = getProjectList();
  return projects.find((p) => p.name === name);
};

export const saveCanvasData = async (
  projectId: string,
  data: any,
): Promise<boolean> => {
  const project = getProjectById(projectId);
  if (!project) return false;

  localStorage.setItem(getCanvasDataKey(projectId), JSON.stringify(data));

  if (localStorageService.isAvailable()) {
    const result = await localStorageService.saveCanvasData(
      projectId,
      project.name,
      data,
    );
    return result.success;
  }

  return true;
};

export const loadCanvasData = async (
  projectId: string,
): Promise<any | null> => {
  const project = getProjectById(projectId);
  if (!project) return null;

  if (localStorageService.isAvailable()) {
    const result = await localStorageService.loadCanvasData(project.name);
    if (result.success && result.data) {
      return result.data;
    }
  }

  const raw = localStorage.getItem(getCanvasDataKey(projectId));
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  return null;
};

const extractExtFromUrl = (url: string, fallback: string = "png"): string => {
  try {
    const urlPath = new URL(url).pathname;
    const ext = urlPath.split(".").pop()?.toLowerCase();
    if (ext && ["png", "jpg", "jpeg", "webp", "gif", "bmp", "mp4", "webm", "mp3", "wav", "ogg"].includes(ext)) {
      return ext;
    }
  } catch {}
  return fallback;
};

export const saveMediaFromUrl = async (
  projectId: string,
  url: string,
  mediaType: "image" | "video" | "audio" | "generate_image" | "generate_video",
  extension?: string,
): Promise<MediaRef> => {
  const project = getProjectById(projectId);
  if (!project || !localStorageService.isAvailable()) {
    return { url };
  }

  const ext = extension || extractExtFromUrl(url, mediaType === "video" ? "mp4" : mediaType === "audio" ? "mp3" : "png");
  const fileName = generateSimpleFileName(ext);

  try {
    const downloadFnMap: Record<string, (projectName: string, fileName: string, url: string) => Promise<any>> = {
      image: localStorageService.downloadImage,
      generate_image: localStorageService.downloadGeneratedImage,
      video: localStorageService.downloadVideo,
      generate_video: localStorageService.downloadGeneratedVideo,
      audio: localStorageService.downloadAudio,
    };

    const downloadFn = downloadFnMap[mediaType];
    if (!downloadFn) {
      return { url };
    }

    const result = await downloadFn(project.name, fileName, url);

    if (result.success) {
      const relativePath = getLocalFilePath(projectId, mediaType, fileName);
      return {
        url,
        localName: fileName,
        localPath: relativePath || undefined,
      };
    }
  } catch (err) {
    console.warn(`[saveMediaFromUrl] 保存 ${mediaType} 到本地失败:`, err);
  }

  return { url };
};

export const saveMediaBuffer = async (
  projectId: string,
  buffer: ArrayBuffer,
  mediaType: "image" | "video" | "audio" | "generate_image" | "generate_video",
  extension: string = "png",
): Promise<MediaRef> => {
  const project = getProjectById(projectId);
  if (!project || !localStorageService.isAvailable()) {
    return { url: "" };
  }

  const fileName = generateSimpleFileName(extension);

  try {
    const saveFnMap: Record<string, (projectName: string, fileName: string, buffer: ArrayBuffer) => Promise<any>> = {
      image: localStorageService.saveImage,
      generate_image: localStorageService.saveGeneratedImage,
      video: localStorageService.saveVideo,
      generate_video: localStorageService.saveGeneratedVideo,
      audio: localStorageService.saveAudio,
    };

    const saveFn = saveFnMap[mediaType];
    if (!saveFn) {
      return { url: "" };
    }

    const result = await saveFn(project.name, fileName, buffer);

    if (result.success) {
      const relativePath = getLocalFilePath(projectId, mediaType, fileName);
      return {
        url: "",
        localName: fileName,
        localPath: relativePath || undefined,
      };
    }
  } catch (err) {
    console.warn(`[saveMediaBuffer] 保存 ${mediaType} 到本地失败:`, err);
  }

  return { url: "" };
};

export const readLocalMediaAsBlobUrl = async (
  relativePath: string,
  mimeType: string = "image/png",
): Promise<string | null> => {
  const fileBytes = await readMediaFromLocal(relativePath);
  if (!fileBytes) return null;

  const blob = new Blob([fileBytes], { type: mimeType });
  return URL.createObjectURL(blob);
};

export const retryMediaUrl = async (
  url: string,
  retries: number = 2,
  timeoutMs: number = 5000,
): Promise<boolean> => {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, {
        method: "HEAD",
        mode: "no-cors",
        signal: controller.signal,
      });
      clearTimeout(timer);
      return true;
    } catch {
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }
  return false;
};

export const getDisplayUrl = async (
  item: { url?: string; localPath?: string; localName?: string },
  mimeType: string = "image/png",
): Promise<string | null> => {
  if (item.url) {
    return item.url;
  }

  if (item.localPath) {
    return readLocalMediaAsBlobUrl(item.localPath, mimeType);
  }

  return null;
};

export const saveImageToLocal = async (
  projectId: string,
  imageData: ArrayBuffer | string,
  extension: string = "png",
): Promise<string | null> => {
  const project = getProjectById(projectId);
  if (!project) return null;

  if (!localStorageService.isAvailable()) return null;

  const fileName = generateSimpleFileName(extension);

  if (typeof imageData === "string") {
    const result = await localStorageService.downloadImage(
      project.name,
      fileName,
      imageData,
    );
    return result.success ? fileName : null;
  } else {
    const result = await localStorageService.saveImage(
      project.name,
      fileName,
      imageData,
    );
    return result.success ? fileName : null;
  }
};

export const saveVideoToLocal = async (
  projectId: string,
  videoData: ArrayBuffer | string,
  extension: string = "mp4",
): Promise<string | null> => {
  const project = getProjectById(projectId);
  if (!project) return null;

  if (!localStorageService.isAvailable()) return null;

  const fileName = generateSimpleFileName(extension);

  if (typeof videoData === "string") {
    const result = await localStorageService.downloadVideo(
      project.name,
      fileName,
      videoData,
    );
    return result.success ? fileName : null;
  } else {
    const result = await localStorageService.saveVideo(
      project.name,
      fileName,
      videoData,
    );
    return result.success ? fileName : null;
  }
};

export const saveAudioToLocal = async (
  projectId: string,
  audioData: ArrayBuffer | string,
  extension: string = "mp3",
): Promise<string | null> => {
  const project = getProjectById(projectId);
  if (!project) return null;

  if (!localStorageService.isAvailable()) return null;

  const fileName = generateSimpleFileName(extension);

  if (typeof audioData === "string") {
    const result = await localStorageService.downloadAudio(
      project.name,
      fileName,
      audioData,
    );
    return result.success ? fileName : null;
  } else {
    const result = await localStorageService.saveAudio(
      project.name,
      fileName,
      audioData,
    );
    return result.success ? fileName : null;
  }
};

export const saveGeneratedImageToLocal = async (
  projectId: string,
  imageUrl: string,
  extension: string = "png",
): Promise<string | null> => {
  const project = getProjectById(projectId);
  if (!project) return null;

  if (!localStorageService.isAvailable()) return null;

  const fileName = generateSimpleFileName(extension);

  const result = await localStorageService.downloadGeneratedImage(
    project.name,
    fileName,
    imageUrl,
  );
  return result.success ? fileName : null;
};

export const saveGeneratedVideoToLocal = async (
  projectId: string,
  videoUrl: string,
  extension: string = "mp4",
): Promise<string | null> => {
  const project = getProjectById(projectId);
  if (!project) return null;

  if (!localStorageService.isAvailable()) return null;

  const fileName = generateSimpleFileName(extension);

  const result = await localStorageService.downloadGeneratedVideo(
    project.name,
    fileName,
    videoUrl,
  );
  return result.success ? fileName : null;
};

const arrayBufferToDataUrl = (buffer: ArrayBuffer, extension: string) => {
  let binary = "";
  const bytes = new Uint8Array(buffer);

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  const base64 = btoa(binary);
  return `data:image/${extension};base64,${base64}`;
};

export const saveCoverImageToLocal = async (
  projectId: string,
  imageData: ArrayBuffer | string,
  extension: string = "png",
): Promise<string | null> => {
  const project = getProjectById(projectId);
  if (!project) return null;

  if (!localStorageService.isAvailable()) return null;

  if (typeof imageData === "string") {
    const result = await localStorageService.downloadCoverImage(
      project.name,
      imageData,
    );
    if (result.success) {
      const ext = imageData.split(".").pop()?.toLowerCase() || "png";
      updateProject(projectId, {
        coverLocalPath: `${project.name}/cover.${ext}`,
        coverUrl: imageData,
      });
      return `cover.${ext}`;
    }
    return null;
  } else {
    const result = await localStorageService.saveCoverImage(
      project.name,
      imageData,
      extension,
    );
    if (!result.success) {
      return null;
    }

    updateProject(projectId, {
      coverLocalPath: `${project.name}/cover.${extension}`,
      coverUrl: arrayBufferToDataUrl(imageData, extension),
    });

    return `cover.${extension}`;
  }
};

export const readMediaFromLocal = async (
  relativePath: string,
): Promise<ArrayBuffer | null> => {
  if (!localStorageService.isAvailable()) return null;

  const readResult = await localStorageService.readMedia(relativePath);
  if (!readResult.success || !readResult.data) {
    return null;
  }

  const rawBytes = new Uint8Array(readResult.data);
  const copiedBytes = new Uint8Array(rawBytes.length);
  copiedBytes.set(rawBytes);
  return copiedBytes.buffer;
};

export const getLocalFilePath = (
  projectId: string,
  fileType: "image" | "video" | "audio" | "generate_image" | "generate_video",
  fileName: string,
): string | null => {
  const project = getProjectById(projectId);
  if (!project) return null;

  const folderMap: Record<string, string> = {
    image: "image",
    video: "video",
    audio: "audio",
    generate_image: "generate_image",
    generate_video: "generate_video",
  };

  const folder = folderMap[fileType];
  return `${project.name}/${folder}/${fileName}`;
};

export const getLocalFileAbsolutePath = (
  projectId: string,
  fileType: "image" | "video" | "audio" | "generate_image" | "generate_video",
  fileName: string,
): string | null => {
  const project = getProjectById(projectId);
  if (!project) return null;

  const basePath = localStorageService.getStoragePath();
  if (!basePath) return null;

  const folderMap: Record<string, string> = {
    image: "image",
    video: "video",
    audio: "audio",
    generate_image: "generate_image",
    generate_video: "generate_video",
  };

  const folder = folderMap[fileType];
  return `${basePath}/${project.name}/${folder}/${fileName}`;
};

export const getMediaPath = (relativePath: string): string | null => {
  return relativePath || null;
};

export const getMediaUrl = (relativePath: string): string | null => {
  return relativePath || null;
};

export const getCoverImageUrl = (projectId: string): string | null => {
  const project = getProjectById(projectId);
  if (!project) return null;

  return project.coverUrl || null;
};
