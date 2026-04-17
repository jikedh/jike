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
  ensureProjectDir: (basePath: string, projectName: string) =>
    ipcRenderer.invoke("storage:ensureProjectDir", basePath, projectName),
  writeJson: (filePath: string, data: any) =>
    ipcRenderer.invoke("storage:writeJson", filePath, data),
  readJson: (filePath: string) => ipcRenderer.invoke("storage:readJson", filePath),
  writeFile: (filePath: string, buffer: ArrayBuffer) =>
    ipcRenderer.invoke("storage:writeFile", filePath, buffer),
  readFile: (filePath: string) => ipcRenderer.invoke("storage:readFile", filePath),
  deleteFile: (filePath: string) => ipcRenderer.invoke("storage:deleteFile", filePath),
  deleteFolder: (folderPath: string) =>
    ipcRenderer.invoke("storage:deleteFolder", folderPath),
  fileExists: (filePath: string) => ipcRenderer.invoke("storage:fileExists", filePath),
  listFiles: (dirPath: string) => ipcRenderer.invoke("storage:listFiles", dirPath),
  downloadFile: (url: string, destPath: string) =>
    ipcRenderer.invoke("storage:downloadFile", url, destPath),
  renameDirectory: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke("storage:renameDirectory", oldPath, newPath),
  migrateProjects: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke("storage:migrateProjects", oldPath, newPath),
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
