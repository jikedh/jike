import { IconSettings } from "@tabler/icons-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "shared/utils/utils";

type Wan27I2vParamsPanelProps = {
  // 视频时长（秒）
  duration?: number;
  // 分辨率
  resolution?: "720P" | "1080P";

  // 回调
  onDurationChange: (value: number) => void;
  onResolutionChange: (value: "720P" | "1080P") => void;
};

// 时长选项
const DURATION_OPTIONS = [
  { label: "4秒", value: 4 },
  { label: "5秒", value: 5 },
  { label: "10秒", value: 10 },
] as const;

// 分辨率选项
const RESOLUTION_OPTIONS = [
  { label: "720P", value: "720P", desc: "高清" },
  { label: "1080P", value: "1080P", desc: "超清" },
] as const;

export const Wan27I2vParamsPanel = ({
  duration,
  resolution,
  onDurationChange,
  onResolutionChange,
}: Wan27I2vParamsPanelProps) => {
  // 默认值处理
  const currentDuration = duration ?? 4;
  const currentResolution = resolution ?? "720P";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          unstyled
          className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-100"
        >
          <IconSettings size={14} />
          <span>整合参数</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-72 border border-neutral-700 bg-neutral-900 p-4 shadow-xl"
      >
        <div className="space-y-5">
          {/* 时长 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">
              视频时长
            </label>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map((item) => {
                const isActive = currentDuration === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onDurationChange(item.value)}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-lg border px-4 py-2 transition-all flex-1",
                      isActive
                        ? "border-[#B43FEB] bg-[#B43FEB]/10"
                        : "border-neutral-700 bg-neutral-800 hover:border-neutral-500 hover:bg-neutral-750",
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
                  </button>
                );
              })}
            </div>
          </div>

          {/* 分辨率 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">
              视频分辨率
            </label>
            <div className="flex gap-2">
              {RESOLUTION_OPTIONS.map((item) => {
                const isActive = currentResolution === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onResolutionChange(item.value)}
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-lg border px-4 py-2 transition-all flex-1",
                      isActive
                        ? "border-[#B43FEB] bg-[#B43FEB]/10"
                        : "border-neutral-700 bg-neutral-800 hover:border-neutral-500 hover:bg-neutral-750",
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs",
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
                      {item.desc}
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
