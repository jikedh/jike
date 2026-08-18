import { IconMusic } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const WAVEFORM_BARS = [
    10, 18, 28, 14, 36, 22, 42, 30, 16, 34, 24, 40, 18, 30, 12,
];

const AudioWaveformBubble = ({
    label,
    position,
}: {
    label?: string;
    position: { left: number; top: number };
}) => {
    return createPortal(
        <div
            className="pointer-events-none fixed z-[9999] w-48 -translate-x-1/2 -translate-y-full rounded-xl border border-fuchsia-300/25 bg-[#17131d] px-3 py-2 shadow-[0_12px_28px_rgba(0,0,0,0.45)]"
            style={{ left: position.left, top: position.top }}
        >
            <div className="mb-2 flex min-w-0 items-center gap-1.5 text-xs text-fuchsia-200">
                <IconMusic size={13} className="shrink-0" />
                <span className="truncate">{label || "音频参考"}</span>
            </div>
            <div className="flex h-11 items-center justify-between gap-1">
                {WAVEFORM_BARS.map((height, index) => (
                    <span
                        key={`${height}-${index}`}
                        className="w-1 rounded-full bg-linear-to-b from-fuchsia-200 to-[#B43FEB]"
                        style={{ height }}
                    />
                ))}
            </div>
        </div>,
        document.body,
    );
};

export const AudioWaveformPreview = ({
    audioUrl,
    label,
    children,
    className,
}: {
    audioUrl: string;
    label?: string;
    children: ReactNode;
    className?: string;
}) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [position, setPosition] = useState<{ left: number; top: number } | null>(
        null,
    );

    const stopPreview = () => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.pause();
        audio.currentTime = 0;
    };

    const handleMouseEnter = (event: React.MouseEvent<HTMLElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPosition({
            left: rect.left + rect.width / 2,
            top: rect.top - 10,
        });

        if (!audioUrl) return;
        const audio = audioRef.current ?? new Audio(audioUrl);
        audioRef.current = audio;
        audio.currentTime = 0;
        void audio.play().catch(() => undefined);
    };

    const handleMouseLeave = () => {
        stopPreview();
        setPosition(null);
    };

    useEffect(() => {
        return () => {
            stopPreview();
            audioRef.current = null;
        };
    }, []);

    return (
        <>
            <span
                className={className}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {children}
            </span>
            {position && <AudioWaveformBubble label={label} position={position} />}
        </>
    );
};

export const AudioWaveformMentionPreview = ({
    audioUrl,
    label,
    position,
}: {
    audioUrl: string;
    label?: string;
    position: { left: number; top: number };
}) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        void audio.play().catch(() => undefined);

        return () => {
            audio.pause();
            audio.currentTime = 0;
            audioRef.current = null;
        };
    }, [audioUrl]);

    return <AudioWaveformBubble label={label} position={position} />;
};
