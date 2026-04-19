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
                className="absolute z-20"
                style={{
                    left: `${x}px`,
                    top: `${y}px`,
                    transform: "translate(-50%, -50%)",
                }}
            >
                <Button
                    variant="default"
                    size="default"
                    onPointerDown={onPointerDown}
                    className="size-10 rounded-full bg-[#B43FEB] hover:bg-[#B43FEB]/90 text-white shadow-[0_0_20px_rgba(180,63,235,0.3)] border border-[#B43FEB]/60"
                >
                    <Plus className="size-5" />
                </Button>
            </div>
        );
    },
);

MultiSelectQuickCreate.displayName = "MultiSelectQuickCreate";
