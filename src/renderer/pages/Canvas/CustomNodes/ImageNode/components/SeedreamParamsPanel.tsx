/**
 * Seedream 5.0 整合参数面板组件
 * 包含宽高比、分辨率的可视化选择
 * 适用于 doubao-seedream-5-0 模型
 */

import { cn } from "shared/utils/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AspectRatioIcon } from "./AspectRatioIcon";

// Seedream 5.0 宽高比选项（与类型定义保持一致）
export const SEEDREAM_ASPECT_RATIOS = [
  { label: "1:1", value: "1:1", description: "正方形" },
  { label: "4:3", value: "4:3", description: "横向4:3" },
  { label: "3:4", value: "3:4", description: "竖向3:4" },
  { label: "16:9", value: "16:9", description: "横向宽屏" },
  { label: "9:16", value: "9:16", description: "竖向长图" },
  { label: "3:2", value: "3:2", description: "横向3:2" },
  { label: "2:3", value: "2:3", description: "竖向2:3" },
  { label: "21:9", value: "21:9", description: "超宽屏" },
  { label: "9:21", value: "9:21", description: "超窄屏" },
];

// Seedream 5.0 分辨率选项
export const SEEDREAM_RESOLUTIONS = [
  { label: "2K", value: "2K", description: "标准分辨率" },
  { label: "3K", value: "3K", description: "高清分辨率" },
];

type SeedreamParamsPanelProps = {
  // 当前宽高比
  size: string;
  // 当前分辨率
  resolution: string;
  // 更新宽高比
  onSizeChange: (value: string) => void;
  // 更新分辨率
  onResolutionChange: (value: string) => void;
};

export const SeedreamParamsPanel = ({
  size,
  resolution,
  onSizeChange,
  onResolutionChange,
}: SeedreamParamsPanelProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          unstyled
          className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 text-xs text-white/70 transition-colors hover:border-[#B43FEB]/30 hover:text-white/90 hover:bg-white/[0.04]"
        >
          <AspectRatioIcon ratio={size} size={16} />
          <span>
            {size} | {resolution}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-96 border border-white/[0.06] bg-[#09090b] p-3 shadow-xl"
      >
        <div className="space-y-4">
          {/* 宽高比选择 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-white/70">宽高比</label>
            <div className="grid grid-cols-5 gap-2">
              {SEEDREAM_ASPECT_RATIOS.map((item) => {
                const isActive = size === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onSizeChange(item.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border p-2 transition-all",
                      isActive
                        ? "border-[#B43FEB] bg-[#B43FEB]/10"
                        : "border-white/[0.06] bg-white/[0.02] hover:border-[#B43FEB]/30 hover:bg-white/[0.04]",
                    )}
                  >
                    <AspectRatioIcon
                      ratio={item.value}
                      size={24}
                      active={isActive}
                    />
                    <span
                      className={cn(
                        "text-[10px]",
                        isActive ? "text-[#B43FEB]" : "text-white/40",
                      )}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 分辨率选择 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">
              分辨率
            </label>
            <div className="flex gap-2">
              {SEEDREAM_RESOLUTIONS.map((item) => {
                const isActive = resolution === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onResolutionChange(item.value)}
                    className={cn(
                      "flex flex-1 flex-col items-center gap-0.5 rounded-lg border px-3 py-2 transition-all",
                      isActive
                        ? "border-[#B43FEB] bg-[#B43FEB]/10"
                        : "border-neutral-700 bg-neutral-800 hover:border-neutral-500",
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs font-medium",
                        isActive ? "text-[#B43FEB]" : "text-neutral-300",
                      )}
                    >
                      {item.label}
                    </span>
                    <span className="text-[10px] text-neutral-500">
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
