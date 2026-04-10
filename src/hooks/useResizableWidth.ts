import { useCallback, useEffect, useState } from "react";

interface UseResizableWidthOptions {
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

export const useResizableWidth = ({
  defaultWidth = 420, // w-105 is 420px
  minWidth = 320,
  maxWidth = window.innerWidth * 0.8,
}: UseResizableWidthOptions = {}) => {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (e: PointerEvent) => {
      // Calculate width from the right edge of the screen
      const newWidth = window.innerWidth - e.clientX;

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth);
      } else if (newWidth < minWidth) {
        setWidth(minWidth);
      } else if (newWidth > maxWidth) {
        setWidth(maxWidth);
      }
    };

    const handlePointerUp = () => {
      setIsResizing(false);
    };
    // 这里有毒
    // Add global listeners
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);

    // Prevent text selection while resizing
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isResizing, minWidth, maxWidth]);

  return {
    width,
    isResizing,
    handlePointerDown,
  };
};
