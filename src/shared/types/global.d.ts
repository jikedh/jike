import type { StorageApi } from "shared/types/storage";

// 项目已完全迁移到 Tauri 2，Electron 兼容层（window.electron.ipcRenderer）已移除。
// Renderer 端通过 src/renderer/services/tauri-bridge.ts 注入的 window.storage / window.debug
// 等命名空间访问主进程能力，或直接使用 import { invoke } from '@tauri-apps/api/core'。

declare global {
  interface Window {
    storage: StorageApi;
    debug: {
      toggleDevTools: () => Promise<{ success: boolean; error?: string }>;
      isDev: () => Promise<boolean>;
      getAppVersion: () => Promise<string>;
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
        authToken?: string;
        backendBaseUrl?: string;
        ffmpegPath?: string;
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
  }
}

export { };
