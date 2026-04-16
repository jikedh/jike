import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { app, BrowserWindow, shell } from "electron";
import { join } from "path";
import {
  APP_ID,
  joinIconPath,
  PACKAGED_PRELOAD_SEGMENTS,
  RENDERER_HTML_SEGMENTS,
  WINDOW_TITLE,
} from "../constants/app";
import {
  registerDebugHandlers,
  registerDownloadHandlers,
  registerStorageHandlers,
} from "../ipc";

const getAppIconPath = () => {
  return joinIconPath(process.resourcesPath);
};

const getPreloadPath = () => {
  if (app.isPackaged) {
    return join(process.resourcesPath, ...PACKAGED_PRELOAD_SEGMENTS);
  }

  return join(__dirname, "../preload/index.js");
};

const getRendererHtmlPath = () => {
  return join(__dirname, ...RENDERER_HTML_SEGMENTS);
};

/**
 * 主窗口实例。
 * 这里集中维护窗口引用，避免入口文件分散管理窗口生命周期。
 */
let mainWindow: BrowserWindow | null = null;

/**
 * 注册所有主进程 IPC 通道。
 * 主进程入口仅负责编排，具体能力继续下沉到各领域模块。
 */
const registerIpcHandlers = () => {
  registerStorageHandlers();
  registerDebugHandlers();
  registerDownloadHandlers();
};

const loadMainWindow = async (window: BrowserWindow) => {
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    await window.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    return;
  }

  await window.loadFile(getRendererHtmlPath());
};

/**
 * 创建主窗口。
 * 这里统一处理窗口配置、开发环境调试能力以及页面加载逻辑。
 */
const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    title: WINDOW_TITLE,
    show: false,
    autoHideMenuBar: true,
    icon: getAppIconPath(),
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.maximize();
    mainWindow?.show();

    if (is.dev) {
      mainWindow?.webContents.openDevTools();
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  void loadMainWindow(mainWindow);
  return mainWindow;
};

/**
 * 初始化 Electron 应用生命周期。
 * 包含 app ready、窗口创建、快捷键支持、自动更新与激活行为。
 */
export const initializeApp = () => {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  app.whenReady().then(() => {
    electronApp.setAppUserModelId(APP_ID);

    app.on("browser-window-created", (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    registerIpcHandlers();
    createMainWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  app.on("second-instance", () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
};

/**
 * 提供给其他模块读取当前主窗口引用。
 */
export const getMainWindow = () => mainWindow;
