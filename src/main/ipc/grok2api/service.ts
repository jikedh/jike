import {
  type ChildProcessWithoutNullStreams,
  spawn,
  spawnSync,
} from "child_process";
import { app, BrowserWindow, shell } from "electron";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { appendFile, readFile } from "fs/promises";
import { createServer } from "net";
import { join } from "path";
import type {
  Grok2ApiSettings,
  Grok2ApiState,
  Grok2ApiStatus,
} from "shared/types/grok2api";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8000;
const SETTINGS_FILE = "settings.json";
const LOG_FILE = "grok2api.log";
const HEALTH_PATH = "/v1/models";
const MANAGE_PATH = "/admin/account";
const LOGIN_PATH = "/admin/login";

type PersistedConfig = {
  host: string;
  port: number;
  projectPath?: string | null;
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

function normalizeProxyUrl(value: string | null | undefined): string | null {
  const candidate = (value || "").trim();
  if (!candidate) {
    return null;
  }
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)
    ? candidate
    : `http://${candidate}`;
}

function escapeTomlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function fetchJson(url: string, apiKey?: string | null): Promise<any> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
  });
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  return response.json();
}

export class Grok2ApiService {
  private child: ChildProcessWithoutNullStreams | null = null;

  private state: Grok2ApiState;

  private readonly rootDir: string;

  private readonly runtimeDir: string;

  private readonly dataDir: string;

  private readonly logsDir: string;

  private readonly settingsPath: string;

  private readonly logPath: string;

  private adminWindow: BrowserWindow | null = null;

  constructor() {
    this.rootDir = app.getPath("userData");
    this.runtimeDir = join(this.rootDir, "grok2api");
    this.dataDir = join(this.runtimeDir, "data");
    this.logsDir = join(this.runtimeDir, "logs");
    this.settingsPath = join(this.runtimeDir, SETTINGS_FILE);
    this.logPath = join(this.runtimeDir, LOG_FILE);

    this.ensureDirs();

    const settings = this.readSettings();
    this.state = this.buildState("stopped", settings);
  }

  private ensureDirs(): void {
    for (const dir of [this.runtimeDir, this.dataDir, this.logsDir]) {
      mkdirSync(dir, { recursive: true });
    }
  }

  private readSettings(): Grok2ApiSettings {
    const fallback: Grok2ApiSettings = {
      host: DEFAULT_HOST,
      port: DEFAULT_PORT,
      projectPath: null,
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
      const settings: Grok2ApiSettings = {
        host: normalizeHost(raw.host),
        port: clampPort(raw.port),
        projectPath: null,
      };
      if (
        raw.host !== settings.host ||
        raw.port !== settings.port ||
        raw.projectPath
      ) {
        writeFileSync(
          this.settingsPath,
          JSON.stringify(settings, null, 2),
          "utf-8",
        );
      }
      return settings;
    } catch {
      return fallback;
    }
  }

  private writeSettings(settings: Grok2ApiSettings): void {
    const payload: Grok2ApiSettings = {
      host: normalizeHost(settings.host),
      port: clampPort(settings.port),
      projectPath: null,
    };
    writeFileSync(this.settingsPath, JSON.stringify(payload, null, 2), "utf-8");
  }

  private buildBaseUrl(settings: Grok2ApiSettings): string {
    return `http://${settings.host}:${settings.port}`;
  }

  private readCurrentApiKey(): string | null {
    const configPath = join(this.dataDir, "config.toml");
    if (!existsSync(configPath)) {
      return null;
    }

    try {
      const content = readFileSync(configPath, "utf-8");
      const match = content.match(/^\s*api_key\s*=\s*["']([^"']*)["']/m);
      return match?.[1]?.trim() || null;
    } catch {
      return null;
    }
  }

