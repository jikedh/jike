import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

export type FileInfo = {
  name: string;
  path: string;
  relativePath: string;
  mediaType: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: number;
};

export type ProjectMeta = {
  name: string;
  createdAt: number;
  updatedAt: number;
};

export type StorageApi = {
  selectDirectory: () => Promise<string | null>;
  ensureProject: (
    basePath: string,
    projectName: string,
  ) => Promise<{ success: boolean; project?: ProjectMeta; error?: string }>;
  listProjects: (
    basePath: string,
  ) => Promise<{ success: boolean; projects: ProjectMeta[]; error?: string }>;
  saveCanvas: (
    basePath: string,
    projectName: string,
    data: any,
  ) => Promise<{ success: boolean; error?: string }>;
  loadCanvas: (
    basePath: string,
    projectName: string,
  ) => Promise<{ success: boolean; data: any; error?: string }>;
  saveMedia: (
    basePath: string,
    relativePath: string,
    buffer: ArrayBuffer,
  ) => Promise<{ success: boolean; path?: string; error?: string }>;
  readMedia: (
    basePath: string,
    relativePath: string,
  ) => Promise<{ success: boolean; data: Buffer | null; error?: string }>;
  listMedia: (
    basePath: string,
    projectName: string,
    mediaType: string,
  ) => Promise<{ success: boolean; files: FileInfo[]; error?: string }>;
  deleteMedia: (
    basePath: string,
    relativePath: string,
  ) => Promise<{ success: boolean; error?: string }>;
  downloadMedia: (
    basePath: string,
    url: string,
    relativePath: string,
  ) => Promise<{ success: boolean; path?: string; error?: string }>;
  renameProject: (
    basePath: string,
    oldProjectName: string,
    newProjectName: string,
  ) => Promise<{ success: boolean; error?: string }>;
  deleteProject: (
    basePath: string,
    projectName: string,
  ) => Promise<{ success: boolean; error?: string }>;
  copyProject: (
    basePath: string,
    srcProjectName: string,
    destProjectName: string,
  ) => Promise<{ success: boolean; error?: string }>;
  mediaExists: (
    basePath: string,
    relativePath: string,
  ) => Promise<boolean>;
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
  renameProject: (basePath, oldProjectName, newProjectName) =>
    ipcRenderer.invoke("storage:renameProject", basePath, oldProjectName, newProjectName),
  deleteProject: (basePath, projectName) =>
    ipcRenderer.invoke("storage:deleteProject", basePath, projectName),
  copyProject: (basePath, srcProjectName, destProjectName) =>
    ipcRenderer.invoke("storage:copyProject", basePath, srcProjectName, destProjectName),
  mediaExists: (basePath, relativePath) =>
    ipcRenderer.invoke("storage:mediaExists", basePath, relativePath),
  getDefaultPath: () => ipcRenderer.invoke("storage:getDefaultPath"),
};

const debugApi: DebugApi = {
  toggleDevTools: () => ipcRenderer.invoke("debug:toggleDevTools"),
  isDev: () => ipcRenderer.invoke("debug:isDev"),
};

const downloadApi: DownloadApi = {
  imageAsBuffer: (url) => ipcRenderer.invoke("download:imageAsBuffer", url),
  imageAsBase64: (url) => ipcRenderer.invoke("download:imageAsBase64", url),
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
