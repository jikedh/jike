import type { StorageApi } from "shared/types/storage";

// 项目已迁移到 Tauri，但 ipcService.ts 仍以 window.electron.ipcRenderer.* 的形态调用
// （由 src/renderer/services/tauri-bridge.ts 中的 electronCompat 注入并转发到 Tauri invoke）。
// 这里定义最小兼容类型，避免依赖已卸载的 @electron-toolkit/preload。
interface ElectronIpcRendererCompat {
  send: (channel: string, data?: unknown) => void;
  invoke: <T = unknown>(channel: string, data?: unknown) => Promise<T>;
}

interface ElectronApiCompat {
  ipcRenderer: ElectronIpcRendererCompat;
}

declare global {
  interface Window {
    electron: ElectronApiCompat;
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
