import { ElectronAPI } from "@electron-toolkit/preload";
import type { Flow2ApiApi } from "shared/types/flow2api";
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
    flow2api: Flow2ApiApi;
  }
}

export {};
