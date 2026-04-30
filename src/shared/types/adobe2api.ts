export type Adobe2ApiStatus = "stopped" | "starting" | "running" | "error";

export type Adobe2ApiSettings = {
  host: string;
  port: number;
  outputDir: string | null;
};

export type Adobe2ApiState = {
  status: Adobe2ApiStatus;
  settings: Adobe2ApiSettings;
  baseUrl: string;
  apiKey: string | null;
  manageUrl: string;
  loginUrl: string;
  testUrl: string;
  healthUrl: string;
  dataDir: string;
  logPath: string;
  pid: number | null;
  recentLogs: string[];
  lastError: string | null;
  lastExitCode: number | null;
  startedAt: number | null;
  updatedAt: number;
};

export type Adobe2Api = {
  getState: () => Promise<Adobe2ApiState>;
  start: () => Promise<Adobe2ApiState>;
  stop: () => Promise<Adobe2ApiState>;
  restart: () => Promise<Adobe2ApiState>;
  openAdminWindow: () => Promise<Adobe2ApiState>;
  updateSettings: (patch: Partial<Adobe2ApiSettings>) => Promise<Adobe2ApiState>;
  getLogs: (limit?: number) => Promise<string[]>;
  selectOutputDirectory: () => Promise<string | null>;
};
