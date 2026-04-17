import { ElectronAPI } from "@electron-toolkit/preload";

export type FileInfo = {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: number;
};

export type StorageApi = {
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

declare global {
  interface Window {
    electron: ElectronAPI;
    storage: StorageApi;
    debug: {
      toggleDevTools: () => Promise<{ success: boolean; error?: string }>;
    };
  }
}

export { };
