"use client";

import * as React from "react";

import { cn } from "shared/utils/utils";

export interface VideoSliderProps {
  /** 当前时间（秒） */
  value: number;
  /** 视频总时长（秒） */
  max: number;
  /** 步进值（秒），默认约 0.033 秒（30 FPS） */
  step?: number;
  /** 是否禁用 */
  disabled?: boolean;
  /** 值变化回调 */
  onChange?: (value: number) => void;
  /** 当前时间格式化显示 */
  formatTime?: (time: number) => string;
  /** 额外的 className */
  className?: string;
}

/**
 * 格式化时间为 MM:SS.CC 格式
 */
const defaultFormatTime = (timeInSeconds: number): string => {
  if (!Number.isFinite(timeInSeconds) || timeInSeconds < 0) {
    return "00:00.00";
  }

  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  const centiseconds = Math.floor((timeInSeconds % 1) * 100);

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
};

/**
 * 视频时间轴滑块组件
 * 支持逐帧精确定位，用于视频截帧等场景
 */
export const VideoSlider = React.forwardRef<HTMLInputElement, VideoSliderProps>(
  (
    {
      value,
      max,
      step = 1 / 30,
      disabled = false,
      onChange,
      formatTime = defaultFormatTime,
      className,
    },
    ref,
  ) => {
    const clampedValue = Math.min(value, max || 0);
    const formattedCurrentTime = formatTime(clampedValue);
    const formattedDuration = formatTime(max || 0);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(Number(e.target.value));
    };

    return (
      <div className={cn("flex items-center gap-4", className)}>
        {/* 当前时间显示 */}
        <div className="min-w-20 rounded-md bg-[#27272a] px-3 py-1.5 text-center text-xs font-mono text-white/90">
          {formattedCurrentTime}
        </div>

        {/* 滑块 */}
        <input
          ref={ref}
          type="range"
          min={0}
          max={max || 0}
          step={Math.min(step, 0.05)}
          value={clampedValue}
          onChange={handleChange}
          disabled={disabled}
          className={cn(
            "h-1 flex-1 cursor-pointer appearance-none rounded-full",
            "bg-white/10",
            // 轨道
            "[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-white/10",
            // 进度条（已填充部分）
            "[&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-white/10",
            // 滑块手柄
            "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-[#B43FEB] [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(180,63,235,0.5)] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125",
            "[&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#B43FEB] [&::-moz-range-thumb]:shadow-[0_0_10px_rgba(180,63,235,0.5)] [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:hover:scale-125",
            // 禁用状态
            "disabled:cursor-not-allowed disabled:opacity-50",
            "disabled:[&::-webkit-slider-thumb]:cursor-not-allowed disabled:[&::-moz-range-thumb]:cursor-not-allowed",
            // 焦点状态
            "focus-visible:outline-none focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-[#B43FEB] focus-visible:[&::-webkit-slider-thumb]:ring-offset-2 focus-visible:[&::-webkit-slider-thumb]:ring-offset-background",
          )}
        />

        {/* 总时长显示 */}
        <div className="min-w-20 rounded-md bg-[#27272a] px-3 py-1.5 text-center text-xs font-mono text-white/90">
          {formattedDuration}
        </div>
      </div>
    );
  },
);

VideoSlider.displayName = "VideoSlider";

export { defaultFormatTime };
