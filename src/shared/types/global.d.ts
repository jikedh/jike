import { ElectronAPI } from "@electron-toolkit/preload";
import type { Adobe2Api } from "shared/types/adobe2api";
import type { Grok2Api } from "shared/types/grok2api";
import type { StorageApi } from "shared/types/storage";

declare global {
  interface Window {
    electron: ElectronAPI;
    storage: StorageApi;
    debug: {
      toggleDevTools: () => Promise<{ success: boolean; error?: string }>;
      isDev: () => Promise<boolean>;
    };
    download: {
      imageAsBuffer: (
        url: string,
      ) => Promise<{ success: boolean; data?: Uint8Array; error?: string }>;
      imageAsBase64: (url: string) => Promise<{
        success: boolean;
        data?: { base64: string; mimeType: string };
        error?: string;
      }>;
      imageToFile: (
        url: string,
        filePath: string,
      ) => Promise<{
        success: boolean;
        data?: { path: string };
        error?: string;
      }>;
    };
    videoProcessing: {
      trim: (request: {
        videoUrl: string;
        start: number;
        end: number;
      }) => Promise<{
        success: boolean;
        data?: {
          url: string;
          format: "mp4";
          duration: number;
          method: "cloud" | "ffmpeg";
          jobId?: string;
        };
        error?: string;
      }>;
    };
    adobe2api: Adobe2Api;
    grok2api: Grok2Api;
  }
}

export {};
