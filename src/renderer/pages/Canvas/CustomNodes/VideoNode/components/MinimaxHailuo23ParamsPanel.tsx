/**
 * MiniMax Hailuo 2.3 视频参数面板组件
 * 严格遵循 MinimaxHailuo23Request 类型定义
 * 字段映射：duration、metadata.resolution、metadata.prompt_optimizer、metadata.fast_pretreatment
 */

import { IconChevronDown } from "@tabler/icons-react";
import { useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "shared/lib/utils";

type MinimaxHailuo23ParamsPanelProps = {
  // 视频时长（秒）：6 | 10
  duration?: number;
  // 扩展参数
  metadata?: {
    // 视频分辨率：768p | 1080p（仅支持 6 秒时长）
    resolution?: string;
    // 是否自动优化 prompt，默认 true
    prompt_optimizer?: boolean;
    // 是否缩短 prompt 优化耗时，默认 false
    fast_pretreatment?: boolean;
  };
  // 更新视频时长
  onDurationChange: (value: number) => void;
  // 更新 metadata
  onMetadataChange: (
    metadata: MinimaxHailuo23ParamsPanelProps["metadata"],
  ) => void;
};

// MiniMax Hailuo 2.3 时长可选值
const DURATION_PRESETS = [6, 10] as const;

// MiniMax Hailuo 2.3 分辨率选项
const RESOLUTION_OPTIONS = [
  { label: "768p", value: "768p", desc: "高清（默认）" },
  { label: "1080p", value: "1080p", desc: "全高清（仅6秒）" },
] as const;

export const MinimaxHailuo23ParamsPanel = ({
  duration,
  metadata,
  onDurationChange,
  onMetadataChange,
}: MinimaxHailuo23ParamsPanelProps) => {
  // 高级设置折叠状态
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // 更新 metadata 中指定字段
  const updateMetadata = (
    updates: Partial<NonNullable<MinimaxHailuo23ParamsPanelProps["metadata"]>>,
  ) => {
    onMetadataChange({
      ...metadata,
      ...updates,
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          unstyled
          className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-100"
        >
          <span>整合参数</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-[420px] border border-neutral-700 bg-neutral-900 p-4 shadow-xl"
      >
        <div className="space-y-5">
          {/* 视频时长选择 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">
              视频时长（秒）
            </label>
            <div className="flex gap-2">
              {DURATION_PRESETS.map((preset) => {
                const isActive = (duration ?? 6) === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onDurationChange(preset)}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-lg border px-5 py-2.5 transition-all",
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
                      {preset}s
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 分隔线 */}
          <div className="border-t border-neutral-700" />

          {/* 提示词优化 - prompt_optimizer */}
          <div className="flex items-center justify-between rounded-lg border border-neutral-700 bg-neutral-800/50 p-3">
            <div className="space-y-0.5">
              <label className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                <IconChevronDown size={12} />
                自动优化提示词
              </label>
              <p className="text-[10px] text-neutral-500">
                AI 自动优化视频描述，提升生成效果
              </p>
            </div>
            <Switch
              checked={metadata?.prompt_optimizer ?? true}
              onCheckedChange={(checked) =>
                updateMetadata({ prompt_optimizer: checked })
              }
              className="data-[state=checked]:bg-[#B43FEB]"
            />
          </div>

          {/* 高级设置折叠区域 */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="flex w-full items-center justify-between text-xs font-medium text-neutral-400 hover:text-neutral-300"
            >
              <span>高级设置</span>
              <IconChevronDown
                size={14}
                className={cn(
                  "transition-transform",
                  isAdvancedOpen && "rotate-180",
                )}
              />
            </button>

            {isAdvancedOpen && (
              <div className="space-y-4 pl-1">
                {/* 视频分辨率 - resolution */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-neutral-400">
                    视频分辨率
                  </label>
                  <div className="flex gap-2">
                    {RESOLUTION_OPTIONS.map((item) => {
                      // 1080p 仅支持 6 秒时长
                      const isDisabled =
                        item.value === "1080p" && (duration ?? 6) !== 6;
                      const isActive =
                        (metadata?.resolution ?? "768p") === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() =>
                            !isDisabled &&
                            updateMetadata({ resolution: item.value })
                          }
                          disabled={isDisabled}
                          className={cn(
                            "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 transition-all",
                            isDisabled && "cursor-not-allowed opacity-50",
                            isActive && !isDisabled
                              ? "border-[#B43FEB] bg-[#B43FEB]/10"
                              : "border-neutral-700 bg-neutral-800 hover:border-neutral-500 hover:bg-neutral-750",
                          )}
                        >
                          <span
                            className={cn(
                              "text-xs",
                              isActive && !isDisabled
                                ? "text-[#B43FEB]"
                                : "text-neutral-300",
                            )}
                          >
                            {item.label}
                          </span>
                          <span
                            className={cn(
                              "text-[10px]",
                              isActive && !isDisabled
                                ? "text-[#B43FEB]/70"
                                : "text-neutral-500",
                            )}
                          >
                            {item.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 快速预处理 - fast_pretreatment */}
                <div className="flex items-center justify-between rounded-lg border border-neutral-700/50 bg-neutral-800/30 p-3">
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-medium text-neutral-400">
                      快速预处理
                    </label>
                    <p className="text-[9px] text-neutral-500">
                      缩短提示词优化耗时
                    </p>
                  </div>
                  <Switch
                    checked={metadata?.fast_pretreatment ?? false}
                    onCheckedChange={(checked) =>
                      updateMetadata({ fast_pretreatment: checked })
                    }
                    className="data-[state=checked]:bg-[#B43FEB] scale-90"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
