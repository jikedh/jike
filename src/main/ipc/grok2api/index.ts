import { ipcMain } from "electron";
import type { Grok2ApiSettings } from "shared/types/grok2api";
import { grok2ApiService } from "./service";

export function registerGrok2ApiHandlers(): void {
  ipcMain.handle("grok2api:getState", async () => grok2ApiService.getState());
  ipcMain.handle("grok2api:start", async () => grok2ApiService.start());
  ipcMain.handle("grok2api:stop", async () => grok2ApiService.stop());
  ipcMain.handle("grok2api:restart", async () => grok2ApiService.restart());
  ipcMain.handle("grok2api:openAdminWindow", async () =>
    grok2ApiService.openAdminWindow(),
  );
  ipcMain.handle(
    "grok2api:updateSettings",
    async (_, patch: Partial<Grok2ApiSettings>) =>
      grok2ApiService.updateSettings(patch),
  );
  ipcMain.handle("grok2api:getLogs", async (_, limit?: number) =>
    grok2ApiService.getLogs(limit),
  );
}
