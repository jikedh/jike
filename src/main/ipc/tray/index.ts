import { ipcMain } from "electron";

/**
 * Tray IPC Handlers
 * 目前托盘操作在主进程内部直接完成，无需额外的 IPC 通道
 * 这里预留扩展接口
 */
export function registerTrayHandlers(): void {
    // Placeholder — tray logic is self-contained in service.ts
    // Can add channels like "tray:showNotification" here in the future.
}
