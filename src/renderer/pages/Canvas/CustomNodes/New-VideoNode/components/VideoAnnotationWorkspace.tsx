import {
    IconArrowBackUp,
    IconArrowForwardUp,
    IconArrowsMove,
    IconBrush,
    IconChevronDown,
    IconChevronUp,
    IconEraser,
    IconEye,
    IconEyeOff,
    IconPlayerPause,
    IconPlayerPlay,
    IconPlus,
    IconRefresh,
    IconTrash,
} from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { VideoPlayer } from "@/components/ui/video-player";
import { cn } from "shared/utils/utils";

type Point = {
    x: number;
    y: number;
};

type Stroke = {
    tool: "brush" | "eraser";
    color: string;
    width: number;
    points: Point[];
};

type AnnotationLayer = {
    id: string;
    name: string;
    start: number;
    end: number;
    color: string;
    strokeWidth: number;
    strokes: Stroke[];
    redoStrokes: Stroke[];
    visible: boolean;
};

export type VideoAnnotationLayerPayload = {
    id: string;
    name: string;
    overlayFile: File;
    start: number;
    end: number;
    strokeCount: number;
};

export type VideoAnnotationPayload = {
    layers: VideoAnnotationLayerPayload[];
    frameTime: number;
    sourceWidth: number;
    sourceHeight: number;
    strokeCount: number;
};

type VideoAnnotationWorkspaceProps = {
    open: boolean;
    videoUrl: string;
    initialTime: number;
    onClose: () => void;
    onSubmit: (payload: VideoAnnotationPayload) => Promise<void> | void;
    isSubmitting?: boolean;
};

enum AnnotationTool {
    Brush = "brush",
    Eraser = "eraser",
    Pan = "pan",
}

const DEFAULT_COLOR = "#ff3b30";
const DEFAULT_STROKE_WIDTH = 8;
const MIN_RANGE_SECONDS = 0.5;
const MAX_OVERLAY_EDGE = 4096;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

const clamp = (value: number, min: number, max: number) => {
    return Math.min(Math.max(value, min), max);
};

