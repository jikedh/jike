import { useCallback } from "react";
import { Slider } from "@/components/ui/slider";

/**
 * 视频时间轴组件
 * 基于 Slider 封装，统一毫秒精度展示与步长吸附逻辑。
 */
export const VideoTimeline = ({
  disabled,
  currentTimeMs,
  durationMs,
  stepMs,
  onSeek,
}: {
  disabled: boolean;
  currentTimeMs: number;
  durationMs: number;
  stepMs: number;
  onSeek: (nextTimeMs: number) => void;
}) => {
  const maxDurationMs = Math.max(0, durationMs);
  const normalizedCurrentMs = clamp(currentTimeMs, 0, maxDurationMs);

  // 拖拽与键盘操作统一通过该入口对齐到步长，保证时间轴行为一致。
  const handleSeek = useCallback(
    (values: number[]) => {
      const [nextValue = 0] = values;
      const snappedValue = snapToStep(nextValue, stepMs, maxDurationMs);
      onSeek(snappedValue);
    },
    [maxDurationMs, onSeek, stepMs],
  );

  return (
    <div className="rounded-lg border border-white/8 bg-[#101013] px-4 py-3">
      <div className="mb-2 flex items-center justify-between text-xs text-white/60">
        <span>时间轴（{stepMs}ms）</span>
        <span>
          {formatTimelineTime(normalizedCurrentMs)} /{" "}
          {formatTimelineTime(maxDurationMs)}
        </span>
      </div>
      <Slider
        value={[normalizedCurrentMs]}
        min={0}
        max={Math.max(stepMs, maxDurationMs)}
        step={stepMs}
        disabled={disabled}
        aria-label="视频时间轴"
        className="**:data-[slot=slider-track]:h-1.5 **:data-[slot=slider-track]:bg-white/10 **:data-[slot=slider-range]:bg-[#B43FEB] **:data-[slot=slider-thumb]:size-4 **:data-[slot=slider-thumb]:border-[#f1d2ff] **:data-[slot=slider-thumb]:bg-[#B43FEB] **:data-[slot=slider-thumb]:ring-[#B43FEB]/55"
        onValueChange={handleSeek}
      />
    </div>
  );
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const snapToStep = (value: number, step: number, max: number) => {
  if (step <= 0) {
    return clamp(Math.round(value), 0, max);
  }

  const aligned = Math.round(value / step) * step;
  return clamp(aligned, 0, max);
};

const formatTimelineTime = (timeMs: number) => {
  const safeTimeMs = Math.max(0, Math.round(timeMs));
  const totalSeconds = Math.floor(safeTimeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = safeTimeMs % 1000;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
};
