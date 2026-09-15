import { useCallback, useEffect, useRef, useState } from "react";
import { useUpdater } from "@/hooks/useUpdater";
import { useUpdateStore } from "@/stores/updateStore";
import { UpdateDialog } from "./ui/update-dialog";

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

export const UpdateManager = () => {
    const {
        state,
        progress,
        updateInfo,
        error,
        isDevMode,
        checkForUpdates,
        startUpdate,
        restartApp,
        resetState,
    } = useUpdater();
    const hasAvailableUpdate = useUpdateStore(
        (state) => state.hasAvailableUpdate,
    );
    const isUpdateDialogOpen = useUpdateStore(
        (state) => state.isUpdateDialogOpen,
    );
    const setHasAvailableUpdate = useUpdateStore(
        (state) => state.setHasAvailableUpdate,
    );
    const setUpdateDialogOpen = useUpdateStore(
        (state) => state.setUpdateDialogOpen,
    );
    const isCheckingRef = useRef(false);
    const hasAvailableUpdateRef = useRef(hasAvailableUpdate);
    const [appVersion, setAppVersion] = useState("");

    useEffect(() => {
        hasAvailableUpdateRef.current = hasAvailableUpdate;
    }, [hasAvailableUpdate]);

    useEffect(() => {
        let cancelled = false;

        window.debug
            ?.getAppVersion()
            .then((version) => {
                if (!cancelled) setAppVersion(version || "");
            })
            .catch(() => {
                if (!cancelled) setAppVersion("");
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const checkSilently = useCallback(async (): Promise<boolean> => {
        if (isCheckingRef.current) return false;

        isCheckingRef.current = true;
        try {
            const hasUpdate = await checkForUpdates();
            if (hasUpdate) {
                if (!hasAvailableUpdateRef.current) {
                    setUpdateDialogOpen(true);
                }
                setHasAvailableUpdate(true);
            }
            return hasUpdate;
        } finally {
            isCheckingRef.current = false;
        }
    }, [
        checkForUpdates,
        setHasAvailableUpdate,
        setUpdateDialogOpen,
    ]);

    useEffect(() => {
        if (isDevMode) return;

        void checkSilently();
        const intervalId = window.setInterval(() => {
            void checkSilently();
        }, UPDATE_CHECK_INTERVAL_MS);

        return () => window.clearInterval(intervalId);
    }, [checkSilently, isDevMode]);

    const handleDialogOpenChange = (nextOpen: boolean) => {
        setUpdateDialogOpen(nextOpen);
        if (!nextOpen && !hasAvailableUpdate && state !== "complete") {
            resetState();
        }
    };

    return (
        <UpdateDialog
            open={isUpdateDialogOpen}
            onOpenChange={handleDialogOpenChange}
            state={state}
            progress={progress}
            updateInfo={updateInfo}
            error={error}
            currentVersion={appVersion}
            onCheckForUpdates={checkSilently}
            onStartUpdate={startUpdate}
            onRestartApp={restartApp}
            onRetry={checkSilently}
        />
    );
};