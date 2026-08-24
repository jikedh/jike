/**
 * Tauri 2 适配层
 *
 * 原 Electron 应用通过 contextBridge 在 window 上暴露 storage/debug/download/videoProcessing/
 * notification/tracking 等 API 命名空间，Renderer 端代码直接调用 window.storage.xxx() 等。
 *
 * 本模块在 Tauri 2 下提供同名 API：把 window.storage 等调用转换为
 * @tauri-apps/api/core 的 invoke('storage_xxx', ...)，保持前端业务代码零改动。
 *
 * 注意：本项目已彻底从 Electron 迁移到 Tauri 2，旧的 window.electron.ipcRenderer
 * 兼容层（electronCompat）已移除，所有调用方应使用 window.storage / window.debug 等
 * Tauri 桥接命名空间，或直接 import { invoke } from '@tauri-apps/api/core'。
 */

// AIVideoTrackData 已在 src/shared/types/tracking.ts 中维护
interface AIVideoTrackDataCompat {
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
type AIVideoTrackData = AIVideoTrackDataCompat;

type TauriInvoke = <T = any>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

const getInvoke = (): TauriInvoke | null => {
    if (typeof window === "undefined") return null;
    const w = window as unknown as { __TAURI_INTERNALS__?: { invoke?: TauriInvoke }; __TAURI__?: { invoke?: TauriInvoke } };
    return w.__TAURI_INTERNALS__?.invoke ?? w.__TAURI__?.invoke ?? null;
};

const invokeOrThrow = async <T = any>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
    const fn = getInvoke();
    if (!fn) throw new Error(`Tauri invoke unavailable for ${cmd}`);
    return fn<T>(cmd, args);
};

const isTauri = (): boolean => getInvoke() !== null;

// === storage ============================================================

const storageApi = {
    selectDirectory: async () => {
        if (!isTauri()) return null;
        return invokeOrThrow<string | null>("storage_select_directory");
    },
    ensureProject: (basePath: string, projectName: string) =>
        invokeOrThrow("storage_ensure_project", { base: basePath, project: projectName }),
    listProjects: (basePath: string) =>
        invokeOrThrow("storage_list_projects", { base: basePath }),
    saveCanvas: (basePath: string, projectName: string, data: unknown) =>
        invokeOrThrow("storage_save_canvas", { base: basePath, project: projectName, data }),
    loadCanvas: (basePath: string, projectName: string) =>
        invokeOrThrow("storage_load_canvas", { base: basePath, project: projectName }),
    saveMedia: (basePath: string, relativePath: string, buffer: ArrayBuffer) =>
        invokeOrThrow("storage_save_media", { base: basePath, relativePath, buffer: Array.from(new Uint8Array(buffer)) }),
    readMedia: (basePath: string, relativePath: string) =>
        invokeOrThrow("storage_read_media", { base: basePath, relativePath }),
    writeRawFile: (basePath: string, relativePath: string, buffer: ArrayBuffer) =>
        invokeOrThrow("storage_write_raw_file", { base: basePath, relativePath, buffer: Array.from(new Uint8Array(buffer)) }),
    readRawFile: (basePath: string, relativePath: string) =>
        invokeOrThrow("storage_read_raw_file", { base: basePath, relativePath }),
    readAbsoluteFile: (path: string) =>
        invokeOrThrow<number[]>("storage_read_absolute_file", { path }),
    scanAssetLibrary: (basePath: string) =>
        invokeOrThrow("storage_scan_asset_library", { base: basePath }),
    deleteRawPath: (basePath: string, relativePath: string) =>
        invokeOrThrow("storage_delete_raw_path", { base: basePath, relativePath }),
    renameRawPath: (basePath: string, oldPath: string, newPath: string) =>
        invokeOrThrow("storage_rename_raw_path", { base: basePath, oldPath, newPath }),
    listMedia: (basePath: string, projectName: string, mediaType: string) =>
        invokeOrThrow("storage_list_media", { base: basePath, project: projectName, mediaType }),
    deleteMedia: (basePath: string, relativePath: string) =>
        invokeOrThrow("storage_delete_media", { base: basePath, relativePath }),
    downloadMedia: (basePath: string, url: string, relativePath: string) =>
        invokeOrThrow("storage_download_media", { base: basePath, url, relativePath }),
    saveBufferToFile: (defaultFileName: string, buffer: ArrayBuffer) =>
        invokeOrThrow("storage_save_buffer_to_file", { defaultName: defaultFileName, buffer: Array.from(new Uint8Array(buffer)) }),
    mediaExists: (basePath: string, relativePath: string) =>
        invokeOrThrow<boolean>("storage_media_exists", { base: basePath, relativePath }),
    renameProject: (basePath: string, oldName: string, newName: string) =>
        invokeOrThrow("storage_rename_project", { base: basePath, oldName, newName }),
    deleteProject: (basePath: string, project: string) =>
        invokeOrThrow("storage_delete_project", { base: basePath, project }),
    copyProject: (basePath: string, src: string, dest: string) =>
        invokeOrThrow("storage_copy_project", { base: basePath, src, dest }),
    exportProject: (basePath: string, project: string) =>
        invokeOrThrow("storage_export_project", { base: basePath, project }),
    importProject: (basePath: string) =>
        invokeOrThrow("storage_import_project", { base: basePath }),
    getDefaultPath: () => invokeOrThrow<string>("storage_get_default_path"),

    // Legacy aliases
    ensureProjectDir: (basePath: string, projectName: string) =>
        invokeOrThrow("storage_ensure_project", { base: basePath, project: projectName }),
    writeFile: (basePath: string, relativePath: string, buffer: ArrayBuffer) =>
        invokeOrThrow("storage_write_file", { base: basePath, relativePath, buffer: Array.from(new Uint8Array(buffer)) }),
    readFile: (basePath: string, relativePath: string) =>
        invokeOrThrow("storage_read_file", { base: basePath, relativePath }),
    deleteFile: (basePath: string, relativePath: string) =>
        invokeOrThrow("storage_delete_file", { base: basePath, relativePath }),
    listFiles: (basePath: string, projectName: string, mediaType: string) =>
        invokeOrThrow("storage_list_files", { base: basePath, project: projectName, mediaType }),
    downloadFile: (basePath: string, url: string, relativePath: string) =>
        invokeOrThrow("storage_download_file", { base: basePath, url, relativePath }),
    fileExists: (basePath: string, relativePath: string) =>
        invokeOrThrow<boolean>("storage_file_exists", { base: basePath, relativePath }),
};