  private buildState(
    status: Grok2ApiStatus,
    settings: Grok2ApiSettings,
    overrides: Partial<Grok2ApiState> = {},
  ): Grok2ApiState {
    const baseUrl = this.buildBaseUrl(settings);
    return {
      status,
      settings,
      resolvedProjectPath:
        overrides.resolvedProjectPath ?? this.resolveAvailableGrokRoot(),
      baseUrl,
      apiKey: overrides.apiKey ?? this.readCurrentApiKey(),
      manageUrl: `${baseUrl}${MANAGE_PATH}`,
      loginUrl: `${baseUrl}${LOGIN_PATH}`,
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
    status: Grok2ApiStatus,
    overrides: Partial<Grok2ApiState> = {},
  ): Grok2ApiState {
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

  private resolveBundledGrokRoot(): string {
    return app.isPackaged
      ? join(process.resourcesPath, "grok2api-main")
      : join(process.cwd(), "resources", "grok2api-main");
  }

  private hasGrokEntrypoint(root: string): boolean {
    return existsSync(join(root, "app", "main.py"));
  }

  private resolveAvailableGrokRoot(): string | null {
    const bundledRoot = this.resolveBundledGrokRoot();
    if (this.hasGrokEntrypoint(bundledRoot)) {
      return bundledRoot;
    }

    return null;
  }

  private resolveGrokRoot(): string {
    const root = this.resolveAvailableGrokRoot();
    if (root) {
      return root;
    }
    throw new Error(
      `Grok2API 资源目录不存在，请确认已放到 ${this.resolveBundledGrokRoot()}`,
    );
  }

  private resolvePythonCommand(grokRoot: string): string {
    const venvPython =
      process.platform === "win32"
        ? join(grokRoot, ".venv", "Scripts", "python.exe")
        : join(grokRoot, ".venv", "bin", "python");
    if (existsSync(venvPython)) {
      return venvPython;
    }

    return process.platform === "win32" ? "python" : "python3";
  }

  private resolveBundledCaBundle(grokRoot: string): string | null {
    const candidates =
      process.platform === "win32"
        ? [
            join(
              grokRoot,
              ".venv",
              "Lib",
              "site-packages",
              "certifi",
              "cacert.pem",
            ),
          ]
        : [];

    const unixLibDir = join(grokRoot, ".venv", "lib");
    try {
      for (const entry of readdirSync(unixLibDir)) {
        candidates.push(
          join(
            unixLibDir,
            entry,
            "site-packages",
            "certifi",
            "cacert.pem",
          ),
        );
      }
    } catch {
      // Windows dev installs do not have .venv/lib; keep the explicit candidates.
    }

    return candidates.find((candidate) => existsSync(candidate)) ?? null;
  }

  private resolveRuntimeCaBundle(grokRoot: string): string | null {
    const sourceCaBundle = this.resolveBundledCaBundle(grokRoot);
    if (!sourceCaBundle) {
      return null;
    }

    const certDir =
      process.platform === "win32" && process.env.LOCALAPPDATA
        ? join(process.env.LOCALAPPDATA, "Jike", "grok2api", "certs")
        : join(this.runtimeDir, "certs");
    const runtimeCaBundle = join(certDir, "cacert.pem");

    try {
      mkdirSync(certDir, { recursive: true });
      copyFileSync(sourceCaBundle, runtimeCaBundle);
      return runtimeCaBundle;
    } catch {
      return sourceCaBundle;
    }
  }

  private resolveEntrypoint(): {
    command: string;
    args: string[];
    cwd: string;
  } {
    const grokRoot = this.resolveGrokRoot();
    return {
      command: this.resolvePythonCommand(grokRoot),
      args: [
        "-X",
        "utf8",
        "-m",
        "granian",
        "--interface",
        "asgi",
        "--host",
        this.state.settings.host,
        "--port",
        String(this.state.settings.port),
        "--workers",
        "1",
        "app.main:app",
      ],
      cwd: grokRoot,
    };
  }

  private buildEnv(
    settings: Grok2ApiSettings,
    entry: { cwd: string },
  ): NodeJS.ProcessEnv {
    const caBundlePath = this.resolveRuntimeCaBundle(entry.cwd);
    const proxyUrl = this.resolveSystemProxyUrl();
    const pythonPath = process.env.PYTHONPATH
      ? `${entry.cwd}${process.platform === "win32" ? ";" : ":"}${process.env.PYTHONPATH}`
      : entry.cwd;
    return {
      ...process.env,
      TZ: "Asia/Shanghai",
      LOG_LEVEL: "INFO",
      LOG_FILE_ENABLED: "true",
      SERVER_HOST: settings.host,
      SERVER_PORT: String(settings.port),
      SERVER_WORKERS: "1",
      HOST_PORT: String(settings.port),
      ACCOUNT_STORAGE: "local",
      DATA_DIR: this.dataDir,
      LOG_DIR: this.logsDir,
      CONFIG_LOCAL_PATH: join(this.dataDir, "config.toml"),
      GROK_APP_APP_URL: this.buildBaseUrl(settings),
      GROK_FEATURES_VIDEO_FORMAT: "local_url",
      ...(proxyUrl
        ? {
            GROK_PROXY_EGRESS_MODE: "single_proxy",
            GROK_PROXY_EGRESS_PROXY_URL: proxyUrl,
            GROK_PROXY_EGRESS_RESOURCE_PROXY_URL: proxyUrl,
          }
        : {}),
      ...(caBundlePath
        ? {
            SSL_CERT_FILE: caBundlePath,
            REQUESTS_CA_BUNDLE: caBundlePath,
            CURL_CA_BUNDLE: caBundlePath,
          }
        : {}),
      PYTHONIOENCODING: "utf-8",
      PYTHONUTF8: "1",
      PYTHONPATH: pythonPath,
    };
  }

  private ensureRuntimeProxyConfig(proxyUrl: string | null): void {
    const configPath = join(this.dataDir, "config.toml");
    if (!existsSync(configPath)) {
      return;
    }

    try {
      const content = readFileSync(configPath, "utf-8");
      const nextContent = this.patchRuntimeConfig(
        content,
        proxyUrl,
        this.buildBaseUrl(this.state.settings),
      );
      if (nextContent !== content) {
        writeFileSync(configPath, nextContent, "utf-8");
      }
    } catch {
      // Grok2API can still use environment overrides if the editable config
      // cannot be updated.
    }
  }

  private patchRuntimeConfig(
    content: string,
    proxyUrl: string | null,
    appUrl: string,
  ): string {
    const normalizedContent = content.replace(/^\uFEFF/, "");
    return this.patchVideoOutputConfig(
      this.patchAppUrlConfig(
        this.patchProxyConfig(normalizedContent, proxyUrl),
        appUrl,
      ),
    );
  }

  private patchAppUrlConfig(content: string, appUrl: string): string {
    return this.patchTomlSectionValue(content, "app", "app_url", appUrl);
  }

  private patchVideoOutputConfig(content: string): string {
    return this.patchTomlSectionValue(
      content,
      "features",
      "video_format",
      "local_url",
    );
  }

  private patchTomlSectionValue(
    content: string,
    section: string,
    key: string,
    value: string,
  ): string {
    const escapedValue = escapeTomlString(value);
    const sectionPattern = new RegExp(
      `^\\s*\\[${section.replace(/\./g, "\\.")}\\]\\s*$`,
    );
    const keyPattern = new RegExp(`^\\s*${key}\\s*=`);
    const lines = content.split(/\r?\n/);
    let inSection = false;
    let hasSection = false;
    let touchedKey = false;

    const output = lines.map((line) => {
      if (/^\s*\[/.test(line)) {
        inSection = sectionPattern.test(line);
        if (inSection) {
          hasSection = true;
        }
      }
      if (inSection && keyPattern.test(line)) {
        touchedKey = true;
        return `${key} = "${escapedValue}"`;
      }
      return line;
    });

    if (hasSection) {
      if (!touchedKey) {
        const sectionStart = output.findIndex((line) => sectionPattern.test(line));
        const insertAt = output.findIndex(
          (line, index) => index > sectionStart && /^\s*\[/.test(line),
        );
        output.splice(
          insertAt > -1 ? insertAt : output.length,
          0,
          `${key} = "${escapedValue}"`,
        );
      }
      return output.join("\n");
    }

    return [
      content.trimEnd(),
      "",
      `[${section}]`,
      `${key} = "${escapedValue}"`,
      "",
    ].join("\n");
  }

  private patchProxyConfig(content: string, proxyUrl: string | null): string {
    const mode = proxyUrl ? "single_proxy" : "direct";
    const proxyValue = proxyUrl ? escapeTomlString(proxyUrl) : "";
    const lines = content.split(/\r?\n/);
    let inProxyEgress = false;
    let touchedMode = false;
    let touchedProxyUrl = false;
    let touchedResourceProxyUrl = false;

    const output = lines.map((line) => {
      if (/^\s*\[/.test(line)) {
        inProxyEgress = /^\s*\[proxy\.egress\]\s*$/.test(line);
      }
      if (!inProxyEgress) {
        return line;
      }
      if (/^\s*mode\s*=/.test(line)) {
        touchedMode = true;
        return `mode = "${mode}"`;
      }
      if (/^\s*proxy_url\s*=/.test(line)) {
        touchedProxyUrl = true;
        return `proxy_url = "${proxyValue}"`;
      }
      if (/^\s*resource_proxy_url\s*=/.test(line)) {
        touchedResourceProxyUrl = true;
        return `resource_proxy_url = "${proxyValue}"`;
      }
      return line;
    });

    if (content.includes("[proxy.egress]")) {
      const insertAt = output.findIndex((line, index) => {
        if (index === 0) {
          return false;
        }
        return /^\s*\[/.test(line) && output[index - 1] !== "[proxy.egress]";
      });
      const patchLines = [
        touchedMode ? null : `mode = "${mode}"`,
        touchedProxyUrl ? null : `proxy_url = "${proxyValue}"`,
        touchedResourceProxyUrl ? null : `resource_proxy_url = "${proxyValue}"`,
      ].filter(Boolean) as string[];
      if (patchLines.length > 0) {
        output.splice(insertAt > -1 ? insertAt : output.length, 0, ...patchLines);
      }
      return output.join("\n");
    }

    return [
      content.trimEnd(),
      "",
      "[proxy.egress]",
      `mode = "${mode}"`,
      `proxy_url = "${proxyValue}"`,
      `resource_proxy_url = "${proxyValue}"`,
      "",
    ].join("\n");
  }

  private resolveSystemProxyUrl(): string | null {
    const envProxy =
      process.env.HTTPS_PROXY ||
      process.env.https_proxy ||
      process.env.HTTP_PROXY ||
      process.env.http_proxy;
    const normalizedEnvProxy = normalizeProxyUrl(envProxy);
    if (normalizedEnvProxy) {
      return normalizedEnvProxy;
    }

    if (process.platform !== "win32") {
      return null;
    }

    try {
      const registryPath =
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";
      const query = spawnSync("reg", [
        "query",
        registryPath,
        "/v",
        "ProxyEnable",
      ]);
      const enabled = query.stdout
        .toString("utf8")
        .match(/ProxyEnable\s+REG_DWORD\s+0x1/i);
      if (!enabled) {
        return null;
      }

      const proxyQuery = spawnSync("reg", [
        "query",
        registryPath,
        "/v",
        "ProxyServer",
      ]);
      const match = proxyQuery.stdout
        .toString("utf8")
        .match(/ProxyServer\s+REG_SZ\s+(.+)\s*$/im);
      const rawProxy = match?.[1]?.trim();
      if (!rawProxy) {
        return null;
      }

      const httpProxy =
        rawProxy
          .split(";")
          .map((part) => part.trim())
          .find((part) => /^https?=/i.test(part))
          ?.replace(/^https?=/i, "") || rawProxy;
      return normalizeProxyUrl(httpProxy);
    } catch {
      return null;
    }
  }

  private buildStartupDiagnostics(entry: {
    command: string;
    args: string[];
    cwd: string;
  }): string {
    const lines = [
      `packaged=${app.isPackaged}`,
      `resourcesPath=${app.isPackaged ? process.resourcesPath : "dev"}`,
      `grokRoot=${entry.cwd} exists=${existsSync(entry.cwd)}`,
      `entrypoint=${join(entry.cwd, "app", "main.py")} exists=${existsSync(
        join(entry.cwd, "app", "main.py"),
      )}`,
      `pythonCommand=${entry.command} exists=${existsSync(entry.command)}`,
      `caBundle=${this.resolveRuntimeCaBundle(entry.cwd) ?? ""}`,
      `runtimeDir=${this.runtimeDir}`,
      `dataDir=${this.dataDir}`,
      `logsDir=${this.logsDir}`,
      `healthUrl=${this.state.healthUrl}`,
    ];
    return `[startup diagnostics]\n${lines.join("\n")}\n`;
  }

  private async assertPortAvailable(settings: Grok2ApiSettings): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const server = createServer();
      server.once("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") {
          reject(
            new Error(
              `Grok2API 端口 ${settings.host}:${settings.port} 已被占用，请先停止旧的 Grok2API 服务或修改端口`,
            ),
          );
          return;
        }
        reject(error);
      });
      server.once("listening", () => {
        server.close(() => resolve());
      });
      server.listen(settings.port, settings.host);
    });
  }

  private async waitForHealthy(timeoutMs = 30000): Promise<void> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (!this.child || this.child.exitCode !== null) {
        throw new Error("Grok2API start failed");
      }

      if (this.state.status === "error") {
        throw new Error(this.state.lastError || "Grok2API start failed");
      }

      try {
        await fetchJson(this.state.healthUrl, this.state.apiKey);
        if (!this.child || this.child.exitCode !== null) {
          throw new Error("Grok2API start failed");
        }
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    throw new Error("Grok2API health check timed out");
  }

  async getState(): Promise<Grok2ApiState> {
    await this.refreshRecentLogs();
    if (this.child && this.state.status !== "starting") {
      try {
        await fetchJson(this.state.healthUrl, this.state.apiKey);
        return this.setState("running");
      } catch (error: any) {
        return this.setState("error", {
          lastError: error?.message || "Grok2API unavailable",
        });
      }
    }
    if (this.state.status === "running") {
      return this.setState("stopped", { pid: null });
    }
    return this.setState(this.state.status, { pid: null });
  }

  async updateSettings(
    patch: Partial<Grok2ApiSettings>,
  ): Promise<Grok2ApiState> {
    const nextSettings: Grok2ApiSettings = {
      host: normalizeHost(patch.host ?? this.state.settings.host),
      port: clampPort(patch.port ?? this.state.settings.port),
      projectPath: null,
    };
    this.writeSettings(nextSettings);
    return this.setState(this.state.status, { settings: nextSettings });
  }

  async start(): Promise<Grok2ApiState> {
    if (this.child && this.state.status === "running") {
      return this.getState();
    }

    this.ensureDirs();

    const entry = this.resolveEntrypoint();
    if (!existsSync(entry.cwd)) {
      const message = `Grok2API 项目目录不存在：${entry.cwd}`;
      this.setState("error", { lastError: message });
      throw new Error(message);
    }
    this.ensureRuntimeProxyConfig(this.resolveSystemProxyUrl());

    try {
      await this.assertPortAvailable(this.state.settings);
    } catch (error: any) {
      const message = error?.message || "Grok2API 端口不可用";
      this.setState("error", { lastError: message });
      throw new Error(message);
    }

    this.setState("starting", {
      lastError: null,
      lastExitCode: null,
      startedAt: Date.now(),
    });

    await appendFile(
      this.logPath,
      `\n[${new Date().toISOString()}] starting grok2api...\n${this.buildStartupDiagnostics(entry)}`,
      "utf-8",
    );

    this.child = spawn(entry.command, entry.args, {
      cwd: entry.cwd,
      env: this.buildEnv(this.state.settings, entry),
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
          `[process exit] Grok2API exited with code ${code ?? "unknown"}\n`,
        );
      }
      this.setState(code === 0 ? "stopped" : "error", {
        lastExitCode: code ?? null,
        pid: null,
        lastError:
          code === 0 ? null : `Grok2API exited with code ${code ?? "unknown"}`,
      });
    });

    this.setState("starting", { pid: this.child.pid ?? null });

    try {
      await this.waitForHealthy();
      return this.setState("running");
    } catch (error: any) {
      this.setState("error", {
        lastError: error?.message || "Grok2API start failed",
      });
      throw error;
    }
  }

  async stop(): Promise<Grok2ApiState> {
    if (!this.child) {
      return this.setState("stopped", { pid: null });
    }

    const target = this.child;
    await this.appendLog(
      `\n[${new Date().toISOString()}] stopping grok2api...\n`,
    );
    target.kill();
    this.child = null;
    return this.setState("stopped", { pid: null });
  }

  async restart(): Promise<Grok2ApiState> {
    await this.stop();
    return this.start();
  }

  async openAdminWindow(): Promise<Grok2ApiState> {
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
      title: "Grok2API 管理后台",
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

export const grok2ApiService = new Grok2ApiService();
