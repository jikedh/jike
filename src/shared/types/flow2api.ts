export type Flow2ApiStatus = "stopped" | "starting" | "running" | "error";

export type Flow2ApiSettings = {
  host: string;
  port: number;
  outputDir: string | null;
};

export type Flow2ApiState = {
  status: Flow2ApiStatus;
  settings: Flow2ApiSettings;
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

export type Flow2ApiApi = {
  getState: () => Promise<Flow2ApiState>;
  start: () => Promise<Flow2ApiState>;
  stop: () => Promise<Flow2ApiState>;
  restart: () => Promise<Flow2ApiState>;
  updateSettings: (patch: Partial<Flow2ApiSettings>) => Promise<Flow2ApiState>;
  getLogs: (limit?: number) => Promise<string[]>;
  selectOutputDirectory: () => Promise<string | null>;
};
