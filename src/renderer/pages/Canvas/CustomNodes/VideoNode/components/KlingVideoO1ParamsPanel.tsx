/**
 * Kling Video O1 视频参数面板组件
 * 包含生成模式、视频时长、宽高比、参考视频等参数控制
 */

import { IconChevronDown, IconVideo } from "@tabler/icons-react";
import { useState } from "react";
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

type KlingVideoO1ParamsPanelProps = {
  // 当前生成模式
  mode?: string;
  // 当前视频时长
  duration?: number;
  // 当前画面比例
  aspectRatio?: string;
  // 当前水印设置
  watermark?: boolean;
  // 参考视频列表
  videoList?: {
    video_url?: string;
    refer_type?: string;
    keep_original_sound?: string;
  }[];
  // 更新生成模式
  onModeChange: (value: string) => void;
  // 更新视频时长
  onDurationChange: (value: number) => void;
  // 更新画面比例
  onAspectRatioChange: (value: string) => void;
  // 更新水印开关
  onWatermarkChange?: (value: boolean) => void;
  // 更新参考视频列表
  onVideoListChange?: (
    value: {
      video_url?: string;
      refer_type?: string;
      keep_original_sound?: string;
    }[],
  ) => void;
};

// Kling Video O1 生成模式选项
const MODE_OPTIONS = [
  { label: "标准模式", value: "std", desc: "720P 分辨率" },
  { label: "专业模式", value: "pro", desc: "1080P 分辨率" },
] as const;

// Kling Video O1 时长预设选项
const DURATION_PRESETS = [5, 10] as const;

// Kling Video O1 宽高比选项
const KLING_ASPECT_RATIOS = [
  { label: "16:9", value: "16:9", desc: "横屏" },
  { label: "9:16", value: "9:16", desc: "竖屏" },
  { label: "1:1", value: "1:1", desc: "方形" },
] as const;

// 参考类型选项
const REFER_TYPE_OPTIONS = [
  { label: "待编辑视频", value: "base", desc: "对视频进行编辑处理" },
  { label: "特征参考", value: "feature", desc: "参考视频风格/动作" },
] as const;

