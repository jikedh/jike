export type Grok2ApiStatus = "stopped" | "starting" | "running" | "error";

export type Grok2ApiSettings = {
  host: string;
  port: number;
  /** @deprecated Grok2API now always runs from the bundled resources directory. */
  projectPath: string | null;
};

export type Grok2ApiState = {
  status: Grok2ApiStatus;
  settings: Grok2ApiSettings;
  resolvedProjectPath: string | null;
  baseUrl: string;
  apiKey: string | null;
  manageUrl: string;
  loginUrl: string;
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

export type Grok2Api = {
  getState: () => Promise<Grok2ApiState>;
  start: () => Promise<Grok2ApiState>;
  stop: () => Promise<Grok2ApiState>;
  restart: () => Promise<Grok2ApiState>;
  openAdminWindow: () => Promise<Grok2ApiState>;
  updateSettings: (patch: Partial<Grok2ApiSettings>) => Promise<Grok2ApiState>;
  getLogs: (limit?: number) => Promise<string[]>;
};
