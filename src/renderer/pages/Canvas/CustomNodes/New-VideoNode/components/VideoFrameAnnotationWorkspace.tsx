import {
    IconArrowBackUp,
    IconArrowForwardUp,
    IconArrowUpRight,
    IconBrush,
    IconMapPin,
    IconPencil,
    IconSquare,
    IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { VideoPlayer } from "@/components/ui/video-player";
import { cn } from "shared/utils/utils";
import type {
    VideoFrameAnnotation,
    VideoFrameAnnotationPayload,
    VideoFrameAnnotationTool,
} from "../constants/videoFrameAnnotations";

export type { VideoFrameAnnotationPayload } from "../constants/videoFrameAnnotations";

type FrameAnnotation = VideoFrameAnnotation & { id: string };

type VideoFrameAnnotationWorkspaceProps = {
    open: boolean;
    videoUrl: string;
    initialTime: number;
    onClose: () => void;
    onSubmit: (payload: VideoFrameAnnotationPayload) => Promise<void> | void;
    isSubmitting?: boolean;
};

const MIN_RECT_SIZE = 0.025;
const DEFAULT_BRUSH_COLOR = "#ef4444";
const BRUSH_COLORS = [
    { label: "红", value: "#ef4444" },
    { label: "黄", value: "#eab308" },
    { label: "绿", value: "#22c55e" },
    { label: "蓝", value: "#3b82f6" },
    { label: "黑", value: "#000000" },
    { label: "白", value: "#ffffff" },
] as const;

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const isLightAnnotationColor = (color?: string) =>
    color === "#eab308" || color === "#ffffff";

const formatTime = (time: number) => {
    const milliseconds = Math.max(0, Math.round(time * 1000));
    const minutes = Math.floor(milliseconds / 60_000);
    const seconds = Math.floor((milliseconds % 60_000) / 1000);
    const remainder = milliseconds % 1000;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(remainder).padStart(3, "0")}`;
};

const getRectFromPoints = (points: Array<{ x: number; y: number }>) => {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const width = Math.max(MIN_RECT_SIZE, Math.max(...xs) - x);
    const height = Math.max(MIN_RECT_SIZE, Math.max(...ys) - y);
    return { x, y, width, height };
};

const normalizeRect = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    return {
        x,
        y,
        width: Math.max(MIN_RECT_SIZE, Math.abs(end.x - start.x)),
        height: Math.max(MIN_RECT_SIZE, Math.abs(end.y - start.y)),
    };
};

const getArrowHead = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    size: number,
) => {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    const perpendicular = { x: -direction.y, y: direction.x };
    const base = {
        x: end.x - direction.x * size,
        y: end.y - direction.y * size,
    };
    const halfWidth = size * 0.48;
    const left = {
        x: base.x + perpendicular.x * halfWidth,
        y: base.y + perpendicular.y * halfWidth,
    };
    const right = {
        x: base.x - perpendicular.x * halfWidth,
        y: base.y - perpendicular.y * halfWidth,
    };
    const padding = 0.012;
    const minX = Math.min(end.x, left.x, right.x);
    const maxX = Math.max(end.x, left.x, right.x);
    const minY = Math.min(end.y, left.y, right.y);
    const maxY = Math.max(end.y, left.y, right.y);
    const shiftX = minX < padding ? padding - minX : maxX > 1 - padding ? 1 - padding - maxX : 0;
    const shiftY = minY < padding ? padding - minY : maxY > 1 - padding ? 1 - padding - maxY : 0;

    return {
        base: { x: base.x + shiftX, y: base.y + shiftY },
        tip: { x: end.x + shiftX, y: end.y + shiftY },
        left: { x: left.x + shiftX, y: left.y + shiftY },
        right: { x: right.x + shiftX, y: right.y + shiftY },
    };
};

const createAnnotation = (
    tool: VideoFrameAnnotationTool,
    point: { x: number; y: number },
    options: { brushColor: string; markerNumber: number },
): FrameAnnotation => ({
    id: `video-frame-annotation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tool,
    rect: {
        x: clamp(point.x - MIN_RECT_SIZE / 2),
        y: clamp(point.y - MIN_RECT_SIZE / 2),
        width: MIN_RECT_SIZE,
        height: MIN_RECT_SIZE,
    },
    color: options.brushColor,
    ...(tool === "brush" ? { points: [point] } : {}),
    ...(tool === "arrow" ? { points: [point, point] } : {}),
    ...(tool === "pin" ? { markerNumber: options.markerNumber } : {}),
});

