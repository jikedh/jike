import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

export type FileInfo = {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: number;
};

export type StorageApi = {
  selectDirectory: () => Promise<string | null>;
  ensureProjectDir: (
    basePath: string,
    projectName: string,
  ) => Promise<{ success: boolean; path?: string; error?: string }>;
  writeJson: (
    filePath: string,
    data: any,
  ) => Promise<{ success: boolean; error?: string }>;
  readJson: (
    filePath: string,
  ) => Promise<{ success: boolean; data: any; error?: string }>;
  writeFile: (
    filePath: string,
    buffer: ArrayBuffer,
  ) => Promise<{ success: boolean; error?: string }>;
  readFile: (
    filePath: string,
  ) => Promise<{ success: boolean; data: Buffer | null; error?: string }>;
  deleteFile: (
    filePath: string,
  ) => Promise<{ success: boolean; error?: string }>;
  deleteFolder: (
    folderPath: string,
  ) => Promise<{ success: boolean; error?: string }>;
  fileExists: (filePath: string) => Promise<boolean>;
  listFiles: (
    dirPath: string,
  ) => Promise<{ success: boolean; files: FileInfo[]; error?: string }>;
  downloadFile: (
    url: string,
    destPath: string,
  ) => Promise<{ success: boolean; path?: string; error?: string }>;
  renameDirectory: (
    oldPath: string,
    newPath: string,
  ) => Promise<{ success: boolean; error?: string }>;
  migrateProjects: (
    oldPath: string,
    newPath: string,
  ) => Promise<{ success: boolean; migratedCount?: number; error?: string }>;
  getDefaultPath: () => Promise<string>;
};

export type DebugApi = {
  toggleDevTools: () => Promise<{ success: boolean; error?: string }>;
  isDev: () => Promise<boolean>;
};

export type DownloadApi = {
  imageAsBuffer: (
    url: string,
  ) => Promise<{ success: boolean; data?: Uint8Array; error?: string }>;
  imageAsBase64: (
    url: string,
  ) => Promise<{
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
  ensureProjectDir: (basePath, projectName) =>
    ipcRenderer.invoke("storage:ensureProjectDir", basePath, projectName),
  writeJson: (filePath, data) =>
    ipcRenderer.invoke("storage:writeJson", filePath, data),
  readJson: (filePath) => ipcRenderer.invoke("storage:readJson", filePath),
  writeFile: (filePath, buffer) =>
    ipcRenderer.invoke("storage:writeFile", filePath, buffer),
  readFile: (filePath) => ipcRenderer.invoke("storage:readFile", filePath),
  deleteFile: (filePath) => ipcRenderer.invoke("storage:deleteFile", filePath),
  deleteFolder: (folderPath) =>
    ipcRenderer.invoke("storage:deleteFolder", folderPath),
  fileExists: (filePath) => ipcRenderer.invoke("storage:fileExists", filePath),
  listFiles: (dirPath) => ipcRenderer.invoke("storage:listFiles", dirPath),
  downloadFile: (url, destPath) =>
    ipcRenderer.invoke("storage:downloadFile", url, destPath),
  renameDirectory: (oldPath, newPath) =>
    ipcRenderer.invoke("storage:renameDirectory", oldPath, newPath),
  migrateProjects: (oldPath, newPath) =>
    ipcRenderer.invoke("storage:migrateProjects", oldPath, newPath),
  getDefaultPath: () => ipcRenderer.invoke("storage:getDefaultPath"),
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
