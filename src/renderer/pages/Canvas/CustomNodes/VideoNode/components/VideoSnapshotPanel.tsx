import {
  IconArrowBigLeftLines,
  IconArrowBigRightLines,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconScissors,
  IconVideo,
} from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VideoTimeline } from "./VideoTimeline";

const DEFAULT_FPS = 30;
const FRAME_STEP_SECONDS = 1 / DEFAULT_FPS;
const TIMELINE_STEP_MS = 100;

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
 * 使用播放器式预览，支持逐帧定位当前截图时间点
 */
export const VideoSnapshotPanel = ({
  open,
  onClose,
  videoUrl,
  onSnapshot,
  isCapturing = false,
}: VideoSnapshotPanelProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playButtonRef = useRef<HTMLButtonElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);

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

  // 弹窗打开时聚焦到播放按钮
  useEffect(() => {
    if (open) {
      // 等待 Dialog 动画完成后再聚焦
      const timer = setTimeout(() => {
        playButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);


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

      // 滑块聚焦时交给 Slider 内部处理键盘事件，避免重复步进。
      if (target?.closest("[data-slot='slider']")) {
        return;
      }

      // 时间轴交互：左右键按 100ms 步长移动，保持毫秒级定位。
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
  }, [currentTime, open, seekTo]);

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92vh] w-[min(1100px,96vw)] max-w-275 flex-col overflow-hidden border border-white/10 bg-[#121214] p-0 text-white">
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
            <VideoTimeline
              disabled={!isReady || isCapturing}
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
                disabled={!isReady || isCapturing}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#27272a] text-white/75 hover:bg-[#3f3f46] hover:text-[#B43FEB] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="向前移动一帧"
              >
                <IconArrowBigLeftLines size={18} />
              </button>
              <button
                ref={playButtonRef}
                type="button"
                onClick={() => void togglePlayback()}
                disabled={!isReady || isCapturing}
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
                disabled={!isReady || isCapturing}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#27272a] text-white/75 hover:bg-[#3f3f46] hover:text-[#B43FEB] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="向后移动一帧"
              >
                <IconArrowBigRightLines size={18} />
              </button>
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

