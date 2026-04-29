import { ipcMain } from "electron";
import type { Flow2ApiSettings } from "shared/types/flow2api";
import { flow2ApiService } from "./service";

export function registerFlow2ApiHandlers(): void {
  ipcMain.handle("flow2api:getState", async () => flow2ApiService.getState());
  ipcMain.handle("flow2api:start", async () => flow2ApiService.start());
  ipcMain.handle("flow2api:stop", async () => flow2ApiService.stop());
  ipcMain.handle("flow2api:restart", async () => flow2ApiService.restart());
  ipcMain.handle(
    "flow2api:updateSettings",
    async (_, patch: Partial<Flow2ApiSettings>) =>
      flow2ApiService.updateSettings(patch),
  );
  ipcMain.handle("flow2api:getLogs", async (_, limit?: number) =>
    flow2ApiService.getLogs(limit),
  );
  ipcMain.handle("flow2api:selectOutputDirectory", async () =>
    flow2ApiService.pickOutputDirectory(),
  );
}
