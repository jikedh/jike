/**
 * Doubao Seedance 1.5 Pro 视频参数面板组件
 * 包含画面比例、视频尺寸、视频时长、分辨率、种子、音频、摄像头固定等参数控制
 */

import {
  IconArrowsShuffle,
  IconSettings,
  IconVideo,
  IconVolume3,
} from "@tabler/icons-react";
import { useState } from "react";

import {
  VIDEO_ASPECT_RATIOS,
  VIDEO_DURATION_CONFIG,
  VIDEO_RESOLUTIONS_15PRO,
} from "shared/constants/ai-models";
import { cn } from "shared/utils/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { AspectRatioIcon } from "../../ImageNode/components/AspectRatioIcon";

type Seedance15ProParamsPanelProps = {
  // 当前画面比例
  aspectRatio: string;
  // 当前视频尺寸
  videoSize: string;
  // 当前视频时长
  duration: number;
  // 当前分辨率
  resolution?: string;
  // 当前随机种子
  seed?: number;
  // 是否生成音频
  audio?: boolean;
  // 是否固定摄像头
  camerafixed?: boolean;
  // 更新画面比例
  onAspectRatioChange: (value: string) => void;
  // 更新视频尺寸
  onVideoSizeChange: (value: string) => void;
  // 更新视频时长
  onDurationChange: (value: number) => void;
  // 更新分辨率
  onResolutionChange?: (value: string) => void;
  // 更新随机种子
  onSeedChange?: (value: number) => void;
  // 更新音频开关
  onAudioChange?: (value: boolean) => void;
  // 更新摄像头固定开关
  onCameraFixedChange?: (value: boolean) => void;
};

// 视频尺寸选项
const VIDEO_SIZE_OPTIONS = [
  { label: "1280×720", value: "1280x720", desc: "横版720p" },
  { label: "720×1280", value: "720x1280", desc: "竖版720p" },
  { label: "1024×1024", value: "1024x1024", desc: "方形" },
] as const;

