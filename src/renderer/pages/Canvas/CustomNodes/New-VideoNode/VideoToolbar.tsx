import {
  IconArrowBigLeftLines,
  IconArrowBigRightLines,
  IconBolt,
  IconDownload,
  IconEraser,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconScissors,
  IconTrash,
  IconUpload,
  IconZoomIn,
} from "@tabler/icons-react";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { uploadFileToOSS } from "service/oss";
import { GenerationStatus } from "shared/constants/enum";
import { normalizeRequiredPoints } from "shared/constants/points";
import type { NewVideoGenerationNode } from "shared/types/flow";
import { formatDuration, getVideoDuration } from "shared/utils/getVideoDuration";
import { appendMediaSequences } from "shared/utils/mediaSequence";
import { cn, downloadImageFromUrl, getJikeingToken } from "shared/utils/utils";
import { withVideoPosterFields } from "shared/utils/videoPoster";
import { toast } from "sonner";
import Lightbox from "yet-another-react-lightbox";
import Download from "yet-another-react-lightbox/plugins/download";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Share from "yet-another-react-lightbox/plugins/share";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import Video from "yet-another-react-lightbox/plugins/video";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import {
  createVideoEnhanceTask,
  createWuhenRemovalTask,
  getUploadOssPutUrl,
  queryVideoEnhanceTask,
  queryWuhenRemovalTask,
} from "@/api/jikeGo";
import { ModelPointsBadge } from "@/components/ModelPointsBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VideoPlayer } from "@/components/ui/video-player";
import { useGenerationPoints } from "@/hooks/useGenerationPoints";
import { getAspectRatioFromMediaFile } from "@/pages/Canvas/CustomNodes/ImageNode/utils/aspectRatioUtils";
import { aiVideoEnhanceTrackingService } from "@/services/aiVideoEnhanceTracking";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { useUserStore } from "@/stores/useUserStore";
import { withRemoteMediaRef } from "../utils/localMedia";
import type { VideoEnhanceParams } from "./components/VideoEnhancePanel";
import { VideoEnhancePanel } from "./components/VideoEnhancePanel";
import { VideoTimeline } from "./components/VideoTimeline";
import type { VideoTrimResult } from "./components/VideoTrimPanel";
import { VideoTrimPanel } from "./components/VideoTrimPanel";
import {
  getVideoItemsFromNodeData,
  getVideoUrlsFromNodeData,
} from "./utils/video-url";

type WuhenRect = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type ViewportRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DragMode = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const DEFAULT_FPS = 30;
const FRAME_STEP_SECONDS = 1 / DEFAULT_FPS;
const TIMELINE_STEP_MS = 100;
const SUBTITLE_REMOVAL_POINTS_PER_SECOND = 0.5;
const WUHEI_MAX_RECT_AREA = 480_000;
const PROCESSED_VIDEO_NODE_GAP = 48;
const subtitlePollers: Record<string, number> = {};

const getProcessedVideoNodePosition = (sourceNode: any) => {
  const basePosition = sourceNode?.position ?? { x: 0, y: 0 };
  const sourceWidth =
    sourceNode?.measured?.width ??
    sourceNode?.width ??
    sourceNode?.initialWidth ??
    350;

  return {
    x: basePosition.x + sourceWidth + PROCESSED_VIDEO_NODE_GAP,
    y: basePosition.y,
  };
};

const normalizeTaskStatus = (value?: string) => {
  return String(value || "")
    .trim()
    .toUpperCase();
};

const extractTaskStatusInfo = (response: any) => {
  const payload = response?.data ?? response;
  const nested = payload?.data ?? {};
  const output = payload?.output ?? {};

  const taskStatus = normalizeTaskStatus(
    nested?.task_status ??
    nested?.status ??
    payload?.task_status ??
    payload?.status ??
    output?.task_status,
  );

  const progressRaw = nested?.progress ?? payload?.progress ?? output?.progress;
  const numericProgress = Number(progressRaw);
  const progress = Number.isFinite(numericProgress)
    ? Math.max(0, Math.min(100, numericProgress))
    : 0;

  const taskId =
    nested?.task_id ??
    nested?.id ??
    payload?.task_id ??
    payload?.id ??
    output?.task_id ??
    "";

  return { taskStatus, progress, taskId };
};

const clamp = (value: number, minValue: number, maxValue: number) => {
  return Math.min(maxValue, Math.max(minValue, value));
};

const computeContainedRect = (
  container: ViewportRect,
  mediaWidth: number,
  mediaHeight: number,
) => {
  if (
    !mediaWidth ||
    !mediaHeight ||
    container.width <= 0 ||
    container.height <= 0
  ) {
    return { x: 0, y: 0, width: container.width, height: container.height };
  }

  const containerRatio = container.width / container.height;
  const mediaRatio = mediaWidth / mediaHeight;

  let width = container.width;
  let height = container.height;

  if (containerRatio > mediaRatio) {
    height = container.height;
    width = height * mediaRatio;
  } else {
    width = container.width;
    height = width / mediaRatio;
  }

  const x = (container.width - width) / 2;
  const y = (container.height - height) / 2;
  return { x, y, width, height };
};

const buildDefaultSubtitleRect = (bounds: ViewportRect) => {
  const width = Math.max(80, bounds.width * 0.8);
  const height = Math.max(60, bounds.height * 0.22);
  const x = clamp(
    (bounds.width - width) / 2,
    0,
    Math.max(0, bounds.width - width),
  );
  const y = clamp(bounds.height * 0.72, 0, Math.max(0, bounds.height - height));
  return { x, y, width, height };
};

const getViewportSize = () => {
  if (typeof window === "undefined") {
    return { width: 1280, height: 720 };
  }
  return { width: window.innerWidth, height: window.innerHeight };
};

const getFittedWorkspaceFrame = (
  media: { width: number; height: number } | null,
  maxWidth: number,
  maxHeight: number,
) => {
  const safeMaxWidth = Math.max(280, maxWidth);
  const safeMaxHeight = Math.max(200, maxHeight);
  const containerRatio = 16 / 9;

  let width = safeMaxWidth;
  let height = width / containerRatio;

  if (height > safeMaxHeight) {
    height = safeMaxHeight;
    width = height * containerRatio;
  }

  return {
    width: Math.max(220, Math.round(width)),
    height: Math.max(140, Math.round(height)),
  };
};

