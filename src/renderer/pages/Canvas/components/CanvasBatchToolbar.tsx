import {
  ArrowLeftRight,
  Group,
  LayoutGrid,
  Ungroup,
} from "lucide-react";
import { memo } from "react";
import { Button } from "@/components/ui/button";

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
    if (!mode) {
      return null;
    }

    return (
      <div
        className="canvas-batch-toolbar absolute z-[40]"
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        style={
          position
            ? {
                left: 0,
                top: 0,
                transform: `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -100%)`,
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
              <Button
                size="sm"
                variant="blue"
                onClick={onCreateGroup}
                className="h-8 gap-2 px-3"
              >
                <Group className="size-4" />
                打组
              </Button>
            </>
          ) : (
            <>
              <span className="max-w-[220px] whitespace-nowrap text-sm font-medium text-white/70">
                当前分组 {groupCount} 个节点
              </span>
              <Button
                size="sm"
                variant="blue"
                onClick={onLayoutHorizontal}
                className="h-8 gap-2 px-3"
              >
                <ArrowLeftRight className="size-4" />
                水平布局
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={onGridLayout}
                className="h-8 gap-2 px-3"
              >
                <LayoutGrid className="size-4" />
                网格布局
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={onUngroup}
                className="h-8 gap-2 px-3"
              >
                <Ungroup className="size-4" />
                解组
              </Button>
            </>
          )}
        </div>
      </div>
    );
  },
);

CanvasBatchToolbar.displayName = "CanvasBatchToolbar";
