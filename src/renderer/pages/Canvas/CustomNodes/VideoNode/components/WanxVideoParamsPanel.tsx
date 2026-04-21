/**
 * 万象（wan2.7-r2v）视频参数面板
 * 独立参数面板组件，支持 resolution、ratio、duration、prompt_extend
 */

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "shared/utils/utils";
import { Sparkles } from "lucide-react";

import { AspectRatioIcon } from "../../ImageNode/components/AspectRatioIcon";

type WanxVideoParamsPanelProps = {
  /** 当前视频数据 */
  currentVideoData: any;
  /** 更新回调 */
  onPatch: (patch: any) => void;
};

/** 获取 resolution 值 */
const getResolution = (currentVideoData: any): string => {
  return currentVideoData?.metadata?.resolution ?? "1080P";
};

/** 获取 ratio 值 */
const getRatio = (currentVideoData: any): string => {
  return currentVideoData?.aspect_ratio ?? "16:9";
};

/** 获取 duration 值 */
const getDuration = (currentVideoData: any): number => {
  return currentVideoData?.duration ?? 5;
};

/** 获取 prompt_extend 值 */
const getPromptExtend = (currentVideoData: any): boolean => {
  return currentVideoData?.metadata?.prompt_extend ?? false;
};

/** 分辨率选项 */
const RESOLUTION_OPTIONS = [
  { label: "720P", value: "720P" },
  { label: "1080P", value: "1080P" },
];

/** 画面比例选项 */
const RATIO_OPTIONS = [
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
  { label: "1:1", value: "1:1" },
];

/** 时长选项 */
const DURATION_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * 万象视频参数面板组件
 */
export const WanxVideoParamsPanel = ({
  currentVideoData,
  onPatch,
}: WanxVideoParamsPanelProps) => {
  const resolution = getResolution(currentVideoData);
  const ratio = getRatio(currentVideoData);
  const duration = getDuration(currentVideoData);
  const promptExtend = getPromptExtend(currentVideoData);

  // 生成摘要文本
  const summary = useMemo(() => {
    const parts: string[] = [];
    parts.push(ratio === "adaptive" ? "Auto" : ratio);
    parts.push(resolution);
    parts.push(`${duration}s`);
    if (promptExtend) {
      parts.push("智能改写");
    }
    return parts;
  }, [ratio, resolution, duration, promptExtend]);

  const handleResolutionChange = (value: string) => {
    onPatch({
      metadata: {
        ...(currentVideoData?.metadata ?? {}),
        resolution: value,
      },
    });
  };

  const handleRatioChange = (value: string) => {
    onPatch({ aspect_ratio: value });
  };

  const handleDurationChange = (value: number) => {
    onPatch({ duration: value });
  };

  const handlePromptExtendChange = (checked: boolean) => {
    onPatch({
      metadata: {
        ...(currentVideoData?.metadata ?? {}),
        prompt_extend: checked,
      },
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          unstyled
          className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-100"
        >
          <span className="flex items-center gap-1.5">
            {summary.map((text, index) => (
              <span key={index} className="flex items-center gap-1.5">
                {index > 0 && (
                  <span className="text-neutral-500">|</span>
                )}
                {text === "16:9" || text === "9:16" || text === "1:1" ? (
                  <>
                    <AspectRatioIcon ratio={text} size={14} active={false} />
                    <span>{text}</span>
                  </>
                ) : text === "智能改写" ? (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-[#B43FEB]" />
                    <span className="text-[#B43FEB]">{text}</span>
                  </>
                ) : (
                  <span>{text}</span>
                )}
              </span>
            ))}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-80 border border-neutral-700 bg-neutral-900 p-4 shadow-xl"
      >
        <div className="space-y-5">
          {/* 分辨率 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">
              分辨率
            </label>
            <div className="flex gap-2">
              {RESOLUTION_OPTIONS.map((option) => {
                const isActive = resolution === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleResolutionChange(option.value)}
                    className={cn(
                      "flex flex-1 flex-col items-center gap-0.5 rounded-lg border px-3 py-2 transition-all",
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
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 画面比例 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">
              画面比例
            </label>
            <div className="flex gap-2">
              {RATIO_OPTIONS.map((option) => {
                const isActive = ratio === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleRatioChange(option.value)}
                    className={cn(
                      "flex flex-1 flex-col items-center gap-0.5 rounded-lg border px-3 py-2 transition-all",
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
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 视频时长 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">
              视频时长（秒）
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_OPTIONS.map((value) => {
                const isActive = duration === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleDurationChange(value)}
                    className={cn(
                      "flex h-8 min-w-[3rem] items-center justify-center rounded-lg border px-2 text-xs font-medium transition-all",
                      isActive
                        ? "border-[#B43FEB] bg-[#B43FEB]/10 text-[#B43FEB]"
                        : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-500 hover:bg-neutral-750",
                    )}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prompt 智能改写 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#B43FEB]" />
              <span className="text-xs font-medium text-neutral-300">
                智能改写 prompt
              </span>
            </div>
            <Switch
              checked={promptExtend}
              onCheckedChange={handlePromptExtendChange}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
