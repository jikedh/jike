import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { uploadFileToOSS } from "service/oss";
import { GenerationStatus } from "shared/constants/enum";
import { normalizeBrowserUrl } from "shared/utils/browserUrl";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { browserSupported, browserWebviewService, publishBrowserRuntime, type BrowserKey, type BrowserLayout, type BrowserNativeState } from "@/services/browserWebviewService";

const makeSessionId = () => crypto.randomUUID();

const hasBlockingOverlay = () =>
    Boolean(
        document.querySelector(
            '[data-slot="dialog-content"], [data-slot="drawer-content"], #panorama-root, .yarl__root, [role="menu"], .canvas-batch-toolbar',
        ),
    );

export const BrowserWebviewLayer = ({ interacting }: { interacting: boolean }) => {
    const activeRef = useRef<{ nodeId: string; key: BrowserKey } | null>(null);
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
        await browserWebviewService.close(active.key).catch(() => undefined);
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
        const flowRect = flow.getBoundingClientRect();
        const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
        const transform = viewport ? new DOMMatrixReadOnly(getComputedStyle(viewport).transform) : new DOMMatrixReadOnly();
        const zoom = transform.a || 1;
        const fullyVisible = rect.left >= flowRect.left && rect.top >= flowRect.top && rect.right <= flowRect.right && rect.bottom <= flowRect.bottom;
        const visible = !interactingRef.current && !nodeInteractionRef.current && !hasBlockingOverlay() && fullyVisible && zoom >= 0.5 && zoom <= 1.6;
        const layout: BrowserLayout = { key: active.key, bounds: { x: rect.left - flowRect.left, y: rect.top - flowRect.top, width: rect.width, height: rect.height }, zoom, visible };
        syncInFlightRef.current = true;
        try {
            await browserWebviewService.sync(layout);
            if (activeRef.current?.key.sessionId !== active.key.sessionId) return;
            publishBrowserRuntime({ nodeId: active.nodeId, active: true, visible });
        } catch (error: any) {
            if (activeRef.current?.key.sessionId !== active.key.sessionId) return;
            publishBrowserRuntime({ nodeId: active.nodeId, active: false, visible: false, error: error?.message || "网页布局同步失败" });
            await closeActive(active.nodeId);
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
        let unsubscribe: (() => void) | undefined;
        void listen<BrowserNativeState>("browser:state", (event) => {
            const active = activeRef.current;
            const state = event.payload;
            if (!active || active.key.nodeId !== state.nodeId || active.key.sessionId !== state.sessionId) return;
            useCanvasFlowStore.getState().updateBrowserNodeData(state.nodeId, { url: state.url, title: state.title });
            publishBrowserRuntime({ nodeId: state.nodeId, active: true, visible: !interactingRef.current, loading: state.loading, error: state.error });
        }).then((dispose) => { unsubscribe = dispose; });
        return () => unsubscribe?.();
    }, []);

    useEffect(() => {
        const open = async (event: Event) => {
            if (!browserSupported()) return;
            const { nodeId, url } = (event as CustomEvent<{ nodeId: string; url: string }>).detail;
            try {
                const normalized = normalizeBrowserUrl(url);
                await closeActive();
                const projectId = useCanvasFlowStore.getState().projectId;
                if (!projectId) throw new Error("请先保存并进入一个项目画布");
                const key = { projectId, nodeId, sessionId: makeSessionId() };
                activeRef.current = { nodeId, key };
                const store = useCanvasFlowStore.getState();
                store.updateBrowserNodeData(nodeId, { url: normalized, collapsed: false });
                store.requestHistorySave();
                store.saveGraph();
                const target = document.querySelector<HTMLElement>(`[data-browser-node-content="${CSS.escape(nodeId)}"]`);
                const flow = document.querySelector<HTMLElement>(".react-flow");
                if (!target || !flow) throw new Error("浏览器节点尚未准备完成");
                const rect = target.getBoundingClientRect(); const flowRect = flow.getBoundingClientRect();
                await browserWebviewService.open({ key, bounds: { x: Math.max(0, rect.left - flowRect.left), y: Math.max(0, rect.top - flowRect.top), width: Math.max(1, rect.width), height: Math.max(1, rect.height) }, zoom: 1, visible: false }, normalized);
                publishBrowserRuntime({ nodeId, active: true, visible: false, loading: true });
                scheduleSync();
            } catch (error: any) {
                const message = error?.message || "打开网页失败";
                publishBrowserRuntime({ nodeId, active: false, error: message });
                await closeActive(nodeId);
            }
        };
        const close = (event: Event) => {
            const { nodeId } = (event as CustomEvent<{ nodeId: string }>).detail;
            useCanvasFlowStore.getState().updateBrowserNodeData(nodeId, { collapsed: true });
            useCanvasFlowStore.getState().requestHistorySave();
            useCanvasFlowStore.getState().saveGraph();
            void closeActive(nodeId);
        };
        const resize = (event: Event) => {
            nodeInteractionRef.current = Boolean((event as CustomEvent<{ resizing?: boolean }>).detail.resizing);
            scheduleSync(!nodeInteractionRef.current);
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
                publishBrowserRuntime({ nodeId, active: true, visible: true, error: error?.message || "网页截图失败" });
            } finally {
                if (activeRef.current?.key.sessionId === active.key.sessionId) publishBrowserRuntime({ nodeId, active: true, visible: true, capturing: false });
            }
        };
        window.addEventListener("canvas:browser-open", open); window.addEventListener("canvas:browser-close", close); window.addEventListener("canvas:browser-resize", resize); window.addEventListener("canvas:browser-layout", layout); window.addEventListener("canvas:browser-capture", capture);
        return () => { window.removeEventListener("canvas:browser-open", open); window.removeEventListener("canvas:browser-close", close); window.removeEventListener("canvas:browser-resize", resize); window.removeEventListener("canvas:browser-layout", layout); window.removeEventListener("canvas:browser-capture", capture); void closeActive(); };
    }, []);

    useEffect(() => {
        const unsubscribe = useCanvasFlowStore.subscribe((state) => {
            const active = activeRef.current;
            if (active && !state.nodes.some((node) => node.id === active.nodeId && node.type === "browserNode")) void closeActive(active.nodeId);
        });
        return unsubscribe;
    }, []);

    return null;
};
