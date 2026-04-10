/**
 * Doubao Seedance 2.0 视频参数面板
 * 说明：该组件是 Seedance 2.0 独立面板，不与 1.5 Pro 参数面板混用
 */

import { IconSettings } from "@tabler/icons-react";
import { useMemo } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { AspectRatioIcon } from "../../ImageNode/components/AspectRatioIcon";

type Seedance20ParamsPanelProps = {
  // 生成模式
  mode?: "fast" | "pro";
  // 视频时长（秒）
  duration?: number;
  // 宽高比
  aspectRatio?: string;
  // 分辨率
  resolution?: "480p" | "720p";
  // 是否生成音频
  generateAudio?: boolean;

  // 回调
  onModeChange: (value: "fast" | "pro") => void;
  onDurationChange: (value: number) => void;
  onAspectRatioChange: (value: string) => void;
  onResolutionChange: (value: "480p" | "720p") => void;
  onGenerateAudioChange: (value: boolean) => void;
};

// 生成模式选项
const MODE_OPTIONS = [
  { label: "Fast", value: "fast", desc: "速度优先" },
  { label: "Pro", value: "pro", desc: "质量优先" },
] as const;

// 宽高比选项（2.0 支持 adaptive）
const RATIO_OPTIONS = [
  { label: "16:9", value: "16:9" },
  { label: "4:3", value: "4:3" },
  { label: "1:1", value: "1:1" },
  { label: "3:4", value: "3:4" },
  { label: "9:16", value: "9:16" },
  { label: "21:9", value: "21:9" },
  { label: "自适应", value: "adaptive" },
] as const;

// 分辨率选项
const RESOLUTION_OPTIONS = [
  { label: "720p", value: "720p", desc: "高清（默认）" },
  { label: "480p", value: "480p", desc: "标清" },
] as const;

const clampDuration = (value: number, mode: "fast" | "pro") => {
  const min = 4;
  const max = mode === "pro" ? 15 : 12;
  return Math.min(Math.max(value, min), max);
};

export const Seedance20ParamsPanel = ({
  mode,
  duration,
  aspectRatio,
  resolution,
  generateAudio,
  onModeChange,
  onDurationChange,
  onAspectRatioChange,
  onResolutionChange,
  onGenerateAudioChange,
}: Seedance20ParamsPanelProps) => {
  // 默认值处理
  const currentMode = mode ?? "fast";
  const currentDuration = duration ?? 8;
  const currentResolution = resolution ?? "720p";
  const currentRatio = aspectRatio ?? "16:9";

  // 动态时长范围（跟随 mode）
  const durationRange = useMemo(() => {
    return currentMode === "pro" ? { min: 4, max: 15 } : { min: 4, max: 12 };
  }, [currentMode]);

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
        className="w-115 border border-neutral-700 bg-neutral-900 p-4 shadow-xl"
      >
        <div className="space-y-5">
          {/* 生成模式 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">
              生成模式
            </label>
            <div className="flex gap-2">
              {MODE_OPTIONS.map((item) => {
                const isActive = currentMode === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onModeChange(item.value)}
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-lg border px-4 py-2 transition-all",
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

          {/* 时长 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">
              视频时长（{durationRange.min}-{durationRange.max}秒）
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={durationRange.min}
                max={durationRange.max}
                step={1}
                value={clampDuration(currentDuration, currentMode)}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isNaN(next)) {
                    onDurationChange(clampDuration(next, currentMode));
                  }
                }}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-neutral-700 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#B43FEB]"
              />
              <span className="min-w-13 rounded bg-neutral-800 px-2 py-1 text-center text-xs text-neutral-300">
                {clampDuration(currentDuration, currentMode)}s
              </span>
            </div>
          </div>

          {/* 画面比例 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">
              画面比例
            </label>
            <div className="flex flex-wrap gap-2">
              {RATIO_OPTIONS.map((item) => {
                const isActive = currentRatio === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onAspectRatioChange(item.value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition-all",
                      isActive
                        ? "border-[#B43FEB] bg-[#B43FEB]/10"
                        : "border-neutral-700 bg-neutral-800 hover:border-neutral-500 hover:bg-neutral-750",
                    )}
                  >
                    {item.value === "adaptive" ? null : (
                      <AspectRatioIcon
                        ratio={item.value}
                        size={18}
                        active={isActive}
                      />
                    )}
                    <span
                      className={cn(
                        "text-[10px]",
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
                      "flex flex-col items-start gap-0.5 rounded-lg border px-4 py-2 transition-all",
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

          {/* 生成音频开关 */}
          <div className="flex items-center justify-between rounded-lg border border-neutral-700 bg-neutral-800/50 p-3">
            <div>
              <label className="text-xs font-medium text-neutral-300">
                生成音频
              </label>
              <p className="text-[10px] text-neutral-500">为视频生成同步音轨</p>
            </div>
            <Switch
              checked={generateAudio ?? true}
              onCheckedChange={onGenerateAudioChange}
              className="data-[state=checked]:bg-[#B43FEB]"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
