import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import type {
  FileInfo,
  StorageApi,
} from "shared/types/storage";

export type DebugApi = {
  toggleDevTools: () => Promise<{ success: boolean; error?: string }>;
  isDev: () => Promise<boolean>;
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

const storageApi: StorageApi = {
  selectDirectory: () => ipcRenderer.invoke("storage:selectDirectory"),
  ensureProject: (basePath, projectName) =>
    ipcRenderer.invoke("storage:ensureProject", basePath, projectName),
  listProjects: (basePath) => ipcRenderer.invoke("storage:listProjects", basePath),
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

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("storage", storageApi);
    contextBridge.exposeInMainWorld("debug", debugApi);
    contextBridge.exposeInMainWorld("download", downloadApi);
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
}