const ToolButton = ({
    active,
    disabled,
    icon: Icon,
    label,
    onClick,
}: {
    active: boolean;
    disabled: boolean;
    icon: typeof IconBrush;
    label: string;
    onClick: () => void;
}) => (
    <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={disabled}
        onClick={onClick}
        className={cn(
            "flex h-10 min-w-14 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-[10px] transition-colors",
            active
                ? "bg-[#B43FEB] text-white"
                : "text-white/60 hover:bg-white/8 hover:text-white",
            disabled && "cursor-not-allowed opacity-35",
        )}
        title={label}
    >
        <Icon size={17} stroke={1.6} />
        <span>{label}</span>
    </Button>
);

const AnnotationOverlay = ({ annotations }: { annotations: FrameAnnotation[] }) => (
    <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 1 1" preserveAspectRatio="none">
        {annotations.map((annotation) => {
            const { rect } = annotation;
            if (annotation.tool === "brush" && annotation.points) {
                return (
                    <polyline
                        key={annotation.id}
                        points={annotation.points.map((point) => `${point.x},${point.y}`).join(" ")}
                        fill="none"
                        stroke={annotation.color ?? DEFAULT_BRUSH_COLOR}
                        strokeWidth="0.008"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                );
            }

            if (annotation.tool === "arrow") {
                const fallbackStart = { x: rect.x, y: rect.y + rect.height };
                const fallbackEnd = { x: rect.x + rect.width, y: rect.y };
                const [start = fallbackStart, end = fallbackEnd] = annotation.points ?? [];
                const deltaX = end.x - start.x;
                const deltaY = end.y - start.y;
                const distance = Math.hypot(deltaX, deltaY);
                const hasArrowHead = distance > 0.001;
                const arrowHead = getArrowHead(
                    start,
                    end,
                    Math.min(0.048, Math.max(0.022, distance * 0.28)),
                );
                return (
                    <g key={annotation.id}>
                        <line
                            x1={start.x}
                            y1={start.y}
                            x2={hasArrowHead ? arrowHead.base.x : end.x}
                            y2={hasArrowHead ? arrowHead.base.y : end.y}
                            stroke={annotation.color ?? DEFAULT_BRUSH_COLOR}
                            strokeWidth="0.008"
                            strokeLinecap="round"
                        />
                        {hasArrowHead ? (
                            <path
                                d={`M ${arrowHead.left.x} ${arrowHead.left.y} L ${arrowHead.tip.x} ${arrowHead.tip.y} L ${arrowHead.right.x} ${arrowHead.right.y} Z`}
                                fill={annotation.color ?? DEFAULT_BRUSH_COLOR}
                            />
                        ) : null}
                    </g>
                );
            }

            if (annotation.tool === "pin") {
                const tipX = rect.x + rect.width / 2;
                const tipY = rect.y + rect.height / 2;
                const radius = 0.024;
                const centerY = tipY - radius * 1.1;
                return (
                    <g key={annotation.id}>
                        <path
                            d={`M ${tipX} ${tipY} C ${tipX - radius * 0.9} ${tipY - radius * 0.85}, ${tipX - radius} ${centerY + radius * 0.35}, ${tipX - radius} ${centerY} C ${tipX - radius} ${centerY - radius}, ${tipX - radius * 0.55} ${centerY - radius}, ${tipX} ${centerY - radius} C ${tipX + radius * 0.55} ${centerY - radius}, ${tipX + radius} ${centerY - radius}, ${tipX + radius} ${centerY} C ${tipX + radius} ${centerY + radius * 0.35}, ${tipX + radius * 0.9} ${tipY - radius * 0.85}, ${tipX} ${tipY} Z`}
                            fill={annotation.color ?? DEFAULT_BRUSH_COLOR}
                        />
                        <text
                            x={tipX}
                            y={centerY}
                            fill={isLightAnnotationColor(annotation.color) ? "#000000" : "#ffffff"}
                            fontSize="0.028"
                            fontWeight="700"
                            textAnchor="middle"
                            dominantBaseline="central"
                        >
                            {annotation.markerNumber ?? 1}
                        </text>
                    </g>
                );
            }

            return (
                <rect
                    key={annotation.id}
                    x={rect.x}
                    y={rect.y}
                    width={rect.width}
                    height={rect.height}
                    fill="none"
                    stroke={annotation.color ?? DEFAULT_BRUSH_COLOR}
                    strokeWidth="0.006"
                    strokeDasharray={annotation.tool === "select" ? "0.02 0.012" : undefined}
                    rx="0.008"
                />
            );
        })}
    </svg>
);

