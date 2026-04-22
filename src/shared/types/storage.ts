export type FileInfo = {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: number;
};

export type StorageResult<T = unknown> = {
  success: boolean;
  error?: string;
} & T;

export type StorageApi = {
  selectDirectory: () => Promise<string | null>;
  ensureProject: (
    basePath: string,
    projectName: string,
  ) => Promise<StorageResult<{ project?: unknown; path?: string }>>;
  listProjects: (
    basePath: string,
  ) => Promise<
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