// 时长预设选项（豆包 1.5 Pro: 4-12秒）
const DURATION_PRESETS = [4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export const Seedance15ProParamsPanel = ({
  aspectRatio,
  videoSize,
  duration,
  resolution,
  seed,
  audio,
  camerafixed,
  onAspectRatioChange,
  onVideoSizeChange,
  onDurationChange,
  onResolutionChange,
  onSeedChange,
  onAudioChange,
  onCameraFixedChange,
}: Seedance15ProParamsPanelProps) => {
  // 种子输入文本（用于处理空值和 -1 的显示）
  const [seedInputValue, setSeedInputValue] = useState(
    seed === undefined || seed === -1 ? "" : String(seed),
  );

  // 处理种子输入变化
  const handleSeedInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSeedInputValue(value);

    if (value === "") {
      onSeedChange?.(-1);
      return;
    }

    const num = Number(value);
    if (!Number.isNaN(num)) {
      // 种子值范围：-1 ~ 2^32-1
      const clampedValue = Math.max(-1, Math.min(num, Math.pow(2, 32) - 1));
      onSeedChange?.(clampedValue);
    }
  };

  // 随机生成种子
  const handleRandomSeed = () => {
    const randomSeed = Math.floor(Math.random() * Math.pow(2, 32));
    setSeedInputValue(String(randomSeed));
    onSeedChange?.(randomSeed);
  };

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
        className="w-96 border border-neutral-700 bg-neutral-900 p-4 shadow-xl"
      >
        <div className="space-y-5">
          {/* 画面比例选择 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">
              画面比例
            </label>
            <div className="flex flex-wrap gap-2">
              {VIDEO_ASPECT_RATIOS.map((item) => {
                const isActive = aspectRatio === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onAspectRatioChange(item.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border p-2 transition-all",
                      isActive
                        ? "border-[#B43FEB] bg-[#B43FEB]/10"
                        : "border-neutral-700 bg-neutral-800 hover:border-neutral-500 hover:bg-neutral-750",
                    )}
                  >
                    <AspectRatioIcon
                      ratio={item.value}
                      size={28}
                      active={isActive}
                    />
                    <span
                      className={cn(
                        "text-[10px]",
                        isActive ? "text-[#B43FEB]" : "text-neutral-400",
                      )}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 视频尺寸选择 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">
              视频尺寸
            </label>
            <div className="flex gap-2">
              {VIDEO_SIZE_OPTIONS.map((item) => {
                const isActive = videoSize === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onVideoSizeChange(item.value)}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-lg border px-3 py-2 transition-all",
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

          {/* 视频时长选择 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">
              视频时长（秒）
            </label>
            <div className="space-y-2">
              {/* 时长预设按钮 */}
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map((preset) => {
                  const isActive = duration === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onDurationChange(preset)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-xs transition-all",
                        isActive
                          ? "border-[#B43FEB] bg-[#B43FEB]/10 text-[#B43FEB]"
                          : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-500 hover:text-neutral-100",
                      )}
                    >
                      {preset}s
                    </button>
                  );
                })}
              </div>
              {/* 时长滑块 */}
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={VIDEO_DURATION_CONFIG.min}
                  max={VIDEO_DURATION_CONFIG.max}
                  step={VIDEO_DURATION_CONFIG.step}
                  value={duration}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (!Number.isNaN(next)) {
                      onDurationChange(next);
                    }
                  }}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-neutral-700 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#B43FEB] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
                />
                <span className="min-w-[40px] rounded bg-neutral-800 px-2 py-1 text-center text-xs text-neutral-300">
                  {duration}s
                </span>
              </div>
            </div>
          </div>

          {/* 分隔线 */}
          <div className="border-t border-neutral-700" />

          {/* 1.5 Pro 专属功能区 */}
          <div className="space-y-4">
            {/* 分辨率选择 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                <IconVideo size={12} />
                视频分辨率
              </label>
              <div className="flex gap-2">
                {VIDEO_RESOLUTIONS_15PRO.map((item) => {
                  const isActive = resolution === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => onResolutionChange?.(item.value)}
                      className={cn(
                        "flex flex-col items-center gap-0.5 rounded-lg border px-3 py-2 transition-all",
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
                        {item.value}
                      </span>
                      <span
                        className={cn(
                          "text-[10px]",
                          isActive ? "text-[#B43FEB]/70" : "text-neutral-500",
                        )}
                      >
                        {item.label.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 随机种子 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                <IconArrowsShuffle size={12} />
                随机种子
                <span className="text-[10px] text-neutral-500 ml-1">
                  -1 = 随机
                </span>
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="留空 = 随机"
                  value={seedInputValue}
                  onChange={handleSeedInputChange}
                  className="h-8 flex-1 bg-neutral-800 border-neutral-700 text-xs text-neutral-200 placeholder:text-neutral-500"
                />
                <Button
                  type="button"
                  variant="blue"
                  size="sm"
                  onClick={handleRandomSeed}
                  className="h-8 px-2 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
                >
                  随机
                </Button>
              </div>
            </div>

            {/* 生成音频 */}
            <div className="flex items-center justify-between rounded-lg border border-neutral-700 bg-neutral-800/50 p-3">
              <div className="space-y-0.5">
                <label className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                  <IconVolume3 size={12} />
                  生成音频
                </label>
                <p className="text-[10px] text-neutral-500">
                  为视频生成配套音频轨道
                </p>
              </div>
              <Switch
                checked={audio ?? false}
                onCheckedChange={(checked) => onAudioChange?.(checked)}
                className="data-[state=checked]:bg-[#B43FEB]"
              />
            </div>

            {/* 固定摄像头 */}
            <div className="flex items-center justify-between rounded-lg border border-neutral-700 bg-neutral-800/50 p-3">
              <div className="space-y-0.5">
                <label className="text-xs font-medium text-neutral-300">
                  固定摄像头
                </label>
                <p className="text-[10px] text-neutral-500">
                  保持摄像头位置固定，不进行动态调整
                </p>
              </div>
              <Switch
                checked={camerafixed ?? false}
                onCheckedChange={(checked) => onCameraFixedChange?.(checked)}
                className="data-[state=checked]:bg-[#B43FEB]"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
