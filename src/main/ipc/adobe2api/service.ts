import {
  type ChildProcessWithoutNullStreams,
  spawn,
  spawnSync,
} from "child_process";
import { randomUUID } from "crypto";
import { app, BrowserWindow, dialog, shell } from "electron";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { appendFile, mkdir, readFile } from "fs/promises";
import { join } from "path";
import type {
  Adobe2ApiSettings,
  Adobe2ApiState,
  Adobe2ApiStatus,
} from "shared/types/adobe2api";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 6001;
const SETTINGS_FILE = "settings.json";
const LOG_FILE = "adobe2api.log";
const HEALTH_PATH = "/api/v1/health";
const MANAGE_PATH = "/";
const TEST_PATH = "/";
const REQUIRED_PYTHON_MAJOR = 3;
const REQUIRED_PYTHON_MINOR = 13;
const DEFAULT_CONFIG = {
  api_key: "adobe1234",
  admin_username: "admin",
  admin_password: "admin",
};

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

export class Adobe2ApiService {
  private child: ChildProcessWithoutNullStreams | null = null;

  private state: Adobe2ApiState;

  private readonly rootDir: string;

  private readonly runtimeDir: string;

  private readonly configDir: string;

  private readonly dataDir: string;

  private readonly generatedDir: string;

  private readonly settingsPath: string;

  private readonly logPath: string;

  private readonly configPath: string;

  private readonly embedAdminToken: string;

  private adminWindow: BrowserWindow | null = null;

  constructor() {
    this.rootDir = app.getPath("userData");
    this.runtimeDir = join(this.rootDir, "adobe2api");
    this.configDir = join(this.runtimeDir, "config");
    this.dataDir = join(this.runtimeDir, "data");
    this.generatedDir = join(this.dataDir, "generated");
    this.settingsPath = join(this.runtimeDir, SETTINGS_FILE);
    this.logPath = join(this.runtimeDir, LOG_FILE);
    this.configPath = join(this.configDir, "config.json");
    this.embedAdminToken = randomUUID();

    this.ensureDirs();

    const settings = this.readSettings();
    this.state = this.buildState("stopped", settings);
  }

  private ensureDirs(): void {
    for (const dir of [
      this.runtimeDir,
      this.configDir,
      this.dataDir,
      this.generatedDir,
    ]) {
      mkdirSync(dir, { recursive: true });
    }
    if (!existsSync(this.configPath)) {
      writeFileSync(
        this.configPath,
        JSON.stringify(DEFAULT_CONFIG, null, 2),
        "utf-8",
      );
    }
  }

  private readSettings(): Adobe2ApiSettings {
    const fallback: PersistedConfig = {
      host: DEFAULT_HOST,
      port: DEFAULT_PORT,
      outputDir: null,
    };

    if (!existsSync(this.settingsPath)) {
      writeFileSync(
        this.settingsPath,
        JSON.stringify(fallback, null, 2),
        "utf-8",
      );
      return fallback;
    }

    try {
      const raw = JSON.parse(
        readFileSync(this.settingsPath, "utf-8"),
      ) as Partial<PersistedConfig>;
      return {
        host: normalizeHost(raw.host),
        port: clampPort(raw.port),
        outputDir: raw.outputDir || null,
      };
    } catch {
      return fallback;
    }
  }

  private writeSettings(settings: Adobe2ApiSettings): void {
    const payload: PersistedConfig = {
      host: normalizeHost(settings.host),
      port: clampPort(settings.port),
      outputDir: settings.outputDir || null,
    };
    writeFileSync(this.settingsPath, JSON.stringify(payload, null, 2), "utf-8");
  }

  private buildBaseUrl(settings: Adobe2ApiSettings): string {
    return `http://${settings.host}:${settings.port}`;
  }

  private readCurrentApiKey(): string | null {
    try {
      const raw = JSON.parse(readFileSync(this.configPath, "utf-8")) as {
        api_key?: string;
      };
      return raw.api_key?.trim() || null;
    } catch {
      return DEFAULT_CONFIG.api_key;
    }
  }

