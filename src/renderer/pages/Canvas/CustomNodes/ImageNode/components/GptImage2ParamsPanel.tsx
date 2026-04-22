/**
 * GPT-Image-2 参数面板组件
 * 包含图像尺寸的可视化选择
 * 适用于 gpt-image-2 模型
 */

import { cn } from "shared/utils/utils";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

// GPT-Image-2 尺寸选项（与 API 类型定义保持一致）
export const GPTIMAGE2_SIZES = [
    { label: "1024×1024", value: "1024x1024", description: "正方形" },
    { label: "1536×1024", value: "1536x1024", description: "横向" },
    { label: "1024×1536", value: "1024x1536", description: "竖向" },
];

type GptImage2ParamsPanelProps = {
    // 当前尺寸
    size: string;
    // 更新尺寸
    onSizeChange: (value: string) => void;
};

export const GptImage2ParamsPanel = ({
    size,
    onSizeChange,
}: GptImage2ParamsPanelProps) => {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    unstyled
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 text-xs text-white/70 transition-colors hover:border-[#B43FEB]/30 hover:text-white/90 hover:bg-white/[0.04]"
                >
                    <span>{size}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                side="top"
                className="w-auto border border-white/[0.06] bg-[#09090b] p-3 shadow-xl"
            >
                <div className="space-y-2">
                    <label className="text-xs font-medium text-white/70">图像尺寸</label>
                    <div className="flex gap-2">
                        {GPTIMAGE2_SIZES.map((item) => {
                            const isActive = size === item.value;
                            return (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => onSizeChange(item.value)}
                                    className={cn(
                                        "flex flex-col items-center gap-1 rounded-lg border p-3 transition-all",
                                        isActive
                                            ? "border-[#B43FEB] bg-[#B43FEB]/10"
                                            : "border-white/[0.06] bg-white/[0.02] hover:border-[#B43FEB]/30 hover:bg-white/[0.04]",
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "text-sm font-medium",
                                            isActive ? "text-[#B43FEB]" : "text-white/70",
                                        )}
                                    >
                                        {item.label}
                                    </span>
                                    <span
                                        className={cn(
                                            "text-[10px]",
                                            isActive ? "text-[#B43FEB]/70" : "text-white/40",
                                        )}
                                    >
                                        {item.description}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};