export const KlingVideoO1ParamsPanel = ({
  mode,
  duration,
  aspectRatio,
  watermark,
  videoList,
  onModeChange,
  onDurationChange,
  onAspectRatioChange,
  onWatermarkChange,
  onVideoListChange,
}: KlingVideoO1ParamsPanelProps) => {
  // 高级设置折叠状态
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  // 参考视频 URL 输入
  const [videoUrlInput, setVideoUrlInput] = useState("");

  // 获取当前参考视频
  const currentVideo = videoList?.[0] ?? {};

  // 处理添加参考视频
  const handleAddVideo = () => {
    const trimmed = videoUrlInput.trim();
    if (!trimmed) return;

    onVideoListChange?.([
      {
        video_url: trimmed,
        refer_type: currentVideo.refer_type ?? "base",
        keep_original_sound: currentVideo.keep_original_sound ?? "no",
      },
    ]);
    setVideoUrlInput("");
  };

  // 处理移除参考视频
  const handleRemoveVideo = () => {
    onVideoListChange?.([]);
  };

  // 处理参考类型变更
  const handleReferTypeChange = (referType: string) => {
    if (videoList?.[0]?.video_url) {
      onVideoListChange?.([
        {
          ...videoList[0],
          refer_type: referType,
        },
      ]);
    }
  };

  // 处理保留原声变更
  const handleKeepSoundChange = (keep: boolean) => {
    if (videoList?.[0]?.video_url) {
      onVideoListChange?.([
        {
          ...videoList[0],
          keep_original_sound: keep ? "yes" : "no",
        },
      ]);
    }
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
          {/* 生成模式选择 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">
              生成模式
            </label>
            <div className="flex gap-2">
              {MODE_OPTIONS.map((item) => {
                const isActive = (mode ?? "std") === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onModeChange(item.value)}
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-lg border px-4 py-2.5 transition-all",
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

          {/* 视频时长选择 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">
              视频时长（秒）
            </label>
            <div className="flex gap-2">
              {DURATION_PRESETS.map((preset) => {
                const isActive = (duration ?? 5) === preset;
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

          {/* 画面比例选择 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">
              画面比例
            </label>
            <div className="flex gap-2">
              {KLING_ASPECT_RATIOS.map((item) => {
                const isActive = (aspectRatio ?? "16:9") === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onAspectRatioChange(item.value)}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-lg border px-4 py-2 transition-all",
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
                      {item.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 水印设置 */}
          <div className="flex items-center justify-between rounded-lg border border-neutral-700 bg-neutral-800/50 p-3">
            <div className="space-y-0.5">
              <label className="text-xs font-medium text-neutral-300">
                添加水印
              </label>
              <p className="text-[10px] text-neutral-500">
                在生成的视频中添加水印标识
              </p>
            </div>
            <Switch
              checked={watermark ?? true}
              onCheckedChange={(checked) => onWatermarkChange?.(checked)}
              className="data-[state=checked]:bg-[#B43FEB]"
            />
          </div>

          {/* 分隔线 */}
          <div className="border-t border-neutral-700" />

          {/* 高级设置折叠区域 */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="flex w-full items-center justify-between text-xs font-medium text-neutral-400 hover:text-neutral-300"
            >
              <span>参考视频</span>
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
                {/* 参考视频 URL */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-neutral-400 flex items-center gap-1.5">
                    <IconVideo size={12} />
                    参考视频 URL
                    <span className="text-[10px] text-neutral-500 ml-1">
                      最多1段视频
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="输入视频 URL (MP4/MOV)..."
                      value={videoUrlInput}
                      onChange={(e) => setVideoUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddVideo();
                        }
                      }}
                      className="h-8 flex-1 bg-neutral-800 border-neutral-700 text-xs text-neutral-200 placeholder:text-neutral-500"
                    />
                    <Button
                      type="button"
                      variant="blue"
                      size="sm"
                      onClick={handleAddVideo}
                      disabled={
                        !currentVideo.video_url && (videoList?.length ?? 0) >= 1
                      }
                      className="h-8 px-2 text-xs"
                    >
                      添加
                    </Button>
                  </div>
                  {/* 已添加的参考视频 */}
                  {currentVideo.video_url && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 rounded border border-neutral-700 bg-neutral-800/50 px-2 py-1">
                        <span className="flex-1 truncate text-[10px] text-neutral-400">
                          {currentVideo.video_url}
                        </span>
                        <button
                          type="button"
                          onClick={handleRemoveVideo}
                          className="text-neutral-500 hover:text-red-400"
                        >
                          ×
                        </button>
                      </div>

                      {/* 参考类型 */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-medium text-neutral-500">
                          参考类型
                        </label>
                        <div className="flex gap-2">
                          {REFER_TYPE_OPTIONS.map((item) => {
                            const isActive =
                              (currentVideo.refer_type ?? "base") ===
                              item.value;
                            return (
                              <button
                                key={item.value}
                                type="button"
                                onClick={() =>
                                  handleReferTypeChange(item.value)
                                }
                                className={cn(
                                  "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-1.5 transition-all",
                                  isActive
                                    ? "border-[#B43FEB] bg-[#B43FEB]/10"
                                    : "border-neutral-700 bg-neutral-800 hover:border-neutral-500 hover:bg-neutral-750",
                                )}
                              >
                                <span
                                  className={cn(
                                    "text-[10px]",
                                    isActive
                                      ? "text-[#B43FEB]"
                                      : "text-neutral-300",
                                  )}
                                >
                                  {item.label}
                                </span>
                                <span
                                  className={cn(
                                    "text-[9px]",
                                    isActive
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

                      {/* 保留原声 */}
                      <div className="flex items-center justify-between rounded-lg border border-neutral-700/50 bg-neutral-800/30 p-2">
                        <div className="space-y-0.5">
                          <label className="text-[10px] font-medium text-neutral-400">
                            保留原视频声音
                          </label>
                          <p className="text-[9px] text-neutral-500">
                            是否保留参考视频的原始音频
                          </p>
                        </div>
                        <Switch
                          checked={
                            (currentVideo.keep_original_sound ?? "no") === "yes"
                          }
                          onCheckedChange={handleKeepSoundChange}
                          className="data-[state=checked]:bg-[#B43FEB] scale-90"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
