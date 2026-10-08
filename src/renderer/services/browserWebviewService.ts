import { invoke, isTauri } from "@tauri-apps/api/core";

export type BrowserKey = { projectId: string; nodeId: string; sessionId: string };
export type BrowserLayout = {
    key: BrowserKey;
    bounds: { x: number; y: number; width: number; height: number };
    zoom: number;
    visible: boolean;
};
export type BrowserRuntimeState = {
    nodeId: string;
    active: boolean;
    visible?: boolean;
    loading?: boolean;
    capturing?: boolean;
    error?: string;
};
export type BrowserNativeState = BrowserKey & {
    url: string;
    title?: string;
    loading: boolean;
    error?: string;
};
export type BrowserAction = { nodeId: string; url?: string; resizing?: boolean };

export const browserSupported = () => isTauri() && /Windows/i.test(navigator.userAgent);
export const dispatchBrowserAction = (action: "open" | "close" | "capture" | "resize", detail: BrowserAction) => {
    window.dispatchEvent(new CustomEvent(`canvas:browser-${action}`, { detail }));
};
export const requestBrowserLayoutSync = (afterCommit = false) => {
    window.dispatchEvent(new CustomEvent("canvas:browser-layout", { detail: { afterCommit } }));
};
export const publishBrowserRuntime = (state: BrowserRuntimeState) => {
    window.dispatchEvent(new CustomEvent("canvas:browser-state", { detail: state }));
};
export const browserWebviewService = {
    open: (layout: BrowserLayout, url: string) => invoke<void>("browser_open", { request: { layout, url } }),
    sync: (request: BrowserLayout) => invoke<void>("browser_sync", { request }),
    close: (key: BrowserKey) => invoke<void>("browser_close", { key }),
    capture: (key: BrowserKey) => invoke<{ dataUrl: string; width: number; height: number }>("browser_capture", { key }),
};