export const VideoFrameAnnotationWorkspace = ({
    open,
    videoUrl,
    initialTime,
    onClose,
    onSubmit,
    isSubmitting = false,
}: VideoFrameAnnotationWorkspaceProps) => {
    const frameRef = useRef<HTMLDivElement | null>(null);
    const annotationsRef = useRef<FrameAnnotation[]>([]);
    const dragRef = useRef<{
        id: string;
        start: { x: number; y: number };
        tool: VideoFrameAnnotationTool;
    } | null>(null);
    const [sourceRatio, setSourceRatio] = useState(16 / 9);
    const [frameTime, setFrameTime] = useState(initialTime);
    const [activeTool, setActiveTool] = useState<VideoFrameAnnotationTool | null>(null);
    const [brushColor, setBrushColor] = useState(DEFAULT_BRUSH_COLOR);
    const [annotations, setAnnotations] = useState<FrameAnnotation[]>([]);
    const [history, setHistory] = useState<FrameAnnotation[][]>([[]]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const tools = useMemo(
        () => [
            { key: "brush" as const, label: "画笔", icon: IconBrush },
            { key: "arrow" as const, label: "箭头", icon: IconArrowUpRight },
            { key: "shape" as const, label: "形状", icon: IconSquare },
            { key: "pin" as const, label: "标记", icon: IconMapPin },
        ],
        [],
    );

    const setCurrentAnnotations = useCallback((next: FrameAnnotation[]) => {
        annotationsRef.current = next;
        setAnnotations(next);
    }, []);

    const commitAnnotations = useCallback(
        (next: FrameAnnotation[]) => {
            const trimmed = history.slice(0, historyIndex + 1);
            const snapshot = next.map((annotation) => ({
                ...annotation,
                rect: { ...annotation.rect },
                ...(annotation.points ? { points: [...annotation.points] } : {}),
            }));
            setHistory([...trimmed, snapshot]);
            setHistoryIndex(trimmed.length);
        },
        [history, historyIndex],
    );

    useEffect(() => {
        if (!open) return;
        setFrameTime(initialTime);
        setActiveTool(null);
        setBrushColor(DEFAULT_BRUSH_COLOR);
        setCurrentAnnotations([]);
        setHistory([[]]);
        setHistoryIndex(0);
        dragRef.current = null;
    }, [initialTime, open, setCurrentAnnotations, videoUrl]);

    const getPoint = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const rect = frameRef.current?.getBoundingClientRect();
        if (!rect || !rect.width || !rect.height) return null;
        return {
            x: clamp((event.clientX - rect.left) / rect.width),
            y: clamp((event.clientY - rect.top) / rect.height),
        };
    }, []);

    const handlePointerDown = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (!activeTool || isSubmitting) return;
            const target = event.target;
            if (
                target instanceof Element &&
                (target.closest("button") || target.closest('[role="slider"]'))
            ) {
                return;
            }
            const point = getPoint(event);
            if (!point) return;

            const annotation = createAnnotation(activeTool, point, {
                brushColor,
                markerNumber:
                    annotationsRef.current.filter((item) => item.tool === "pin").length + 1,
            });
            const next = [...annotationsRef.current, annotation];
            setCurrentAnnotations(next);

            if (activeTool === "pin") {
                commitAnnotations(next);
                return;
            }

            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = { id: annotation.id, start: point, tool: activeTool };
        },
        [activeTool, brushColor, commitAnnotations, getPoint, isSubmitting, setCurrentAnnotations],
    );

    const handlePointerMove = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            const drag = dragRef.current;
            if (!drag) return;
            const point = getPoint(event);
            if (!point) return;

            const next = annotationsRef.current.map((annotation) => {
                if (annotation.id !== drag.id) return annotation;
                if (drag.tool === "brush") {
                    const points = [...(annotation.points ?? []), point];
                    return { ...annotation, points, rect: getRectFromPoints(points) };
                }
                if (drag.tool === "arrow") {
                    return {
                        ...annotation,
                        points: [drag.start, point],
                        rect: normalizeRect(drag.start, point),
                    };
                }
                return { ...annotation, rect: normalizeRect(drag.start, point) };
            });
            setCurrentAnnotations(next);
        },
        [getPoint, setCurrentAnnotations],
    );

    const finishPointerGesture = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (!dragRef.current) return;
            dragRef.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
            commitAnnotations(annotationsRef.current);
        },
        [commitAnnotations],
    );

    const handleUndo = useCallback(() => {
        if (historyIndex === 0) return;
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        setCurrentAnnotations(history[nextIndex] ?? []);
    }, [history, historyIndex, setCurrentAnnotations]);

    const handleRedo = useCallback(() => {
        if (historyIndex >= history.length - 1) return;
        const nextIndex = historyIndex + 1;
        setHistoryIndex(nextIndex);
        setCurrentAnnotations(history[nextIndex] ?? []);
    }, [history, historyIndex, setCurrentAnnotations]);

    const handleCancelEdit = useCallback(() => {
        setActiveTool(null);
        setCurrentAnnotations([]);
        setHistory([[]]);
        setHistoryIndex(0);
    }, [setCurrentAnnotations]);

    const handleSubmit = useCallback(async () => {
        if (!annotations.length) return;
        await onSubmit({
            frameTime,
            annotations: annotations.map((annotation) => ({
                tool: annotation.tool,
                rect: { ...annotation.rect },
                ...(annotation.points ? { points: [...annotation.points] } : {}),
                ...(annotation.color ? { color: annotation.color } : {}),
                ...(annotation.markerNumber ? { markerNumber: annotation.markerNumber } : {}),
            })),
        });
    }, [annotations, frameTime, onSubmit]);

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !isSubmitting && onClose()}>
            <DialogContent
                overlayClassName="bg-black/88"
                className="nodrag nopan nowheel left-0 top-0 flex h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-0 bg-[#101012] p-0 text-white shadow-none data-open:fade-in-0 data-open:zoom-in-100 duration-300"
            >
                <DialogHeader className="relative shrink-0 border-b border-white/10 bg-[#161619] px-6 py-4">
                    <DialogTitle className="text-white">
                        <span className="text-base font-semibold">视频帧标注</span>
                        <span className="absolute left-1/2 -translate-x-1/2 text-xs font-normal text-white/45">
                            当前帧 {formatTime(frameTime)}
                        </span>
                    </DialogTitle>
                </DialogHeader>

                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={isSubmitting}
                    onClick={onClose}
                    className="absolute right-5 top-3 z-10 size-8 rounded-full p-0 text-white/65 hover:bg-white/8 hover:text-white"
                    title="关闭"
                >
                    <IconX />
                </Button>

                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-8 py-7">
                    <div className="flex min-h-0 w-full flex-1 items-center justify-center rounded-2xl border border-white/8 bg-black/55 p-6">
                        <div
                            ref={frameRef}
                            className={cn(
                                "relative w-full max-w-300 overflow-hidden rounded-lg bg-black shadow-[0_20px_64px_rgba(0,0,0,0.48)]",
                                activeTool ? "cursor-crosshair" : "cursor-default",
                            )}
                            style={{ aspectRatio: sourceRatio }}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={finishPointerGesture}
                            onPointerCancel={finishPointerGesture}
                        >
                            <VideoPlayer
                                src={videoUrl}
                                containerClassName="h-full w-full bg-black"
                                videoClassName="h-full w-full object-fill"
                                showDefaultControls
                                playsInline
                                preload="metadata"
                                onLoadedMetadata={(event) => {
                                    const video = event.currentTarget;
                                    const duration = Number.isFinite(video.duration) ? video.duration : 0;
                                    const nextTime = Math.min(Math.max(0, initialTime), duration || initialTime);
                                    setFrameTime(nextTime);
                                    setSourceRatio(video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9);
                                    video.currentTime = nextTime;
                                    video.pause();
                                }}
                                onTimeUpdate={(event) => setFrameTime(event.currentTarget.currentTime)}
                                onSeeked={(event) => setFrameTime(event.currentTarget.currentTime)}
                            />
                            <AnnotationOverlay annotations={annotations} />
                            {!activeTool ? (
                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15 text-sm text-white/72">
                                    选择工具后在视频帧上标注
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex w-full max-w-5xl flex-col gap-2">
                        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#1b1b1f] p-2 shadow-xl">
                            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                                {tools.map((tool) => (
                                    <ToolButton
                                        key={tool.key}
                                        active={activeTool === tool.key}
                                        disabled={isSubmitting}
                                        icon={tool.icon}
                                        label={tool.label}
                                        onClick={() => setActiveTool(tool.key)}
                                    />
                                ))}
                                <div className="mx-1 h-7 w-px bg-white/10" />
                                <ToolButton
                                    active={false}
                                    disabled={isSubmitting || historyIndex === 0}
                                    icon={IconArrowBackUp}
                                    label="撤销"
                                    onClick={handleUndo}
                                />
                                <ToolButton
                                    active={false}
                                    disabled={isSubmitting || historyIndex >= history.length - 1}
                                    icon={IconArrowForwardUp}
                                    label="重做"
                                    onClick={handleRedo}
                                />
                            </div>

                            {activeTool ? (
                                <div className="flex shrink-0 items-center gap-2 border-l border-white/10 pl-3">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        disabled={isSubmitting}
                                        onClick={handleCancelEdit}
                                        className="text-white/70 hover:bg-white/8 hover:text-white"
                                    >
                                        取消
                                    </Button>
                                    <Button
                                        type="button"
                                        disabled={isSubmitting || annotations.length === 0}
                                        onClick={() => void handleSubmit()}
                                        className="bg-[#B43FEB] text-white hover:bg-[#C45BF0]"
                                    >
                                        <IconPencil data-icon="inline-start" />
                                        {isSubmitting ? "生成中..." : "生成图片节点"}
                                    </Button>
                                </div>
                            ) : null}
                        </div>

                        {activeTool ? (
                            <div className="flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-[#1b1b1f] px-4 py-2 shadow-xl">
                                {BRUSH_COLORS.map((color) => (
                                    <Button
                                        key={color.value}
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        disabled={isSubmitting}
                                        onClick={() => setBrushColor(color.value)}
                                        title={`${color.label}色`}
                                        className={cn(
                                            "size-9 rounded-full border-2 p-1 hover:bg-transparent",
                                            brushColor === color.value
                                                ? "border-white bg-white/15"
                                                : "border-transparent",
                                        )}
                                    >
                                        <span
                                            className="size-full rounded-full border border-white/30"
                                            style={{ backgroundColor: color.value }}
                                        />
                                    </Button>
                                ))}
                            </div>
                        ) : null}

                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
