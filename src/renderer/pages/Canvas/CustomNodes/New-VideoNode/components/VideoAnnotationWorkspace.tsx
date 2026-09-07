import {
    IconArrowBackUp,
    IconArrowForwardUp,
    IconBrush,
    IconEraser,
    IconPlayerPause,
    IconPlayerPlay,
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

export type VideoAnnotationPayload = {
    overlayFile: File;
    start: number;
    end: number;
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

const COLOR_OPTIONS = [
    "#ff3b30",
    "#ff9500",
    "#ffcc00",
    "#34c759",
    "#0a84ff",
    "#bf5af2",
    "#ffffff",
] as const;
const STROKE_WIDTHS = [4, 8, 14, 22] as const;
const MIN_RANGE_SECONDS = 0.5;
const MAX_OVERLAY_EDGE = 4096;

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
    const pendingPointRef = useRef<Point | null>(null);
    const redrawFrameRef = useRef(0);
    const strokesRef = useRef<Stroke[]>([]);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [redoStrokes, setRedoStrokes] = useState<Stroke[]>([]);
    const [tool, setTool] = useState<"brush" | "eraser">("brush");
    const [color, setColor] = useState<string>(COLOR_OPTIONS[0]);
    const [strokeWidth, setStrokeWidth] = useState<number>(8);
    const [duration, setDuration] = useState(0);
    const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 });
    const [videoBounds, setVideoBounds] = useState({ width: 0, height: 0 });
    const [range, setRange] = useState([0, 0]);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isReady, setIsReady] = useState(false);

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
        drawStrokes(canvas, strokesRef.current, activeStrokeRef.current);
    }, []);

    const scheduleRedraw = useCallback(() => {
        if (redrawFrameRef.current) return;
        redrawFrameRef.current = window.requestAnimationFrame(() => {
            redrawFrameRef.current = 0;
            const canvas = canvasRef.current;
            if (canvas) {
                drawStrokes(canvas, strokesRef.current, activeStrokeRef.current);
            }
        });
    }, []);

    useEffect(() => {
        strokesRef.current = strokes;
        scheduleRedraw();
    }, [scheduleRedraw, strokes]);

    useEffect(() => {
        if (!open) {
            videoRef.current?.pause();
            return;
        }

        setStrokes([]);
        setRedoStrokes([]);
        strokesRef.current = [];
        activeStrokeRef.current = null;
        setDuration(0);
        setSourceSize({ width: 0, height: 0 });
        setVideoBounds({ width: 0, height: 0 });
        setRange([0, 0]);
        setCurrentTime(0);
        setIsPlaying(false);
        setIsReady(false);
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
            const point = getPoint(event);
            if (!point) return;

            event.preventDefault();
            videoRef.current?.pause();
            event.currentTarget.setPointerCapture(event.pointerId);
            activeStrokeRef.current = {
                tool,
                color,
                width: strokeWidth / Math.max(1, Math.min(videoBounds.width, videoBounds.height)),
                points: [point],
            };
            scheduleRedraw();
        },
        [color, getPoint, isReady, isSubmitting, scheduleRedraw, strokeWidth, tool, videoBounds.height, videoBounds.width],
    );

    const handlePointerMove = useCallback(
        (event: React.PointerEvent<HTMLCanvasElement>) => {
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

    const finishStroke = useCallback(
        (event: React.PointerEvent<HTMLCanvasElement>) => {
            if (!activeStrokeRef.current) return;
            flushPendingPoint();
            const completedStroke = activeStrokeRef.current;
            activeStrokeRef.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
            setStrokes((previous) => [...previous, completedStroke]);
            setRedoStrokes([]);
            scheduleRedraw();
        },
        [flushPendingPoint, scheduleRedraw],
    );

    const handleUndo = useCallback(() => {
        setStrokes((previous) => {
            const lastStroke = previous.at(-1);
            if (!lastStroke) return previous;
            setRedoStrokes((redo) => [...redo, lastStroke]);
            return previous.slice(0, -1);
        });
    }, []);

    const handleRedo = useCallback(() => {
        setRedoStrokes((previous) => {
            const lastStroke = previous.at(-1);
            if (!lastStroke) return previous;
            setStrokes((items) => [...items, lastStroke]);
            return previous.slice(0, -1);
        });
    }, []);

    const handleClear = useCallback(() => {
        setStrokes([]);
        setRedoStrokes([]);
    }, []);

    const handleRangeChange = useCallback(
        (values: number[]) => {
            const start = clamp((values[0] ?? 0) / 1000, 0, duration);
            const end = clamp((values[1] ?? duration * 1000) / 1000, 0, duration);
            if (end - start >= MIN_RANGE_SECONDS) {
                setRange([start, end]);
            }
        },
        [duration],
    );

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
        if (!sourceSize.width || !sourceSize.height || strokes.length === 0) return;
        const [start, end] = range;
        if (end - start < MIN_RANGE_SECONDS) return;

        const scale = Math.min(1, MAX_OVERLAY_EDGE / Math.max(sourceSize.width, sourceSize.height));
        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = Math.max(1, Math.round(sourceSize.width * scale));
        exportCanvas.height = Math.max(1, Math.round(sourceSize.height * scale));
        drawStrokes(exportCanvas, strokes);

        const blob = await new Promise<Blob | null>((resolve) => {
            exportCanvas.toBlob(resolve, "image/png");
        });
        if (!blob) {
            throw new Error("标注图层导出失败");
        }

        await onSubmit({
            overlayFile: new File([blob], "video-annotation.png", { type: "image/png" }),
            start,
            end,
            frameTime: initialTime,
            sourceWidth: sourceSize.width,
            sourceHeight: sourceSize.height,
            strokeCount: strokes.length,
        });
    }, [initialTime, onSubmit, range, sourceSize.height, sourceSize.width, strokes]);

    const rangeValid = range[1] - range[0] >= MIN_RANGE_SECONDS;
    const isAnnotationVisible = currentTime >= range[0] && currentTime <= range[1];

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
            <DialogContent className="nodrag nopan nowheel flex h-[min(860px,94vh)] w-[min(1120px,96vw)] max-w-none flex-col overflow-hidden border border-white/10 bg-[#121214] p-0 text-white">
                <DialogHeader className="shrink-0 border-b border-white/5 bg-[#18181b] px-5 py-4">
                    <DialogTitle className="flex items-center gap-2 text-white">
                        <IconBrush size={18} />
                        视频标注
                    </DialogTitle>
                </DialogHeader>

                <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
                    <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-white/8 bg-black">
                        <div ref={viewportRef} className="relative h-full w-full">
                            <VideoPlayer
                                ref={videoRef}
                                src={videoUrl}
                                containerClassName="h-full w-full rounded-none bg-black"
                                videoClassName="h-full w-full object-contain"
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
                                    setRange([nextStart, nextEnd]);
                                    video.currentTime = frameTime;
                                    video.pause();
                                    setCurrentTime(frameTime);
                                    setIsReady(video.videoWidth > 0 && video.videoHeight > 0 && nextDuration > 0);
                                    window.requestAnimationFrame(syncCanvasSize);
                                }}
                                onTimeUpdate={(event) => {
                                    setCurrentTime(event.currentTarget.currentTime);
                                }}
                                onPlay={() => setIsPlaying(true)}
                                onPause={() => setIsPlaying(false)}
                                onEnded={() => setIsPlaying(false)}
                                onSeeked={() => {
                                    videoRef.current?.pause();
                                    window.requestAnimationFrame(syncCanvasSize);
                                }}
                            />
                            <canvas
                                ref={canvasRef}
                                className={cn(
                                    "nodrag nopan nowheel absolute left-1/2 top-1/2 touch-none -translate-x-1/2 -translate-y-1/2 cursor-crosshair",
                                    !isAnnotationVisible && "invisible",
                                )}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={finishStroke}
                                onPointerCancel={finishStroke}
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/8 bg-[#18181b] px-4 py-3">
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant={tool === "brush" ? "blue" : "default"}
                                onClick={() => setTool("brush")}
                                className={cn(tool === "brush" ? "bg-[#B43FEB] text-white hover:bg-[#C45BF0]" : "border-white/10 bg-transparent text-white/70 hover:bg-white/5")}
                            >
                                <IconBrush data-icon="inline-start" />
                                画笔
                            </Button>
                            <Button
                                size="sm"
                                variant={tool === "eraser" ? "blue" : "default"}
                                onClick={() => setTool("eraser")}
                                className={cn(tool === "eraser" ? "bg-[#B43FEB] text-white hover:bg-[#C45BF0]" : "border-white/10 bg-transparent text-white/70 hover:bg-white/5")}
                            >
                                <IconEraser data-icon="inline-start" />
                                橡皮
                            </Button>
                        </div>

                        <div className="flex items-center gap-2">
                            {COLOR_OPTIONS.map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    className={cn(
                                        "size-6 rounded-full border border-white/30",
                                        color === option && "ring-2 ring-[#B43FEB] ring-offset-2 ring-offset-[#18181b]",
                                    )}
                                    style={{ backgroundColor: option }}
                                    onClick={() => setColor(option)}
                                    title={option}
                                />
                            ))}
                        </div>

                        <div className="flex items-center gap-2">
                            {STROKE_WIDTHS.map((value) => (
                                <Button
                                    key={value}
                                    size="sm"
                                    variant={strokeWidth === value ? "blue" : "default"}
                                    onClick={() => setStrokeWidth(value)}
                                    className={cn("size-8 p-0", strokeWidth === value ? "bg-[#B43FEB] text-white hover:bg-[#C45BF0]" : "border-white/10 bg-transparent text-white/70 hover:bg-white/5")}
                                    title={`${value}px`}
                                >
                                    <span style={{ fontSize: `${Math.max(10, value)}px`, lineHeight: 1 }}>●</span>
                                </Button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2">
                            <Button size="sm" variant="default" onClick={handleUndo} disabled={strokes.length === 0} className="size-8 p-0 border-white/10 bg-transparent text-white/70 hover:bg-white/5">
                                <IconArrowBackUp />
                            </Button>
                            <Button size="sm" variant="default" onClick={handleRedo} disabled={redoStrokes.length === 0} className="size-8 p-0 border-white/10 bg-transparent text-white/70 hover:bg-white/5">
                                <IconArrowForwardUp />
                            </Button>
                            <Button size="sm" variant="default" onClick={handleClear} disabled={strokes.length === 0} className="border-white/10 bg-transparent text-white/70 hover:bg-white/5">
                                <IconTrash data-icon="inline-start" />
                                清空
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-lg border border-white/8 bg-[#18181b] px-4 py-3">
                        <div className="mb-3 flex items-center justify-between gap-4 text-xs text-white/60">
                            <span>标注显示区间</span>
                            <span>{formatTime(range[0])} - {formatTime(range[1])}</span>
                        </div>
                        <Slider
                            value={[Math.round(range[0] * 1000), Math.round(range[1] * 1000)]}
                            min={0}
                            max={Math.max(1000, Math.round(duration * 1000))}
                            step={100}
                            disabled={!isReady || isSubmitting}
                            onValueChange={handleRangeChange}
                            className="**:data-[slot=slider-track]:h-1.5 **:data-[slot=slider-track]:bg-white/10 **:data-[slot=slider-range]:bg-[#B43FEB] **:data-[slot=slider-thumb]:size-4 **:data-[slot=slider-thumb]:border-[#f1d2ff] **:data-[slot=slider-thumb]:bg-[#B43FEB]"
                        />
                        <div className="mt-4">
                            <div className="mb-3 flex items-center justify-between gap-4 text-xs text-white/60">
                                <span>播放进度</span>
                                <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
                            </div>
                            <Slider
                                value={[Math.round(currentTime * 1000)]}
                                min={0}
                                max={Math.max(1000, Math.round(duration * 1000))}
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
                </div>

                <div className="flex shrink-0 justify-end gap-3 border-t border-white/5 bg-[#18181b] px-5 py-4">
                    <Button variant="default" onClick={onClose} disabled={isSubmitting} className="border-white/10 bg-transparent text-white/70 hover:bg-white/5 hover:text-white">
                        取消
                    </Button>
                    <Button
                        onClick={() => void handleConfirm()}
                        disabled={!isReady || isSubmitting || strokes.length === 0 || !rangeValid}
                        className="bg-[#B43FEB] text-white hover:bg-[#C45BF0]"
                    >
                        {isSubmitting ? "烧录中..." : "生成标注视频"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
