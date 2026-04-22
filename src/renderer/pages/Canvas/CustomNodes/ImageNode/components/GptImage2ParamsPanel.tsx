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
  { label: "1:1", value: "1024x1024", description: "正方形" },
  { label: "3:2", value: "1536x1024", description: "横向3:2" },
  { label: "2:3", value: "1024x1536", description: "竖向2:3" },
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
  const currentSizeLabel = GPTIMAGE2_SIZES.find((item) => item.value === size)?.label ?? size;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          unstyled
          className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-100"
        >
          <span>{currentSizeLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-auto border border-neutral-700 bg-neutral-900 p-3 shadow-xl"
      >
        <div className="space-y-2">
          <label className="text-xs font-medium text-neutral-300">图像尺寸</label>
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
                      : "border-neutral-700 bg-neutral-800 hover:border-neutral-500 hover:bg-neutral-750",
                  )}
                >
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isActive ? "text-[#B43FEB]" : "text-neutral-300",
                    )}
                  >
                    {item.label}
                  </span>
                  <span
                    className={cn(
                      "text-[10px]",
                      isActive ? "text-[#B43FEB]/70" : "text-neutral-500",
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
