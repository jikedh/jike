/**
 * ============================================================================
 * @file        index.ts
 * @description Electron Preload Script - 安全桥接层
 *              采用 Context Isolation + Preload Script 模式
 *              所有 API 通过 window.electronApi 统一暴露
 * ============================================================================
 */

import { contextBridge, ipcRenderer } from "electron";

// 文件信息类型（保留供其他模块使用）
export type FileInfo = {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: number;
};

// ============================================================================
// IPC Service - 通用 IPC 通信服务
// ============================================================================
const ipcService = {
  // 发送消息（用于 main process 的 on 监听）
  send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
  // 异步调用并返回结果
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  // 监听事件
  on: (channel: string, listener: (...args: any[]) => void) =>
    ipcRenderer.on(channel, (_event, ...args) => listener(...args)),
  // 单次监听
  once: (channel: string, listener: (...args: any[]) => void) =>
    ipcRenderer.once(channel, (_event, ...args) => listener(...args)),
  // 移除监听
  removeListener: (channel: string, listener: (...args: any[]) => void) =>
    ipcRenderer.removeListener(channel, listener),
};

// ============================================================================
// Storage API - 文件系统操作
// ============================================================================
const storageApi = {
  selectDirectory: () => ipcRenderer.invoke("storage:selectDirectory"),
  ensureProject: (basePath: string, projectName: string) =>
    ipcRenderer.invoke("storage:ensureProject", basePath, projectName),
  listProjects: (basePath: string) =>
    ipcRenderer.invoke("storage:listProjects", basePath),
  saveCanvas: (basePath: string, projectName: string, data: any) =>
    ipcRenderer.invoke("storage:saveCanvas", basePath, projectName, data),
  loadCanvas: (basePath: string, projectName: string) =>
    ipcRenderer.invoke("storage:loadCanvas", basePath, projectName),
  saveMedia: (basePath: string, relativePath: string, buffer: ArrayBuffer) =>
    ipcRenderer.invoke("storage:saveMedia", basePath, relativePath, buffer),
  readMedia: (basePath: string, relativePath: string) =>
    ipcRenderer.invoke("storage:readMedia", basePath, relativePath),
  listMedia: (basePath: string, projectName: string, mediaType: string) =>
    ipcRenderer.invoke("storage:listMedia", basePath, projectName, mediaType),
  deleteMedia: (basePath: string, relativePath: string) =>
    ipcRenderer.invoke("storage:deleteMedia", basePath, relativePath),
  downloadMedia: (basePath: string, url: string, relativePath: string) =>
    ipcRenderer.invoke("storage:downloadMedia", basePath, url, relativePath),
  renameProject: (
    basePath: string,
    oldProjectName: string,
    newProjectName: string,
  ) =>
    ipcRenderer.invoke(
      "storage:renameProject",
      basePath,
      oldProjectName,
      newProjectName,
    ),
  deleteProject: (basePath: string, projectName: string) =>
    ipcRenderer.invoke("storage:deleteProject", basePath, projectName),
  getDefaultPath: () => ipcRenderer.invoke("storage:getDefaultPath"),
};

// ============================================================================
// Debug API - 调试功能
// ============================================================================
const debugApi = {
  toggleDevTools: () => ipcRenderer.invoke("debug:toggleDevTools"),
  isDev: () => ipcRenderer.invoke("debug:isDev"),
};

// ============================================================================
// Download API - 图片下载
// ============================================================================
const downloadApi = {
  imageAsBuffer: (url: string) => ipcRenderer.invoke("download:imageAsBuffer", url),
  imageAsBase64: (url: string) =>
    ipcRenderer.invoke("download:imageAsBase64", url),
  imageToFile: (url: string, filePath: string) =>
    ipcRenderer.invoke("download:imageToFile", url, filePath),
};

// ============================================================================
// Globals - 安全的进程信息暴露
// ============================================================================
const globals = {
  process: {
    platform: process.platform,
    arch: process.arch,
    env: { ...process.env },
    versions: process.versions,
    execPath: process.execPath,
  },
};

// ============================================================================
// Context Bridge - 统一暴露 API
// ============================================================================
const electronApi = {
  ipcService,
  storage: storageApi,
  debug: debugApi,
  download: downloadApi,
  globals,
  platform: process.platform,
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electronApi", electronApi);
  } catch (error) {
    console.error("contextBridge error:", error);
  }
} else {
  // @ts-ignore (fallback for non-isolated context)
  window.electronApi = electronApi;
}
