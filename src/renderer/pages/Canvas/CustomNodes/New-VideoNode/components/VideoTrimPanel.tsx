import {
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconScissors,
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

export type VideoTrimResult = {
  url: string;
  format: "mp4";
  duration: number;
  method: "imm" | "ffmpeg";
  jobId?: string;
};

type VideoTrimPanelProps = {
  open: boolean;
  onClose: () => void;
  videoUrl: string;
  onTrim: (range: { start: number; end: number }) => Promise<VideoTrimResult>;
  isTrimming?: boolean;
};

type DragHandle = "start" | "end" | null;

const MIN_TRIM_DURATION = 0.5;

const getViewportSize = () => {
  if (typeof window === "undefined") {
    return { width: 1280, height: 720 };
  }
  return { width: window.innerWidth, height: window.innerHeight };
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) {
    return "0:00.0";
  }
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, "0")}`;
};

export const VideoTrimPanel = ({
  open,
  onClose,
  videoUrl,
  onTrim,
  isTrimming = false,
}: VideoTrimPanelProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const dragHandleRef = useRef<DragHandle>(null);
  const [viewportSize, setViewportSize] = useState(getViewportSize);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const workspaceFrame = useMemo(() => {
    const maxWidth = Math.min(viewportSize.width - 160, 720);
    const maxHeight = Math.min(viewportSize.height - 360, 430);
    return {
      width: Math.max(360, maxWidth),
      height: Math.max(220, maxHeight),
    };
  }, [viewportSize.height, viewportSize.width]);

  const selectedDuration = Math.max(0, endTime - startTime);
  const startPercent = duration > 0 ? (startTime / duration) * 100 : 0;
  const endPercent = duration > 0 ? (endTime / duration) * 100 : 0;

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const nextTime = clamp(time, 0, video.duration || 0);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  }, []);

  const togglePlayback = useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (video.paused) {
      video.currentTime = clamp(currentTime, startTime, endTime);
      await video.play();
      setIsPlaying(true);
      return;
    }

    video.pause();
    setIsPlaying(false);
  }, [currentTime, endTime, startTime]);

  const updateDragTime = useCallback(
    (clientX: number) => {
      const rect = timelineRef.current?.getBoundingClientRect();
      const handle = dragHandleRef.current;
      if (!rect || !handle || duration <= 0) {
        return;
      }

      const percent = clamp((clientX - rect.left) / rect.width, 0, 1);
      const nextTime = percent * duration;
      if (handle === "start") {
        const nextStart = clamp(nextTime, 0, endTime - MIN_TRIM_DURATION);
        setStartTime(nextStart);
        seekTo(nextStart);
      } else {
        const nextEnd = clamp(nextTime, startTime + MIN_TRIM_DURATION, duration);
        setEndTime(nextEnd);
        seekTo(nextEnd);
      }
    },
    [duration, endTime, seekTo, startTime],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      updateDragTime(event.clientX);
    },
    [updateDragTime],
  );

  const handlePointerUp = useCallback(() => {
    dragHandleRef.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }, [handlePointerMove]);

  const startDrag = useCallback(
    (handle: Exclude<DragHandle, null>, event: React.PointerEvent) => {
      event.preventDefault();
      dragHandleRef.current = handle;
      updateDragTime(event.clientX);
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [handlePointerMove, handlePointerUp, updateDragTime],
  );

  const handleReset = useCallback(() => {
    setStartTime(0);
    setEndTime(duration);
    seekTo(0);
  }, [duration, seekTo]);

  const handleConfirm = useCallback(async () => {
    if (!videoUrl || !isReady || selectedDuration < MIN_TRIM_DURATION) {
      return;
    }

    await onTrim({ start: startTime, end: endTime });
    onClose();
  }, [
    endTime,
    isReady,
    onClose,
    onTrim,
    selectedDuration,
    startTime,
    videoUrl,
  ]);

  useEffect(() => {
    if (!open) {
      videoRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    setDuration(0);
    setCurrentTime(0);
    setStartTime(0);
    setEndTime(0);
    setIsReady(false);
    setIsPlaying(false);
  }, [open, videoUrl]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleResize = () => setViewportSize(getViewportSize());
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="flex max-h-[92vh] w-[min(760px,94vw)] flex-col overflow-hidden border border-white/10 bg-[#121214] p-0 text-white">
        <DialogHeader className="shrink-0 border-b border-white/5 bg-[#18181b] px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-white">
              <IconScissors size={18} />
              视频裁剪
            </DialogTitle>
            <div className="rounded-lg border border-[#f3d5ff]/20 bg-[#B43FEB]/10 px-3 py-1.5 text-xs text-white/70">
              {formatTime(startTime)} - {formatTime(endTime)}
              <span className="ml-2 font-semibold text-[#e9c8ff]">
                共 {formatTime(selectedDuration)}
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 p-5">
          <div className="flex justify-center">
            <div
              className="relative overflow-hidden rounded-lg bg-black"
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
                  const nextDuration = event.currentTarget.duration || 0;
                  setDuration(nextDuration);
                  setStartTime(0);
                  setEndTime(nextDuration);
                  setCurrentTime(0);
                  setIsReady(nextDuration > 0);
                }}
                onTimeUpdate={(event) => {
                  const nextTime = event.currentTarget.currentTime || 0;
                  setCurrentTime(nextTime);
                  if (nextTime >= endTime && endTime > 0) {
                    event.currentTarget.pause();
                    setIsPlaying(false);
                    seekTo(startTime);
                  }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />
              <button
                type="button"
                className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/70 text-black shadow-[0_12px_32px_rgba(0,0,0,0.36)] transition hover:bg-white"
                onClick={() => void togglePlayback()}
                disabled={!isReady || isTrimming}
                aria-label={isPlaying ? "暂停" : "播放"}
              >
                {isPlaying ? (
                  <IconPlayerPauseFilled size={24} />
                ) : (
                  <IconPlayerPlayFilled size={24} className="ml-1" />
                )}
              </button>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[640px]">
            <div className="mb-3 flex items-center justify-between text-xs text-white/45">
              <span>{formatTime(startTime)}</span>
              <span>{formatTime(endTime)}</span>
            </div>
            <div
              ref={timelineRef}
              className="relative h-12 rounded-md bg-[#303033] px-2"
            >
              <div className="absolute inset-x-3 top-1/2 h-8 -translate-y-1/2 rounded bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.13)_0,rgba(255,255,255,0.13)_2px,transparent_2px,transparent_8px)]" />
              <div
                className="absolute top-1/2 h-8 -translate-y-1/2 rounded border-2 border-[#B43FEB] bg-[#B43FEB]/25 shadow-[0_0_24px_rgba(180,63,235,0.32)]"
                style={{
                  left: `calc(${startPercent}% + 12px)`,
                  width: `calc(${Math.max(0, endPercent - startPercent)}% - 24px)`,
                }}
              />
              <button
                type="button"
                className="absolute top-1/2 z-10 h-12 w-3 -translate-x-1/2 -translate-y-1/2 rounded bg-[#B43FEB] shadow-[0_0_18px_rgba(180,63,235,0.55)] ring-2 ring-[#f3d5ff]/30"
                style={{ left: `calc(${startPercent}% + 12px)` }}
                onPointerDown={(event) => startDrag("start", event)}
                aria-label="调整开始时间"
              />
              <button
                type="button"
                className="absolute top-1/2 z-10 h-12 w-3 -translate-x-1/2 -translate-y-1/2 rounded bg-[#B43FEB] shadow-[0_0_18px_rgba(180,63,235,0.55)] ring-2 ring-[#f3d5ff]/30"
                style={{ left: `calc(${endPercent}% - 12px)` }}
                onPointerDown={(event) => startDrag("end", event)}
                aria-label="调整结束时间"
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-white/5 bg-[#18181b] px-5 py-4">
          <button
            type="button"
            className="text-sm text-white/50 transition hover:text-white"
            onClick={handleReset}
          >
            重置
          </button>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              className="border border-white/10 bg-transparent text-white/70 hover:bg-white/5 hover:text-white"
              onClick={onClose}
            >
              取消
            </Button>
            <Button
              type="button"
              className={cn(
                "min-w-32 border border-[#f3d5ff]/50 bg-[#B43FEB] font-semibold text-white shadow-[0_12px_34px_rgba(180,63,235,0.44)] ring-1 ring-[#f0c7ff]/25 hover:bg-[#C45BF0]",
                isTrimming && "opacity-75",
              )}
              loading={isTrimming}
              disabled={
                !isReady || isTrimming || selectedDuration < MIN_TRIM_DURATION
              }
              onClick={() => void handleConfirm()}
            >
              <IconScissors size={16} />
              {isTrimming ? "裁剪中..." : "确认裁剪"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
