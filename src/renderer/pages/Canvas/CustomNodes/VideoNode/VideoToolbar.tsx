import {
  IconArrowBigLeftLines,
  IconArrowBigRightLines,
  IconDownload,
  IconEraser,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlayerStop,
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
import type { VideoGenerationNode } from "shared/types/flow";
import { createPresignedOssUploadTarget } from "shared/utils/presignedOssUploader";
import { formatDuration } from "shared/utils/getVideoDuration";
import { cn, downloadImageFromUrl } from "shared/utils/utils";
import { toast } from "sonner";
import Lightbox from "yet-another-react-lightbox";
// import Captions from 'yet-another-react-lightbox/plugins/captions'
import Download from "yet-another-react-lightbox/plugins/download";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Share from "yet-another-react-lightbox/plugins/share";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import Video from "yet-another-react-lightbox/plugins/video";
// import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import { ModelPointsBadge } from "@/components/ModelPointsBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useGenerationPoints } from "@/hooks/useGenerationPoints";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import {
  getAspectRatioFromMediaFile,
} from "../ImageNode/utils/aspectRatioUtils";
import { VideoSnapshotPanel } from "./components/VideoSnapshotPanel";
import { VideoTimeline } from "./components/VideoTimeline";
import { useVideoFrameCapture } from "./hooks/useVideoFrameCapture";
import { getVideoUrlsFromNodeData } from "./utils/video-url";
import { getVideoRemovalStatus, videoRemoval } from "@/api/ai";

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

const normalizeTaskStatus = (value?: string) => {
  return String(value || "").trim().toUpperCase();
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

  const progressRaw =
    nested?.progress ??
    payload?.progress ??
    output?.progress;
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

  return {
    taskStatus,
    progress,
    taskId,
  };
};

const clamp = (value: number, minValue: number, maxValue: number) => {
  return Math.min(maxValue, Math.max(minValue, value));
};

