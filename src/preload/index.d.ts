import { ElectronAPI } from "@electron-toolkit/preload";
import type { Adobe2Api } from "shared/types/adobe2api";
import type { StorageApi } from "shared/types/storage";

export type DebugApi = {
  toggleDevTools: () => Promise<{ success: boolean; error?: string }>;
  isDev: () => Promise<boolean>;
  getAppVersion: () => Promise<string>;
};

export type DownloadApi = {
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
  ) => Promise<{ success: boolean; data?: { path: string }; error?: string }>;
};

export interface AIVideoTrackData {
  userId: string;
  userUuid?: string;
  apiName: string;
  model: string;
  taskId: string;
  prompt?: string;
  duration?: number;
  referenceImageUrl?: string;
  provider?: string;
  requestParams?: Record<string, unknown>;
  generatedVideoUrl?: string;
  status: "SUCCESS" | "FAIL" | "PENDING";
  timestamp: number;
}

export type TrackingApi = {
  send: (
    data: AIVideoTrackData,
  ) => Promise<{ success: boolean; error?: string }>;
  updateStatus: (
    taskId: string,
    status: string,
    errorMessage?: string,
    generatedVideoUrl?: string,
  ) => Promise<{ success: boolean; error?: string }>;
};

declare global {
  interface Window {
    electron: ElectronAPI;
    storage: StorageApi;
    debug: DebugApi;
    download: DownloadApi;
    adobe2api: Adobe2Api;
    tracking: TrackingApi;
  }
}
