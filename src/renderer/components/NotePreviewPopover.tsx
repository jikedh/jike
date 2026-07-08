import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconFileText } from "@tabler/icons-react";

interface NotePreviewPopoverProps {
  content: string;
  label?: string;
  index: number;
  children: ReactNode;
}

/**
 * 便签内容悬浮预览：在 Hover 时显示放大文本卡片，视觉风格与图片预览保持一致。
 */
export const NotePreviewPopover = ({
  content,
  label,
  index,
  children,
}: NotePreviewPopoverProps) => {
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
    }, 250);
  }, []);

  const handlePreviewMouseEnter = useCallback(() => {
    clearTimers();
  }, []);

  const handlePreviewMouseLeave = useCallback(() => {
    clearTimers();
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
    }, 150);
  }, []);

  useEffect(() => clearTimers, []);

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
            className="nodrag nopan nowheel fixed z-9999 pointer-events-auto"
            style={{
              left: previewPosition.left,
              top: previewPosition.top,
              transform: "translate(-50%, -100%)",
            }}
            onMouseEnter={handlePreviewMouseEnter}
            onMouseLeave={handlePreviewMouseLeave}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="w-72 max-h-80 rounded-xl border border-white/10 bg-neutral-900 p-3 shadow-2xl">
              <div className="mb-2 flex items-center gap-2 text-xs text-white/85">
                <IconFileText size={14} className="text-[#B43FEB]" />
                <span className="truncate font-medium">
                  {label?.trim() || `便签${index + 1}`}
                </span>
              </div>
              <div className="max-h-64 cursor-text select-text overflow-auto whitespace-pre-wrap wrap-break-word rounded-md bg-white/4 p-2.5 text-[12px] leading-relaxed text-white/80">
                {content || "（便签内容为空）"}
              </div>
              <div className="mt-2 flex justify-end">
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-black/55 px-1.5 text-[10px] font-medium text-white">
                  {index + 1}
                </span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
