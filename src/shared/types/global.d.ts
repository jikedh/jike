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

declare global {
  interface Window {
    electron: ElectronAPI;
    storage: StorageApi;
    debug: {
      toggleDevTools: () => Promise<{ success: boolean; error?: string }>;
    };
  }
}

export {};