  private buildState(
    status: Adobe2ApiStatus,
    settings: Adobe2ApiSettings,
    overrides: Partial<Adobe2ApiState> = {},
  ): Adobe2ApiState {
    const baseUrl = this.buildBaseUrl(settings);
    const embeddedAdminUrl = `${baseUrl}${MANAGE_PATH}?electron_admin_token=${encodeURIComponent(
      this.embedAdminToken,
    )}`;
    return {
      status,
      settings,
      baseUrl,
      apiKey: overrides.apiKey ?? this.readCurrentApiKey(),
      manageUrl: embeddedAdminUrl,
      loginUrl: embeddedAdminUrl,
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

  private setState(
    status: Adobe2ApiStatus,
    overrides: Partial<Adobe2ApiState> = {},
  ): Adobe2ApiState {
    this.state = this.buildState(
      status,
      overrides.settings ?? this.state.settings,
      overrides,
    );
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

  private isEmbeddedPythonCommand(
    command: string,
    pythonRoot: string,
  ): boolean {
    return this.resolvePythonCandidates(pythonRoot).some(
      (candidate) => candidate === command,
    );
  }

  private buildEnv(
    settings: Adobe2ApiSettings,
    entry: { command: string; pythonRoot: string },
  ): NodeJS.ProcessEnv {
    const baseEnv: NodeJS.ProcessEnv = {
      ...process.env,
      PORT: String(settings.port),
      ADOBE2API_RUNTIME_DIR: this.runtimeDir,
      ADOBE_CONFIG_DIR: this.configDir,
      ADOBE_DATA_DIR: this.dataDir,
      ADOBE_PUBLIC_BASE_URL: this.buildBaseUrl(settings),
      ADOBE_OUTPUT_DIR: settings.outputDir || "",
      ADOBE_EMBED_ADMIN_TOKEN: this.embedAdminToken,
      PYTHONIOENCODING: "utf-8",
      PYTHONUTF8: "1",
    };

    if (!this.isEmbeddedPythonCommand(entry.command, entry.pythonRoot)) {
      return baseEnv;
    }

    const caBundlePath = this.resolveCaBundlePath(entry.pythonRoot);
    return {
      ...baseEnv,
      PYTHONHOME: entry.pythonRoot,
      SSL_CERT_FILE: caBundlePath,
      REQUESTS_CA_BUNDLE: caBundlePath,
      CURL_CA_BUNDLE: caBundlePath,
    };
  }

  private resolveAdobeRoot(): string {
    if (app.isPackaged) {
      return join(process.resourcesPath, "adobe2api-master");
    }
    return join(process.cwd(), "resources", "adobe2api-master");
  }

  private resolvePythonRoot(): string {
    return app.isPackaged
      ? join(process.resourcesPath, "python")
      : join(process.cwd(), "resources", "python");
  }

  private resolvePythonCandidates(pythonRoot: string): string[] {
    return process.platform === "win32"
      ? [
          join(pythonRoot, "python.exe"),
          join(pythonRoot, "Scripts", "python.exe"),
        ]
      : [join(pythonRoot, "bin", "python3"), join(pythonRoot, "bin", "python")];
  }

  private isEmbeddedPythonReady(command: string, pythonRoot: string): boolean {
    const readyMarker = join(pythonRoot, ".jike-adobe2api-python-ready");
    if (!existsSync(readyMarker) || !existsSync(command)) {
      return false;
    }

    try {
      const marker = JSON.parse(readFileSync(readyMarker, "utf-8")) as {
        version?: string;
      };
      if (
        typeof marker.version === "string" &&
        !marker.version.startsWith(
          `${REQUIRED_PYTHON_MAJOR}.${REQUIRED_PYTHON_MINOR}.`,
        )
      ) {
        return false;
      }
    } catch {
      return false;
    }

    const result = spawnSync(
      command,
      [
        "-c",
        [
          "import sys",
          `raise SystemExit(0 if sys.version_info[:2] == (${REQUIRED_PYTHON_MAJOR}, ${REQUIRED_PYTHON_MINOR}) else 1)`,
        ].join("\n"),
      ],
      {
        stdio: "ignore",
        windowsHide: true,
      },
    );
    return !result.error && result.status === 0;
  }

  private resolveBundledCaBundle(pythonRoot: string): string {
    if (process.platform === "win32") {
      return join(pythonRoot, "Lib", "site-packages", "certifi", "cacert.pem");
    }

    const libDir = join(pythonRoot, "lib");
    try {
      const pythonLib = readdirSync(libDir).find((entry) => {
        const candidate = join(
          libDir,
          entry,
          "site-packages",
          "certifi",
          "cacert.pem",
        );
        return entry.startsWith("python") && existsSync(candidate);
      });
      if (pythonLib) {
        return join(
          libDir,
          pythonLib,
          "site-packages",
          "certifi",
          "cacert.pem",
        );
      }
    } catch {
      // Fall through to the expected Python 3.13 layout for diagnostics.
    }

    return join(
      pythonRoot,
      "lib",
      "python3.13",
      "site-packages",
      "certifi",
      "cacert.pem",
    );
  }

  private resolveCaBundlePath(pythonRoot: string): string {
    const bundledCaBundle = this.resolveBundledCaBundle(pythonRoot);
    if (!existsSync(bundledCaBundle)) {
      return bundledCaBundle;
    }

    const baseDir =
      process.platform === "win32" && process.env.LOCALAPPDATA
        ? join(process.env.LOCALAPPDATA, "Jike", "adobe2api", "certs")
        : join(this.runtimeDir, "certs");
    const runtimeCaBundle = join(baseDir, "cacert.pem");

    try {
      mkdirSync(baseDir, { recursive: true });
      copyFileSync(bundledCaBundle, runtimeCaBundle);
      return runtimeCaBundle;
    } catch {
      return bundledCaBundle;
    }
  }

  private resolvePythonCommand(): string {
    const pythonRoot = this.resolvePythonRoot();
    const embeddedPythonCandidates = this.resolvePythonCandidates(pythonRoot);

    const embeddedPython = embeddedPythonCandidates.find((candidate) =>
      this.isEmbeddedPythonReady(candidate, pythonRoot),
    );
    if (embeddedPython) {
      return embeddedPython;
    }

    if (app.isPackaged) {
      throw new Error(
        `Embedded Python ${REQUIRED_PYTHON_MAJOR}.${REQUIRED_PYTHON_MINOR} runtime is missing or incomplete: ${pythonRoot}`,
      );
    }

    return "python";
  }

  private resolveEntrypoint(): {
    command: string;
    args: string[];
    cwd: string;
    pythonRoot: string;
  } {
    const adobeRoot = this.resolveAdobeRoot();
    const pythonRoot = this.resolvePythonRoot();
    return {
      command: this.resolvePythonCommand(),
      args: ["-X", "utf8", "app.py"],
      cwd: adobeRoot,
      pythonRoot,
    };
  }

  private buildStartupDiagnostics(entry: {
    command: string;
    args: string[];
    cwd: string;
    pythonRoot: string;
  }): string {
    const readyMarker = join(entry.pythonRoot, ".jike-adobe2api-python-ready");
    const pythonCandidates = this.resolvePythonCandidates(entry.pythonRoot);
    const lines = [
      `packaged=${app.isPackaged}`,
      `resourcesPath=${app.isPackaged ? process.resourcesPath : "dev"}`,
      `adobeRoot=${entry.cwd} exists=${existsSync(entry.cwd)}`,
      `entrypoint=${join(entry.cwd, "app.py")} exists=${existsSync(join(entry.cwd, "app.py"))}`,
      `pythonRoot=${entry.pythonRoot} exists=${existsSync(entry.pythonRoot)}`,
      `pythonReadyMarker=${readyMarker} exists=${existsSync(readyMarker)}`,
      `pythonCommand=${entry.command} exists=${existsSync(entry.command)}`,
      `caBundle=${this.resolveCaBundlePath(entry.pythonRoot)} exists=${existsSync(
        this.resolveCaBundlePath(entry.pythonRoot),
      )}`,
      `pythonCandidates=${pythonCandidates
        .map((candidate) => `${candidate}:${existsSync(candidate)}`)
        .join(", ")}`,
      `runtimeDir=${this.runtimeDir}`,
      `configDir=${this.configDir}`,
      `dataDir=${this.dataDir}`,
      `healthUrl=${this.state.healthUrl}`,
    ];
    return `[startup diagnostics]\n${lines.join("\n")}\n`;
  }

  private async waitForHealthy(timeoutMs = 30000): Promise<void> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (this.state.status === "error") {
        throw new Error(this.state.lastError || "Adobe2API start failed");
      }

      try {
        await fetchJson(this.state.healthUrl);
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    throw new Error("Adobe2API health check timed out");
  }

  async getState(): Promise<Adobe2ApiState> {
    await this.refreshRecentLogs();
    if (this.child && this.state.status !== "starting") {
      try {
        await fetchJson(this.state.healthUrl);
        return this.setState("running");
      } catch (error: any) {
        return this.setState("error", {
          lastError: error?.message || "Adobe2API unavailable",
        });
      }
    }
    try {
      await fetchJson(this.state.healthUrl);
      return this.setState("running", { pid: null });
    } catch {
      // 没有 Electron 托管的子进程，也没有可用的外部服务时，保留当前状态。
    }
    return this.setState(this.state.status);
  }

  async updateSettings(
    patch: Partial<Adobe2ApiSettings>,
  ): Promise<Adobe2ApiState> {
    const nextSettings: Adobe2ApiSettings = {
      host: normalizeHost(patch.host ?? this.state.settings.host),
      port: clampPort(patch.port ?? this.state.settings.port),
      outputDir:
        patch.outputDir === undefined
          ? this.state.settings.outputDir
          : patch.outputDir,
    };
    this.writeSettings(nextSettings);
    return this.setState(this.state.status, { settings: nextSettings });
  }

  async pickOutputDirectory(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "选择 Adobe2API 结果目录",
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  }

  async start(): Promise<Adobe2ApiState> {
    if (this.child && this.state.status === "running") {
      return this.getState();
    }

    this.ensureDirs();
    await mkdir(this.configDir, { recursive: true });

    try {
      await fetchJson(this.buildBaseUrl(this.state.settings) + HEALTH_PATH);
      return this.setState("running", {
        pid: null,
        lastError: null,
        lastExitCode: null,
      });
    } catch {
      // 端口上没有已启动的 Adobe2API，继续拉起本地服务。
    }

    this.setState("starting", {
      lastError: null,
      lastExitCode: null,
      startedAt: Date.now(),
    });
    const entry = this.resolveEntrypoint();
    const env = this.buildEnv(this.state.settings, entry);
    await appendFile(
      this.logPath,
      `\n[${new Date().toISOString()}] starting adobe2api...\n${this.buildStartupDiagnostics(entry)}`,
      "utf-8",
    );

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
      void this.appendLog(`[spawn error] ${error.message}\n`);
      this.setState("error", {
        lastError: error.message,
        pid: null,
      });
    });
    this.child.on("exit", (code) => {
      this.child = null;
      if (code !== 0) {
        void this.appendLog(
          `[process exit] Adobe2API exited with code ${code ?? "unknown"}\n`,
        );
      }
      this.setState(code === 0 ? "stopped" : "error", {
        lastExitCode: code ?? null,
        pid: null,
        lastError:
          code === 0 ? null : `Adobe2API exited with code ${code ?? "unknown"}`,
      });
    });

    this.setState("starting", { pid: this.child.pid ?? null });

    try {
      await this.waitForHealthy();
      return this.setState("running");
    } catch (error: any) {
      this.setState("error", {
        lastError: error?.message || "Adobe2API start failed",
      });
      throw error;
    }
  }

  async stop(): Promise<Adobe2ApiState> {
    if (!this.child) {
      return this.setState("stopped", { pid: null });
    }

    const target = this.child;
    await this.appendLog(
      `\n[${new Date().toISOString()}] stopping adobe2api...\n`,
    );
    target.kill();
    this.child = null;
    return this.setState("stopped", { pid: null });
  }

  async restart(): Promise<Adobe2ApiState> {
    await this.stop();
    return this.start();
  }

  async openAdminWindow(): Promise<Adobe2ApiState> {
    const state =
      this.state.status === "running"
        ? await this.getState()
        : await this.start();

    if (this.adminWindow && !this.adminWindow.isDestroyed()) {
      this.adminWindow.show();
      this.adminWindow.focus();
      await this.adminWindow.loadURL(state.manageUrl);
      return state;
    }

    this.adminWindow = new BrowserWindow({
      title: "Adobe2API 管理后台",
      width: 1280,
      height: 860,
      minWidth: 980,
      minHeight: 680,
      autoHideMenuBar: true,
      webPreferences: {
        sandbox: false,
        webSecurity: false,
      },
    });

    this.adminWindow.on("closed", () => {
      this.adminWindow = null;
    });
    this.adminWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: "deny" };
    });
    await this.adminWindow.loadURL(state.manageUrl);
    return state;
  }

  async getLogs(limit = 200): Promise<string[]> {
    await this.refreshRecentLogs(limit);
    return this.state.recentLogs.slice(-limit);
  }
}

export const adobe2ApiService = new Adobe2ApiService();
