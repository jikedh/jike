import { app, dialog } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { appendFile, mkdir, readFile } from "fs/promises";
import { DatabaseSync } from "node:sqlite";
import { join } from "path";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import type {
  Flow2ApiSettings,
  Flow2ApiState,
  Flow2ApiStatus,
} from "shared/types/flow2api";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 18000;
const SETTINGS_FILE = "settings.json";
const LOG_FILE = "flow2api.log";
const DEFAULT_SETTING_TOML = `[global]
api_key = "han1234"
admin_username = "admin"
admin_password = "admin"

[flow]
labs_base_url = "https://labs.google/fx/api"
api_base_url = "https://aisandbox-pa.googleapis.com/v1"
timeout = 120
max_retries = 3

[server]
host = "127.0.0.1"
port = 18000

[debug]
enabled = true
log_requests = true
log_responses = true
mask_token = false
`;
const HEALTH_PATH = "/health";
const MANAGE_PATH = "/manage";
const LOGIN_PATH = "/login";
const TEST_PATH = "/test";

type PersistedConfig = {
  host: string;
  port: number;
  outputDir: string | null;
};

function clampPort(value: number | undefined): number {
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 1024 && numeric <= 65535) {
    return numeric;
  }
  return DEFAULT_PORT;
}

function normalizeHost(value: string | undefined): string {
  const candidate = (value || "").trim();
  return candidate || DEFAULT_HOST;
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  return response.json();
}

export class Flow2ApiService {
  private child: ChildProcessWithoutNullStreams | null = null;

  private state: Flow2ApiState;

  private readonly rootDir: string;

  private readonly runtimeDir: string;

  private readonly configDir: string;

  private readonly dataDir: string;

  private readonly tmpDir: string;

  private readonly browserDir: string;

  private readonly settingsPath: string;

  private readonly logPath: string;

  private readonly configPath: string;

  constructor() {
    this.rootDir = app.getPath("userData");
    this.runtimeDir = join(this.rootDir, "flow2api");
    this.configDir = join(this.runtimeDir, "config");
    this.dataDir = join(this.runtimeDir, "data");
    this.tmpDir = join(this.runtimeDir, "tmp");
    this.browserDir = join(this.runtimeDir, "browser_data_rt");
    this.settingsPath = join(this.runtimeDir, SETTINGS_FILE);
    this.logPath = join(this.runtimeDir, LOG_FILE);
    this.configPath = join(this.configDir, "setting.toml");

    this.ensureDirs();

    const settings = this.readSettings();
    this.state = this.buildState("stopped", settings);
  }

  private ensureDirs(): void {
    for (const dir of [
      this.runtimeDir,
      this.configDir,
      this.dataDir,
      this.tmpDir,
      this.browserDir,
    ]) {
      mkdirSync(dir, { recursive: true });
    }
    if (!existsSync(this.configPath)) {
      writeFileSync(this.configPath, DEFAULT_SETTING_TOML, "utf-8");
    }
  }

  private readSettings(): Flow2ApiSettings {
    const fallback: PersistedConfig = {
      host: DEFAULT_HOST,
      port: DEFAULT_PORT,
      outputDir: null,
    };

    if (!existsSync(this.settingsPath)) {
      writeFileSync(this.settingsPath, JSON.stringify(fallback, null, 2), "utf-8");
      return fallback;
    }

    try {
      const raw = JSON.parse(readFileSync(this.settingsPath, "utf-8")) as Partial<PersistedConfig>;
      return {
        host: normalizeHost(raw.host),
        port: clampPort(raw.port),
        outputDir: raw.outputDir || null,
      };
    } catch {
      return fallback;
    }
  }

  private writeSettings(settings: Flow2ApiSettings): void {
    const payload: PersistedConfig = {
      host: normalizeHost(settings.host),
      port: clampPort(settings.port),
      outputDir: settings.outputDir || null,
    };
    writeFileSync(this.settingsPath, JSON.stringify(payload, null, 2), "utf-8");
  }

  private buildBaseUrl(settings: Flow2ApiSettings): string {
    return `http://${settings.host}:${settings.port}`;
  }

