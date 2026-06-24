import { useCallback, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateState =
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "installing"
    | "complete"
    | "error"
    | "up_to_date";

export interface UpdateProgress {
    downloadedBytes: number;
    totalBytes: number | null;
}

export interface UpdateInfo {
    version: string;
    releaseNotes: string | null;
}

export interface UseUpdaterReturn {
    state: UpdateState;
    progress: UpdateProgress;
    updateInfo: UpdateInfo | null;
    error: string | null;
    isDevMode: boolean;
    checkForUpdates: () => Promise<boolean>;
    startUpdate: () => Promise<void>;
    restartApp: () => Promise<void>;
    resetState: () => void;
}

// 开发态下模拟有新版本可更新，便于在 `npm run dev:tauri` 中也能完整跑通弹窗流程。
const DEV_MOCK_UPDATE: UpdateInfo = {
    version: "99.0.0",
    releaseNotes: `### ✨ 新功能

- 新增设置中心内一键检测更新
- 新增带进度条的下载与安装流程
- 新增更新完成后自动重启应用

### 🐛 修复

- 修复若干已知问题

---
*这是开发态下的模拟更新，用于联调 UI 流程。*`,
};

const DEV_MOCK_TOTAL_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * 自动更新 Hook：复用 ssh-buddy 中相同的 7 态机设计。
 * - 在 Tauri 运行时调用 @tauri-apps/plugin-updater 进行真实检查与下载。
 * - 在 Vite dev (浏览器) 下用 setTimeout 模拟同样的状态切换，避免阻塞前端开发。
 */
export function useUpdater(): UseUpdaterReturn {
    // Vite dev 服务下没有 Tauri runtime，等价于"非 Tauri 环境"，走模拟分支。
    const isDevMode =
        typeof window === "undefined" ||
        !(window as unknown as { __TAURI_INTERNALS__?: unknown })
            .__TAURI_INTERNALS__;

    const [state, setState] = useState<UpdateState>("idle");
    const [progress, setProgress] = useState<UpdateProgress>({
        downloadedBytes: 0,
        totalBytes: null,
    });
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [updateInstance, setUpdateInstance] = useState<Update | null>(null);

    const resetState = useCallback(() => {
        setState("idle");
        setProgress({ downloadedBytes: 0, totalBytes: null });
        setUpdateInfo(null);
        setError(null);
        setUpdateInstance(null);
    }, []);

    const simulateCheck = useCallback(async (): Promise<boolean> => {
        setState("checking");
        setError(null);
        await new Promise((resolve) => setTimeout(resolve, 1200));
        setUpdateInfo(DEV_MOCK_UPDATE);
        setState("available");
        return true;
    }, []);

    const simulateStartUpdate = useCallback(async () => {
        setState("downloading");
        setProgress({ downloadedBytes: 0, totalBytes: DEV_MOCK_TOTAL_BYTES });

        const chunkSize = DEV_MOCK_TOTAL_BYTES / 20;
        let downloaded = 0;
        for (let i = 0; i < 20; i++) {
            await new Promise((resolve) => setTimeout(resolve, 180));
            downloaded += chunkSize;
            setProgress({
                downloadedBytes: Math.min(downloaded, DEV_MOCK_TOTAL_BYTES),
                totalBytes: DEV_MOCK_TOTAL_BYTES,
            });
        }
        setState("installing");
        await new Promise((resolve) => setTimeout(resolve, 800));
        setState("complete");
    }, []);

    const checkForUpdates = useCallback(async (): Promise<boolean> => {
        if (isDevMode) {
            return simulateCheck();
        }

        try {
            setState("checking");
            setError(null);
            const update = await check();
            if (update) {
                setUpdateInstance(update);
                setUpdateInfo({
                    version: update.version,
                    releaseNotes: update.body ?? null,
                });
                setState("available");
                return true;
            }
            setState("up_to_date");
            return false;
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "检查更新失败",
            );
            setState("error");
            return false;
        }
    }, [isDevMode, simulateCheck]);

    const startUpdate = useCallback(async () => {
        if (isDevMode) {
            return simulateStartUpdate();
        }

        if (!updateInstance) return;

        try {
            setState("downloading");
            setProgress({ downloadedBytes: 0, totalBytes: null });

            await updateInstance.downloadAndInstall((event) => {
                switch (event.event) {
                    case "Started":
                        setProgress({
                            downloadedBytes: 0,
                            totalBytes: event.data.contentLength ?? null,
                        });
                        break;
                    case "Progress":
                        setProgress((prev) => ({
                            ...prev,
                            downloadedBytes: prev.downloadedBytes + event.data.chunkLength,
                        }));
                        break;
                    case "Finished":
                        setProgress((prev) => ({
                            ...prev,
                            downloadedBytes: prev.totalBytes ?? prev.downloadedBytes,
                        }));
                        setState("installing");
                        break;
                }
            });

            setState("complete");
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "下载或安装更新失败",
            );
            setState("error");
        }
    }, [isDevMode, updateInstance, simulateStartUpdate]);

    const restartApp = useCallback(async () => {
        if (isDevMode) {
            // 开发态无法真实重启，直接清空状态、等待下次手动刷新
            resetState();
            return;
        }

        try {
            await relaunch();
        } catch (err) {
            setError(err instanceof Error ? err.message : "重启应用失败");
            setState("error");
        }
    }, [isDevMode, resetState]);

    return {
        state,
        progress,
        updateInfo,
        error,
        isDevMode,
        checkForUpdates,
        startUpdate,
        restartApp,
        resetState,
    };
}
