import {
  IconArrowBigDownLines,
  IconArrowBigUpLines,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconScissors,
  IconVideo,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DEFAULT_FPS = 30;
const FRAME_STEP_SECONDS = 1 / DEFAULT_FPS;

/**
 * 视频截帧面板属性
 */
export interface VideoSnapshotPanelProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 视频 URL */
  videoUrl: string;
  /** 截帧回调 (时间点，毫秒) */
  onSnapshot: (timeMs: number) => Promise<void> | void;
  /** 是否正在截帧 */
  isCapturing?: boolean;
}

/**
 * 视频截帧面板组件
 * 使用 16:9 预览区承载任意比例视频，支持键盘、时间轴、步进和播放控制
 */
export const VideoSnapshotPanel = ({
  open,
  onClose,
  videoUrl,
  onSnapshot,
  isCapturing = false,
}: VideoSnapshotPanelProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const formattedCurrentTime = useMemo(() => {
    return formatTime(currentTime);
  }, [currentTime]);

  const formattedDuration = useMemo(() => {
    return formatTime(duration);
  }, [duration]);

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const maxTime = Number.isFinite(video.duration) ? video.duration : duration;
    const nextTime = clamp(time, 0, maxTime || 0);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  }, [duration]);

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

      // 尝试读取视频的实际帧率，如果不确定就用 DEFAULT_FPS
      // 有些视频会有自定义属性或者基于 duration 推断，这里为了保险起见，
      // 我们用略小于 1/FPS 的步长并依赖 requestVideoFrameCallback
      const step = FRAME_STEP_SECONDS;
      const targetTime = video.currentTime + direction * step;

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

  const handleCapture = useCallback(async () => {
    await onSnapshot(Math.round(currentTime * 1000));
    onClose();
  }, [currentTime, onClose, onSnapshot]);

  useEffect(() => {
    if (!open) {
      const video = videoRef.current;
      if (video && !video.paused) {
        video.pause();
      }
      setIsPlaying(false);
      return;
    }

    setCurrentTime(0);
    setDuration(0);
    setIsReady(false);
  }, [open, videoUrl]);

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

      if (event.key === "ArrowUp") {
        event.preventDefault();
        stepFrame(-1);
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        stepFrame(1);
      }

      if (event.key === " ") {
        event.preventDefault();
        void togglePlayback();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, stepFrame, togglePlayback]);

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92vh] w-[min(1100px,96vw)] max-w-[1100px] flex-col overflow-hidden border border-white/10 bg-[#121214] p-0 text-white">
        <DialogHeader className="shrink-0 border-b border-white/5 bg-[#18181b] px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-white">
            <IconVideo size={18} />
            截取视频帧
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col bg-[#18181b]">
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
          <div className="relative overflow-hidden rounded-xl border border-white/8 bg-black">
            <div className="aspect-video w-full">
              <video
                ref={videoRef}
                src={videoUrl}
                className="h-full w-full object-contain"
                controls={false}
                playsInline
                preload="auto"
                onLoadedMetadata={(event) => {
                  const nextDuration = event.currentTarget.duration || 0;
                  setDuration(nextDuration);
                  setCurrentTime(event.currentTarget.currentTime || 0);
                  setIsReady(true);
                }}
                onTimeUpdate={(event) => {
                  setCurrentTime(event.currentTarget.currentTime || 0);
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="min-w-20 rounded-md bg-[#27272a] px-3 py-1.5 text-center text-xs font-mono text-white/90">
              {formattedCurrentTime}
            </div>

            <input
              type="range"
              min={0}
              max={duration || 0}
              step={Math.min(FRAME_STEP_SECONDS, 0.05)}
              value={Math.min(currentTime, duration || 0)}
              onChange={(event) => seekTo(Number(event.target.value))}
              disabled={!isReady}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-[#B43FEB]"
            />

            <div className="min-w-20 rounded-md bg-[#27272a] px-3 py-1.5 text-center text-xs font-mono text-white/90">
              {formattedDuration}
            </div>
          </div>

          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => stepFrame(-1)}
              disabled={!isReady || isCapturing}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#27272a] text-white/75 transition-colors hover:bg-[#3f3f46] hover:text-[#B43FEB] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="向前移动一帧"
            >
              <IconArrowBigUpLines size={18} />
            </button>
            <button
              type="button"
              onClick={() => void togglePlayback()}
              disabled={!isReady || isCapturing}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#B43FEB] text-white shadow-lg shadow-[#B43FEB]/20 transition-transform hover:scale-105 hover:bg-[#B43FEB]/90 disabled:cursor-not-allowed disabled:opacity-50"
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
              disabled={!isReady || isCapturing}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#27272a] text-white/75 transition-colors hover:bg-[#3f3f46] hover:text-[#B43FEB] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="向后移动一帧"
            >
              <IconArrowBigDownLines size={18} />
            </button>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-white/6 bg-[#1f1f23] px-4 py-3 text-xs text-white/65">
            <span>按 `↓` 向后逐帧移动，按 `↑` 向前逐帧移动，空格键可播放或暂停</span>
            <span>按 30 FPS 估算单帧步进</span>
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
              onClick={() => void handleCapture()}
              disabled={!isReady || isCapturing}
              className="min-w-44 border border-[#f3d5ff]/50 bg-[#B43FEB] font-semibold text-white shadow-[0_12px_34px_rgba(180,63,235,0.44)] ring-1 ring-[#f0c7ff]/25 hover:bg-[#C45BF0] hover:shadow-[0_16px_40px_rgba(180,63,235,0.52)]"
            >
              <IconScissors size={16} />
              {isCapturing ? "生成中..." : "截取此帧并生成新图片"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const formatTime = (timeInSeconds: number) => {
  if (!Number.isFinite(timeInSeconds) || timeInSeconds < 0) {
    return "00:00.00";
  }

  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  const centiseconds = Math.floor((timeInSeconds % 1) * 100);

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
};
