import { ipcMain, BrowserWindow, app } from "electron";
import { is } from "@electron-toolkit/utils";

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

  ipcMain.handle("debug:getAppVersion", async () => {
    return app.getVersion();
  });

  ipcMain.handle(
    "debug:capturePage",
    async (
      event,
      rect?: { x: number; y: number; width: number; height: number },
    ) => {
      const webContents = event.sender;

      if (
        rect &&
        rect.width > 0 &&
        rect.height > 0 &&
        Number.isFinite(rect.x) &&
        Number.isFinite(rect.y)
      ) {
        const image = await webContents.capturePage({
          x: Math.max(0, Math.round(rect.x)),
          y: Math.max(0, Math.round(rect.y)),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
        return { success: true, data: image.toPNG() };
      }

      const image = await webContents.capturePage();
      return { success: true, data: image.toPNG() };
    },
  );
}
