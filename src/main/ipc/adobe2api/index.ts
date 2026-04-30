import { ipcMain } from "electron";
import type { Adobe2ApiSettings } from "shared/types/adobe2api";
import { adobe2ApiService } from "./service";

export function registerAdobe2ApiHandlers(): void {
  ipcMain.handle("adobe2api:getState", async () => adobe2ApiService.getState());
  ipcMain.handle("adobe2api:start", async () => adobe2ApiService.start());
  ipcMain.handle("adobe2api:stop", async () => adobe2ApiService.stop());
  ipcMain.handle("adobe2api:restart", async () => adobe2ApiService.restart());
  ipcMain.handle("adobe2api:openAdminWindow", async () =>
    adobe2ApiService.openAdminWindow(),
  );
  ipcMain.handle(
    "adobe2api:updateSettings",
    async (_, patch: Partial<Adobe2ApiSettings>) =>
      adobe2ApiService.updateSettings(patch),
  );
  ipcMain.handle("adobe2api:getLogs", async (_, limit?: number) =>
    adobe2ApiService.getLogs(limit),
  );
  ipcMain.handle("adobe2api:selectOutputDirectory", async () =>
    adobe2ApiService.pickOutputDirectory(),
  );
}