const formatTime = (seconds: number) => {
    const milliseconds = Math.max(0, Math.round(seconds * 1000));
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const remainSeconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainSeconds).padStart(2, "0")}.${String(milliseconds % 1000).padStart(3, "0")}`;
};

const createLayer = (nameIndex: number, start: number, end: number): AnnotationLayer => ({
    id: `annotation-layer-${Date.now()}-${nameIndex}-${Math.random().toString(36).slice(2, 8)}`,
    name: `标注显示区间${nameIndex}`,
    start,
    end,
    color: DEFAULT_COLOR,
    strokeWidth: DEFAULT_STROKE_WIDTH,
    strokes: [],
    redoStrokes: [],
    visible: true,
});

const drawStroke = (
    context: CanvasRenderingContext2D,
    stroke: Stroke,
    width: number,
    height: number,
) => {
    const points = stroke.points;
    if (points.length === 0) return;

    context.save();
    context.globalCompositeOperation =
        stroke.tool === "eraser" ? "destination-out" : "source-over";
    context.strokeStyle = stroke.color;
    context.fillStyle = stroke.color;
    context.lineWidth = Math.max(1, stroke.width * Math.min(width, height));
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(points[0].x * width, points[0].y * height);

    points.slice(1).forEach((point) => {
        context.lineTo(point.x * width, point.y * height);
    });
    context.stroke();

    if (points.length === 1) {
        context.beginPath();
        context.arc(
            points[0].x * width,
            points[0].y * height,
            context.lineWidth / 2,
            0,
            Math.PI * 2,
        );
        context.fill();
    }
    context.restore();
};

const drawStrokes = (
    canvas: HTMLCanvasElement,
    strokes: Stroke[],
    activeStroke?: Stroke | null,
) => {
    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach((stroke) => drawStroke(context, stroke, canvas.width, canvas.height));
    if (activeStroke) {
        drawStroke(context, activeStroke, canvas.width, canvas.height);
    }
};

const drawLayers = (
    canvas: HTMLCanvasElement,
    layers: AnnotationLayer[],
    currentTime: number,
    activeLayerId: string,
    activeStroke?: Stroke | null,
) => {
    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    [...layers].reverse().forEach((layer) => {
        if (!layer.visible || currentTime < layer.start || currentTime > layer.end) return;

        const layerCanvas = document.createElement("canvas");
        layerCanvas.width = canvas.width;
        layerCanvas.height = canvas.height;
        drawStrokes(
            layerCanvas,
            layer.strokes,
            layer.id === activeLayerId ? activeStroke : null,
        );
        context.drawImage(layerCanvas, 0, 0);
    });
};

const canvasToBlob = (canvas: HTMLCanvasElement) => {
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
};

export const VideoAnnotationWorkspace = ({
    open,
    videoUrl,
    initialTime,
    onClose,
    onSubmit,
    isSubmitting = false,
}: VideoAnnotationWorkspaceProps) => {
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const activeStrokeRef = useRef<Stroke | null>(null);
    const activeStrokeLayerIdRef = useRef("");
    const pendingPointRef = useRef<Point | null>(null);
    const redrawFrameRef = useRef(0);
    const layersRef = useRef<AnnotationLayer[]>([]);
    const currentTimeRef = useRef(0);
    const activeLayerIdRef = useRef("");
    const layerNameCounterRef = useRef(2);
    const panGestureRef = useRef<{
        pointerId: number;
        startX: number;
        startY: number;
        originX: number;
        originY: number;
    } | null>(null);
    const [layers, setLayers] = useState<AnnotationLayer[]>([]);
    const [activeLayerId, setActiveLayerId] = useState("");
    const [tool, setTool] = useState(AnnotationTool.Brush);
    const [duration, setDuration] = useState(0);
    const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 });
    const [videoBounds, setVideoBounds] = useState({ width: 0, height: 0 });
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [zoom, setZoom] = useState(MIN_ZOOM);
    const [pan, setPan] = useState({ x: 0, y: 0 });

    const activeLayer = layers.find((layer) => layer.id === activeLayerId) ?? null;

    const syncCanvasSize = useCallback(() => {
        const viewport = viewportRef.current;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!viewport || !video || !canvas || !video.videoWidth || !video.videoHeight) {
            return;
        }

        const rect = viewport.getBoundingClientRect();
        const containerRatio = rect.width / rect.height;
        const videoRatio = video.videoWidth / video.videoHeight;
        const width = containerRatio > videoRatio ? rect.height * videoRatio : rect.width;
        const height = containerRatio > videoRatio ? rect.height : rect.width / videoRatio;
        const pixelRatio = window.devicePixelRatio || 1;

        canvas.width = Math.max(1, Math.round(width * pixelRatio));
        canvas.height = Math.max(1, Math.round(height * pixelRatio));
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        setVideoBounds({ width, height });
        drawLayers(
            canvas,
            layersRef.current,
            currentTimeRef.current,
            activeLayerIdRef.current,
            activeStrokeRef.current,
        );
    }, []);

    const scheduleRedraw = useCallback(() => {
        if (redrawFrameRef.current) return;
        redrawFrameRef.current = window.requestAnimationFrame(() => {
            redrawFrameRef.current = 0;
            const canvas = canvasRef.current;
            if (canvas) {
                drawLayers(
                    canvas,
                    layersRef.current,
                    currentTimeRef.current,
                    activeLayerIdRef.current,
                    activeStrokeRef.current,
                );
            }
        });
    }, []);

    useEffect(() => {
        layersRef.current = layers;
        activeLayerIdRef.current = activeLayerId;
        currentTimeRef.current = currentTime;
        scheduleRedraw();
    }, [activeLayerId, currentTime, layers, scheduleRedraw]);

    useEffect(() => {
        if (!open) {
            videoRef.current?.pause();
            return;
        }

        const initialLayer = createLayer(1, 0, 0);
        setLayers([initialLayer]);
        setActiveLayerId(initialLayer.id);
        layersRef.current = [initialLayer];
        activeLayerIdRef.current = initialLayer.id;
        currentTimeRef.current = 0;
        layerNameCounterRef.current = 2;
        activeStrokeRef.current = null;
        activeStrokeLayerIdRef.current = "";
        setDuration(0);
        setSourceSize({ width: 0, height: 0 });
        setVideoBounds({ width: 0, height: 0 });
        setCurrentTime(0);
        setIsPlaying(false);
        setIsReady(false);
        setTool(AnnotationTool.Brush);
        setZoom(MIN_ZOOM);
        setPan({ x: 0, y: 0 });
    }, [open, videoUrl]);

    useEffect(() => {
        if (!open || !viewportRef.current) return;

        const observer = new ResizeObserver(() => {
            syncCanvasSize();
        });
        observer.observe(viewportRef.current);
        return () => observer.disconnect();
    }, [open, syncCanvasSize]);

    useEffect(() => {
        return () => {
            if (redrawFrameRef.current) {
                window.cancelAnimationFrame(redrawFrameRef.current);
            }
        };
    }, []);

    const getPoint = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        return {
            x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
            y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
        };
    }, []);

    const flushPendingPoint = useCallback(() => {
        if (!pendingPointRef.current || !activeStrokeRef.current) return;
        activeStrokeRef.current.points.push(pendingPointRef.current);
        pendingPointRef.current = null;
        scheduleRedraw();
    }, [scheduleRedraw]);

    const handlePointerDown = useCallback(
        (event: React.PointerEvent<HTMLCanvasElement>) => {
            if (!isReady || isSubmitting) return;

            event.preventDefault();
            videoRef.current?.pause();
            if (tool === AnnotationTool.Pan) {
                event.currentTarget.setPointerCapture(event.pointerId);
                panGestureRef.current = {
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    originX: pan.x,
                    originY: pan.y,
                };
                return;
            }

            if (
                !activeLayer ||
                !activeLayer.visible ||
                currentTime < activeLayer.start ||
                currentTime > activeLayer.end
            ) {
                return;
            }
            const point = getPoint(event);
            if (!point) return;

            event.currentTarget.setPointerCapture(event.pointerId);
            activeStrokeRef.current = {
                tool: tool === AnnotationTool.Eraser ? "eraser" : "brush",
                color: activeLayer.color,
                width: activeLayer.strokeWidth / Math.max(1, Math.min(videoBounds.width, videoBounds.height)),
                points: [point],
            };
            activeStrokeLayerIdRef.current = activeLayer.id;
            scheduleRedraw();
        },
        [activeLayer, currentTime, getPoint, isReady, isSubmitting, pan.x, pan.y, scheduleRedraw, tool, videoBounds.height, videoBounds.width],
    );

    const handlePointerMove = useCallback(
        (event: React.PointerEvent<HTMLCanvasElement>) => {
            const panGesture = panGestureRef.current;
            if (panGesture?.pointerId === event.pointerId) {
                setPan({
                    x: panGesture.originX + event.clientX - panGesture.startX,
                    y: panGesture.originY + event.clientY - panGesture.startY,
                });
                return;
            }
            if (!activeStrokeRef.current) return;
            const point = getPoint(event);
            if (!point) return;
            pendingPointRef.current = point;
            if (!redrawFrameRef.current) {
                redrawFrameRef.current = window.requestAnimationFrame(() => {
                    redrawFrameRef.current = 0;
                    flushPendingPoint();
                });
            }
        },
        [flushPendingPoint, getPoint],
    );

    const finishPointerGesture = useCallback(
        (event: React.PointerEvent<HTMLCanvasElement>) => {
            if (panGestureRef.current?.pointerId === event.pointerId) {
                panGestureRef.current = null;
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                }
                return;
            }
            if (!activeStrokeRef.current) return;
            flushPendingPoint();
            const completedStroke = activeStrokeRef.current;
            const layerId = activeStrokeLayerIdRef.current;
            activeStrokeRef.current = null;
            activeStrokeLayerIdRef.current = "";
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
            setLayers((previous) => previous.map((layer) => (
                layer.id === layerId
                    ? { ...layer, strokes: [...layer.strokes, completedStroke], redoStrokes: [] }
                    : layer
            )));
            scheduleRedraw();
        },
        [flushPendingPoint, scheduleRedraw],
    );

    const handleUndo = useCallback(() => {
        setLayers((previous) => previous.map((layer) => {
            if (layer.id !== activeLayerId) return layer;
            const lastStroke = layer.strokes.at(-1);
            if (!lastStroke) return layer;
            return {
                ...layer,
                strokes: layer.strokes.slice(0, -1),
                redoStrokes: [...layer.redoStrokes, lastStroke],
            };
        }));
    }, [activeLayerId]);

    const handleRedo = useCallback(() => {
        setLayers((previous) => previous.map((layer) => {
            if (layer.id !== activeLayerId) return layer;
            const lastStroke = layer.redoStrokes.at(-1);
            if (!lastStroke) return layer;
            return {
                ...layer,
                strokes: [...layer.strokes, lastStroke],
                redoStrokes: layer.redoStrokes.slice(0, -1),
            };
        }));
    }, [activeLayerId]);

    const handleClear = useCallback(() => {
        setLayers((previous) => previous.map((layer) => (
            layer.id === activeLayerId
                ? { ...layer, strokes: [], redoStrokes: [] }
                : layer
        )));
    }, [activeLayerId]);

    const handleRangeChange = useCallback(
        (layerId: string, values: number[]) => {
            const start = clamp((values[0] ?? 0) / 1000, 0, duration);
            const end = clamp((values[1] ?? duration * 1000) / 1000, 0, duration);
            if (end - start >= MIN_RANGE_SECONDS) {
                setLayers((previous) => previous.map((layer) => (
                    layer.id === layerId ? { ...layer, start, end } : layer
                )));
            }
        },
        [duration],
    );

    const handleSelectLayer = useCallback((layer: AnnotationLayer) => {
        setActiveLayerId(layer.id);
        const video = videoRef.current;
        if (video && (video.currentTime < layer.start || video.currentTime > layer.end)) {
            video.pause();
            video.currentTime = layer.start;
            setCurrentTime(layer.start);
        }
    }, []);

    const handleAddLayer = useCallback(() => {
        const start = clamp(currentTime, 0, duration);
        const end = Math.min(duration, start + 1);
        const safeStart = end - start < MIN_RANGE_SECONDS
            ? Math.max(0, end - MIN_RANGE_SECONDS)
            : start;
        const layer = createLayer(layerNameCounterRef.current, safeStart, end);
        layerNameCounterRef.current += 1;
        setLayers((previous) => [layer, ...previous]);
        setActiveLayerId(layer.id);
    }, [currentTime, duration]);

    const handleDeleteLayer = useCallback((layerId: string) => {
        setLayers((previous) => {
            const next = previous.filter((layer) => layer.id !== layerId);
            if (activeLayerId === layerId) {
                setActiveLayerId(next[0]?.id ?? "");
            }
            return next;
        });
    }, [activeLayerId]);

    const handleMoveLayer = useCallback((layerId: string, offset: -1 | 1) => {
        setLayers((previous) => {
            const index = previous.findIndex((layer) => layer.id === layerId);
            const targetIndex = index + offset;
            if (index < 0 || targetIndex < 0 || targetIndex >= previous.length) return previous;
            const next = [...previous];
            [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
            return next;
        });
    }, []);

    const updateLayer = useCallback((layerId: string, patch: Partial<AnnotationLayer>) => {
        setLayers((previous) => previous.map((layer) => (
            layer.id === layerId ? { ...layer, ...patch } : layer
        )));
    }, []);

    const handleTogglePlayback = useCallback(() => {
        const video = videoRef.current;
        if (!video || !isReady) return;

        if (video.paused) {
            void video.play().catch((error: any) => {
                console.error("视频播放失败", error);
            });
            return;
        }
        video.pause();
    }, [isReady]);

    const handleProgressChange = useCallback(
        (values: number[]) => {
            const video = videoRef.current;
            if (!video) return;

            const nextTime = clamp((values[0] ?? 0) / 1000, 0, duration);
            video.pause();
            video.currentTime = nextTime;
            setCurrentTime(nextTime);
        },
        [duration],
    );

    const handleConfirm = useCallback(async () => {
        if (!sourceSize.width || !sourceSize.height) return;
        const drawableLayers = layers.filter((layer) => (
            layer.strokes.length > 0 && layer.end - layer.start >= MIN_RANGE_SECONDS
        ));
        if (drawableLayers.length === 0) return;

        const scale = Math.min(1, MAX_OVERLAY_EDGE / Math.max(sourceSize.width, sourceSize.height));
        const exportedLayers = await Promise.all(drawableLayers.map(async (layer, index) => {
            const exportCanvas = document.createElement("canvas");
            exportCanvas.width = Math.max(1, Math.round(sourceSize.width * scale));
            exportCanvas.height = Math.max(1, Math.round(sourceSize.height * scale));
            drawStrokes(exportCanvas, layer.strokes);
            const blob = await canvasToBlob(exportCanvas);
            if (!blob) throw new Error(`${layer.name}导出失败`);
            return {
                id: layer.id,
                name: layer.name,
                overlayFile: new File([blob], `video-annotation-${index + 1}.png`, { type: "image/png" }),
                start: layer.start,
                end: layer.end,
                strokeCount: layer.strokes.length,
            };
        }));

        await onSubmit({
            layers: exportedLayers,
            frameTime: initialTime,
            sourceWidth: sourceSize.width,
            sourceHeight: sourceSize.height,
            strokeCount: exportedLayers.reduce((total, layer) => total + layer.strokeCount, 0),
        });
    }, [initialTime, layers, onSubmit, sourceSize.height, sourceSize.width]);

    const hasDrawableLayers = layers.some((layer) => layer.strokes.length > 0);
    const rangesValid = layers.every((layer) => layer.end - layer.start >= MIN_RANGE_SECONDS);
    const timelineMax = Math.max(1, Math.round(duration * 1000));

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
            <DialogContent
                overlayClassName="bg-black"
                className="nodrag nopan nowheel left-0 top-0 flex h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-0 bg-[#101012] p-0 text-white shadow-none"
            >
                <DialogHeader className="shrink-0 border-b border-white/10 bg-[#18181b] px-5 py-3">
                    <DialogTitle className="flex items-center justify-between gap-4 text-white">
                        <span className="flex items-center gap-2">
                            <IconBrush />
                            视频标注
                        </span>
                        <span className="text-xs font-normal text-white/45">
                            {activeLayer ? `当前图层：${activeLayer.name}` : "请添加标注显示区间"}
                        </span>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex min-h-0 flex-1">
                    <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#18181b] px-3 py-2">
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant={tool === AnnotationTool.Brush ? "blue" : "default"}
                                    onClick={() => setTool(AnnotationTool.Brush)}
                                    disabled={!activeLayer}
                                    className={cn(tool === AnnotationTool.Brush ? "bg-[#B43FEB] text-white hover:bg-[#C45BF0]" : "border-white/10 bg-transparent text-white/70 hover:bg-white/5")}
                                >
                                    <IconBrush data-icon="inline-start" />
                                    画笔
                                </Button>
                                <Button
                                    size="sm"
                                    variant={tool === AnnotationTool.Eraser ? "blue" : "default"}
                                    onClick={() => setTool(AnnotationTool.Eraser)}
                                    disabled={!activeLayer}
                                    className={cn(tool === AnnotationTool.Eraser ? "bg-[#B43FEB] text-white hover:bg-[#C45BF0]" : "border-white/10 bg-transparent text-white/70 hover:bg-white/5")}
                                >
                                    <IconEraser data-icon="inline-start" />
                                    橡皮
                                </Button>
                                <Button
                                    size="sm"
                                    variant={tool === AnnotationTool.Pan ? "blue" : "default"}
                                    onClick={() => setTool(AnnotationTool.Pan)}
                                    className={cn(tool === AnnotationTool.Pan ? "bg-[#B43FEB] text-white hover:bg-[#C45BF0]" : "border-white/10 bg-transparent text-white/70 hover:bg-white/5")}
                                >
                                    <IconArrowsMove data-icon="inline-start" />
                                    移动画面
                                </Button>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="default" onClick={handleUndo} disabled={!activeLayer?.strokes.length} className="size-8 border-white/10 bg-transparent p-0 text-white/70 hover:bg-white/5">
                                    <IconArrowBackUp />
                                </Button>
                                <Button size="sm" variant="default" onClick={handleRedo} disabled={!activeLayer?.redoStrokes.length} className="size-8 border-white/10 bg-transparent p-0 text-white/70 hover:bg-white/5">
                                    <IconArrowForwardUp />
                                </Button>
                                <Button size="sm" variant="default" onClick={handleClear} disabled={!activeLayer?.strokes.length} className="border-white/10 bg-transparent text-white/70 hover:bg-white/5">
                                    <IconTrash data-icon="inline-start" />
                                    清空当前层
                                </Button>
                            </div>

                            <div className="flex min-w-56 items-center gap-3">
                                <span className="shrink-0 text-xs text-white/55">缩放 {Math.round(zoom * 100)}%</span>
                                <Slider
                                    value={[Math.round(zoom * 100)]}
                                    min={MIN_ZOOM * 100}
                                    max={MAX_ZOOM * 100}
                                    step={10}
                                    disabled={!isReady}
                                    onValueChange={(values) => setZoom((values[0] ?? 100) / 100)}
                                    className="**:data-[slot=slider-track]:bg-white/10 **:data-[slot=slider-range]:bg-[#B43FEB] **:data-[slot=slider-thumb]:bg-white"
                                />
                                <Button size="sm" variant="default" onClick={() => { setZoom(MIN_ZOOM); setPan({ x: 0, y: 0 }); }} className="size-8 shrink-0 border-white/10 bg-transparent p-0 text-white/70 hover:bg-white/5">
                                    <IconRefresh />
                                </Button>
                            </div>
                        </div>

                        <div ref={viewportRef} className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-black">
                            <div
                                className="absolute origin-center"
                                style={{
                                    left: `calc(50% + ${pan.x}px)`,
                                    top: `calc(50% + ${pan.y}px)`,
                                    width: `${videoBounds.width}px`,
                                    height: `${videoBounds.height}px`,
                                    transform: `translate(-50%, -50%) scale(${zoom})`,
                                }}
                            >
                                <VideoPlayer
                                    ref={videoRef}
                                    src={videoUrl}
                                    containerClassName="h-full w-full rounded-none bg-black"
                                    videoClassName="h-full w-full object-fill"
                                    showDefaultControls={false}
                                    playsInline
                                    preload="metadata"
                                    onLoadedMetadata={(event) => {
                                        const video = event.currentTarget;
                                        const nextDuration = Number.isFinite(video.duration) ? video.duration : 0;
                                        const frameTime = clamp(initialTime, 0, nextDuration);
                                        const nextEnd = Math.min(nextDuration, frameTime + 1);
                                        const nextStart = nextEnd - frameTime < MIN_RANGE_SECONDS
                                            ? Math.max(0, nextEnd - MIN_RANGE_SECONDS)
                                            : frameTime;

                                        setDuration(nextDuration);
                                        setSourceSize({ width: video.videoWidth, height: video.videoHeight });
                                        setLayers((previous) => {
                                            const next = previous.map((layer, index) => (
                                                index === 0 ? { ...layer, start: nextStart, end: nextEnd } : layer
                                            ));
                                            layersRef.current = next;
                                            return next;
                                        });
                                        video.currentTime = frameTime;
                                        video.pause();
                                        setCurrentTime(frameTime);
                                        currentTimeRef.current = frameTime;
                                        setIsReady(video.videoWidth > 0 && video.videoHeight > 0 && nextDuration > 0);
                                        window.requestAnimationFrame(syncCanvasSize);
                                    }}
                                    onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                                    onPlay={() => setIsPlaying(true)}
                                    onPause={() => setIsPlaying(false)}
                                    onEnded={() => setIsPlaying(false)}
                                    onSeeked={() => window.requestAnimationFrame(syncCanvasSize)}
                                />
                                <canvas
                                    ref={canvasRef}
                                    className={cn(
                                        "nodrag nopan nowheel absolute inset-0 touch-none",
                                        tool === AnnotationTool.Pan ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair",
                                    )}
                                    onPointerDown={handlePointerDown}
                                    onPointerMove={handlePointerMove}
                                    onPointerUp={finishPointerGesture}
                                    onPointerCancel={finishPointerGesture}
                                />
                            </div>
                        </div>

                        <div className="rounded-lg border border-white/10 bg-[#18181b] px-4 py-3">
                            <div className="mb-2 flex items-center justify-between gap-4 text-xs text-white/60">
                                <span>播放进度</span>
                                <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
                            </div>
                            <Slider
                                value={[Math.round(currentTime * 1000)]}
                                min={0}
                                max={timelineMax}
                                step={100}
                                disabled={!isReady || isSubmitting}
                                onValueChange={handleProgressChange}
                                className="**:data-[slot=slider-track]:h-1.5 **:data-[slot=slider-track]:bg-white/10 **:data-[slot=slider-range]:bg-white/60 **:data-[slot=slider-thumb]:size-3.5 **:data-[slot=slider-thumb]:border-white **:data-[slot=slider-thumb]:bg-white"
                            />
                            <Button
                                size="sm"
                                variant="default"
                                onClick={handleTogglePlayback}
                                disabled={!isReady || isSubmitting}
                                className="mt-3 border-white/10 bg-transparent text-white hover:bg-white/10"
                            >
                                {isPlaying ? <IconPlayerPause data-icon="inline-start" /> : <IconPlayerPlay data-icon="inline-start" />}
                                {isPlaying ? "暂停" : "播放"}
                            </Button>
                        </div>
                    </div>

                    <aside className="flex w-95 shrink-0 flex-col border-l border-white/10 bg-[#151517]">
                        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                            <div>
                                <div className="text-sm font-semibold">标注图层与时间轴</div>
                                <div className="mt-1 text-xs text-white/45">列表顶部图层优先显示</div>
                            </div>
                            <Button size="sm" onClick={handleAddLayer} disabled={!isReady || duration < MIN_RANGE_SECONDS || isSubmitting} className="bg-[#B43FEB] text-white hover:bg-[#C45BF0]">
                                <IconPlus data-icon="inline-start" />
                                添加区间
                            </Button>
                        </div>

                        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
                            {layers.length === 0 && (
                                <div className="rounded-lg border border-dashed border-white/15 px-4 py-8 text-center text-sm text-white/45">
                                    暂无标注显示区间
                                </div>
                            )}
                            {layers.map((layer, index) => (
                                <div
                                    key={layer.id}
                                    className={cn(
                                        "flex flex-col gap-3 rounded-lg border bg-[#1d1d20] p-3",
                                        activeLayerId === layer.id ? "border-[#B43FEB]" : "border-white/10",
                                    )}
                                    onClick={() => handleSelectLayer(layer)}
                                >
                                    <div className="flex items-center gap-2">
                                        <Input
                                            value={layer.name}
                                            onChange={(event) => updateLayer(layer.id, { name: event.target.value })}
                                            onClick={(event) => event.stopPropagation()}
                                            disabled={isSubmitting}
                                            className="h-8 border-white/10 bg-black/20 text-white"
                                        />
                                        <Button size="sm" variant="default" onClick={(event) => { event.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }); }} className="size-8 shrink-0 border-white/10 bg-transparent p-0 text-white/70 hover:bg-white/5">
                                            {layer.visible ? <IconEye /> : <IconEyeOff />}
                                        </Button>
                                        <Button size="sm" variant="default" onClick={(event) => { event.stopPropagation(); handleMoveLayer(layer.id, -1); }} disabled={index === 0 || isSubmitting} className="size-8 shrink-0 border-white/10 bg-transparent p-0 text-white/70 hover:bg-white/5">
                                            <IconChevronUp />
                                        </Button>
                                        <Button size="sm" variant="default" onClick={(event) => { event.stopPropagation(); handleMoveLayer(layer.id, 1); }} disabled={index === layers.length - 1 || isSubmitting} className="size-8 shrink-0 border-white/10 bg-transparent p-0 text-white/70 hover:bg-white/5">
                                            <IconChevronDown />
                                        </Button>
                                        <Button size="sm" variant="default" onClick={(event) => { event.stopPropagation(); handleDeleteLayer(layer.id); }} disabled={isSubmitting} className="size-8 shrink-0 border-white/10 bg-transparent p-0 text-red-300 hover:bg-red-500/10">
                                            <IconTrash />
                                        </Button>
                                    </div>

                                    <div>
                                        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-white/55">
                                            <span>显示区间</span>
                                            <span>{formatTime(layer.start)} - {formatTime(layer.end)}</span>
                                        </div>
                                        <Slider
                                            value={[Math.round(layer.start * 1000), Math.round(layer.end * 1000)]}
                                            min={0}
                                            max={timelineMax}
                                            step={100}
                                            minStepsBetweenThumbs={5}
                                            disabled={!isReady || isSubmitting}
                                            onValueChange={(values) => handleRangeChange(layer.id, values)}
                                            onClick={(event) => event.stopPropagation()}
                                            className="**:data-[slot=slider-track]:h-1.5 **:data-[slot=slider-track]:bg-white/10 **:data-[slot=slider-range]:bg-[#B43FEB] **:data-[slot=slider-thumb]:size-4 **:data-[slot=slider-thumb]:border-[#f1d2ff] **:data-[slot=slider-thumb]:bg-[#B43FEB]"
                                        />
                                    </div>

                                    <div className="grid grid-cols-[72px_1fr] items-center gap-x-3 gap-y-3 text-xs text-white/55">
                                        <span>画笔颜色</span>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="color"
                                                value={layer.color}
                                                onChange={(event) => updateLayer(layer.id, { color: event.target.value })}
                                                onClick={(event) => event.stopPropagation()}
                                                disabled={isSubmitting}
                                                className="size-9 cursor-pointer border-white/10 bg-transparent p-1"
                                            />
                                            <span className="font-mono text-white/70">{layer.color.toUpperCase()}</span>
                                        </div>
                                        <span>画笔粗细</span>
                                        <div className="flex items-center gap-3">
                                            <Slider
                                                value={[layer.strokeWidth]}
                                                min={1}
                                                max={60}
                                                step={1}
                                                disabled={isSubmitting}
                                                onValueChange={(values) => updateLayer(layer.id, { strokeWidth: values[0] ?? DEFAULT_STROKE_WIDTH })}
                                                onClick={(event) => event.stopPropagation()}
                                                className="**:data-[slot=slider-track]:bg-white/10 **:data-[slot=slider-range]:bg-[#B43FEB] **:data-[slot=slider-thumb]:bg-white"
                                            />
                                            <span className="w-10 text-right text-white/70">{layer.strokeWidth}px</span>
                                        </div>
                                    </div>

                                    <div className="text-right text-xs text-white/35">{layer.strokes.length} 笔</div>
                                </div>
                            ))}
                        </div>
                    </aside>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 bg-[#18181b] px-5 py-3">
                    <span className="text-xs text-white/45">放大后选择“移动画面”，可拖动定位需要标注的视频区域。</span>
                    <div className="flex items-center gap-3">
                        <Button variant="default" onClick={onClose} disabled={isSubmitting} className="border-white/10 bg-transparent text-white/70 hover:bg-white/5 hover:text-white">
                            取消
                        </Button>
                        <Button
                            onClick={() => void handleConfirm()}
                            disabled={!isReady || isSubmitting || !hasDrawableLayers || !rangesValid}
                            className="bg-[#B43FEB] text-white hover:bg-[#C45BF0]"
                        >
                            {isSubmitting ? "烧录中..." : "生成标注视频"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
