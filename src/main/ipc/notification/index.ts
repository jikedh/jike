import { BrowserWindow, Notification, app, ipcMain } from "electron";

type SystemNotificationPayload = {
    title?: string;
    body?: string;
    whenWindowFocused?: boolean;
};
const DEFAULT_NOTIFICATION_TITLE = "即刻";
export function registerNotificationHandlers(): void {
    ipcMain.handle(
        "notification:show",
        async (event, payload: SystemNotificationPayload) => {
            try {
                if (!Notification.isSupported()) {
                    return { success: false, error: "当前系统不支持通知" };
                }
                const sourceWindow = BrowserWindow.fromWebContents(event.sender);
                if (sourceWindow?.isFocused() && !payload?.whenWindowFocused) {
                    return { success: true, skipped: true };
                }
                const title = String(payload?.title || DEFAULT_NOTIFICATION_TITLE).trim();
                const body = String(payload?.body || "任务已完成").trim();
                const notification = new Notification({
                    title: title || DEFAULT_NOTIFICATION_TITLE,
                    body: body || "任务已完成",
                    silent: false,
                });
                notification.on("click", () => {
                    const targetWindow = sourceWindow ?? BrowserWindow.getAllWindows()[0];
                    if (!targetWindow) {
                        return;
                    }
                    if (targetWindow.isMinimized()) {
                        targetWindow.restore();
                    }
                    targetWindow.show();
                    targetWindow.focus();
                });
                notification.show();
                return { success: true };
            } catch (error: any) {
                return { success: false, error: error.message };
            }
        },
    );
    ipcMain.handle("notification:isSupported", async () => {
        return Notification.isSupported() && app.isReady();
    });
}
