import { useCallback, useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";

export const useAudioPlayback = (audioUrl?: string) => {
    const waveformRef = useRef<HTMLDivElement | null>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
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
            wavesurfer.on("timeupdate", setCurrentTime),
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

    const togglePlayback = useCallback(async () => {
        if (!wavesurferRef.current || isLoading) return;

        try {
            setPlaybackError("");
            await wavesurferRef.current.playPause();
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
