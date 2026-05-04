import { ipcMain } from "electron";
import { videoProcessingService } from "./service";
import type { VideoTrimRequest } from "./service";

export function registerVideoProcessingHandlers(): void {
  ipcMain.handle(
    "video-processing:trim",
    async (_, request: VideoTrimRequest) => {
      try {
        const data = await videoProcessingService.trimVideo(request);
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "视频裁剪失败",
        };
      }
    },
  );
}
