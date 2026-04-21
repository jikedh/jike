/**
 * Doubao Seedance 2.0 视频参数面板
 * 说明：该组件是 Seedance 2.0 独立面板，不与 1.5 Pro 参数面板混用
 */

import { useMemo } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

import { AspectRatioIcon } from "../../ImageNode/components/AspectRatioIcon";
import { cn } from "shared/utils/utils";
import { Volume2, VolumeX } from "lucide-react";

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
  { label: "Auto", value: "adaptive" },
  { label: "16:9", value: "16:9" },
  { label: "4:3", value: "4:3" },
  { label: "1:1", value: "1:1" },
  { label: "3:4", value: "3:4" },
  { label: "9:16", value: "9:16" },
  { label: "21:9", value: "21:9" },
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

  const clampedDuration = clampDuration(currentDuration, currentMode);
  const resolutionLabel = currentResolution.toUpperCase();
  const ratioLabel = currentRatio === "adaptive" ? "Auto" : currentRatio;
  const audioEnabled = generateAudio ?? true;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          unstyled
          className="flex h-8 items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-100"
        >
          <span className="flex items-center gap-1.5">
            {currentRatio === "adaptive" ? null : (
              <AspectRatioIcon ratio={currentRatio} size={14} active={false} />
            )}
            <span className="text-neutral-300">{ratioLabel}</span>
            <span className="text-neutral-500">|</span>
            <span className="text-neutral-300">{resolutionLabel}</span>
            <span className="text-neutral-500">|</span>
            <span className="text-neutral-300">{clampedDuration}s</span>
            <span className="text-neutral-500">|</span>
            {audioEnabled ? (
              <Volume2 className="h-3.5 w-3.5 text-neutral-300" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 text-neutral-400" />
            )}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-[360px] border border-neutral-700 bg-neutral-900 p-4 shadow-xl"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {MODE_OPTIONS.map((item) => {
              const isActive = currentMode === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onModeChange(item.value)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-all",
                    isActive
                      ? "border-[#B43FEB]/70 bg-[#B43FEB]/10 text-[#d97bff]"
                      : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-500 hover:bg-neutral-750",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">比例</label>
            <div className="grid grid-cols-5 gap-2">
              {RATIO_OPTIONS.map((item) => {
                const isActive = currentRatio === item.value;
                const isAdaptive = item.value === "adaptive";
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onAspectRatioChange(item.value)}
                    className={cn(
                      "flex h-14 flex-col items-center justify-center gap-1 rounded-lg border transition-all",
                      isActive
                        ? "border-[#B43FEB]/70 bg-[#B43FEB]/10"
                        : "border-neutral-700 bg-neutral-800 hover:border-neutral-500 hover:bg-neutral-750",
                    )}
                  >
                    {isAdaptive ? null : (
                      <AspectRatioIcon
                        ratio={item.value}
                        size={18}
                        active={isActive}
                      />
                    )}
                    <span
                      className={cn(
                        "text-[10px]",
                        isActive ? "text-[#d97bff]" : "text-neutral-300",
                      )}
                    >
                      {isAdaptive ? "Auto" : item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">清晰度</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "480P", value: "480p" as const, enabled: true },
                { label: "720P", value: "720p" as const, enabled: true },
                { label: "1080P", value: "1080p" as const, enabled: false },
              ].map((item) => {
                const isActive = currentResolution === item.value;
                const isDisabled = !item.enabled;
                return (
                  <button
                    key={item.value}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      if (isDisabled) {
                        return;
                      }
                      onResolutionChange(item.value);
                    }}
                    className={cn(
                      "flex h-9 items-center justify-center rounded-lg border text-xs font-semibold transition-all",
                      isDisabled
                        ? "cursor-not-allowed border-neutral-800 bg-neutral-900/40 text-neutral-600"
                        : isActive
                          ? "border-[#B43FEB]/70 bg-[#B43FEB]/10 text-[#d97bff]"
                          : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-500 hover:bg-neutral-750",
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">
              视频时长
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={durationRange.min}
                max={durationRange.max}
                step={1}
                value={clampedDuration}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isNaN(next)) {
                    onDurationChange(clampDuration(next, currentMode));
                  }
                }}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-neutral-700 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#B43FEB]"
              />
              <span className="min-w-10 text-right text-xs text-neutral-300">
                {clampedDuration}s
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-neutral-300">
                生成音频
              </label>
              <div className="flex items-center gap-1 text-[10px] text-neutral-500">
                {audioEnabled ? (
                  <Volume2 className="h-3.5 w-3.5" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5" />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onGenerateAudioChange(true)}
                className={cn(
                  "flex h-9 items-center justify-center rounded-lg border text-xs font-semibold transition-all",
                  audioEnabled
                    ? "border-[#B43FEB]/70 bg-[#B43FEB]/10 text-[#d97bff]"
                    : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-500 hover:bg-neutral-750",
                )}
              >
                开启
              </button>
              <button
                type="button"
                onClick={() => onGenerateAudioChange(false)}
                className={cn(
                  "flex h-9 items-center justify-center rounded-lg border text-xs font-semibold transition-all",
                  !audioEnabled
                    ? "border-[#B43FEB]/70 bg-[#B43FEB]/10 text-[#d97bff]"
                    : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-500 hover:bg-neutral-750",
                )}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
