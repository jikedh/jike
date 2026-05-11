import { electronAPI } from "@electron-toolkit/preload";
import { contextBridge, ipcRenderer } from "electron";
import type { Adobe2Api } from "shared/types/adobe2api";
import type { Grok2Api } from "shared/types/grok2api";
import type { StorageApi } from "shared/types/storage";

export type DebugApi = {
  toggleDevTools: () => Promise<{ success: boolean; error?: string }>;
  isDev: () => Promise<boolean>;
  getAppVersion: () => Promise<string>;
  capturePage: (rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => Promise<{ success: boolean; data?: Uint8Array; error?: string }>;
};

export type DownloadApi = {
  imageAsBuffer: (
    url: string,
  ) => Promise<{ success: boolean; data?: Uint8Array; error?: string }>;
  imageAsBase64: (url: string) => Promise<{
    success: boolean;
    data?: { base64: string; mimeType: string };
    error?: string;
  }>;
  imageToFile: (
    url: string,
    filePath: string,
  ) => Promise<{ success: boolean; data?: { path: string }; error?: string }>;
};

export type VideoProcessingApi = {
  trim: (request: {
    videoUrl: string;
    start: number;
    end: number;
    authToken?: string;
    backendBaseUrl?: string;
  }) => Promise<{
    success: boolean;
    data?: {
      url: string;
      format: "mp4";
      duration: number;
      method: "cloud" | "ffmpeg";
      jobId?: string;
    };
    error?: string;
  }>;
};

const storageApi: StorageApi = {
  selectDirectory: () => ipcRenderer.invoke("storage:selectDirectory"),
  ensureProject: (basePath, projectName) =>
    ipcRenderer.invoke("storage:ensureProject", basePath, projectName),
  listProjects: (basePath) =>
    ipcRenderer.invoke("storage:listProjects", basePath),
  saveCanvas: (basePath, projectName, data) =>
    ipcRenderer.invoke("storage:saveCanvas", basePath, projectName, data),
  loadCanvas: (basePath, projectName) =>
    ipcRenderer.invoke("storage:loadCanvas", basePath, projectName),
  saveMedia: (basePath, relativePath, buffer) =>
    ipcRenderer.invoke("storage:saveMedia", basePath, relativePath, buffer),
  readMedia: (basePath, relativePath) =>
    ipcRenderer.invoke("storage:readMedia", basePath, relativePath),
  listMedia: (basePath, projectName, mediaType) =>
    ipcRenderer.invoke("storage:listMedia", basePath, projectName, mediaType),
  deleteMedia: (basePath, relativePath) =>
    ipcRenderer.invoke("storage:deleteMedia", basePath, relativePath),
  downloadMedia: (basePath, url, relativePath) =>
    ipcRenderer.invoke("storage:downloadMedia", basePath, url, relativePath),
  saveBufferToFile: (defaultFileName, buffer) =>
    ipcRenderer.invoke("storage:saveBufferToFile", defaultFileName, buffer),
  mediaExists: (basePath, relativePath) =>
    ipcRenderer.invoke("storage:mediaExists", basePath, relativePath),
  renameProject: (basePath, oldProjectName, newProjectName) =>
    ipcRenderer.invoke(
      "storage:renameProject",
      basePath,
      oldProjectName,
      newProjectName,
    ),
  deleteProject: (basePath, projectName) =>
    ipcRenderer.invoke("storage:deleteProject", basePath, projectName),
  copyProject: (basePath, srcProjectName, destProjectName) =>
    ipcRenderer.invoke(
      "storage:copyProject",
      basePath,
      srcProjectName,
      destProjectName,
    ),
  exportProject: (basePath, projectName) =>
    ipcRenderer.invoke("storage:exportProject", basePath, projectName),
  importProject: (basePath) =>
    ipcRenderer.invoke("storage:importProject", basePath),
  getDefaultPath: () => ipcRenderer.invoke("storage:getDefaultPath"),

  // Compatibility aliases for existing renderer-side service wrappers.
  ensureProjectDir: (basePath, projectName) =>
    ipcRenderer.invoke("storage:ensureProject", basePath, projectName),
  writeFile: (basePath, relativePath, buffer) =>
    ipcRenderer.invoke("storage:saveMedia", basePath, relativePath, buffer),
  readFile: (basePath, relativePath) =>
    ipcRenderer.invoke("storage:readMedia", basePath, relativePath),
  deleteFile: (basePath, relativePath) =>
    ipcRenderer.invoke("storage:deleteMedia", basePath, relativePath),
  listFiles: (basePath, projectName, mediaType) =>
    ipcRenderer.invoke("storage:listMedia", basePath, projectName, mediaType),
  downloadFile: (basePath, url, relativePath) =>
    ipcRenderer.invoke("storage:downloadMedia", basePath, url, relativePath),
  fileExists: (basePath, relativePath) =>
    ipcRenderer.invoke("storage:mediaExists", basePath, relativePath),
};

const debugApi: DebugApi = {
  // 触发主进程切换 DevTools
  toggleDevTools: () => ipcRenderer.invoke("debug:toggleDevTools"),
  // 检查是否为开发环境
  isDev: () => ipcRenderer.invoke("debug:isDev"),
  getAppVersion: () => ipcRenderer.invoke("debug:getAppVersion"),
  capturePage: (rect) => ipcRenderer.invoke("debug:capturePage", rect),
};

const downloadApi: DownloadApi = {
  // 下载图片作为 Buffer
  imageAsBuffer: (url) => ipcRenderer.invoke("download:imageAsBuffer", url),
  // 下载图片作为 Base64
  imageAsBase64: (url) => ipcRenderer.invoke("download:imageAsBase64", url),
  // 下载图片保存到文件
  imageToFile: (url, filePath) =>
    ipcRenderer.invoke("download:imageToFile", url, filePath),
};

const videoProcessingApi: VideoProcessingApi = {
  trim: (request) => ipcRenderer.invoke("video-processing:trim", request),
};

const adobe2Api: Adobe2Api = {
  getState: () => ipcRenderer.invoke("adobe2api:getState"),
  start: () => ipcRenderer.invoke("adobe2api:start"),
  stop: () => ipcRenderer.invoke("adobe2api:stop"),
  restart: () => ipcRenderer.invoke("adobe2api:restart"),
  openAdminWindow: () => ipcRenderer.invoke("adobe2api:openAdminWindow"),
  updateSettings: (patch) =>
    ipcRenderer.invoke("adobe2api:updateSettings", patch),
  getLogs: (limit) => ipcRenderer.invoke("adobe2api:getLogs", limit),
  selectOutputDirectory: () =>
    ipcRenderer.invoke("adobe2api:selectOutputDirectory"),
};

const grok2Api: Grok2Api = {
  getState: () => ipcRenderer.invoke("grok2api:getState"),
  start: () => ipcRenderer.invoke("grok2api:start"),
  stop: () => ipcRenderer.invoke("grok2api:stop"),
  restart: () => ipcRenderer.invoke("grok2api:restart"),
  openAdminWindow: () => ipcRenderer.invoke("grok2api:openAdminWindow"),
  updateSettings: (patch) => ipcRenderer.invoke("grok2api:updateSettings", patch),
  getLogs: (limit) => ipcRenderer.invoke("grok2api:getLogs", limit),
};

export type TrackingApi = {
  send: (
    data: AIVideoTrackData,
  ) => Promise<{ success: boolean; error?: string }>;
  updateStatus: (
    taskId: string,
    status: string,
    errorMessage?: string,
    generatedVideoUrl?: string,
  ) => Promise<{ success: boolean; error?: string }>;
};

export interface AIVideoTrackData {
  userId: string;
  userUuid?: string;
  apiName: string;
  model: string;
  taskId: string;
  prompt?: string;
  duration?: number;
  referenceImageUrl?: string;
  provider?: string;
  requestParams?: Record<string, unknown>;
  generatedVideoUrl?: string;
  status: "SUCCESS" | "FAIL" | "PENDING";
  timestamp: number;
}

const trackingApi: TrackingApi = {
  send: (data) => ipcRenderer.invoke("tracking:send", data),
  updateStatus: (taskId, status, errorMessage, generatedVideoUrl) =>
    ipcRenderer.invoke(
      "tracking:updateStatus",
      taskId,
      status,
      errorMessage,
      generatedVideoUrl,
    ),
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("storage", storageApi);
    contextBridge.exposeInMainWorld("debug", debugApi);
    contextBridge.exposeInMainWorld("download", downloadApi);
    contextBridge.exposeInMainWorld("videoProcessing", videoProcessingApi);
    contextBridge.exposeInMainWorld("adobe2api", adobe2Api);
    contextBridge.exposeInMainWorld("grok2api", grok2Api);
    contextBridge.exposeInMainWorld("tracking", trackingApi);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.storage = storageApi;
  // @ts-ignore (define in dts)
  window.debug = debugApi;
  // @ts-ignore (define in dts)
  window.download = downloadApi;
  // @ts-ignore (define in dts)
  window.videoProcessing = videoProcessingApi;
  // @ts-ignore (define in dts)
  window.adobe2api = adobe2Api;
  // @ts-ignore (define in dts)
  window.grok2api = grok2Api;
  // @ts-ignore (define in dts)
  window.tracking = trackingApi;
}
