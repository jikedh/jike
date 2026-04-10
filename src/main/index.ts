import { app, shell, BrowserWindow, ipcMain, dialog } from "electron";
import { join, dirname, normalize } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  readdirSync,
  statSync,
  renameSync,
} from "fs";
import { autoUpdater } from "electron-updater";
// @ts-ignore
import icon from "../../resources/icon.png?asset";

let mainWindow: BrowserWindow | null = null;

function setupAutoUpdater(): void {
  // 如果不是安装包运行或者平台不是 Windows，则不启用自动更新功能
  if (!app.isPackaged || process.platform !== "win32") {
    return;
  }

  autoUpdater.autoDownload = true;

  autoUpdater.on("checking-for-update", () => {
    console.log("[autoUpdater] Checking for updates...");
  });

  autoUpdater.on("update-available", (info) => {
    console.log(`[autoUpdater] Update available: ${info.version}`);
  });

  autoUpdater.on("update-not-available", () => {
    console.log("[autoUpdater] No updates available");
  });

  autoUpdater.on("download-progress", (progress) => {
    console.log(
      `[autoUpdater] Download progress: ${progress.percent.toFixed(2)}%`,
    );
  });

  autoUpdater.on("update-downloaded", async (info) => {
    console.log(`[autoUpdater] Update downloaded: ${info.version}`);

    if (!mainWindow) {
      autoUpdater.quitAndInstall();
      return;
    }

    const result = await dialog.showMessageBox(mainWindow, {
      type: "info",
      buttons: ["稍后重启", "立即重启"],
      defaultId: 1,
      cancelId: 0,
      title: "发现新版本",
      message: `新版本 ${info.version} 已下载完成`,
      detail: "重启后将自动完成更新安装。",
    });

    if (result.response === 1) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on("error", (error) => {
    console.error("[autoUpdater] Update error:", error);
  });

  void autoUpdater.checkForUpdates();
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    title: "即刻",
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false,
      webSecurity: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
    if (is.dev) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

function setupIpcHandlers(): void {
  ipcMain.handle("storage:selectDirectory", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openDirectory", "createDirectory"],
      title: "选择项目存储路径",
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle(
    "storage:ensureProjectDir",
    async (_, basePath: string, projectName: string) => {
      const projectDir = normalize(join(basePath, projectName));
      const audioDir = join(projectDir, "audio");

      try {
        if (!existsSync(projectDir)) {
          mkdirSync(projectDir, { recursive: true });
        }
        if (!existsSync(audioDir)) {
          mkdirSync(audioDir, { recursive: true });
        }
        return { success: true, path: projectDir };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle(
    "storage:writeJson",
    async (_, filePath: string, data: any) => {
      try {
        const normalizedPath = normalize(filePath);
        const dir = dirname(normalizedPath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(normalizedPath, JSON.stringify(data, null, 2), "utf-8");
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle("storage:readJson", async (_, filePath: string) => {
    try {
      const normalizedPath = normalize(filePath);
      if (!existsSync(normalizedPath)) {
        return { success: false, error: "File not found", data: null };
      }
      const content = readFileSync(normalizedPath, "utf-8");
      return { success: true, data: JSON.parse(content) };
    } catch (error: any) {
      return { success: false, error: error.message, data: null };
    }
  });

  ipcMain.handle(
    "storage:writeFile",
    async (_, filePath: string, buffer: ArrayBuffer) => {
      try {
        const normalizedPath = normalize(filePath);
        const dir = dirname(normalizedPath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(normalizedPath, Buffer.from(buffer));
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle("storage:readFile", async (_, filePath: string) => {
    try {
      const normalizedPath = normalize(filePath);
      if (!existsSync(normalizedPath)) {
        return { success: false, error: "File not found", data: null };
      }
      const content = readFileSync(normalizedPath);
      return { success: true, data: content };
    } catch (error: any) {
      return { success: false, error: error.message, data: null };
    }
  });

  ipcMain.handle("storage:deleteFile", async (_, filePath: string) => {
    try {
      const normalizedPath = normalize(filePath);
      if (existsSync(normalizedPath)) {
        unlinkSync(normalizedPath);
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("storage:deleteFolder", async (_, folderPath: string) => {
    try {
      const normalizedPath = normalize(folderPath);
      if (existsSync(normalizedPath)) {
        const { rmSync } = require("fs");
        rmSync(normalizedPath, { recursive: true, force: true });
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("storage:fileExists", async (_, filePath: string) => {
    return existsSync(normalize(filePath));
  });

  ipcMain.handle("storage:listFiles", async (_, dirPath: string) => {
    try {
      const normalizedPath = normalize(dirPath);
      if (!existsSync(normalizedPath)) {
        return { success: true, files: [] };
      }
      const files = readdirSync(normalizedPath).map((name) => {
        const fullPath = join(normalizedPath, name);
        const stats = statSync(fullPath);
        return {
          name,
          path: fullPath,
          isDirectory: stats.isDirectory(),
          size: stats.size,
          modifiedAt: stats.mtimeMs,
        };
      });
      return { success: true, files };
    } catch (error: any) {
      return { success: false, error: error.message, files: [] };
    }
  });

  ipcMain.handle(
    "storage:downloadFile",
    async (_, url: string, destPath: string) => {
      try {
        const normalizedPath = normalize(destPath);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const dir = dirname(normalizedPath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(normalizedPath, Buffer.from(arrayBuffer));
        return { success: true, path: normalizedPath };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle(
    "storage:renameDirectory",
    async (_, oldPath: string, newPath: string) => {
      try {
        const normalizedOldPath = normalize(oldPath);
        const normalizedNewPath = normalize(newPath);

        if (!existsSync(normalizedOldPath)) {
          return { success: false, error: "Source directory does not exist" };
        }

        if (existsSync(normalizedNewPath)) {
          return { success: false, error: "Target directory already exists" };
        }

        const parentDir = dirname(normalizedNewPath);
        if (!existsSync(parentDir)) {
          mkdirSync(parentDir, { recursive: true });
        }

        renameSync(normalizedOldPath, normalizedNewPath);

        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle(
    "storage:migrateProjects",
    async (_, oldPath: string, newPath: string) => {
      try {
        const normalizedOldPath = normalize(oldPath);
        const normalizedNewPath = normalize(newPath);

        if (!existsSync(normalizedOldPath)) {
          return {
            success: true,
            message: "Old path does not exist, nothing to migrate",
          };
        }

        if (!existsSync(normalizedNewPath)) {
          mkdirSync(normalizedNewPath, { recursive: true });
        }

        const entries = readdirSync(normalizedOldPath, { withFileTypes: true });
        let migratedCount = 0;

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const projectDir = join(normalizedOldPath, entry.name);
            const canvasFile = join(projectDir, "canvas.json");

            if (existsSync(canvasFile)) {
              const destDir = join(normalizedNewPath, entry.name);

              if (!existsSync(destDir)) {
                mkdirSync(destDir, { recursive: true });

                const subEntries = readdirSync(projectDir, {
                  withFileTypes: true,
                });
                for (const subEntry of subEntries) {
                  const srcPath = join(projectDir, subEntry.name);
                  const destPath = join(destDir, subEntry.name);

                  if (subEntry.isDirectory()) {
                    mkdirSync(destPath, { recursive: true });
                    const files = readdirSync(srcPath);
                    for (const file of files) {
                      const srcFile = join(srcPath, file);
                      const destFile = join(destPath, file);
                      const content = readFileSync(srcFile);
                      writeFileSync(destFile, content);
                    }
                  } else {
                    const content = readFileSync(srcPath);
                    writeFileSync(destPath, content);
                  }
                }
                migratedCount++;
              }
            }
          }
        }

        return { success: true, migratedCount };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle("storage:getDefaultPath", async () => {
    return join(app.getPath("documents"), "jike-projects");
  });

  // 切换 Electron 开发者工具面板
  ipcMain.handle("debug:toggleDevTools", async () => {
    if (!mainWindow?.webContents) {
      return { success: false, error: "Main window not found" };
    }

    mainWindow.webContents.toggleDevTools();
    return { success: true };
  });

  // 检查是否为开发环境
  ipcMain.handle("debug:isDev", async () => {
    return is.dev;
  });
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.electron");

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  setupIpcHandlers();

  createWindow();
  setupAutoUpdater();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