// === debug =============================================================

const debugApi = {
    toggleDevTools: () => invokeOrThrow<{ success: boolean; error?: string }>("debug_toggle_dev_tools"),
    isDev: () => invokeOrThrow<boolean>("debug_is_dev"),
    getAppVersion: () => invokeOrThrow<string>("debug_get_app_version"),
    capturePage: (rect?: { x: number; y: number; width: number; height: number }) =>
        invokeOrThrow<{ success: boolean; data?: Uint8Array; error?: string }>("debug_capture_page", { rect }),
};

// === download ==========================================================

const downloadApi = {
    imageAsBuffer: (url: string) =>
        invokeOrThrow<{ success: boolean; data?: { data: number[]; mimeType: string }; error?: string }>("download_image_as_buffer", { url }),
    imageAsBase64: (url: string) =>
        invokeOrThrow<{ success: boolean; data?: { base64: string; mimeType: string }; error?: string }>("download_image_as_base64", { url }),
    imageToFile: (url: string, filePath: string) =>
        invokeOrThrow<{ success: boolean; data?: { path: string }; error?: string }>("download_image_to_file", { url, filePath }),
};

// === videoProcessing ===================================================

const videoProcessingApi = {
    trim: (request: { videoUrl: string; start: number; end: number; authToken?: string; backendBaseUrl?: string }) =>
        invokeOrThrow<{
            success: boolean;
            data?: { url: string; format: "mp4"; duration: number; method: "cloud" | "ffmpeg"; jobId?: string };
            error?: string;
        }>("video_processing_trim", { request }),
    captureFrame: (request: { videoUrl: string; time: number; mode: "current" | "start" | "end"; authToken?: string; backendBaseUrl?: string }) =>
        invokeOrThrow<{
            success: boolean;
            data?: { url: string; format: "png"; method: "ffmpeg" };
            error?: string;
        }>("video_capture_frame", { request }),
};

// === notification ======================================================

const notificationApi = {
    show: (payload: { title?: string; body?: string; whenWindowFocused?: boolean }) =>
        invokeOrThrow<{ success: boolean; skipped?: boolean; error?: string }>("notification_show", payload),
    isSupported: () => invokeOrThrow<boolean>("notification_is_supported"),
};

// === tracking ==========================================================

const trackingApi = {
    send: (data: AIVideoTrackData) => invokeOrThrow<{ success: boolean; error?: string }>("tracking_send", { data }),
    updateStatus: (taskId: string, status: string, errorMessage?: string, generatedVideoUrl?: string) =>
        invokeOrThrow<{ success: boolean; error?: string }>("tracking_update_status", { taskId, status, errorMessage, generatedVideoUrl }),
};

// === 导出：调用方应使用 ensureTauriApis() 自动安装到 window ===================

export const ensureTauriApis = () => {
    if (typeof window === "undefined") return;
    const w = window as unknown as Record<string, unknown>;
    if (isTauri()) {
        w.storage = storageApi;
        w.debug = debugApi;
        w.download = downloadApi;
        w.videoProcessing = videoProcessingApi;
        w.notification = notificationApi;
        w.tracking = trackingApi;
    }
};

export { storageApi, debugApi, downloadApi, videoProcessingApi, notificationApi, trackingApi };
