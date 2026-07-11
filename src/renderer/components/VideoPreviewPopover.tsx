import { useState, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

interface VideoPreviewPopoverProps {
    src: string;
    poster?: string;
    index: number;
    children: ReactNode;
}

export const VideoPreviewPopover = ({
    src,
    poster,
    index,
    children,
}: VideoPreviewPopoverProps) => {
    const [visible, setVisible] = useState(false);
    const [previewPosition, setPreviewPosition] = useState({
        left: 0,
        top: 0,
    });
    const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const clearTimers = () => {
        if (showTimerRef.current) {
            clearTimeout(showTimerRef.current);
            showTimerRef.current = null;
        }
        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
    };

    const handleMouseEnter = useCallback(() => {
        clearTimers();
        showTimerRef.current = setTimeout(() => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                setPreviewPosition({
                    left: rect.left + rect.width / 2,
                    top: Math.max(12, rect.top - 8),
                });
            }
            setVisible(true);
        }, 200);
    }, []);

    const handleMouseLeave = useCallback(() => {
        clearTimers();
        hideTimerRef.current = setTimeout(() => {
            setVisible(false);
        }, 150);
    }, []);

    return (
        <div
            ref={containerRef}
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}

            {visible &&
                createPortal(
                    <div
                        className="pointer-events-none fixed z-[9999]"
                        style={{
                            left: previewPosition.left,
                            top: previewPosition.top,
                            transform: "translate(-50%, -100%)",
                        }}
                    >
                        <div className="flex w-60 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-neutral-900 shadow-2xl transition-opacity duration-150">
                            <video
                                src={src}
                                poster={poster}
                                muted
                                autoPlay
                                loop
                                playsInline
                                className="h-auto w-full object-contain"
                            />
                            <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs font-medium text-white">
                                {index + 1}
                            </span>
                        </div>
                    </div>,
                    document.body,
                )}
        </div>
    );
};
