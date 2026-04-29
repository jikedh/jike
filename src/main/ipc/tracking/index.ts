import { ipcMain } from "electron";

/**
 * Video Tracking IPC Handlers
 * 处理埋点相关的 IPC 通道
 */
export function registerTrackingHandlers(): void {
  // 发送埋点数据
  ipcMain.handle("tracking:send", async (_event, data) => {
    try {
      console.log("[Tracking] 收到埋点数据:", JSON.stringify(data));
      // 埋点数据将通过后端拦截器处理
      // 这里可以添加额外的日志或处理逻辑
      return { success: true };
    } catch (error) {
      console.error("[Tracking] 埋点数据发送失败:", error);
      return { success: false, error: String(error) };
    }
  });

  // 更新埋点状态
  ipcMain.handle("tracking:updateStatus", async (_event, taskId, status, errorMessage) => {
    try {
      console.log("[Tracking] 更新埋点状态:", { taskId, status, errorMessage });
      return { success: true };
    } catch (error) {
      console.error("[Tracking] 状态更新失败:", error);
      return { success: false, error: String(error) };
    }
  });
}
