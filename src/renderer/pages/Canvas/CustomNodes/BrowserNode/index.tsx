import { memo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { Camera, ChevronLeft, ChevronRight, Globe, Maximize2, Minimize2, RefreshCw, X } from "lucide-react";
import type { BrowserNodeType } from "shared/types/flow";
import { normalizeBrowserUrl } from "shared/utils/browserUrl";
import { cn } from "shared/utils/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ButtonHandle } from "@/components/button-handle";
import { NodeContextMenu } from "@/pages/Canvas/components/NodeContextMenu";
import { browserSupported, dispatchBrowserAction, requestBrowserLayoutSync, type BrowserRuntimeState } from "@/services/browserWebviewService";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

export const BrowserNode = memo(({ id, data, selected, dragging, width, height }: NodeProps<BrowserNodeType>) => {
    const [draft, setDraft] = useState(data.url);
    const [runtime, setRuntime] = useState<BrowserRuntimeState>({ nodeId: id, active: false });
    const [inputError, setInputError] = useState("");
    const [isFullscreen, setIsFullscreen] = useState(false);
    const supported = browserSupported();

    useEffect(() => { setDraft(data.url); }, [data.url]);
    useEffect(() => {
        const receive = (event: Event) => {
            const state = (event as CustomEvent<BrowserRuntimeState>).detail;
            if (state?.nodeId === id) setRuntime((previous) => ({ ...previous, ...state }));
        };
        window.addEventListener("canvas:browser-state", receive);
        return () => window.removeEventListener("canvas:browser-state", receive);
    }, [id]);

    useEffect(() => {
        requestBrowserLayoutSync(true);
        if (!isFullscreen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            setIsFullscreen(false);
        };
        window.addEventListener("keydown", onKeyDown, true);
        return () => window.removeEventListener("keydown", onKeyDown, true);
    }, [isFullscreen]);

    const navigate = () => {
        try {
            const url = normalizeBrowserUrl(draft);
            setInputError("");
            setDraft(url);
            dispatchBrowserAction("open", { nodeId: id, url });
        } catch (error: any) {
            setInputError(error?.message || "网址格式不正确");
        }
    };
    const close = () => {
        if (isFullscreen) {
            setIsFullscreen(false);
            return;
        }
        dispatchBrowserAction("close", { nodeId: id });
    };
    const enlarge = () => setIsFullscreen((current) => !current);
    const hiddenPreview = !runtime.active || !runtime.visible || data.collapsed;

    const browserContent = (
        <div data-browser-fullscreen={isFullscreen ? id : undefined} className={cn("relative flex flex-col overflow-visible border bg-black text-white", isFullscreen ? "h-full w-full" : "rounded-xl", !isFullscreen && selected ? "ring-2 ring-primary" : "border-border")} style={isFullscreen ? undefined : { width: width ?? 800, height: height ?? 520 }}>
            <NodeResizer
                isVisible={Boolean(!isFullscreen && (selected || runtime.active) && !dragging)} minWidth={360} minHeight={240}
                lineClassName="!border-primary/60"
                handleClassName="!z-10 !size-4 !border-2 !border-primary !bg-black"
                onResizeStart={() => dispatchBrowserAction("resize", { nodeId: id, resizing: true })}
                onResizeEnd={(_, size) => {
                    const store = useCanvasFlowStore.getState();
                    store.updateNodeDimensions(id, size.width, size.height);
                    store.requestHistorySave();
                    store.saveGraph();
                    dispatchBrowserAction("resize", { nodeId: id, resizing: false });
                }}
            />
            <div className="flex h-9 shrink-0 items-center gap-2 px-3 text-xs text-white/60">
                <Globe className="size-4" />
                <span className="min-w-0 flex-1 truncate">{data.title || "浏览器"}</span>
                <span>{runtime.loading ? "加载中" : data.collapsed ? "已收起" : runtime.active ? "当前网页" : "预览"}</span>
            </div>
            <form className="nodrag nopan nodelete nowheel flex shrink-0 items-center gap-2 px-2 pb-2" onSubmit={(event) => { event.preventDefault(); navigate(); }}>
                <Button type="button" size="sm" disabled={!supported || !runtime.active || runtime.loading} title="后退" onClick={() => dispatchBrowserAction("back", { nodeId: id })}><ChevronLeft data-icon="inline-start" /></Button>
                <Button type="button" size="sm" disabled={!supported || !runtime.active || runtime.loading} title="前进" onClick={() => dispatchBrowserAction("forward", { nodeId: id })}><ChevronRight data-icon="inline-start" /></Button>
                <Input className="min-w-0 flex-1 border-white/15 bg-black text-white placeholder:text-white/45" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="输入网址，例如 example.com" disabled={!supported} />
                <Button size="sm" disabled={!supported} title={isFullscreen ? "退出全屏" : "全屏浏览"} onClick={enlarge}>{isFullscreen ? <Minimize2 data-icon="inline-start" /> : <Maximize2 data-icon="inline-start" />}</Button>
                <Button type="submit" size="sm" disabled={!supported} title="打开或重新加载网页"><RefreshCw data-icon="inline-start" /></Button>
                <Button size="sm" disabled={!supported || !runtime.active || !runtime.visible || runtime.loading || runtime.capturing} title="截取当前网页并上传到项目存储" onClick={() => dispatchBrowserAction("capture", { nodeId: id })}><Camera data-icon="inline-start" /></Button>
                <Button size="sm" disabled={!isFullscreen && data.collapsed} title={isFullscreen ? "退出全屏" : "收起网页，保留节点"} onClick={close}><X data-icon="inline-start" /></Button>
            </form>
            {(inputError || runtime.error) && <div className="nodrag nopan px-3 pb-2 text-xs text-destructive">{inputError || runtime.error}</div>}
            {/* 原生网页不受 DOM 层级控制，边距为尺寸手柄保留命中区域。 */}
            <div data-browser-node-content={id} className="nodrag nopan nowheel relative mx-4 mb-4 min-h-0 flex-1 overflow-hidden rounded-lg bg-black">
                {hiddenPreview && data.screenshotUrl && <img src={data.screenshotUrl} alt="最近的网页截图" className="absolute inset-0 size-full object-contain" draggable={false} />}
                {hiddenPreview && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 p-4 text-center text-sm text-white/60">
                    <Globe className="size-8" />
                    <span>{!supported ? "浏览器节点仅支持 Windows 桌面端" : runtime.capturing ? "正在生成图片节点…" : runtime.error ? "网页暂不可用，请重新打开" : runtime.active && !data.collapsed ? "画布交互或遮挡时暂停显示网页" : data.url ? "打开网页后可交互浏览和截图" : "在地址栏输入网址开始浏览"}</span>
                    {supported && data.url && !runtime.active && <Button size="sm" onClick={navigate}>打开网页</Button>}
                </div>}
            </div>
            {!isFullscreen && <ButtonHandle type="target" position={Position.Left} id="input" visible />}
            {!isFullscreen && <ButtonHandle type="source" position={Position.Right} id="output" visible />}
        </div>
    );

    return (
        <NodeContextMenu onDuplicate={() => useCanvasFlowStore.getState().duplicateNode(id)} onDelete={() => useCanvasFlowStore.getState().deleteNode(id)}>
            {isFullscreen ? (
                <div className="flex items-center justify-center rounded-xl border border-border bg-black text-sm text-white/60" style={{ width: width ?? 800, height: height ?? 520 }}>
                    正在全屏浏览
                    {createPortal(<div className="nodrag nopan nodelete noflow nowheel fixed inset-0 z-100">{browserContent}</div>, document.body)}
                </div>
            ) : browserContent}
        </NodeContextMenu>
    );
});
BrowserNode.displayName = "BrowserNode";
