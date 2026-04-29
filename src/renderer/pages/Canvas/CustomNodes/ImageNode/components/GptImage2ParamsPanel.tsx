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

// GPT-Image-2 尺寸选项（与 API GptImage2GenerationRequest.size 一致）
export const GPTIMAGE2_SIZES = [
  { label: "1:1", value: "1:1", description: "正方形" },
  { label: "3:2", value: "3:2", description: "横向" },
  { label: "2:3", value: "2:3", description: "竖向" },
  { label: "4:3", value: "4:3", description: "横向" },
  { label: "3:4", value: "3:4", description: "竖向" },
  { label: "16:9", value: "16:9", description: "宽屏" },
  { label: "9:16", value: "9:16", description: "竖屏" },
  { label: "2:1", value: "2:1", description: "超宽" },
  { label: "1:2", value: "1:2", description: "超竖" },
];

type GptImage2ParamsPanelProps = {
  // 当前尺寸
  size: string;
  // 当前分辨率
  resolution: string;
  // 更新尺寸
  onSizeChange: (value: string) => void;
  // 更新分辨率
  onResolutionChange: (value: string) => void;
};

export const GptImage2ParamsPanel = ({
  size,
  resolution,
  onSizeChange,
  onResolutionChange,
}: GptImage2ParamsPanelProps) => {
  const currentSizeLabel =
    GPTIMAGE2_SIZES.find((item) => item.value === size)?.label ?? size;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          unstyled
          className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-100"
        >
          <span>{currentSizeLabel}</span>
          <span className="text-neutral-500">·</span>
          <span>{resolution}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-auto border border-neutral-700 bg-neutral-900 p-3 shadow-xl"
      >
        <div className="space-y-3">
          {/* 分辨率档位 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-300">
              分辨率档位
            </label>
            <div className="flex gap-2">
              {["1K", "2K", "4K"].map((res) => {
                const isActive = resolution === res;
                return (
                  <button
                    key={res}
                    type="button"
                    onClick={() => onResolutionChange(res)}
                    className={cn(
                      "flex items-center rounded-md border px-3 py-1.5 text-xs transition-all",
                      isActive
                        ? "border-[#B43FEB] bg-[#B43FEB]/10 text-[#B43FEB]"
                        : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-500",
                    )}
                  >
                    {res}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 图像比例 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-300">
              图像比例
            </label>
            <div className="grid grid-cols-3 gap-2">
              {GPTIMAGE2_SIZES.map((item) => {
                const isActive = size === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onSizeChange(item.value)}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-lg border p-2.5 transition-all",
                      isActive
                        ? "border-[#B43FEB] bg-[#B43FEB]/10"
                        : "border-neutral-700 bg-neutral-800 hover:border-neutral-500",
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
        </div>
      </PopoverContent>
    </Popover>
  );
};
