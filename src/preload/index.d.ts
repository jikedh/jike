/**
 * ============================================================================
 * @file        index.d.ts
 * @description Electron Preload 类型声明
 *              统一通过 window.electronApi 访问所有 API
 * ============================================================================
 */

export type FileInfo = {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: number;
};

// ============================================================================
// IPC Service
// ============================================================================
type IpcService = {
  send: (channel: string, ...args: any[]) => void;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, listener: (...args: any[]) => void) => void;
  once: (channel: string, listener: (...args: any[]) => void) => void;
  removeListener: (channel: string, listener: (...args: any[]) => void) => void;
};

// ============================================================================
// Storage API
// ============================================================================
type StorageApi = {
  selectDirectory: () => Promise<string | null>;
  ensureProject: (
    basePath: string,
    projectName: string,
  ) => Promise<{
    success: boolean;
    project?: { name: string; createdAt: number; updatedAt: number };
    error?: string;
  }>;
  listProjects: (basePath: string) => Promise<{
    success: boolean;
    projects: Array<{ name: string; createdAt: number; updatedAt: number }>;
    error?: string;
  }>;
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
  getDefaultPath: () => Promise<string>;
};

// ============================================================================
// Debug API
// ============================================================================
type DebugApi = {
  toggleDevTools: () => Promise<{ success: boolean; error?: string }>;
  isDev: () => Promise<boolean>;
};

// ============================================================================
// Download API
// ============================================================================
type DownloadApi = {
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

// ============================================================================
// Globals
// ============================================================================
type Globals = {
  process: {
    platform: string;
    arch: string;
    env: Record<string, string | undefined>;
    versions: NodeJS.Versions;
    execPath: string;
  };
};

// ============================================================================
// ElectronApi - 统一暴露的 API 对象
// ============================================================================
type ElectronApi = {
  ipcService: IpcService;
  storage: StorageApi;
  debug: DebugApi;
  download: DownloadApi;
  globals: Globals;
  platform: string;
};

declare global {
  interface Window {
    electronApi: ElectronApi;
  }
}
