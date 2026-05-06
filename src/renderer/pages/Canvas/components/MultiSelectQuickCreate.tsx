import { Plus } from "lucide-react";
import { memo } from "react";
import { Button } from "@/components/ui/button";

type MultiSelectQuickCreateProps = {
  visible: boolean;
  x: number;
  y: number;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
};

// 多选快捷创建按钮：固定显示在选区右侧中心，按住后进入拖拽创建流程。
export const MultiSelectQuickCreate = memo(
  ({ visible, x, y, onPointerDown }: MultiSelectQuickCreateProps) => {
    if (!visible) {
      return null;
    }

    return (
      <div
        className="canvas-multi-select-quick-create fixed left-0 top-0 z-[60]"
        style={{
          transform: `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`,
        }}
      >
        <Button
          variant="default"
          size="default"
          onPointerDown={onPointerDown}
          className="size-8 min-h-0 p-0 rounded-full bg-[#B43FEB] hover:bg-[#B43FEB]/90 text-white shadow-[0_0_20px_rgba(180,63,235,0.3)] border border-[#B43FEB]/60"
        >
          <Plus className="size-4" />
        </Button>
      </div>
    );
  },
);

MultiSelectQuickCreate.displayName = "MultiSelectQuickCreate";
