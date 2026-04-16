import { is } from "@electron-toolkit/utils";
import { app, BrowserWindow, ipcMain } from "electron";

/**
 * Debug IPC Handlers
 * 处理调试相关的 IPC 通道
 */
export function registerDebugHandlers(): void {
  // 切换 Electron 开发者工具面板
  ipcMain.handle("debug:toggleDevTools", async () => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
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

  ipcMain.handle("debug:isPackaged", async () => {
    return app.isPackaged;
  });
}
