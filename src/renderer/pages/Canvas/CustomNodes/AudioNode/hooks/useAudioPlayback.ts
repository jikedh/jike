import { useCallback, useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";

type AudioPlaybackRange = {
    start: number;
    end: number;
};

export const useAudioPlayback = (
    audioUrl?: string,
    playbackRange?: AudioPlaybackRange,
) => {
    const waveformRef = useRef<HTMLDivElement | null>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const playbackRangeRef = useRef(playbackRange);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [playbackError, setPlaybackError] = useState("");

    useEffect(() => {
        const container = waveformRef.current;
        if (!container || !audioUrl) return;

        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setIsLoading(true);
        setPlaybackError("");

        const wavesurfer = WaveSurfer.create({
            container,
            url: audioUrl,
            height: "auto",
            waveColor: "#45414d",
            progressColor: "#75617e",
            cursorColor: "#ff3b3b",
            cursorWidth: 2,
            barWidth: 3,
            barGap: 3,
            barRadius: 3,
            barHeight: 0.9,
            barMinHeight: 2,
            normalize: true,
            interact: true,
            dragToSeek: true,
            hideScrollbar: true,
        });
        wavesurferRef.current = wavesurfer;

        const unsubscribers = [
            wavesurfer.on("ready", (nextDuration) => {
                setDuration(nextDuration);
                setIsLoading(false);
            }),
            wavesurfer.on("timeupdate", (nextTime) => {
                const range = playbackRangeRef.current;
                if (!range) {
                    setCurrentTime(nextTime);
                    return;
                }
                if (nextTime < range.start) {
                    wavesurfer.setTime(range.start);
                    setCurrentTime(range.start);
                    return;
                }
                if (nextTime >= range.end) {
                    wavesurfer.pause();
                    if (Math.abs(nextTime - range.end) > 0.01) {
                        wavesurfer.setTime(range.end);
                    }
                    setCurrentTime(range.end);
                    return;
                }
                setCurrentTime(nextTime);
            }),
            wavesurfer.on("interaction", (nextTime) => {
                const range = playbackRangeRef.current;
                if (!range) return;
                if (nextTime < range.start) {
                    wavesurfer.setTime(range.start);
                } else if (nextTime > range.end) {
                    wavesurfer.setTime(range.end);
                }
            }),
            wavesurfer.on("play", () => setIsPlaying(true)),
            wavesurfer.on("pause", () => setIsPlaying(false)),
            wavesurfer.on("finish", () => setIsPlaying(false)),
            wavesurfer.on("error", () => {
                setIsLoading(false);
                setPlaybackError("音频波形加载失败");
            }),
        ];

        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
            wavesurfer.destroy();
            wavesurferRef.current = null;
        };
    }, [audioUrl]);

    useEffect(() => {
        playbackRangeRef.current = playbackRange;
        const wavesurfer = wavesurferRef.current;
        if (!wavesurfer || !playbackRange) return;

        const currentTime = wavesurfer.getCurrentTime();
        const nextTime =
            currentTime < playbackRange.start || currentTime >= playbackRange.end
                ? playbackRange.start
                : currentTime;
        wavesurfer.setTime(nextTime);
        setCurrentTime(nextTime);

        if (wavesurfer.isPlaying()) {
            void wavesurfer.play(nextTime, playbackRange.end).catch((error: any) => {
                console.error("更新音频截取播放范围失败:", error);
                setPlaybackError("音频播放失败");
            });
        }
    }, [playbackRange?.end, playbackRange?.start]);

    const togglePlayback = useCallback(async () => {
        if (!wavesurferRef.current || isLoading) return;

        try {
            setPlaybackError("");
            if (wavesurferRef.current.isPlaying()) {
                wavesurferRef.current.pause();
                return;
            }

            const range = playbackRangeRef.current;
            if (!range) {
                await wavesurferRef.current.play();
                return;
            }

            const currentTime = wavesurferRef.current.getCurrentTime();
            const startTime =
                currentTime >= range.start && currentTime < range.end
                    ? currentTime
                    : range.start;
            await wavesurferRef.current.play(startTime, range.end);
        } catch (error: any) {
            console.error("音频播放失败:", error);
            setPlaybackError("音频播放失败");
        }
    }, [isLoading]);

    return {
        waveformRef,
        isPlaying,
        currentTime,
        duration,
        isLoading,
        playbackError,
        togglePlayback,
    };
};
