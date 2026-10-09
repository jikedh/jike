import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { uploadFileToOSS } from "service/oss";
import { GenerationStatus } from "shared/constants/enum";
import { normalizeBrowserUrl } from "shared/utils/browserUrl";
import type { BrowserNodeData } from "shared/types/flow";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { browserSupported, browserWebviewService, dispatchBrowserAction, publishBrowserRuntime, type BrowserAction, type BrowserKey, type BrowserLayout, type BrowserNativeState } from "@/services/browserWebviewService";

const makeSessionId = () => crypto.randomUUID();

const hasBlockingOverlay = (fullscreen = false) =>
    Boolean(
        document.querySelector(
            '[data-slot="dialog-content"], [data-slot="drawer-content"], #panorama-root, .yarl__root, [role="menu"]' + (fullscreen ? '' : ', .canvas-batch-toolbar'),
        ),
    );

export const BrowserWebviewLayer = ({ interacting }: { interacting: boolean }) => {
    const activeRef = useRef<{ nodeId: string; tabId: string; key: BrowserKey } | null>(null);
    const sessionsRef = useRef(new Map<string, { nodeId: string; tabId: string; key: BrowserKey; loading: boolean; error?: string }>());
    const operationRef = useRef(Promise.resolve());
    const disposedRef = useRef(false);
    const rafRef = useRef<number | null>(null);
    const pendingRef = useRef(false);
    const syncInFlightRef = useRef(false);
    const closingRef = useRef(false);
    const interactingRef = useRef(interacting);
    const nodeInteractionRef = useRef(false);
    interactingRef.current = interacting;

    const closeActive = async (nodeId?: string) => {
        const active = activeRef.current;
        if (!active || (nodeId && active.nodeId !== nodeId)) return;
        activeRef.current = null;
        publishBrowserRuntime({ nodeId: active.nodeId, active: false, visible: false });
        await browserWebviewService.sync({ key: active.key, bounds: { x: 0, y: 0, width: 1, height: 1 }, zoom: 1, visible: false }).catch(() => undefined);
    };

    const disposeSession = async (sessionId: string) => {
        const session = sessionsRef.current.get(sessionId);
        if (!session) return;
        sessionsRef.current.delete(sessionId);
        if (activeRef.current?.key.sessionId === sessionId) {
            activeRef.current = null;
            publishBrowserRuntime({ nodeId: session.nodeId, active: false, visible: false, loading: false, capturing: false });
        }
        await browserWebviewService.close(session.key).catch(() => undefined);
    };

    const sync = async () => {
        rafRef.current = null;
        if (syncInFlightRef.current || !pendingRef.current || !activeRef.current || closingRef.current) return;
        pendingRef.current = false;
        const active = activeRef.current;
        const node = useCanvasFlowStore.getState().nodes.find((item) => item.id === active.nodeId && item.type === "browserNode");
        const target = document.querySelector<HTMLElement>(`[data-browser-node-content="${CSS.escape(active.nodeId)}"]`);
        const flow = document.querySelector<HTMLElement>(".react-flow");
        if (!node || !target || !flow || node.data.collapsed) { await closeActive(active.nodeId); return; }
        const rect = target.getBoundingClientRect();
        const fullscreen = Boolean(target.closest("[data-browser-fullscreen]"));
        const flowRect = fullscreen ? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight } : flow.getBoundingClientRect();
        const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
        const transform = viewport ? new DOMMatrixReadOnly(getComputedStyle(viewport).transform) : new DOMMatrixReadOnly();
        const zoom = fullscreen ? 1 : transform.a || 1;
        const fullyVisible = rect.left >= flowRect.left && rect.top >= flowRect.top && rect.right <= flowRect.right && rect.bottom <= flowRect.bottom;
        const visible = (fullscreen || !interactingRef.current) && !nodeInteractionRef.current && !hasBlockingOverlay(fullscreen) && fullyVisible && zoom >= 0.5 && zoom <= 1.6;
        const layout: BrowserLayout = { key: active.key, bounds: { x: Math.max(0, rect.left), y: Math.max(0, rect.top), width: rect.width, height: rect.height }, zoom, visible };
        syncInFlightRef.current = true;
        try {
            await browserWebviewService.sync(layout);
            if (activeRef.current?.key.sessionId !== active.key.sessionId) return;
            publishBrowserRuntime({ nodeId: active.nodeId, active: true, visible });
        } catch (error: any) {
            if (activeRef.current?.key.sessionId !== active.key.sessionId) return;
            await disposeSession(active.key.sessionId);
            publishBrowserRuntime({ nodeId: active.nodeId, active: false, visible: false, error: error?.message || "网页布局同步失败" });
        } finally {
            syncInFlightRef.current = false;
            if (pendingRef.current) scheduleSync();
        }
    };

    const scheduleSync = (afterCommit = false) => {
        pendingRef.current = true;
        if (rafRef.current !== null) return;
        const enqueue = () => {
            if (rafRef.current === null) rafRef.current = window.requestAnimationFrame(() => void sync());
        };
        if (afterCommit) {
            window.requestAnimationFrame(enqueue);
            return;
        }
        enqueue();
    };

    useEffect(() => {
        if (!browserSupported()) return;
        const update = () => scheduleSync();
        const observer = new ResizeObserver(update);
        const flow = document.querySelector<HTMLElement>(".react-flow");
        if (flow) observer.observe(flow);
        window.addEventListener("resize", update);
        return () => { observer.disconnect(); window.removeEventListener("resize", update); };
    }, []);

    useEffect(() => {
        const observer = new MutationObserver(() => scheduleSync());
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state"] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => { scheduleSync(true); }, [interacting]);

    useEffect(() => {
        if (!browserSupported()) return;
        let disposed = false;
        const unsubscribes: (() => void)[] = [];
        const register = (promise: Promise<() => void>) => void promise.then((dispose) => { if (disposed) dispose(); else unsubscribes.push(dispose); });
        register(listen<BrowserNativeState>("browser:state", (event) => {
            const active = activeRef.current;
            const state = event.payload;
            const session = sessionsRef.current.get(state.sessionId);
            const store = useCanvasFlowStore.getState();
            if (!session || session.nodeId !== state.nodeId || session.key.projectId !== state.projectId || store.projectId !== state.projectId) return;
            session.loading = state.loading;
            session.error = state.error;
            const node = store.nodes.find((item) => item.id === state.nodeId && item.type === "browserNode");
            if (!node) return;
            const data = node.data as BrowserNodeData;
            const tabs = data.tabs?.map((tab) => tab.id === session.tabId ? { ...tab, url: state.url, title: state.title ?? tab.title } : tab);
            const selected = data.activeTabId === session.tabId;
            store.updateBrowserNodeData(state.nodeId, { tabs, ...(selected ? { url: state.url, title: tabs?.find((tab) => tab.id === session.tabId)?.title } : {}) });
            if (!state.loading) store.saveGraph();
            if (active?.key.sessionId === state.sessionId) publishBrowserRuntime({ nodeId: state.nodeId, tabId: session.tabId, active: true, loading: state.loading, error: state.error });
        }));
        register(listen<BrowserNativeState>("browser:new-tab", (event) => {
            const state = event.payload;
            const session = sessionsRef.current.get(state.sessionId);
            if (!session || session.nodeId !== state.nodeId || session.key.projectId !== state.projectId || useCanvasFlowStore.getState().projectId !== state.projectId) return;
            dispatchBrowserAction("new-tab", { nodeId: state.nodeId, url: state.url });
        }));
        return () => { disposed = true; unsubscribes.forEach((dispose) => dispose()); };
    }, []);

    useEffect(() => {
        disposedRef.current = false;
        const queue = (action: () => Promise<void>) => {
            operationRef.current = operationRef.current.then(async () => { if (!disposedRef.current) await action(); }).catch(() => undefined);
        };
        const open = async (event: Event) => {
            if (!browserSupported()) return;
            const { nodeId, url, tabId } = (event as CustomEvent<BrowserAction>).detail;
            let session: { nodeId: string; tabId: string; key: BrowserKey; loading: boolean; error?: string } | undefined;
            try {
                const store = useCanvasFlowStore.getState();
                const node = store.nodes.find((item) => item.id === nodeId && item.type === "browserNode");
                if (!node) return;
                const data = node.data as BrowserNodeData;
                const tabs = data.tabs?.length ? data.tabs.map((tab) => ({ ...tab })) : [{ id: makeSessionId(), url: data.url, title: data.title }];
                const tab = tabs.find((item) => item.id === (tabId ?? data.activeTabId)) ?? tabs[0];
                if (!tab) return;
                const normalized = url !== undefined ? normalizeBrowserUrl(url) : tab.url ? normalizeBrowserUrl(tab.url) : "";
                const projectId = store.projectId;
                if (!projectId) throw new Error("请先保存并进入一个项目画布");
                session = [...sessionsRef.current.values()].find((item) => item.nodeId === nodeId && item.tabId === tab.id && item.key.projectId === projectId);
                if (activeRef.current?.key.sessionId !== session?.key.sessionId) await closeActive();
                tab.url = normalized;
                if (url !== undefined) tab.title = undefined;
                store.updateBrowserNodeData(nodeId, { tabs, activeTabId: tab.id, url: normalized, title: tab.title, collapsed: false });
                store.requestHistorySave();
                store.saveGraph();
                if (!normalized) {
                    await closeActive();
                    publishBrowserRuntime({ nodeId, tabId: tab.id, active: false, visible: false, loading: false, capturing: false, error: "" });
                    return;
                }
                const target = document.querySelector<HTMLElement>(`[data-browser-node-content="${CSS.escape(nodeId)}"]`);
                const flow = document.querySelector<HTMLElement>(".react-flow");
                if (!target || !flow) throw new Error("浏览器节点尚未准备完成");
                const rect = target.getBoundingClientRect();
                const existing = Boolean(session);
                if (!session) {
                    session = { nodeId, tabId: tab.id, key: { projectId, nodeId, sessionId: makeSessionId() }, loading: true };
                    sessionsRef.current.set(session.key.sessionId, session);
                }
                activeRef.current = { nodeId, tabId: tab.id, key: session.key };
                publishBrowserRuntime({ nodeId, tabId: tab.id, active: true, visible: false, loading: url !== undefined || session.loading, capturing: false, error: url !== undefined ? "" : session.error ?? "" });
                if (!existing || url !== undefined) await browserWebviewService.open({ key: session.key, bounds: { x: Math.max(0, rect.left), y: Math.max(0, rect.top), width: Math.max(1, rect.width), height: Math.max(1, rect.height) }, zoom: 1, visible: false }, normalized);
                if (disposedRef.current || useCanvasFlowStore.getState().projectId !== projectId || sessionsRef.current.get(session.key.sessionId) !== session) {
                    sessionsRef.current.delete(session.key.sessionId);
                    await browserWebviewService.close(session.key).catch(() => undefined);
                    return;
                }
                scheduleSync(true);
            } catch (error: any) {
                const message = error?.message || "打开网页失败";
                if (session) await disposeSession(session.key.sessionId);
                publishBrowserRuntime({ nodeId, active: false, error: message });
            }
        };
        const newTab = async (event: Event) => {
            const { nodeId, url } = (event as CustomEvent<BrowserAction>).detail;
            const store = useCanvasFlowStore.getState();
            const node = store.nodes.find((item) => item.id === nodeId && item.type === "browserNode");
            if (!node) return;
            const data = node.data as BrowserNodeData;
            const tabs = data.tabs?.length ? data.tabs : [{ id: makeSessionId(), url: data.url, title: data.title }];
            if (tabs.length >= 20) { publishBrowserRuntime({ nodeId, active: activeRef.current?.nodeId === nodeId, error: "最多打开 20 个标签，请先关闭部分标签" }); return; }
            let normalized = "";
            try { normalized = url ? normalizeBrowserUrl(url) : ""; }
            catch (error: any) { publishBrowserRuntime({ nodeId, active: activeRef.current?.nodeId === nodeId, error: error?.message || "新标签网址无效" }); return; }
            const tab = { id: makeSessionId(), url: normalized };
            store.updateBrowserNodeData(nodeId, { tabs: [...tabs, tab], activeTabId: tab.id });
            await open(new CustomEvent("open", { detail: { nodeId, tabId: tab.id } }));
        };
        const closeTab = async (event: Event) => {
            const { nodeId, tabId } = (event as CustomEvent<BrowserAction>).detail;
            const store = useCanvasFlowStore.getState();
            const node = store.nodes.find((item) => item.id === nodeId && item.type === "browserNode");
            if (!node) return;
            const data = node.data as BrowserNodeData;
            const index = data.tabs?.findIndex((tab) => tab.id === tabId) ?? -1;
            if (index < 0) return;
            const tabs = data.tabs!.filter((tab) => tab.id !== tabId);
            for (const session of sessionsRef.current.values()) {
                if (session.nodeId === nodeId && session.tabId === tabId) await disposeSession(session.key.sessionId);
            }
            if (!tabs.length) tabs.push({ id: makeSessionId(), url: "" });
            const next = tabs.find((tab) => tab.id === data.activeTabId) ?? tabs[Math.min(index, tabs.length - 1)];
            store.updateBrowserNodeData(nodeId, { tabs, activeTabId: next.id, url: next.url, title: next.title });
            store.requestHistorySave(); store.saveGraph();
            if (data.activeTabId === tabId) await open(new CustomEvent("open", { detail: { nodeId, tabId: next.id } }));
        };
        const close = async (event: Event) => {
            const { nodeId } = (event as CustomEvent<{ nodeId: string }>).detail;
            useCanvasFlowStore.getState().updateBrowserNodeData(nodeId, { collapsed: true });
            useCanvasFlowStore.getState().requestHistorySave();
            useCanvasFlowStore.getState().saveGraph();
            await closeActive(nodeId);
        };
        const resize = (event: Event) => {
            nodeInteractionRef.current = Boolean((event as CustomEvent<{ resizing?: boolean }>).detail.resizing);
            scheduleSync(!nodeInteractionRef.current);
        };
        const navigateHistory = async (event: Event, direction: "back" | "forward") => {
            const { nodeId } = (event as CustomEvent<{ nodeId: string }>).detail;
            const active = activeRef.current;
            if (!active || active.nodeId !== nodeId) return;
            try {
                await (direction === "back" ? browserWebviewService.goBack(active.key) : browserWebviewService.goForward(active.key));
            } catch (error: any) {
                if (activeRef.current?.key.sessionId !== active.key.sessionId) return;
                publishBrowserRuntime({ nodeId, active: true, visible: true, error: error?.message || "网页历史导航失败" });
            }
        };
        const layout = (event: Event) => scheduleSync(Boolean((event as CustomEvent<{ afterCommit?: boolean }>).detail.afterCommit));
        const capture = async (event: Event) => {
            const { nodeId } = (event as CustomEvent<{ nodeId: string }>).detail;
            const active = activeRef.current;
            if (!active || active.nodeId !== nodeId) return;
            publishBrowserRuntime({ nodeId, active: true, visible: true, capturing: true });
            try {
                const captured = await browserWebviewService.capture(active.key);
                const response = await fetch(captured.dataUrl); const blob = await response.blob();
                const uploaded = await uploadFileToOSS(new File([blob], `browser-${Date.now()}.png`, { type: "image/png" }));
                if (!uploaded.url) throw new Error("截图上传失败，未返回图片地址");
                const store = useCanvasFlowStore.getState();
                const source = store.nodes.find((item) => item.id === nodeId && item.type === "browserNode");
                if (!source || store.projectId !== active.key.projectId || activeRef.current?.key.sessionId !== active.key.sessionId) return;
                const imageId = store.addNode("image", { x: source.position.x + (source.width ?? 800) + 80, y: source.position.y });
                store.updateImageNodeData(imageId, { image_urls: [uploaded.url], isUpload: true, status: GenerationStatus.COMPLETED, progress: 100, result: { type: "image", data: [{ url: uploaded.url, remoteUrl: uploaded.url }] } });
                store.updateBrowserNodeData(nodeId, { screenshotUrl: uploaded.url });
                store.onConnect({ source: nodeId, sourceHandle: "output", target: imageId, targetHandle: "input" });
                store.requestHistorySave(); store.saveGraph();
            } catch (error: any) {
                if (activeRef.current?.key.sessionId !== active.key.sessionId) return;
                publishBrowserRuntime({ nodeId, active: true, visible: true, error: error?.message || "网页截图失败" });
            } finally {
                if (activeRef.current?.key.sessionId === active.key.sessionId) publishBrowserRuntime({ nodeId, active: true, visible: true, capturing: false });
            }
        };
        const back = (event: Event) => void navigateHistory(event, "back");
        const forward = (event: Event) => void navigateHistory(event, "forward");
        const actions: Record<string, (event: Event) => void> = {
            open: (event) => queue(() => open(event)),
            "select-tab": (event) => queue(() => open(event)),
            "new-tab": (event) => queue(() => newTab(event)),
            "close-tab": (event) => queue(() => closeTab(event)),
            close: (event) => queue(() => close(event)), resize, layout, capture, back, forward,
        };
        for (const [action, handler] of Object.entries(actions)) window.addEventListener(`canvas:browser-${action}`, handler);
        return () => {
            disposedRef.current = true;
            for (const [action, handler] of Object.entries(actions)) window.removeEventListener(`canvas:browser-${action}`, handler);
            if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
            for (const sessionId of sessionsRef.current.keys()) void disposeSession(sessionId);
        };
    }, []);

    useEffect(() => {
        const unsubscribe = useCanvasFlowStore.subscribe((state) => {
            for (const session of sessionsRef.current.values()) {
                const node = state.nodes.find((node) => node.id === session.nodeId && node.type === "browserNode");
                if (state.projectId !== session.key.projectId || !node || !(node.data as BrowserNodeData).tabs?.some((tab) => tab.id === session.tabId)) void disposeSession(session.key.sessionId);
            }
        });
        return unsubscribe;
    }, []);

    return null;
};
