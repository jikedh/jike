import { IconMusic, IconPhoto, IconVideo } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "shared/utils/utils";
import type { FileDragState } from "@/hooks/useFileDrop";
import { FILE_DROP_HINT_TEXT } from "shared/constants/fileDrop";

type FileDropOverlayProps = {
  dragStateRef: React.RefObject<FileDragState | null>;
  /** ReactFlow 的 screenToFlowPosition，将屏幕坐标转换为画布坐标 */
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number };
};

const PLACEHOLDER_SIZE = { width: 280, height: 180 };

/** 占位框左上角相对鼠标的偏移 */
const PLACEHOLDER_OFFSET = { x: 140, y: 90 };

/**
 * 拖放占位框叠加层。
 * 通过 RAF 自驱动读取 dragStateRef 中的位置信息，避免父组件高频重渲染。
 */
export function FileDropOverlay({
  dragStateRef,
  screenToFlowPosition,
}: FileDropOverlayProps) {
  const [flowPos, setFlowPos] = useState({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const lastPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const tick = () => {
      const state = dragStateRef.current;
      if (!state?.active) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const { x, y } = state.position;
      // 避免重复计算相同位置
      if (x !== lastPosRef.current.x || y !== lastPosRef.current.y) {
        lastPosRef.current = { x, y };
        const flow = screenToFlowPosition({
          x: x - PLACEHOLDER_OFFSET.x,
          y: y - PLACEHOLDER_OFFSET.y,
        });
        setFlowPos(flow);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [dragStateRef, screenToFlowPosition]);

  const state = dragStateRef.current;
  const previewUrl = state?.previewUrl || "";
  const fileType = state?.fileType || "unknown";

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-50"
      style={{
        transform: `translate3d(${flowPos.x}px, ${flowPos.y}px, 0)`,
        width: PLACEHOLDER_SIZE.width,
        height: PLACEHOLDER_SIZE.height,
      }}
    >
      {/* 虚线占位框 */}
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center",
          "rounded-xl border-2 border-dashed border-white/35",
          "bg-white/[0.04] backdrop-blur-sm",
          "transition-colors duration-150",
        )}
      >
        {/* 预览区域 */}
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="预览"
            className="max-h-[120px] max-w-[240px] rounded-lg object-contain opacity-80"
            draggable={false}
          />
        ) : (
          <div className="mb-2 text-white/30">
            {fileType === "video" && <IconVideo size={48} stroke={1.5} />}
            {fileType === "audio" && <IconMusic size={48} stroke={1.5} />}
            {(fileType === "unknown" || fileType === "image") && (
              <IconPhoto size={48} stroke={1.5} />
            )}
          </div>
        )}
      </div>

      {/* 提示文字 */}
      <div className="mt-3 text-center">
        <span className="select-none text-sm text-white/45">
          {FILE_DROP_HINT_TEXT}
        </span>
      </div>
    </div>
  );
}
