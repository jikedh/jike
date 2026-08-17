import { useCallback, useState } from "react";

export const useAudioPlayback = (
    audioRef: React.RefObject<HTMLAudioElement | null>,
) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const togglePlayback = useCallback(() => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            void audioRef.current.play();
        }
        setIsPlaying((value) => !value);
    }, [audioRef, isPlaying]);

    const updateCurrentTime = useCallback(() => {
        if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
    }, [audioRef]);

    const loadMetadata = useCallback(() => {
        if (audioRef.current) setDuration(audioRef.current.duration);
    }, [audioRef]);

    const seek = useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            if (!audioRef.current || !duration) return;

            const rect = event.currentTarget.getBoundingClientRect();
            const nextTime = ((event.clientX - rect.left) / rect.width) * duration;
            audioRef.current.currentTime = nextTime;
            setCurrentTime(nextTime);
        },
        [audioRef, duration],
    );

    return {
        isPlaying,
        currentTime,
        duration,
        togglePlayback,
        updateCurrentTime,
        loadMetadata,
        seek,
        stopPlayback: () => setIsPlaying(false),
    };
};
