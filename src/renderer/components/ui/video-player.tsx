import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import * as React from "react";
import { cn } from "shared/utils/utils";
import { Slider } from "@/components/ui/slider";

export type VideoPlayerRenderProps = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  progress: number;
  volume: number;
  muted: boolean;
  bufferedEnd: number;
  isReady: boolean;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => Promise<void>;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMuted: () => void;
  formatTime: (time: number) => string;
};

export interface VideoPlayerProps
  extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>, "children"> {
  children?: (props: VideoPlayerRenderProps) => React.ReactNode;
  containerClassName?: string;
  videoClassName?: string;
  controlsClassName?: string;
  showDefaultControls?: boolean;
}

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const getBufferedEnd = (video: HTMLVideoElement) => {
  if (!video.buffered.length) {
    return 0;
  }

  return video.buffered.end(video.buffered.length - 1);
};

const formatTime = (time: number) => {
  if (!Number.isFinite(time) || time < 0) {
    return "00:00";
  }

  const totalSeconds = Math.floor(time);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const VideoPlayer = React.forwardRef<HTMLVideoElement, VideoPlayerProps>(
  (
    {
      children,
      className,
      containerClassName,
      videoClassName,
      controlsClassName,
      showDefaultControls = true,
      controls: _controls,
      onLoadedMetadata,
      onTimeUpdate,
      onPlay,
      onPause,
      onEnded,
      onVolumeChange,
      onProgress,
      ...props
    },
    forwardedRef,
  ) => {
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [currentTime, setCurrentTime] = React.useState(0);
    const [duration, setDuration] = React.useState(0);
    const [volume, setVolumeState] = React.useState(1);
    const [muted, setMuted] = React.useState(Boolean(props.muted));
    const [bufferedEnd, setBufferedEnd] = React.useState(0);
    const [isReady, setIsReady] = React.useState(false);

    const setVideoRef = React.useCallback(
      (node: HTMLVideoElement | null) => {
        videoRef.current = node;

        if (typeof forwardedRef === "function") {
          forwardedRef(node);
          return;
        }

        if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    const syncFromVideo = React.useCallback(() => {
      const video = videoRef.current;
      if (!video) {
        return;
      }

      setCurrentTime(video.currentTime || 0);
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      setVolumeState(video.volume);
      setMuted(video.muted);
      setBufferedEnd(getBufferedEnd(video));
      setIsPlaying(!video.paused);
    }, []);

    const play = React.useCallback(async () => {
      const video = videoRef.current;
      if (!video) {
        return;
      }

      await video.play();
    }, []);

    const pause = React.useCallback(() => {
      videoRef.current?.pause();
    }, []);

    const togglePlay = React.useCallback(async () => {
      const video = videoRef.current;
      if (!video) {
        return;
      }

      if (video.paused) {
        await video.play();
        return;
      }

      video.pause();
    }, []);

    const seek = React.useCallback((time: number) => {
      const video = videoRef.current;
      if (!video) {
        return;
      }

      const nextTime = clamp(
        time,
        0,
        Number.isFinite(video.duration) ? video.duration : 0,
      );
      video.currentTime = nextTime;
      setCurrentTime(nextTime);
    }, []);

    const setVolume = React.useCallback((nextVolume: number) => {
      const video = videoRef.current;
      if (!video) {
        return;
      }

      const normalizedVolume = clamp(nextVolume, 0, 1);
      video.volume = normalizedVolume;
      video.muted = normalizedVolume === 0 ? true : video.muted;
      setVolumeState(normalizedVolume);
      setMuted(video.muted);
    }, []);

    const toggleMuted = React.useCallback(() => {
      const video = videoRef.current;
      if (!video) {
        return;
      }

      video.muted = !video.muted;
      setMuted(video.muted);
    }, []);

    const progress =
      duration > 0 ? clamp((currentTime / duration) * 100, 0, 100) : 0;

    const renderProps = React.useMemo<VideoPlayerRenderProps>(
      () => ({
        videoRef,
        isPlaying,
        currentTime,
        duration,
        progress,
        volume,
        muted,
        bufferedEnd,
        isReady,
        play,
        pause,
        togglePlay,
        seek,
        setVolume,
        toggleMuted,
        formatTime,
      }),
      [
        isPlaying,
        currentTime,
        duration,
        progress,
        volume,
        muted,
        bufferedEnd,
        isReady,
        play,
        pause,
        togglePlay,
        seek,
        setVolume,
        toggleMuted,
      ],
    );

    const handleLoadedMetadata = (
      event: React.SyntheticEvent<HTMLVideoElement>,
    ) => {
      setIsReady(true);
      syncFromVideo();
      onLoadedMetadata?.(event);
    };

    const handleTimeUpdate = (
      event: React.SyntheticEvent<HTMLVideoElement>,
    ) => {
      const video = event.currentTarget;
      setCurrentTime(video.currentTime || 0);
      setBufferedEnd(getBufferedEnd(video));
      onTimeUpdate?.(event);
    };

    const handlePlay = (event: React.SyntheticEvent<HTMLVideoElement>) => {
      setIsPlaying(true);
      onPlay?.(event);
    };

    const handlePause = (event: React.SyntheticEvent<HTMLVideoElement>) => {
      setIsPlaying(false);
      onPause?.(event);
    };

    const handleEnded = (event: React.SyntheticEvent<HTMLVideoElement>) => {
      setIsPlaying(false);
      onEnded?.(event);
    };

    const handleVolumeChange = (
      event: React.SyntheticEvent<HTMLVideoElement>,
    ) => {
      const video = event.currentTarget;
      setVolumeState(video.volume);
      setMuted(video.muted);
      onVolumeChange?.(event);
    };

    const handleProgress = (event: React.SyntheticEvent<HTMLVideoElement>) => {
      setBufferedEnd(getBufferedEnd(event.currentTarget));
      onProgress?.(event);
    };

    const controlsContent =
      typeof children === "function" ? (
        children(renderProps)
      ) : showDefaultControls ? (
        <DefaultVideoControls
          className={controlsClassName}
          player={renderProps}
        />
      ) : null;

    return (
      <div
        className={cn(
          "nopan group relative overflow-hidden rounded-lg bg-black text-white",
          containerClassName,
        )}
      >
        <video
          {...props}
          ref={setVideoRef}
          className={cn(
            "block h-full w-full bg-black object-contain",
            className,
            videoClassName,
          )}
          controls={false}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          onVolumeChange={handleVolumeChange}
          onProgress={handleProgress}
        />
        {controlsContent}
      </div>
    );
  },
);

VideoPlayer.displayName = "VideoPlayer";

type DefaultVideoControlsProps = {
  className?: string;
  player: VideoPlayerRenderProps;
};

function DefaultVideoControls({
  className,
  player,
}: DefaultVideoControlsProps) {
  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    muted,
    bufferedEnd,
    isReady,
    togglePlay,
    seek,
    setVolume,
    toggleMuted,
    formatTime,
  } = player;

  const [showVolumeSlider, setShowVolumeSlider] = React.useState(false);
  const volumeRef = React.useRef<HTMLDivElement>(null);

  const safeDuration = duration > 0 ? duration : 0;

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (volumeRef.current && !volumeRef.current.contains(event.target as Node)) {
        setShowVolumeSlider(false);
      }
    };

    if (showVolumeSlider) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showVolumeSlider]);

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent px-3 pb-2 pt-12",
        className,
      )}
    >
      <div className="pointer-events-auto flex items-center gap-3">
        <button
          type="button"
          aria-label={isPlaying ? "Pause video" : "Play video"}
          title={isPlaying ? "Pause" : "Play"}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-white/90 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B43FEB]/70"
          onClick={() => {
            void togglePlay();
          }}
        >
          {isPlaying ? (
            <Pause className="size-4" />
          ) : (
            <Play className="size-4" />
          )}
        </button>

        <div className="shrink-0 text-xs tabular-nums text-white/70">
          {formatTime(currentTime)}
        </div>

        <Slider
          aria-label="Video progress"
          value={[currentTime]}
          min={0}
          max={Math.max(safeDuration, 0.01)}
          step={0.1}
          disabled={!isReady || safeDuration <= 0}
          onValueChange={([nextTime = 0]) => seek(nextTime)}
          className="min-w-[80px] flex-1 **:data-[slot=slider-track]:h-1 **:data-[slot=slider-track]:bg-white/20 **:data-[slot=slider-range]:bg-[#B43FEB] **:data-[slot=slider-thumb]:size-3 **:data-[slot=slider-thumb]:border-[#f1d2ff] **:data-[slot=slider-thumb]:bg-[#B43FEB] **:data-[slot=slider-thumb]:ring-[#B43FEB]/45"
        />

        <div className="shrink-0 text-xs tabular-nums text-white/70">
          {formatTime(safeDuration)}
        </div>

        <div ref={volumeRef} className="relative">
          <button
            type="button"
            aria-label={muted ? "Unmute video" : "Mute video"}
            title={muted ? "Unmute" : "Mute"}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B43FEB]/70"
            onClick={toggleMuted}
            onMouseEnter={() => setShowVolumeSlider(true)}
          >
            {muted || volume === 0 ? (
              <VolumeX className="size-4" />
            ) : (
              <Volume2 className="size-4" />
            )}
          </button>

          {showVolumeSlider && (
            <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2">
              <div className="rounded-md bg-black/80 p-2 backdrop-blur-sm">
                <Slider
                  aria-label="Video volume"
                  value={[muted ? 0 : volume]}
                  min={0}
                  max={1}
                  step={0.01}
                  orientation="vertical"
                  onValueChange={([nextVolume = 0]) => setVolume(nextVolume)}
                  className="h-24 data-[orientation=vertical]:**:**[:where(.radix-slider-track)]:w-1 **:data-[slot=slider-track]:bg-white/20 **:data-[slot=slider-range]:bg-white/80 **:data-[slot=slider-thumb]:size-2.5 **:data-[slot=slider-thumb]:border-white **:data-[slot=slider-thumb]:bg-white"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { VideoPlayer };
