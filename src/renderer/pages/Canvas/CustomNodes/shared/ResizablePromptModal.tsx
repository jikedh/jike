import { useCallback, useEffect, useRef, useState } from "react";

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type ResizablePromptModalProps = {
    children: React.ReactNode;
};

const MIN_WIDTH = 640;
const MIN_HEIGHT = 360;
const VIEWPORT_PADDING = 32;

const RESIZE_HANDLES: Array<{
    direction: ResizeDirection;
    className: string;
}> = [
        { direction: "n", className: "inset-x-3 -top-1.5 h-3 cursor-ns-resize" },
        { direction: "s", className: "inset-x-3 -bottom-1.5 h-3 cursor-ns-resize" },
        { direction: "e", className: "inset-y-3 -right-1.5 w-3 cursor-ew-resize" },
        { direction: "w", className: "inset-y-3 -left-1.5 w-3 cursor-ew-resize" },
        { direction: "ne", className: "-right-1.5 -top-1.5 h-4 w-4 cursor-nesw-resize" },
        { direction: "nw", className: "-left-1.5 -top-1.5 h-4 w-4 cursor-nwse-resize" },
        { direction: "se", className: "-right-1.5 -bottom-1.5 h-4 w-4 cursor-nwse-resize" },
        { direction: "sw", className: "-left-1.5 -bottom-1.5 h-4 w-4 cursor-nesw-resize" },
    ];

const getInitialSize = () => ({
    width: Math.min(960, window.innerWidth - VIEWPORT_PADDING * 2),
    height: Math.min(640, window.innerHeight - VIEWPORT_PADDING * 2),
});

export const ResizablePromptModal = ({ children }: ResizablePromptModalProps) => {
    const [size, setSize] = useState(getInitialSize);
    const resizeRef = useRef<{
        direction: ResizeDirection;
        startX: number;
        startY: number;
        startSize: { width: number; height: number };
    } | null>(null);

    const constrainSize = useCallback((width: number, height: number) => {
        return {
            width: Math.min(
                Math.max(MIN_WIDTH, width),
                window.innerWidth - VIEWPORT_PADDING * 2,
            ),
            height: Math.min(
                Math.max(MIN_HEIGHT, height),
                window.innerHeight - VIEWPORT_PADDING * 2,
            ),
        };
    }, []);

    const handleResizeStart = useCallback(
        (direction: ResizeDirection, event: React.PointerEvent<HTMLDivElement>) => {
            event.preventDefault();
            event.stopPropagation();
            resizeRef.current = {
                direction,
                startX: event.clientX,
                startY: event.clientY,
                startSize: size,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
        },
        [size],
    );

    useEffect(() => {
        const handlePointerMove = (event: PointerEvent) => {
            const resize = resizeRef.current;
            if (!resize) {
                return;
            }

            const deltaX = event.clientX - resize.startX;
            const deltaY = event.clientY - resize.startY;
            const widthDelta = resize.direction.includes("e")
                ? deltaX
                : resize.direction.includes("w")
                    ? -deltaX
                    : 0;
            const heightDelta = resize.direction.includes("s")
                ? deltaY
                : resize.direction.includes("n")
                    ? -deltaY
                    : 0;

            setSize(
                constrainSize(
                    resize.startSize.width + widthDelta,
                    resize.startSize.height + heightDelta,
                ),
            );
        };

        const handlePointerEnd = () => {
            resizeRef.current = null;
        };

        const handleViewportResize = () => {
            setSize((currentSize) =>
                constrainSize(currentSize.width, currentSize.height),
            );
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerEnd);
        window.addEventListener("resize", handleViewportResize);
        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerEnd);
            window.removeEventListener("resize", handleViewportResize);
        };
    }, [constrainSize]);

    return (
        <div
            className="nodrag nopan nowheel fixed inset-0 z-9999 flex items-center justify-center bg-black/55 p-8 backdrop-blur-[2px]"
            onMouseDown={(event) => event.stopPropagation()}
        >
            <div
                className="relative max-h-full max-w-full"
                style={{ width: size.width, height: size.height }}
                onMouseDown={(event) => event.stopPropagation()}
            >
                {children}
                {RESIZE_HANDLES.map((handle) => (
                    <div
                        key={handle.direction}
                        className={`absolute z-10 ${handle.className}`}
                        onPointerDown={(event) => handleResizeStart(handle.direction, event)}
                    />
                ))}
            </div>
        </div>
    );
};