const computeContainedRect = (container: ViewportRect, mediaWidth: number, mediaHeight: number) => {
  if (!mediaWidth || !mediaHeight || container.width <= 0 || container.height <= 0) {
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
  const x = clamp((bounds.width - width) / 2, 0, Math.max(0, bounds.width - width));
  const y = clamp(bounds.height * 0.72, 0, Math.max(0, bounds.height - height));
  return { x, y, width, height };
};

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
  onSubmit: (rect: WuhenRect) => Promise<void> | void;
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
  const [videoSize, setVideoSize] = useState<{ width: number; height: number } | null>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);
  const [videoBounds, setVideoBounds] = useState<ViewportRect | null>(null);
  const [cropRect, setCropRect] = useState<ViewportRect | null>(null);

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
      if (!video) {
        return;
      }

      const maxTime = Number.isFinite(video.duration) ? video.duration : duration;
      const nextTime = clamp(time, 0, maxTime || 0);
      video.currentTime = nextTime;
      setCurrentTime(nextTime);
    },
    [duration],
  );

  const stepFrame = useCallback(
    (direction: 1 | -1) => {
      const video = videoRef.current;
      if (!video) {
        return;
      }

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
    if (!video) {
      return;
    }

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
    if (!viewportRef.current || !videoRef.current) {
      return;
    }
    const viewport = viewportRef.current.getBoundingClientRect();
    const container = { x: 0, y: 0, width: viewport.width, height: viewport.height };
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

  useEffect(() => {
    const video = videoRef.current;
    if (!open) {
      if (video && !video.paused) {
        video.pause();
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
    if (!open) {
      return;
    }
    const handleResize = () => syncVideoBounds();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [open, syncVideoBounds]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const target = viewportRef.current;
    if (!target) {
      return;
    }

    let rafId = 0;
    const schedule = () => {
      if (rafId) {
        return;
      }
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
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [open, syncVideoBounds]);

  useEffect(() => {
    if (!open) {
      return;
    }

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
        if (!isReady || isSubmitting) {
          return;
        }
        void togglePlayback();
        return;
      }

      if (target?.closest("[data-slot='slider']")) {
        return;
      }

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
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentTime, isReady, isSubmitting, open, seekTo, togglePlayback]);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }, []);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !videoBounds) {
        return;
      }

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
      if (!cropRect) {
        return;
      }
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
    if (!videoBounds || !cropRect || !videoSize) {
      return;
    }

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
      toast.warning(`选区过大（${area}），无痕AI 限制面积 <= ${WUHEI_MAX_RECT_AREA} 像素`);
      return;
    }

    onClose();
    await onSubmit(rect);
  }, [
    cropRect,
    ensureEnoughPoints,
    onClose,
    onSubmit,
    requiredPoints,
    videoBounds,
    videoSize,
  ]);

  const handleConfig = useMemo(() => {
    return [
      { mode: "nw", className: "-left-2 -top-2 cursor-nwse-resize" },
      { mode: "n", className: "left-1/2 -top-2 -translate-x-1/2 cursor-ns-resize" },
      { mode: "ne", className: "-right-2 -top-2 cursor-nesw-resize" },
      { mode: "e", className: "-right-2 top-1/2 -translate-y-1/2 cursor-ew-resize" },
      { mode: "se", className: "-right-2 -bottom-2 cursor-nwse-resize" },
      { mode: "s", className: "left-1/2 -bottom-2 -translate-x-1/2 cursor-ns-resize" },
      { mode: "sw", className: "-left-2 -bottom-2 cursor-nesw-resize" },
      { mode: "w", className: "-left-2 top-1/2 -translate-y-1/2 cursor-ew-resize" },
    ] as const;
  }, []);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[92vh] w-[min(1100px,96vw)] max-w-275 flex-col overflow-hidden border border-white/10 bg-[#121214] p-0 text-white">
        <DialogHeader className="shrink-0 border-b border-white/5 bg-[#18181b] px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-white">
            <IconEraser size={18} />
            去字幕
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col bg-[#18181b]">
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
            <div
              ref={viewportRef}
              className="relative overflow-hidden rounded-xl border border-white/8 bg-black"
            >
              <div
                className="w-full"
                style={{
                  aspectRatio: videoSize ? `${videoSize.width} / ${videoSize.height}` : "16 / 9",
                }}
              >
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="h-full w-full object-contain"
                  controls={false}
                  playsInline
                  preload="auto"
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
              </div>

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
                      onPointerDown={(event) => startDrag(item.mode as DragMode, event)}
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
                        containerSize.height - (videoBounds.y + videoBounds.height),
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
                        containerSize.width - (videoBounds.x + videoBounds.width),
                      ),
                      height: videoBounds.height,
                    }}
                  />
                </>
              ) : null}
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
                {isReady ? `视频时长 ${formatDuration(duration)}（${Math.ceil(duration)} 秒）` : "读取视频时长中..."}
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
              disabled={!isReady || isSubmitting || requiredPoints <= 0}
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

type VideoToolbarProps = {
  nodeId: string;
  data: VideoGenerationNode;
  onDelete?: () => void;
};

type ActionKey =
  | "upload"
  | "download"
  | "preview"
  | "snapshot"
  | "removeCaptions"
  | "lastFrame";

/**
 * 视频节点工具栏组件
 * 职责：
 * - 提供首帧、尾帧、上传、下载、放大查看、截帧等操作按钮
 * - 处理工具栏按钮交互反馈
 * - 基于 yet-another-react-lightbox 提供放大查看能力
 */
