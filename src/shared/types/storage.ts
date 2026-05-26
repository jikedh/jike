export type FileInfo = {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: number;
};

export type AssetDiskFileInfo = {
  projectName: string;
  categoryName: string;
  name: string;
  relativePath: string;
  size: number;
  modifiedAt: number;
};

export type AssetDiskProjectInfo = {
  name: string;
  relativePath: string;
  createdAt: number;
  modifiedAt: number;
};

export type StorageResult<T = unknown> = {
  success: boolean;
  error?: string;
} & T;

export type StoryboardAssetsPackageResult = StorageResult<{
  assets?: unknown;
  path?: string;
  canceled?: boolean;
  copiedMediaCount?: number;
}>;

export type StorageApi = {
  selectDirectory: () => Promise<string | null>;
  ensureProject: (
    basePath: string,
    projectName: string,
  ) => Promise<StorageResult<{ project?: unknown; path?: string }>>;
  listProjects: (basePath: string) => Promise<
    StorageResult<{
      projects?: Array<{ name: string; createdAt: number; updatedAt: number }>;
    }>
  >;
  saveCanvas: (
    basePath: string,
    projectName: string,
    data: unknown,
  ) => Promise<StorageResult>;
  loadCanvas: (
    basePath: string,
    projectName: string,
  ) => Promise<StorageResult<{ data: unknown | null }>>;
  saveMedia: (
    basePath: string,
    relativePath: string,
    buffer: ArrayBuffer,
  ) => Promise<StorageResult<{ path?: string }>>;
  readMedia: (
    basePath: string,
    relativePath: string,
  ) => Promise<StorageResult<{ data: Buffer | null }>>;
  writeRawFile: (
    basePath: string,
    relativePath: string,
    buffer: ArrayBuffer,
  ) => Promise<StorageResult<{ path?: string }>>;
  readRawFile: (
    basePath: string,
    relativePath: string,
  ) => Promise<StorageResult<{ data: Buffer | null }>>;
  scanAssetLibrary: (
    basePath: string,
  ) => Promise<
    StorageResult<{
      projects?: AssetDiskProjectInfo[];
      files?: AssetDiskFileInfo[];
    }>
  >;
  deleteRawPath?: (
    basePath: string,
    relativePath: string,
  ) => Promise<StorageResult>;
  renameRawPath?: (
    basePath: string,
    oldRelativePath: string,
    newRelativePath: string,
  ) => Promise<StorageResult>;
  listMedia: (
    basePath: string,
    projectName: string,
    mediaType: string,
  ) => Promise<StorageResult<{ files?: FileInfo[] }>>;
  deleteMedia: (
    basePath: string,
    relativePath: string,
  ) => Promise<StorageResult>;
  downloadMedia: (
    basePath: string,
    url: string,
    relativePath: string,
  ) => Promise<StorageResult<{ path?: string }>>;
  saveBufferToFile: (
    defaultFileName: string,
    buffer: ArrayBuffer,
  ) => Promise<StorageResult<{ path?: string; canceled?: boolean }>>;
  mediaExists: (basePath: string, relativePath: string) => Promise<boolean>;
  renameProject: (
    basePath: string,
    oldProjectName: string,
    newProjectName: string,
  ) => Promise<StorageResult>;
  deleteProject: (
    basePath: string,
    projectName: string,
  ) => Promise<StorageResult>;
  copyProject: (
    basePath: string,
    srcProjectName: string,
    destProjectName: string,
  ) => Promise<StorageResult>;
  exportProject: (
    basePath: string,
    projectName: string,
  ) => Promise<
    StorageResult<{ path?: string; projectName?: string; canceled?: boolean }>
  >;
  importProject: (
    basePath: string,
  ) => Promise<
    StorageResult<{ path?: string; projectName?: string; canceled?: boolean }>
  >;
  exportStoryboardAssets: (
    basePath: string,
    projectId: string,
    assets: unknown,
  ) => Promise<StoryboardAssetsPackageResult>;
  importStoryboardAssetsPackage: (
    basePath: string,
    projectId: string,
  ) => Promise<StoryboardAssetsPackageResult>;
  getDefaultPath: () => Promise<string>;

  // Legacy aliases retained for compatibility while the renderer migrates.
  ensureProjectDir: (
    basePath: string,
    projectName: string,
  ) => Promise<StorageResult<{ project?: unknown; path?: string }>>;
  writeFile: (
    basePath: string,
    relativePath: string,
    buffer: ArrayBuffer,
  ) => Promise<StorageResult<{ path?: string }>>;
  readFile: (
    basePath: string,
    relativePath: string,
  ) => Promise<StorageResult<{ data: Buffer | null }>>;
  deleteFile: (
    basePath: string,
    relativePath: string,
  ) => Promise<StorageResult>;
  listFiles: (
    basePath: string,
    projectName: string,
    mediaType: string,
  ) => Promise<StorageResult<{ files?: FileInfo[] }>>;
  downloadFile: (
    basePath: string,
    url: string,
    relativePath: string,
  ) => Promise<StorageResult<{ path?: string }>>;
  fileExists: (basePath: string, relativePath: string) => Promise<boolean>;
};