  private readApiKeyFromConfig(): string | null {
    try {
      const raw = readFileSync(this.configPath, "utf-8");
      const match = raw.match(/^\s*api_key\s*=\s*"([^"]+)"/m);
      return match?.[1]?.trim() || null;
    } catch {
      return null;
    }
  }

  private readCurrentApiKey(): string | null {
    const dbPath = join(this.dataDir, "flow.db");

    if (existsSync(dbPath)) {
      try {
        const db = new DatabaseSync(dbPath, { readOnly: true });
        try {
          const row = db
            .prepare("SELECT api_key FROM admin_config WHERE id = 1")
            .get() as { api_key?: string } | undefined;
          const apiKey = row?.api_key?.trim();
          if (apiKey) {
            return apiKey;
          }
        } finally {
          db.close();
        }
      } catch {
        // Fall back to the bootstrap setting.toml when the runtime DB is unavailable.
      }
    }

    return this.readApiKeyFromConfig();
  }

  private buildState(
    status: Flow2ApiStatus,
    settings: Flow2ApiSettings,
    overrides: Partial<Flow2ApiState> = {},
  ): Flow2ApiState {
    const baseUrl = this.buildBaseUrl(settings);
    return {
      status,
      settings,
      baseUrl,
      apiKey: overrides.apiKey ?? this.readCurrentApiKey(),
      manageUrl: `${baseUrl}${MANAGE_PATH}`,
      loginUrl: `${baseUrl}${LOGIN_PATH}`,
      testUrl: `${baseUrl}${TEST_PATH}`,
      healthUrl: `${baseUrl}${HEALTH_PATH}`,
      dataDir: this.runtimeDir,
      logPath: this.logPath,
      pid: this.child?.pid ?? overrides.pid ?? null,
      recentLogs: overrides.recentLogs ?? this.state?.recentLogs ?? [],
      lastError: overrides.lastError ?? this.state?.lastError ?? null,
      lastExitCode: overrides.lastExitCode ?? this.state?.lastExitCode ?? null,
      startedAt: overrides.startedAt ?? this.state?.startedAt ?? null,
      updatedAt: Date.now(),
    };
  }

  private setState(status: Flow2ApiStatus, overrides: Partial<Flow2ApiState> = {}): Flow2ApiState {
    this.state = this.buildState(status, overrides.settings ?? this.state.settings, overrides);
    return this.state;
  }

  private async appendLog(message: string): Promise<void> {
    await appendFile(this.logPath, message, "utf-8");
    await this.refreshRecentLogs();
  }

  private async refreshRecentLogs(limit = 200): Promise<void> {
    try {
      const content = await readFile(this.logPath, "utf-8");
      const lines = content.split(/\r?\n/).filter(Boolean);
      this.state = {
        ...this.state,
        recentLogs: lines.slice(-limit),
        updatedAt: Date.now(),
      };
    } catch {
      this.state = {
        ...this.state,
        recentLogs: [],
        updatedAt: Date.now(),
      };
    }
  }

  private buildEnv(settings: Flow2ApiSettings): NodeJS.ProcessEnv {
    return {
      ...process.env,
      FLOW2API_RUNTIME_DIR: this.runtimeDir,
      FLOW2API_CONFIG_PATH: this.configPath,
      FLOW2API_DATA_DIR: this.dataDir,
      FLOW2API_DB_PATH: join(this.dataDir, "flow.db"),
      FLOW2API_TMP_DIR: this.tmpDir,
      FLOW2API_STATIC_DIR: this.resolveStaticDir(),
      FLOW2API_BROWSER_DATA_DIR: this.browserDir,
      FLOW2API_BROWSER_PID_DIR: join(this.tmpDir, "browser_pids"),
      FLOW2API_SERVER_HOST: settings.host,
      FLOW2API_SERVER_PORT: String(settings.port),
      FLOW2API_OUTPUT_DIR: settings.outputDir || "",
      PYTHONIOENCODING: "utf-8",
      PYTHONUTF8: "1",
    };
  }

  private resolveStaticDir(): string {
    return join(this.resolveFlowRoot(), "static");
  }

  private resolveFlowRoot(): string {
    if (app.isPackaged) {
      return join(process.resourcesPath, "flow2api-main");
    }
    return join(process.cwd(), "..", "flow2api-main", "flow2api-main");
  }

  private resolveEntrypoint(): { command: string; args: string[]; cwd: string } {
    const flowRoot = this.resolveFlowRoot();
    if (app.isPackaged) {
      return {
        command: join(flowRoot, "flow2api.exe"),
        args: [],
        cwd: flowRoot,
      };
    }
    return {
      command: "python",
      args: ["-X", "utf8", "main.py"],
      cwd: flowRoot,
    };
  }

  private async waitForHealthy(timeoutMs = 20000): Promise<void> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (this.state.status === "error") {
        throw new Error(this.state.lastError || "Flow2API start failed");
      }

      try {
        await fetchJson(this.state.healthUrl);
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    throw new Error("Flow2API health check timed out");
  }

  async getState(): Promise<Flow2ApiState> {
    await this.refreshRecentLogs();
    if (this.child && this.state.status !== "starting") {
      try {
        await fetchJson(this.state.healthUrl);
        return this.setState("running");
      } catch (error: any) {
        return this.setState("error", {
          lastError: error?.message || "Flow2API unavailable",
        });
      }
    }
    return this.setState(this.state.status);
  }

  async updateSettings(patch: Partial<Flow2ApiSettings>): Promise<Flow2ApiState> {
    const nextSettings: Flow2ApiSettings = {
      host: normalizeHost(patch.host ?? this.state.settings.host),
      port: clampPort(patch.port ?? this.state.settings.port),
      outputDir:
        patch.outputDir === undefined ? this.state.settings.outputDir : patch.outputDir,
    };
    this.writeSettings(nextSettings);
    return this.setState(this.state.status, { settings: nextSettings });
  }

  async pickOutputDirectory(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "选择本地 Gemini 结果目录",
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  }

  async start(): Promise<Flow2ApiState> {
    if (this.child && this.state.status === "running") {
      return this.getState();
    }

    this.ensureDirs();
    await mkdir(this.configDir, { recursive: true });
    this.setState("starting", {
      lastError: null,
      lastExitCode: null,
      startedAt: Date.now(),
    });
    await appendFile(
      this.logPath,
      `\n[${new Date().toISOString()}] starting flow2api...\n`,
      "utf-8",
    );

    const entry = this.resolveEntrypoint();
    const env = this.buildEnv(this.state.settings);
    this.child = spawn(entry.command, entry.args, {
      cwd: entry.cwd,
      env,
      windowsHide: true,
    });

    this.child.stdout.on("data", (chunk) => {
      void this.appendLog(chunk.toString());
    });
    this.child.stderr.on("data", (chunk) => {
      void this.appendLog(chunk.toString());
    });
    this.child.on("error", (error) => {
      this.setState("error", {
        lastError: error.message,
        pid: null,
      });
    });
    this.child.on("exit", (code) => {
      this.child = null;
      this.setState(code === 0 ? "stopped" : "error", {
        lastExitCode: code ?? null,
        pid: null,
        lastError: code === 0 ? null : `Flow2API exited with code ${code ?? "unknown"}`,
      });
    });

    this.setState("starting", { pid: this.child.pid ?? null });

    try {
      await this.waitForHealthy();
      return this.setState("running");
    } catch (error: any) {
      this.setState("error", {
        lastError: error?.message || "Flow2API start failed",
      });
      throw error;
    }
  }

  async stop(): Promise<Flow2ApiState> {
    if (!this.child) {
      return this.setState("stopped", { pid: null });
    }

    const target = this.child;
    await this.appendLog(`\n[${new Date().toISOString()}] stopping flow2api...\n`);
    target.kill();
    this.child = null;
    return this.setState("stopped", { pid: null });
  }

  async restart(): Promise<Flow2ApiState> {
    await this.stop();
    return this.start();
  }

  async getLogs(limit = 200): Promise<string[]> {
    await this.refreshRecentLogs(limit);
    return this.state.recentLogs.slice(-limit);
  }
}

export const flow2ApiService = new Flow2ApiService();
