import { useState, useRef, useCallback } from "react";
import type { ReactNode } from "react";

interface ThumbnailPreviewPopoverProps {
    src: string;
    index: number;
    children: ReactNode;
}

export const ThumbnailPreviewPopover = ({
    src,
    index,
    children,
}: ThumbnailPreviewPopoverProps) => {
    const [visible, setVisible] = useState(false);
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

            {/* 大图预览浮窗 */}
            {visible && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
                    <div className="w-60 h-60 rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-neutral-900 transition-opacity duration-150">
                        <img
                            src={src}
                            alt={`预览 ${index + 1}`}
                            className="w-full h-full object-cover"
                        />
                        {/* 序号角标 */}
                        <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs font-medium text-white">
                            {index + 1}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};
