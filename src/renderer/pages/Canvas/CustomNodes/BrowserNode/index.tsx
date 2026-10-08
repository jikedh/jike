import { memo, useEffect, useState } from "react";
import { NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { Camera, Globe, Maximize2, RefreshCw, X } from "lucide-react";
import type { BrowserNodeType } from "shared/types/flow";
import { normalizeBrowserUrl } from "shared/utils/browserUrl";
import { cn } from "shared/utils/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ButtonHandle } from "@/components/button-handle";
import { NodeContextMenu } from "@/pages/Canvas/components/NodeContextMenu";
import { browserSupported, dispatchBrowserAction, type BrowserRuntimeState } from "@/services/browserWebviewService";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

export const BrowserNode = memo(({ id, data, selected, dragging, width, height }: NodeProps<BrowserNodeType>) => {
    const [draft, setDraft] = useState(data.url);
    const [runtime, setRuntime] = useState<BrowserRuntimeState>({ nodeId: id, active: false });
    const [inputError, setInputError] = useState("");
    const supported = browserSupported();

    useEffect(() => { setDraft(data.url); }, [data.url]);
    useEffect(() => {
        const receive = (event: Event) => {
            const state = (event as CustomEvent<BrowserRuntimeState>).detail;
            if (state?.nodeId === id) setRuntime(state);
        };
        window.addEventListener("canvas:browser-state", receive);
        return () => window.removeEventListener("canvas:browser-state", receive);
    }, [id]);

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
    const close = () => dispatchBrowserAction("close", { nodeId: id });
    const enlarge = () => {
        const store = useCanvasFlowStore.getState();
        store.updateNodeDimensions(id, Math.max(width ?? 800, 1200), Math.max(height ?? 520, 800));
        store.requestHistorySave();
        store.saveGraph();
        dispatchBrowserAction("resize", { nodeId: id, resizing: false });
    };
    const hiddenPreview = !runtime.active || !runtime.visible || data.collapsed;

    return (
        <NodeContextMenu onDuplicate={() => useCanvasFlowStore.getState().duplicateNode(id)} onDelete={() => useCanvasFlowStore.getState().deleteNode(id)}>
            <div className={cn("relative flex flex-col overflow-visible rounded-xl border bg-background text-foreground", selected ? "ring-2 ring-primary" : "border-border")} style={{ width: width ?? 800, height: height ?? 520 }}>
                <NodeResizer
                    isVisible={Boolean((selected || runtime.active) && !dragging)} minWidth={360} minHeight={240}
                    lineClassName="!border-primary/60"
                    handleClassName="!z-10 !size-4 !border-2 !border-primary !bg-background"
                    onResizeStart={() => dispatchBrowserAction("resize", { nodeId: id, resizing: true })}
                    onResizeEnd={(_, size) => {
                        const store = useCanvasFlowStore.getState();
                        store.updateNodeDimensions(id, size.width, size.height);
                        store.requestHistorySave();
                        store.saveGraph();
                        dispatchBrowserAction("resize", { nodeId: id, resizing: false });
                    }}
                />
                <div className="flex h-9 shrink-0 items-center gap-2 px-3 text-xs text-muted-foreground">
                    <Globe className="size-4" />
                    <span className="min-w-0 flex-1 truncate">{data.title || "浏览器"}</span>
                    <span>{runtime.loading ? "加载中" : data.collapsed ? "已收起" : runtime.active ? "当前网页" : "预览"}</span>
                </div>
                <form className="nodrag nopan nodelete nowheel flex shrink-0 items-center gap-2 px-2 pb-2" onSubmit={(event) => { event.preventDefault(); navigate(); }}>
                    <Input className="min-w-0 flex-1" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="输入网址，例如 example.com" disabled={!supported} />
                    <Button size="sm" disabled={!supported} title="放大浏览器节点" onClick={enlarge}><Maximize2 data-icon="inline-start" /></Button>
                    <Button type="submit" size="sm" disabled={!supported} title="打开或重新加载网页"><RefreshCw data-icon="inline-start" /></Button>
                    <Button size="sm" disabled={!supported || !runtime.active || !runtime.visible || runtime.loading || runtime.capturing} title="截取当前网页并上传到项目存储" onClick={() => dispatchBrowserAction("capture", { nodeId: id })}><Camera data-icon="inline-start" /></Button>
                    <Button size="sm" disabled={data.collapsed} title="收起网页，保留节点" onClick={close}><X data-icon="inline-start" /></Button>
                </form>
                {(inputError || runtime.error) && <div className="nodrag nopan px-3 pb-2 text-xs text-destructive">{inputError || runtime.error}</div>}
                {/* 原生网页不受 DOM 层级控制，边距为尺寸手柄保留命中区域。 */}
                <div data-browser-node-content={id} className="nodrag nopan nowheel relative mx-4 mb-4 min-h-0 flex-1 overflow-hidden rounded-lg bg-muted">
                    {hiddenPreview && data.screenshotUrl && <img src={data.screenshotUrl} alt="最近的网页截图" className="absolute inset-0 size-full object-contain" draggable={false} />}
                    {hiddenPreview && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/75 p-4 text-center text-sm text-muted-foreground">
                        <Globe className="size-8" />
                        <span>{!supported ? "浏览器节点仅支持 Windows 桌面端" : runtime.capturing ? "正在生成图片节点…" : runtime.error ? "网页暂不可用，请重新打开" : runtime.active && !data.collapsed ? "画布交互或遮挡时暂停显示网页" : data.url ? "打开网页后可交互浏览和截图" : "在地址栏输入网址开始浏览"}</span>
                        {supported && data.url && !runtime.active && <Button size="sm" onClick={navigate}>打开网页</Button>}
                    </div>}
                </div>
                <ButtonHandle type="target" position={Position.Left} id="input" visible />
                <ButtonHandle type="source" position={Position.Right} id="output" visible />
            </div>
        </NodeContextMenu>
    );
});
BrowserNode.displayName = "BrowserNode";
