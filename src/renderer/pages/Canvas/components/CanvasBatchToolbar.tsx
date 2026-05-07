import {
  ArrowLeftRight,
  Group,
  LayoutGrid,
  Ungroup,
} from "lucide-react";
import { memo, useRef } from "react";
import type { MouseEvent, PointerEvent } from "react";
import { cn } from "shared/utils/utils";

type CanvasBatchToolbarProps = {
  mode: "selection" | "group" | null;
  selectedCount?: number;
  groupCount?: number;
  position?: {
    x: number;
    y: number;
  } | null;
  onCreateGroup?: () => void;
  onLayoutHorizontal?: () => void;
  onGridLayout?: () => void;
  onUngroup?: () => void;
};

const toolbarButtonClassName =
  "noflow nodrag nopan nowheel inline-flex h-8 items-center justify-center gap-2 rounded-md px-3 text-xs font-medium transition-all active:scale-[0.97]";

export const CanvasBatchToolbar = memo(
  ({
    mode,
    selectedCount = 0,
    groupCount = 0,
    position = null,
    onCreateGroup,
    onLayoutHorizontal,
    onGridLayout,
    onUngroup,
  }: CanvasBatchToolbarProps) => {
    const lastActionTimeRef = useRef(0);

    if (!mode) {
      return null;
    }

    const runAction = (callback?: () => void) => {
      const now = Date.now();
      if (now - lastActionTimeRef.current < 120) {
        return;
      }
      lastActionTimeRef.current = now;
      callback?.();
    };

    const handleToolbarPointerUp = (
      event: PointerEvent<HTMLButtonElement>,
      callback?: () => void,
    ) => {
      event.preventDefault();
      event.stopPropagation();
      runAction(callback);
    };

    const handleToolbarClick = (
      event: MouseEvent<HTMLButtonElement>,
      callback?: () => void,
    ) => {
      event.preventDefault();
      event.stopPropagation();
      runAction(callback);
    };

    const handleButtonPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
      event.stopPropagation();
    };

    return (
      <div
        className="canvas-batch-toolbar noflow nodrag nopan nowheel absolute z-[40]"
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
        }}
        style={
          position
            ? {
                left: `${position.x}px`,
                top: `${position.y}px`,
                transform: "translate(-50%, -100%)",
              }
            : {
                left: "50%",
                top: 16,
                transform: "translate(-50%, 0)",
              }
        }
      >
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#101114]/92 px-3 py-2 shadow-[0_16px_38px_rgba(0,0,0,0.32)] backdrop-blur-md">
          {mode === "selection" ? (
            <>
              <span className="max-w-[220px] whitespace-nowrap text-sm font-medium text-white/70">
                当前选中 {selectedCount} 个节点
              </span>
              <button
                type="button"
                onPointerDown={handleButtonPointerDown}
                onPointerUp={(event) =>
                  handleToolbarPointerUp(event, onCreateGroup)
                }
                onClick={(event) => handleToolbarClick(event, onCreateGroup)}
                className={cn(
                  toolbarButtonClassName,
                  "bg-[#B43FEB] text-white shadow-[0_0_15px_rgba(180,63,235,0.3)] hover:bg-[#9d35ce]",
                )}
              >
                <Group className="size-4" />
                打组
              </button>
            </>
          ) : (
            <>
              <span className="max-w-[220px] whitespace-nowrap text-sm font-medium text-white/70">
                当前分组 {groupCount} 个节点
              </span>
              <button
                type="button"
                onPointerDown={handleButtonPointerDown}
                onPointerUp={(event) =>
                  handleToolbarPointerUp(event, onLayoutHorizontal)
                }
                onClick={(event) =>
                  handleToolbarClick(event, onLayoutHorizontal)
                }
                className={cn(
                  toolbarButtonClassName,
                  "bg-[#B43FEB] text-white shadow-[0_0_15px_rgba(180,63,235,0.3)] hover:bg-[#9d35ce]",
                )}
              >
                <ArrowLeftRight className="size-4" />
                水平布局
              </button>
              <button
                type="button"
                onPointerDown={handleButtonPointerDown}
                onPointerUp={(event) =>
                  handleToolbarPointerUp(event, onGridLayout)
                }
                onClick={(event) => handleToolbarClick(event, onGridLayout)}
                className={cn(
                  toolbarButtonClassName,
                  "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                <LayoutGrid className="size-4" />
                网格布局
              </button>
              <button
                type="button"
                onPointerDown={handleButtonPointerDown}
                onPointerUp={(event) => handleToolbarPointerUp(event, onUngroup)}
                onClick={(event) => handleToolbarClick(event, onUngroup)}
                className={cn(
                  toolbarButtonClassName,
                  "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                <Ungroup className="size-4" />
                解组
              </button>
            </>
          )}
        </div>
      </div>
    );
  },
);

CanvasBatchToolbar.displayName = "CanvasBatchToolbar";