export const VideoToolbar = ({ nodeId, data, onDelete }: VideoToolbarProps) => {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSnapshotPanelOpen, setIsSnapshotPanelOpen] = useState(false);
  const [isSubtitlePanelOpen, setIsSubtitlePanelOpen] = useState(false);
  const [isSubmittingSubtitle, setIsSubmittingSubtitle] = useState(false);
  const subtitlePollersRef = useRef<Record<string, number>>({});

  // 隐藏的文件输入框引用：用于点击"上传"按钮时拉起文件选择器
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const nodes = useCanvasFlowStore((state) => state.nodes);
  const addNode = useCanvasFlowStore((state) => state.addNode);
  const onConnect = useCanvasFlowStore((state) => state.onConnect);

  // 更新视频节点数据：上传成功后将 URL 回填到当前节点
  const updateVideoNodeData = useCanvasFlowStore(
    (state) => state.updateVideoNodeData,
  );

  // 视频截帧 Hook
  const {
    captureLastFrame,
    captureSnapshot,
    isCapturingLastFrame,
    isCapturingSnapshot,
  } = useVideoFrameCapture();

  // 统一走视频节点 URL 提取工具，避免不同组件口径不一致。
  const videoUrls = useMemo(() => {
    return getVideoUrlsFromNodeData(data);
  }, [data]);
  const currentVideoUrl = videoUrls[0];

  const toolbarActions = useMemo(() => {
    return [
      { key: "upload" as const, label: "上传", icon: IconUpload },
      { key: "snapshot" as const, label: "截帧", icon: IconScissors },
      { key: "lastFrame" as const, label: "尾帧", icon: IconPlayerStop },
      { key: "removeCaptions" as const, label: "去字幕", icon: IconEraser },
      { key: "download" as const, label: "下载", icon: IconDownload },
      { key: "preview" as const, label: "放大查看", icon: IconZoomIn },
    ];
  }, []);

  // 触发文件选择
  const handleUploadClick = () => {
    if (isUploading) {
      return;
    }

    fileInputRef.current?.click();
  };

  // 处理文件上传：调用 OSS 上传并把返回 URL 追加到视频结果数组
  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploading(true);

    try {
      const result = await uploadFileToOSS(file);
      const uploadedUrl = result.url;

      if (!uploadedUrl) {
        toast.warning("上传成功但未返回视频地址");
        return;
      }

      const fileExt = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const currentData = data.result?.data ?? [];

      // 检测视频尺寸并更新节点比例（仅当节点还没有视频时设置 aspect_ratio）
      const updatePatch: Record<string, any> = {
        result: {
          type: "video",
          data: [...currentData, { url: uploadedUrl, format: fileExt }],
        },
      };

      if (currentData.length === 0) {
        const aspectRatio = await getAspectRatioFromMediaFile(file, "video");
        if (aspectRatio) {
          updatePatch.aspect_ratio = aspectRatio;
        }
      }

      updateVideoNodeData(nodeId, updatePatch);
      toast.success("上传成功");
    } catch (uploadError) {
      console.error("上传视频失败:", uploadError);
      toast.error("上传失败，请重试");
    } finally {
      setIsUploading(false);
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

      setIsLightboxOpen(true);
      return;
    }

    if (actionKey === "download") {
      if (!currentVideoUrl) {
        toast.info("暂无可下载视频");
        return;
      }

      if (isDownloading) {
        return;
      }

      setIsDownloading(true);
      try {
        await downloadImageFromUrl(currentVideoUrl);
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

    if (actionKey === "snapshot") {
      if (!currentVideoUrl) {
        toast.info("暂无可用视频");
        return;
      }
      setIsSnapshotPanelOpen(true);
      return;
    }

    if (actionKey === "lastFrame") {
      if (!currentVideoUrl) {
        toast.info("暂无可用视频");
        return;
      }
      await captureLastFrame(currentVideoUrl, nodeId);
      return;
    }

    if (actionKey === "removeCaptions") {
      if (!currentVideoUrl) {
        toast.info("暂无可用视频");
        return;
      }
      setIsSubtitlePanelOpen(true);
      return;
    }

  };

  const isPreviewActive = isLightboxOpen;

  useEffect(() => {
    return () => {
      Object.values(subtitlePollersRef.current).forEach((timer) => {
        window.clearInterval(timer);
      });
      subtitlePollersRef.current = {};
    };
  }, []);

  const startSubtitlePolling = useCallback(
    (taskId: string, targetNodeId: string, publicUrl: string) => {
      const existing = subtitlePollersRef.current[targetNodeId];
      if (existing) {
        window.clearInterval(existing);
      }

      const timer = window.setInterval(async () => {
        try {
          const response = await getVideoRemovalStatus(taskId);
          const { taskStatus, progress } = extractTaskStatusInfo(response);

          if (["SUCCESS", "SUCCEEDED", "COMPLETED"].includes(taskStatus)) {
            updateVideoNodeData(targetNodeId, {
              status: GenerationStatus.COMPLETED,
              progress: 100,
              result: {
                type: "video",
                data: [{ url: publicUrl, format: "mp4" }],
              },
              error: undefined,
            });
            window.clearInterval(timer);
            delete subtitlePollersRef.current[targetNodeId];
            return;
          }

          if (["FAILED", "FAIL", "ERROR"].includes(taskStatus)) {
            updateVideoNodeData(targetNodeId, {
              status: GenerationStatus.FAILED,
              progress,
              error: {
                code: "WUHEI_FAILED",
                message: "去字幕失败",
              },
            });
            window.clearInterval(timer);
            delete subtitlePollersRef.current[targetNodeId];
            return;
          }

          updateVideoNodeData(targetNodeId, {
            status: GenerationStatus.IN_PROGRESS,
            progress,
          });
        } catch {
        }
      }, 10000);

      subtitlePollersRef.current[targetNodeId] = timer;
    },
    [updateVideoNodeData],
  );

  const handleSubmitRemoveCaptions = useCallback(
    async (rect: WuhenRect) => {
      if (!currentVideoUrl) {
        return;
      }
      if (isSubmittingSubtitle) {
        return;
      }

      setIsSubmittingSubtitle(true);
      try {
        const sourceNode = nodes.find((n) => n.id === nodeId);
        const basePosition = sourceNode?.position ?? { x: 0, y: 0 };
        const baseWidth = Number(sourceNode?.width ?? 350) || 350;

        const target = await createPresignedOssUploadTarget({
          directory: "video",
          extension: "mp4",
          contentType: "application/octet-stream",
        });

        const newNodeId = addNode("video", {
          x: basePosition.x + baseWidth + 120,
          y: basePosition.y,
        });

        updateVideoNodeData(newNodeId, {
          nickname: "去字幕",
          status: GenerationStatus.IN_PROGRESS,
          progress: 0,
          result: { type: "video", data: [] },
          error: undefined,
          wuhen: {
            taskId: "",
            rect,
            resultVideoUrl: target.publicUrl,
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

        const response: any = await videoRemoval({
          video_url: currentVideoUrl,
          method: "sel_area",
          rect,
          upload_url: target.uploadUrl,
          model: "video_removal_std",
        });

        const { taskId, taskStatus } = extractTaskStatusInfo(response);

        if (!taskId) {
          updateVideoNodeData(newNodeId, {
            status: GenerationStatus.FAILED,
            error: {
              code: "WUHEI_CREATE_FAILED",
              message: "创建去字幕任务失败",
            },
          });
          return;
        }

        updateVideoNodeData(newNodeId, {
          wuhen: {
            taskId,
            rect,
            resultVideoUrl: target.publicUrl,
          },
        } as any);

        if (["SUCCESS", "SUCCEEDED", "COMPLETED"].includes(taskStatus)) {
          updateVideoNodeData(newNodeId, {
            status: GenerationStatus.COMPLETED,
            progress: 100,
            result: {
              type: "video",
              data: [{ url: target.publicUrl, format: "mp4" }],
            },
            error: undefined,
          });
        } else {
          updateVideoNodeData(newNodeId, {
            status: GenerationStatus.IN_PROGRESS,
            progress: 0,
          });
          startSubtitlePolling(taskId, newNodeId, target.publicUrl);
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
      isSubmittingSubtitle,
      nodeId,
      nodes,
      onConnect,
      startSubtitlePolling,
      updateVideoNodeData,
    ],
  );

  return (
    <>
      {/* 隐藏 input：通过工具栏“上传”按钮触发 */}
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
            (item.key === "lastFrame" && isCapturingLastFrame) ||
            (item.key === "snapshot" && isCapturingSnapshot) ||
            (item.key === "removeCaptions" && isSubmittingSubtitle);

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

      {/* 截帧面板 */}
      <VideoSnapshotPanel
        open={isSnapshotPanelOpen}
        onClose={() => setIsSnapshotPanelOpen(false)}
        videoUrl={currentVideoUrl || ""}
        onSnapshot={(timeMs) => captureSnapshot(currentVideoUrl || "", timeMs, nodeId)}
        isCapturing={isCapturingSnapshot}
      />

      <VideoSubtitleRemovalPanel
        open={isSubtitlePanelOpen}
        onClose={() => setIsSubtitlePanelOpen(false)}
        videoUrl={currentVideoUrl || ""}
        onSubmit={handleSubmitRemoveCaptions}
        isSubmitting={isSubmittingSubtitle}
      />

      {isLightboxOpen ? (
        <Lightbox
          open={isLightboxOpen}
          close={() => {
            setIsLightboxOpen(false);
          }}
          slides={videoUrls
            .filter((url): url is string => !!url)
            .map((url) => ({
              type: "video" as const,
              sources: [{ src: url, type: "video/mp4" }],
            }))}
          plugins={[Video, Fullscreen, Slideshow, Zoom, Share, Download]}
          zoom={{ maxZoomPixelRatio: 4, zoomInMultiplier: 2 }}
          controller={{ closeOnBackdropClick: true }}
        />
      ) : null}
    </>
  );
};