// ====== 去字幕面板 ======

const VideoSubtitleRemovalPanel = ({
  open,
  onClose,
  videoUrl,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onClose: () => void;
  videoUrl: string;
  isSubmitting: boolean;
  onSubmit: (rect: WuhenRect, requiredPoints: number) => Promise<void> | void;
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playButtonRef = useRef<HTMLButtonElement | null>(null);
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    startRect: ViewportRect;
  } | null>(null);

  const { pointsEnabled, totalPoints, ensureEnoughPoints, refreshBalanceInfo } =
    useGenerationPoints();

  const [isReady, setIsReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoSize, setVideoSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [viewportSize, setViewportSize] = useState(getViewportSize);
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [videoBounds, setVideoBounds] = useState<ViewportRect | null>(null);
  const [cropRect, setCropRect] = useState<ViewportRect | null>(null);

  const workspaceFrame = useMemo(() => {
    return getFittedWorkspaceFrame(
      videoSize,
      Math.min(viewportSize.width - 96, 960),
      Math.min(viewportSize.height - 420, 560),
    );
  }, [videoSize, viewportSize.height, viewportSize.width]);

  const dialogWidth = useMemo(() => {
    return Math.max(
      460,
      Math.min(viewportSize.width - 32, workspaceFrame.width + 40),
    );
  }, [viewportSize.width, workspaceFrame.width]);

  const requiredPoints = useMemo(() => {
    if (!Number.isFinite(duration) || duration <= 0) {
      return 0;
    }
    return normalizeRequiredPoints(
      Math.max(1, Math.ceil(duration * SUBTITLE_REMOVAL_POINTS_PER_SECOND)),
    );
  }, [duration]);

  const seekTo = useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (!video) return;

      const maxTime = Number.isFinite(video.duration)
        ? video.duration
        : duration;
      const nextTime = clamp(time, 0, maxTime || 0);
      video.currentTime = nextTime;
      setCurrentTime(nextTime);
    },
    [duration],
  );

  const stepFrame = useCallback(
    (direction: 1 | -1) => {
      const video = videoRef.current;
      if (!video) return;

      if (!video.paused) {
        video.pause();
        setIsPlaying(false);
      }

      const targetTime = video.currentTime + direction * FRAME_STEP_SECONDS;
      seekTo(targetTime);

      if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) {
        video.requestVideoFrameCallback(() => {
          setCurrentTime(video.currentTime);
        });
      }
    },
    [seekTo],
  );

  const togglePlayback = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      try {
        await video.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
      return;
    }

    video.pause();
    setIsPlaying(false);
  }, []);

  const syncVideoBounds = useCallback(() => {
    if (!viewportRef.current || !videoRef.current) return;

    const viewport = viewportRef.current.getBoundingClientRect();
    const container = {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
    };
    setContainerSize({ width: viewport.width, height: viewport.height });

    const mediaWidth = videoRef.current.videoWidth || 0;
    const mediaHeight = videoRef.current.videoHeight || 0;
    const contained = computeContainedRect(container, mediaWidth, mediaHeight);
    setVideoBounds(contained);

    setCropRect((prev) => {
      if (!prev) {
        const initial = buildDefaultSubtitleRect(contained);
        return {
          x: contained.x + initial.x,
          y: contained.y + initial.y,
          width: initial.width,
          height: initial.height,
        };
      }

      if (!videoBounds || videoBounds.width <= 0 || videoBounds.height <= 0) {
        const fallback = buildDefaultSubtitleRect(contained);
        return {
          x: contained.x + fallback.x,
          y: contained.y + fallback.y,
          width: fallback.width,
          height: fallback.height,
        };
      }

      const nx = (prev.x - videoBounds.x) / videoBounds.width;
      const ny = (prev.y - videoBounds.y) / videoBounds.height;
      const nw = prev.width / videoBounds.width;
      const nh = prev.height / videoBounds.height;

      const nextWidth = clamp(nw * contained.width, 24, contained.width);
      const nextHeight = clamp(nh * contained.height, 24, contained.height);
      const nextX = clamp(
        contained.x + nx * contained.width,
        contained.x,
        contained.x + contained.width - nextWidth,
      );
      const nextY = clamp(
        contained.y + ny * contained.height,
        contained.y,
        contained.y + contained.height - nextHeight,
      );

      return {
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight,
      };
    });
  }, [videoBounds?.height, videoBounds?.width]);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }, []);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !videoBounds) return;

      const minSize = 24;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const start = drag.startRect;
      const mode = drag.mode;

      let next: ViewportRect = { ...start };

      if (mode === "move") {
        next.x = clamp(
          start.x + dx,
          videoBounds.x,
          videoBounds.x + videoBounds.width - start.width,
        );
        next.y = clamp(
          start.y + dy,
          videoBounds.y,
          videoBounds.y + videoBounds.height - start.height,
        );
        setCropRect(next);
        return;
      }

      if (mode.includes("e")) {
        next.width = clamp(
          start.width + dx,
          minSize,
          videoBounds.x + videoBounds.width - start.x,
        );
      }
      if (mode.includes("s")) {
        next.height = clamp(
          start.height + dy,
          minSize,
          videoBounds.y + videoBounds.height - start.y,
        );
      }
      if (mode.includes("w")) {
        const nextX = clamp(
          start.x + dx,
          videoBounds.x,
          start.x + start.width - minSize,
        );
        next.width = start.width - (nextX - start.x);
        next.x = nextX;
      }
      if (mode.includes("n")) {
        const nextY = clamp(
          start.y + dy,
          videoBounds.y,
          start.y + start.height - minSize,
        );
        next.height = start.height - (nextY - start.y);
        next.y = nextY;
      }

      next.width = clamp(
        next.width,
        minSize,
        videoBounds.x + videoBounds.width - next.x,
      );
      next.height = clamp(
        next.height,
        minSize,
        videoBounds.y + videoBounds.height - next.y,
      );
      setCropRect(next);
    },
    [videoBounds],
  );

  const startDrag = useCallback(
    (mode: DragMode, event: React.PointerEvent<HTMLDivElement>) => {
      if (!cropRect) return;
      event.preventDefault();
      event.stopPropagation();

      dragRef.current = {
        mode,
        startX: event.clientX,
        startY: event.clientY,
        startRect: cropRect,
      };
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [cropRect, handlePointerMove, handlePointerUp],
  );

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const handleSend = useCallback(async () => {
    if (!videoBounds || !cropRect || !videoSize) return;

    if (
      !ensureEnoughPoints({
        requiredPoints,
        actionLabel: "去字幕",
        warning: toast.warning,
      })
    ) {
      return;
    }

    const scaleX = videoSize.width / videoBounds.width;
    const scaleY = videoSize.height / videoBounds.height;

    const rect: WuhenRect = {
      x1: Math.round((cropRect.x - videoBounds.x) * scaleX),
      y1: Math.round((cropRect.y - videoBounds.y) * scaleY),
      x2: Math.round((cropRect.x - videoBounds.x + cropRect.width) * scaleX),
      y2: Math.round((cropRect.y - videoBounds.y + cropRect.height) * scaleY),
    };

    const rectWidth = Math.max(0, rect.x2 - rect.x1);
    const rectHeight = Math.max(0, rect.y2 - rect.y1);
    const area = rectWidth * rectHeight;
    if (area > WUHEI_MAX_RECT_AREA) {
      toast.warning(
        `选区过大（${area}），无痕AI 限制面积 <= ${WUHEI_MAX_RECT_AREA} 像素`,
      );
      return;
    }

    onClose();
    await onSubmit(rect, requiredPoints);
  }, [
    cropRect,
    ensureEnoughPoints,
    onClose,
    onSubmit,
    requiredPoints,
    videoBounds,
    videoSize,
  ]);

  const handleConfig = useMemo(
    () =>
      [
        { mode: "nw", className: "-left-2 -top-2 cursor-nwse-resize" },
        {
          mode: "n",
          className: "left-1/2 -top-2 -translate-x-1/2 cursor-ns-resize",
        },
        { mode: "ne", className: "-right-2 -top-2 cursor-nesw-resize" },
        {
          mode: "e",
          className: "-right-2 top-1/2 -translate-y-1/2 cursor-ew-resize",
        },
        { mode: "se", className: "-right-2 -bottom-2 cursor-nwse-resize" },
        {
          mode: "s",
          className: "left-1/2 -bottom-2 -translate-x-1/2 cursor-ns-resize",
        },
        { mode: "sw", className: "-left-2 -bottom-2 cursor-nesw-resize" },
        {
          mode: "w",
          className: "-left-2 top-1/2 -translate-y-1/2 cursor-ew-resize",
        },
      ] as const,
    [],
  );

  useEffect(() => {
    if (!open) {
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
      setIsPlaying(false);
      return;
    }
    setIsReady(false);
    setVideoSize(null);
    setVideoBounds(null);
    setCropRect(null);
    setDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
  }, [open, videoUrl]);

  useEffect(() => {
    if (open) {
      void refreshBalanceInfo();
      const timer = setTimeout(() => {
        playButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open, refreshBalanceInfo]);

  useEffect(() => {
    if (!open) return;

    const handleResize = () => {
      setViewportSize(getViewportSize());
      syncVideoBounds();
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [open, syncVideoBounds]);

  useEffect(() => {
    if (!open) return;

    const target = viewportRef.current;
    if (!target) return;

    let rafId = 0;
    const schedule = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        syncVideoBounds();
      });
    };

    schedule();

    const observer = new ResizeObserver(() => {
      schedule();
    });
    observer.observe(target);

    return () => {
      observer.disconnect();
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [open, syncVideoBounds]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (event.code === "Space" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        if (!isReady || isSubmitting) return;
        void togglePlayback();
        return;
      }

      if (target?.closest("[data-slot='slider']")) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        seekTo(currentTime - TIMELINE_STEP_MS / 1000);
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        seekTo(currentTime + TIMELINE_STEP_MS / 1000);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentTime, isReady, isSubmitting, open, seekTo, togglePlayback]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="nodrag nopan nowheel flex max-h-[92vh] w-auto max-w-[96vw] flex-col overflow-hidden border border-white/10 bg-[#121214] p-0 text-white"
        style={{ width: `${dialogWidth}px` }}
      >
        <DialogHeader className="shrink-0 border-b border-white/5 bg-[#18181b] px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-white">
            <IconEraser size={18} />
            去字幕
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col bg-[#18181b]">
          <div className="flex min-h-0 flex-1 flex-col gap-5 p-5">
            <div className="flex justify-center">
              <div
                ref={viewportRef}
                className="relative overflow-hidden rounded-xl border border-white/8 bg-black"
                style={{
                  width: `${workspaceFrame.width}px`,
                  height: `${workspaceFrame.height}px`,
                }}
              >
                <VideoPlayer
                  ref={videoRef}
                  src={videoUrl}
                  containerClassName="h-full w-full rounded-none bg-black"
                  videoClassName="h-full w-full object-contain"
                  showDefaultControls={false}
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={(event) => {
                    const w = event.currentTarget.videoWidth || 0;
                    const h = event.currentTarget.videoHeight || 0;
                    setVideoSize({ width: w, height: h });
                    setDuration(event.currentTarget.duration || 0);
                    setCurrentTime(event.currentTarget.currentTime || 0);
                    setIsReady(true);
                    window.requestAnimationFrame(() => {
                      window.requestAnimationFrame(() => {
                        syncVideoBounds();
                      });
                    });
                  }}
                  onTimeUpdate={(event) => {
                    setCurrentTime(event.currentTarget.currentTime || 0);
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />

                {videoBounds && cropRect ? (
                  <div
                    className="absolute border border-white/90 bg-white/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                    style={{
                      left: cropRect.x,
                      top: cropRect.y,
                      width: cropRect.width,
                      height: cropRect.height,
                    }}
                    onPointerDown={(event) => startDrag("move", event)}
                  >
                    {handleConfig.map((item) => (
                      <div
                        key={item.mode}
                        className={`absolute h-4 w-4 rounded-full border border-white bg-[#B43FEB] ${item.className}`}
                        onPointerDown={(event) =>
                          startDrag(item.mode as DragMode, event)
                        }
                      />
                    ))}
                  </div>
                ) : null}

                {containerSize && videoBounds ? (
                  <>
                    <div
                      className="pointer-events-none absolute left-0 top-0 bg-black/55"
                      style={{
                        width: containerSize.width,
                        height: Math.max(0, videoBounds.y),
                      }}
                    />
                    <div
                      className="pointer-events-none absolute left-0 bg-black/55"
                      style={{
                        top: videoBounds.y + videoBounds.height,
                        width: containerSize.width,
                        height: Math.max(
                          0,
                          containerSize.height -
                          (videoBounds.y + videoBounds.height),
                        ),
                      }}
                    />
                    <div
                      className="pointer-events-none absolute top-0 bg-black/55"
                      style={{
                        left: 0,
                        top: videoBounds.y,
                        width: Math.max(0, videoBounds.x),
                        height: videoBounds.height,
                      }}
                    />
                    <div
                      className="pointer-events-none absolute top-0 bg-black/55"
                      style={{
                        left: videoBounds.x + videoBounds.width,
                        top: videoBounds.y,
                        width: Math.max(
                          0,
                          containerSize.width -
                          (videoBounds.x + videoBounds.width),
                        ),
                        height: videoBounds.height,
                      }}
                    />
                  </>
                ) : null}
              </div>
            </div>

            <VideoTimeline
              disabled={!isReady || isSubmitting}
              currentTimeMs={Math.round(currentTime * 1000)}
              durationMs={Math.round(duration * 1000)}
              stepMs={TIMELINE_STEP_MS}
              onSeek={(nextTimeMs) => {
                seekTo(nextTimeMs / 1000);
              }}
            />

            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => stepFrame(-1)}
                disabled={!isReady || isSubmitting}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#27272a] text-white/75 hover:bg-[#3f3f46] hover:text-[#B43FEB] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="快退"
              >
                <IconArrowBigLeftLines size={18} />
              </button>
              <button
                ref={playButtonRef}
                type="button"
                onClick={() => void togglePlayback()}
                disabled={!isReady || isSubmitting}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-[#B43FEB] text-white shadow-lg shadow-[#B43FEB]/20 hover:bg-[#B43FEB]/90 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={isPlaying ? "暂停" : "播放"}
              >
                {isPlaying ? (
                  <IconPlayerPauseFilled size={20} />
                ) : (
                  <IconPlayerPlayFilled size={20} className="ml-0.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => stepFrame(1)}
                disabled={!isReady || isSubmitting}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#27272a] text-white/75 hover:bg-[#3f3f46] hover:text-[#B43FEB] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="快进"
              >
                <IconArrowBigRightLines size={18} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs text-white/50">
                {isReady
                  ? `视频时长 ${formatDuration(duration)}（${Math.ceil(duration)} 秒）`
                  : "读取视频时长中..."}
                {pointsEnabled
                  ? ` · 单价 ${SUBTITLE_REMOVAL_POINTS_PER_SECOND} 积分/秒`
                  : ""}
              </div>
              {pointsEnabled ? (
                <ModelPointsBadge
                  totalPoints={totalPoints}
                  requiredPoints={requiredPoints}
                  title={
                    isReady
                      ? `预计消耗 ${requiredPoints} 积分（${SUBTITLE_REMOVAL_POINTS_PER_SECOND} 积分/秒，时长 ${formatDuration(duration)}），当前余额 ${totalPoints}`
                      : `预计消耗 ${requiredPoints} 积分，当前余额 ${totalPoints}`
                  }
                />
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-white/5 bg-[#18181b] px-5 py-4">
            <Button
              variant="default"
              onClick={onClose}
              className="border border-white/10 bg-transparent text-white/70 hover:bg-white/5 hover:text-white"
            >
              取消
            </Button>
            <Button
              onClick={() => void handleSend()}
              disabled={
                !isReady ||
                isSubmitting ||
                (pointsEnabled && requiredPoints <= 0)
              }
              className="min-w-44 border border-[#f3d5ff]/50 bg-[#B43FEB] font-semibold text-white shadow-[0_12px_34px_rgba(180,63,235,0.44)] ring-1 ring-[#f0c7ff]/25 hover:bg-[#C45BF0] hover:shadow-[0_16px_40px_rgba(180,63,235,0.52)]"
            >
              {isSubmitting ? "发送中..." : "发送并生成新视频"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ====== 主工具栏 ======

type VideoToolbarProps = {
  nodeId: string;
  data: NewVideoGenerationNode;
  onDelete?: () => void;
  isUploading?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
};

type ActionKey =
  | "upload"
  | "download"
  | "preview"
  | "snapshot"
  | "trim"
  | "removeCaptions"
  | "videoEnhance";

const SNAPSHOT_LABELS = {
  current: "截取当前帧",
  start: "截取首帧",
  end: "截取尾帧",
} as const;
const SNAPSHOT_MODES = ["current", "start", "end"] as const;

/**
 * 新版视频节点工具栏
 * 职责：提供上传、下载、放大查看、截帧、裁剪、去字幕等操作按钮
 */
export const VideoToolbar = ({
  nodeId,
  data,
  onDelete,
  isUploading = false,
  onUploadingChange,
}: VideoToolbarProps) => {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isTrimPanelOpen, setIsTrimPanelOpen] = useState(false);
  const [isTrimmingVideo, setIsTrimmingVideo] = useState(false);
  const [isSubtitlePanelOpen, setIsSubtitlePanelOpen] = useState(false);
  const [isSubmittingSubtitle, setIsSubmittingSubtitle] = useState(false);
  const [isEnhancePanelOpen, setIsEnhancePanelOpen] = useState(false);
  const [previewVideoUrls, setPreviewVideoUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewObjectUrlsRef = useRef<string[]>([]);

  const addNode = useCanvasFlowStore((state) => state.addNode);
  const projectId = useCanvasFlowStore((state) => state.projectId);
  const onConnect = useCanvasFlowStore((state) => state.onConnect);
  const updateNewVideoNodeData = useCanvasFlowStore(
    (state) => state.updateNewVideoNodeData,
  );
  const setActiveVideoTool = useCanvasFlowStore(
    (state) => state.setActiveVideoTool,
  );

  const videoUrls = useMemo(() => {
    return getVideoUrlsFromNodeData(data);
  }, [data]);
  const videoItems = useMemo(() => {
    return getVideoItemsFromNodeData(data);
  }, [data]);
  const currentVideoUrl = videoUrls[0];

  // 视频真实时长：从视频文件加载，失败则 fallback 60s
  const [videoDuration, setVideoDuration] = useState(60);

  useEffect(() => {
    if (!currentVideoUrl) {
      setVideoDuration(60);
      return;
    }
    let cancelled = false;
    getVideoDuration(currentVideoUrl).then((d) => {
      if (!cancelled && typeof d === "number" && d > 0) {
        setVideoDuration(d);
      }
    });
    return () => { cancelled = true; };
  }, [currentVideoUrl]);

  const toolbarActions = useMemo(
    () => [
      { key: "upload" as const, label: "上传", icon: IconUpload },
      { key: "snapshot" as const, label: "截帧", icon: IconScissors },
      { key: "trim" as const, label: "视频裁剪", icon: IconScissors },
      {
        key: "removeCaptions" as const,
        label: "去字幕",
        icon: IconEraser,
      },
      {
        key: "videoEnhance" as const,
        label: "视频超清",
        icon: IconBolt,
      },
      { key: "download" as const, label: "下载", icon: IconDownload },
      { key: "preview" as const, label: "放大查看", icon: IconZoomIn },
    ],
    [],
  );

  const revokePreviewObjectUrls = useCallback(() => {
    previewObjectUrlsRef.current.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    previewObjectUrlsRef.current = [];
  }, []);

  const buildPreviewVideoUrls = useCallback(async () => {
    revokePreviewObjectUrls();

    const urls = await Promise.all(
      videoItems.map(async (item) => {
        return item.displayUrl || item.remoteUrl || item.url || "";
      }),
    );

    return urls.filter((url): url is string => Boolean(url));
  }, [revokePreviewObjectUrls, videoItems]);

  useEffect(() => {
    return () => {
      revokePreviewObjectUrls();
      setActiveVideoTool(null);
    };
  }, [revokePreviewObjectUrls, setActiveVideoTool]);

  // 触发文件选择
  const handleUploadClick = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  // 处理文件上传
  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    onUploadingChange?.(true);

    try {
      const result = await uploadFileToOSS(file);
      const uploadedUrl = result.url;

      if (!uploadedUrl) {
        toast.warning("上传成功但未返回视频地址");
        return;
      }

      const fileExt = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const currentData = data.result?.data ?? [];
      const resultItem = withRemoteMediaRef(
        withVideoPosterFields({
          url: uploadedUrl,
          remoteUrl: uploadedUrl,
          format: fileExt,
        }),
      );

      const updatePatch: Record<string, unknown> = {
        result: {
          type: "video",
          data: appendMediaSequences(currentData, [resultItem]),
        },
        status: GenerationStatus.COMPLETED,
        progress: 100,
        error: undefined,
      };

      if (currentData.length === 0) {
        const aspectRatio = await getAspectRatioFromMediaFile(file, "video");
        if (aspectRatio) {
          updatePatch.aspect_ratio = aspectRatio;
        }
      }

      updateNewVideoNodeData(nodeId, updatePatch as any);
      toast.success("上传成功");
    } catch (uploadError) {
      console.error("上传视频失败:", uploadError);
      toast.error("上传失败，请重试");
    } finally {
      onUploadingChange?.(false);
      event.target.value = "";
    }
  };

  const handleAction = async (actionKey: ActionKey) => {
    if (actionKey === "upload") {
      handleUploadClick();
      return;
    }

    if (actionKey === "preview") {
      if (!currentVideoUrl) {
        toast.info("暂无可预览视频");
        return;
      }
      setActiveVideoTool({ nodeId, tool: "preview" });
      setPreviewVideoUrls(await buildPreviewVideoUrls());
      setIsLightboxOpen(true);
      return;
    }

    if (actionKey === "download") {
      if (!currentVideoUrl) {
        toast.info("暂无可下载视频");
        return;
      }
      if (isDownloading) return;

      setIsDownloading(true);
      try {
        const format = videoItems[0]?.format?.toLowerCase();
        const extension = ["mp4", "webm", "mov", "mkv", "avi"].includes(
          format || "",
        )
          ? format
          : "mp4";
        await downloadImageFromUrl(
          currentVideoUrl,
          `video_${nodeId}.${extension}`,
        );
        toast.success("下载成功");
      } catch (error) {
        const message = error instanceof Error ? error.message : "下载失败";
        toast.error(message);
        console.error("下载视频失败:", error);
      } finally {
        setIsDownloading(false);
      }
      return;
    }

    if (actionKey === "trim") {
      if (!currentVideoUrl) {
        toast.info("暂无可裁剪视频");
        return;
      }
      setActiveVideoTool({ nodeId, tool: "trim" });
      setIsTrimPanelOpen(true);
      return;
    }

    if (actionKey === "removeCaptions") {
      if (!currentVideoUrl) {
        toast.info("暂无可用视频");
        return;
      }
      setActiveVideoTool({ nodeId, tool: "removeCaptions" });
      setIsSubtitlePanelOpen(true);
      return;
    }

    if (actionKey === "videoEnhance") {
      if (!currentVideoUrl) {
        toast.info("暂无可用视频");
        return;
      }
      setActiveVideoTool({ nodeId, tool: "videoEnhance" });
      setIsEnhancePanelOpen(true);
      return;
    }
  };

  const closeVideoTool = useCallback(() => {
    setActiveVideoTool(null);
  }, [setActiveVideoTool]);

  const closeSubtitlePanel = useCallback(() => {
    setIsSubtitlePanelOpen(false);
    closeVideoTool();
  }, [closeVideoTool]);

  const closeEnhancePanel = useCallback(() => {
    setIsEnhancePanelOpen(false);
    closeVideoTool();
  }, [closeVideoTool]);

  const closeTrimPanel = useCallback(() => {
    setIsTrimPanelOpen(false);
    closeVideoTool();
  }, [closeVideoTool]);

  const closeLightbox = useCallback(() => {
    setIsLightboxOpen(false);
    revokePreviewObjectUrls();
    setPreviewVideoUrls([]);
    closeVideoTool();
  }, [closeVideoTool, revokePreviewObjectUrls]);

  const isPreviewActive = isLightboxOpen;

  const handleTrimVideo = useCallback(
    async (range: { start: number; end: number }): Promise<VideoTrimResult> => {
      setIsTrimmingVideo(true);

      try {
        if (!currentVideoUrl) {
          throw new Error("暂无可裁剪视频");
        }

        if (!window.videoProcessing?.trim) {
          throw new Error("视频裁剪组件未初始化，请重启应用后重试");
        }

        const authToken = getJikeingToken();
        const backendBaseUrl =
          import.meta.env.VITE_JIKE_GO_BASE_URL || "http://localhost:9181";

        const response = await window.videoProcessing.trim({
          videoUrl: currentVideoUrl,
          start: range.start,
          end: range.end,
          authToken: authToken || undefined,
          backendBaseUrl,
        });

        if (!response.success || !response.data?.url) {
          throw new Error(response.error || "视频裁剪失败");
        }

        const sourceNode = useCanvasFlowStore
          .getState()
          .nodes.find((node) => node.id === nodeId);
        const childPosition = {
          x: (sourceNode?.position.x ?? 0) + (sourceNode?.width ?? 350) + 80,
          y: sourceNode?.position.y ?? 0,
        };
        const childId = addNode("newVideo", childPosition);

        onConnect({
          source: nodeId,
          target: childId,
          sourceHandle: "output",
          targetHandle: "input",
        });

        const resultItem = withRemoteMediaRef(
          withVideoPosterFields({
            url: response.data.url,
            remoteUrl: response.data.url,
            format: response.data.format,
          }),
        );

        updateNewVideoNodeData(childId, {
          badgeLabel: "视频裁剪",
          isUpload: true,
          aspect_ratio: data.aspect_ratio,
          duration: response.data.duration,
          trimInfo: {
            sourceNodeId: nodeId,
            sourceVideoUrl: currentVideoUrl,
            startTime: range.start,
            endTime: range.end,
            method: response.data.method,
            jobId: response.data.jobId,
          },
          result: {
            type: "video",
            data: [resultItem],
          },
          status: GenerationStatus.COMPLETED,
          progress: 100,
          error: undefined,
        });

        const flowStore = useCanvasFlowStore.getState();
        flowStore.requestHistorySave();
        flowStore.saveGraph();
        toast.success(
          response.data.method === "cloud"
            ? "云端裁剪成功"
            : "本地 ffmpeg 裁剪成功",
        );
        return response.data;
      } catch (error: any) {
        console.error("视频裁剪失败:", error);
        toast.error(error?.message || "视频裁剪失败，请重试");
        throw error;
      } finally {
        setIsTrimmingVideo(false);
      }
    },
    [
      addNode,
      currentVideoUrl,
      data.aspect_ratio,
      nodeId,
      onConnect,
      projectId,
      updateNewVideoNodeData,
    ],
  );

  const startSubtitlePolling = useCallback(
    (taskId: string, targetNodeId: string, accessUrl: string) => {
      const existing = subtitlePollers[targetNodeId];
      if (existing) {
        window.clearInterval(existing);
      }

      let timer = 0;
      const clearPolling = () => {
        if (timer) {
          window.clearInterval(timer);
        }
        delete subtitlePollers[targetNodeId];
      };

      const poll = async () => {
        try {
          const targetExists = useCanvasFlowStore
            .getState()
            .nodes.some((node) => node.id === targetNodeId);
          if (!targetExists) {
            clearPolling();
            return;
          }

          const response = await queryWuhenRemovalTask({ task_id: taskId });
          const payload = response?.data ?? response;
          const taskStatus = String(payload.status ?? payload.task_status ?? "").trim().toUpperCase();
          const progress = Number(payload.progress ?? 0);

          if (["SUCCEEDED", "SUCCESS", "COMPLETED"].includes(taskStatus)) {
            const resultItem = withRemoteMediaRef(
              withVideoPosterFields({
                url: accessUrl,
                remoteUrl: accessUrl,
                format: "mp4",
              }),
            );
            updateNewVideoNodeData(targetNodeId, {
              status: GenerationStatus.COMPLETED,
              progress: 100,
              result: {
                type: "video",
                data: [resultItem],
              },
              error: undefined,
            } as any);
            await useUserStore.getState().fetchBalanceInfo();
            clearPolling();
            return;
          }

          if (["FAILED", "FAIL", "ERROR"].includes(taskStatus)) {
            updateNewVideoNodeData(targetNodeId, {
              status: GenerationStatus.FAILED,
              progress,
              error: {
                code: "WUHEI_FAILED",
                message: "去字幕失败",
              },
            } as any);
            clearPolling();
            return;
          }

          updateNewVideoNodeData(targetNodeId, {
            status: GenerationStatus.IN_PROGRESS,
            progress,
          } as any);
        } catch { }
      };

      timer = window.setInterval(() => {
        void poll();
      }, 10000);
      subtitlePollers[targetNodeId] = timer;
      void poll();
    },
    [projectId, updateNewVideoNodeData],
  );

  // ====== 视频超清轮询器 ======
  const videoEnhancePollers: Record<string, number> = {};

  const startVideoEnhancePolling = useCallback(
    (taskId: string, targetNodeId: string) => {
      const existing = videoEnhancePollers[targetNodeId];
      if (existing) {
        window.clearInterval(existing);
      }

      let timer = 0;
      const clearPolling = () => {
        if (timer) {
          window.clearInterval(timer);
        }
        delete videoEnhancePollers[targetNodeId];
      };

      const poll = async () => {
        try {
          const targetExists = useCanvasFlowStore
            .getState()
            .nodes.some((node) => node.id === targetNodeId);
          if (!targetExists) {
            clearPolling();
            return;
          }

          const response: any = await queryVideoEnhanceTask({
            task_id: taskId,
          });
          const data = response?.data ?? response;
          const status = data?.status || "";

          if (status === "succeeded") {
            const resultUrl = data?.video_url || "";

            // 埋点：超清成功
            aiVideoEnhanceTrackingService.updateStatus(taskId, "SUCCESS", {
              generatedVideoUrl: resultUrl || undefined,
              durationMs: data?.duration_ms,
              outputResolution: data?.output_resolution,
              outputFps: data?.output_fps,
            });

            if (resultUrl) {
              const resultItem = withRemoteMediaRef(
                withVideoPosterFields({
                  url: resultUrl,
                  remoteUrl: resultUrl,
                  format: "mp4",
                }),
              );
              updateNewVideoNodeData(targetNodeId, {
                status: GenerationStatus.COMPLETED,
                progress: 100,
                result: {
                  type: "video",
                  data: [resultItem],
                },
                error: undefined,
              } as any);
              toast.success("视频超清完成");
            }
            await useUserStore.getState().fetchBalanceInfo();
            clearPolling();
            return;
          }

          if (status === "failed") {
            // 埋点：超清失败
            aiVideoEnhanceTrackingService.updateStatus(taskId, "FAIL", {
              errorMessage: data?.error || "视频超清失败",
            });

            updateNewVideoNodeData(targetNodeId, {
              status: GenerationStatus.FAILED,
              progress: 0,
              error: {
                code: "ENHANCE_FAILED",
                message: data?.error || "视频超清失败",
              },
            } as any);
            toast.error(data?.error || "视频超清失败");
            clearPolling();
            return;
          }

          // running - 更新进度提示
          updateNewVideoNodeData(targetNodeId, {
            status: GenerationStatus.IN_PROGRESS,
            progress: 30,
          } as any);
        } catch {
          // 轮询中静默处理
        }
      };

      timer = window.setInterval(() => {
        void poll();
      }, 10000); // 文档建议轮询间隔不低于 10 秒
      videoEnhancePollers[targetNodeId] = timer;
      void poll();
    },
    [projectId, updateNewVideoNodeData],
  );

  const handleVideoEnhance = useCallback(
    async (params: VideoEnhanceParams) => {
      if (!currentVideoUrl) return;

      try {
        const sourceNode = useCanvasFlowStore
          .getState()
          .nodes.find((n) => n.id === nodeId);

        const newNodeId = addNode(
          "newVideo",
          getProcessedVideoNodePosition(sourceNode),
        );

        updateNewVideoNodeData(newNodeId, {
          badgeLabel: "视频超清",
          nickname: "视频超清",
          aspect_ratio: data.aspect_ratio,
          status: GenerationStatus.IN_PROGRESS,
          progress: 0,
          result: { type: "video", data: [] },
          error: undefined,
        } as any);

        window.setTimeout(() => {
          onConnect({
            source: nodeId,
            sourceHandle: "output",
            target: newNodeId,
            targetHandle: "input",
          });
        }, 50);

        const response: any = await createVideoEnhanceTask({
          video_url: currentVideoUrl,
          video_duration: videoDuration,
          scene: params.scene || undefined,
          tool_version: params.tool_version,
          resolution: params.resolution || undefined,
          fps: params.fps,
        });

        const taskId = response?.data?.task_id || response?.task_id || "";
        const scoreCost = response?.data?.score_cost ?? response?.score_cost;
        if (!taskId) {
          updateNewVideoNodeData(newNodeId, {
            status: GenerationStatus.FAILED,
            error: {
              code: "NO_TASK_ID",
              message: "创建画质增强任务失败",
            },
          } as any);
          toast.error("创建画质增强任务失败");
          return;
        }

        // 埋点：创建任务
        aiVideoEnhanceTrackingService.track(
          aiVideoEnhanceTrackingService.buildTrackDataFromCreateRequest(
            taskId,
            taskId,
            {
              video_url: currentVideoUrl,
              video_duration: videoDuration,
              scene: params.scene || undefined,
              tool_version: params.tool_version,
              resolution: params.resolution || undefined,
              fps: params.fps,
            },
            undefined,
            scoreCost,
          ),
        );

        startVideoEnhancePolling(taskId, newNodeId);
        setIsEnhancePanelOpen(false);
      } catch (error: any) {
        toast.error(error?.message || "视频超清失败");
      }
    },
    [
      addNode,
      currentVideoUrl,
      data.aspect_ratio,
      videoDuration,
      nodeId,
      onConnect,
      startVideoEnhancePolling,
      updateNewVideoNodeData,
    ],
  );

  const handleSubmitRemoveCaptions = useCallback(
    async (rect: WuhenRect, requiredPoints: number) => {
      if (!currentVideoUrl) return;
      if (isSubmittingSubtitle) return;

      setIsSubmittingSubtitle(true);
      try {
        const sourceNode = useCanvasFlowStore
          .getState()
          .nodes.find((n) => n.id === nodeId);

        const putUrlResponse = await getUploadOssPutUrl({
          blob_type: "video",
          ext: "mp4",
          content_type: "video/mp4",
          ttl: 43200,
        });
        const target = putUrlResponse?.data ?? putUrlResponse;
        const accessUrl =
          target?.access_url || target?.put_url?.split("?")[0] || "";

        if (!target?.put_url) {
          throw new Error("未获取到预签名上传地址");
        }

        const newNodeId = addNode(
          "newVideo",
          getProcessedVideoNodePosition(sourceNode),
        );

        updateNewVideoNodeData(newNodeId, {
          badgeLabel: "去字幕",
          nickname: "去字幕",
          aspect_ratio: data.aspect_ratio,
          status: GenerationStatus.IN_PROGRESS,
          progress: 0,
          result: { type: "video", data: [] },
          error: undefined,
          wuhen: {
            taskId: "",
            rect,
            resultVideoUrl: accessUrl,
          },
        } as any);

        window.setTimeout(() => {
          onConnect({
            source: nodeId,
            sourceHandle: "output",
            target: newNodeId,
            targetHandle: "input",
          });
        }, 50);

        const response: any = await createWuhenRemovalTask({
          video_url: currentVideoUrl,
          upload_url: target.put_url,
          upload_headers: target.headers,
          rect,
          model: "video_removal_std",
          method: "sel_area",
          duration: videoDuration || 60,
        });

        const payload = response?.data ?? response;
        const taskId = payload?.task_id || "";
        const taskStatus = String(payload.status ?? "").trim().toUpperCase()

        if (!taskId) {
          updateNewVideoNodeData(newNodeId, {
            status: GenerationStatus.FAILED,
            error: {
              code: "WUHEI_CREATE_FAILED",
              message: "创建去字幕任务失败",
            },
          } as any);
          return;
        }

        updateNewVideoNodeData(newNodeId, {
          wuhen: {
            taskId,
            rect,
            resultVideoUrl: accessUrl,
          },
        } as any);

        if (["SUCCESS", "SUCCEEDED", "COMPLETED"].includes(taskStatus)) {
          const resultItem = withRemoteMediaRef(
            withVideoPosterFields({
              url: accessUrl,
              remoteUrl: accessUrl,
              format: "mp4",
            }),
          );
          updateNewVideoNodeData(newNodeId, {
            status: GenerationStatus.COMPLETED,
            progress: 100,
            result: {
              type: "video",
              data: [resultItem],
            },
            error: undefined,
          } as any);
          await useUserStore.getState().fetchBalanceInfo();
        } else {
          updateNewVideoNodeData(newNodeId, {
            status: GenerationStatus.IN_PROGRESS,
            progress: 0,
          } as any);
          startSubtitlePolling(taskId, newNodeId, accessUrl);
        }
      } catch (error: any) {
        toast.error(error?.message || "去字幕失败");
      } finally {
        setIsSubmittingSubtitle(false);
      }
    },
    [
      addNode,
      currentVideoUrl,
      data.aspect_ratio,
      isSubmittingSubtitle,
      nodeId,
      onConnect,
      projectId,
      startSubtitlePolling,
      updateNewVideoNodeData,
    ],
  );

  return (
    <>
      {/* 隐藏 input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="nodrag nopan nowheel inline-flex h-10 items-center gap-1 overflow-hidden rounded-full border border-white/10 bg-[#2a2a2d] px-2 shadow-xl">
        {toolbarActions.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === "preview" ? isPreviewActive : false;
          const isDisabled =
            (item.key === "download" && isDownloading) ||
            (item.key === "upload" && isUploading) ||
            (item.key === "trim" && isTrimmingVideo) ||
            (item.key === "removeCaptions" && isSubmittingSubtitle);

          if (item.key === "snapshot") {
            return (
              <DropdownMenu key={item.key}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={isDisabled}
                    className={cn(
                      "flex min-w-11 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-xs transition-colors cursor-pointer",
                      isDisabled
                        ? "text-white/30 cursor-not-allowed"
                        : "text-white/60 hover:text-white hover:bg-white/5",
                    )}
                    title={item.label}
                  >
                    <Icon size={16} stroke={1.5} />
                    <span className="text-[10px] whitespace-nowrap">
                      {item.label}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="center"
                  className="min-w-32 border-white/10 bg-[#121214] text-white"
                >
                  <DropdownMenuGroup>
                    {SNAPSHOT_MODES.map((mode) => (
                      <DropdownMenuItem
                        key={mode}
                        onSelect={() => {
                          toast.info("此功能正在开发中");
                        }}
                      >
                        {SNAPSHOT_LABELS[mode]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleAction(item.key)}
              disabled={isDisabled}
              className={cn(
                "flex min-w-11 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-xs transition-colors cursor-pointer",
                isDisabled
                  ? "text-white/30 cursor-not-allowed"
                  : isActive
                    ? "text-[#B43FEB]"
                    : "text-white/60 hover:text-white hover:bg-white/5",
              )}
              title={item.label}
              aria-label={item.label}
            >
              <Icon size={16} stroke={1.5} />
              <span className="text-[10px] whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* 删除按钮 */}
        <button
          type="button"
          onClick={onDelete}
          className="flex min-w-11 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-xs text-white/60 transition-colors cursor-pointer hover:bg-red-500/10 hover:text-red-400"
          title="删除"
          aria-label="删除节点"
        >
          <IconTrash size={16} stroke={1.5} />
          <span className="text-[10px]">删除</span>
        </button>
      </div>

      {/* 去字幕面板 */}
      <VideoSubtitleRemovalPanel
        open={isSubtitlePanelOpen}
        onClose={closeSubtitlePanel}
        videoUrl={currentVideoUrl || ""}
        onSubmit={handleSubmitRemoveCaptions}
        isSubmitting={isSubmittingSubtitle}
      />

      <VideoTrimPanel
        open={isTrimPanelOpen}
        onClose={closeTrimPanel}
        videoUrl={currentVideoUrl || ""}
        onTrim={handleTrimVideo}
        isTrimming={isTrimmingVideo}
      />

      <VideoEnhancePanel
        open={isEnhancePanelOpen}
        onClose={closeEnhancePanel}
        onSubmit={handleVideoEnhance}
        videoDuration={videoDuration || undefined}
      />

      {isLightboxOpen ? (
        <Lightbox
          open={isLightboxOpen}
          close={closeLightbox}
          slides={(previewVideoUrls.length > 0 ? previewVideoUrls : videoUrls)
            .filter((url): url is string => !!url)
            .map((url) => ({
              type: "video" as const,
              sources: [{ src: url, type: "video/mp4" }],
            }))}
          plugins={[Video, Fullscreen, Slideshow, Zoom, Share, Download]}
          video={{ preload: "metadata" }}
          carousel={{ preload: 0 }}
          zoom={{ maxZoomPixelRatio: 4, zoomInMultiplier: 2 }}
          controller={{ closeOnBackdropClick: true }}
        />
      ) : null}
    </>
  );
};
