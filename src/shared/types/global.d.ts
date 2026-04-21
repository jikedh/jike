import { ElectronAPI } from "@electron-toolkit/preload";

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

declare global {
  interface Window {
    electron: ElectronAPI;
    storage: StorageApi;
    debug: DebugApi;
    download: DownloadApi;
  }
}

export {};
