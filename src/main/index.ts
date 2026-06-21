import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { app, BrowserWindow, dialog, shell } from "electron";
import { autoUpdater } from "electron-updater";
import { mkdirSync } from "fs";
import { join } from "path";
// @ts-ignore
import icon from "../../resources/icon.png?asset";
/**
 * main 层：只做编排，不做业务细节
 * 1. 创建窗口
 * 2. 注册 IPC（委托给模块）
 * 3. 启动 updater
 *
 * 其余全部下沉到模块（ipc/storage、ipc/debug）
 */

// 导入 IPC handlers
import {
  registerDebugHandlers,
  registerDatabaseHandlers,
  registerDownloadHandlers,
  registerStorageHandlers,
  registerTrackingHandlers,
  registerTrayHandlers,
  registerVideoProcessingHandlers,
  registerNotificationHandlers
} from "./ipc";
import { createTray, destroyTray, isTrayActive, setTrayMainWindow } from "./ipc/tray/service";

let mainWindow: BrowserWindow | null = null;

function configureRuntimePaths(): void {
  const userDataPath = app.getPath("userData");
  const sessionDataPath = join(userDataPath, "session-data");
  const cachePath = join(sessionDataPath, "Cache");

  mkdirSync(cachePath, { recursive: true });
  app.setPath("sessionData", sessionDataPath);
  app.commandLine.appendSwitch("disk-cache-dir", cachePath);
}

function setupAutoUpdater(): void {
  // 如果不是安装包运行或者平台不是 Windows，则不启用自动更新功能
  if (!app.isPackaged || process.platform !== "win32") {
    return;
  }

  autoUpdater.autoDownload = true;

  autoUpdater.on("checking-for-update", () => { });

  autoUpdater.on("update-available", (info) => { });

  autoUpdater.on("update-not-available", () => { });

  autoUpdater.on("download-progress", (progress) => { });

  autoUpdater.on("update-downloaded", async (info) => {
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

configureRuntimePaths();

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
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

  // 注册 IPC handlers
  registerStorageHandlers();
  registerDatabaseHandlers();
  registerDebugHandlers();
  registerDownloadHandlers();
  registerTrackingHandlers();
  registerTrayHandlers();
  registerVideoProcessingHandlers();
  registerNotificationHandlers();

  createTray();
  setTrayMainWindow(mainWindow);
}

app.on("second-instance", () => {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
});

if (gotSingleInstanceLock) {
  app.whenReady().then(() => {
    electronApp.setAppUserModelId("com.electron");

    app.on("browser-window-created", (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    createWindow();
    setupAutoUpdater();

    app.on("activate", function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  // 当托盘存在时，关闭窗口不退出应用（托盘菜单提供退出入口）
  if (isTrayActive()) return;
  app.quit();
});

app.on("before-quit", () => {
  destroyTray();
});
