/**
 * 涓囪薄锛坵an2.7-r2v锛夎棰戝弬鏁伴潰鏉? * 鐙珛鍙傛暟闈㈡澘缁勪欢锛屾敮鎸?resolution銆乺atio銆乨uration銆乸rompt_extend
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
  /** 褰撳墠瑙嗛鏁版嵁 */
  currentVideoData: any;
  /** 鏇存柊鍥炶皟 */
  onPatch: (patch: any) => void;
};

/** 鑾峰彇 resolution 鍊?*/
const getResolution = (currentVideoData: any): string => {
  return currentVideoData?.metadata?.resolution ?? "1080P";
};

/** 鑾峰彇 ratio 鍊?*/
const getRatio = (currentVideoData: any): string => {
  return currentVideoData?.aspect_ratio ?? "16:9";
};

/** 鑾峰彇 duration 鍊?*/
const getDuration = (currentVideoData: any): number => {
  return currentVideoData?.duration ?? 5;
};

/** 鑾峰彇 prompt_extend 鍊?*/
const getPromptExtend = (currentVideoData: any): boolean => {
  return currentVideoData?.metadata?.prompt_extend ?? false;
};

/** 鍒嗚鲸鐜囬€夐」 */
const RESOLUTION_OPTIONS = [
  { label: "720p", value: "720P" },
  { label: "1080p", value: "1080P" },
];

/** 鐢婚潰姣斾緥閫夐」 */
const RATIO_OPTIONS = [
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
  { label: "1:1", value: "1:1" },
];

/** 鏃堕暱閫夐」 */
const DURATION_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * 涓囪薄瑙嗛鍙傛暟闈㈡澘缁勪欢
 */
export const WanxVideoParamsPanel = ({
  currentVideoData,
  onPatch,
}: WanxVideoParamsPanelProps) => {
  const resolution = getResolution(currentVideoData);
  const ratio = getRatio(currentVideoData);
  const duration = getDuration(currentVideoData);
  const promptExtend = getPromptExtend(currentVideoData);

  // 鐢熸垚鎽樿鏂囨湰
  const summary = useMemo(() => {
    const parts: string[] = [];
    parts.push(ratio === "adaptive" ? "Auto" : ratio);
    parts.push(resolution.toLowerCase());
    parts.push(`${duration}s`);
    if (promptExtend) {
      parts.push("鏅鸿兘鏀瑰啓");
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
                ) : text === "鏅鸿兘鏀瑰啓" ? (
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
          {/* 鍒嗚鲸鐜?*/}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">
              鍒嗚鲸鐜?            </label>
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

          {/* 鐢婚潰姣斾緥 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">
              鐢婚潰姣斾緥
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

          {/* 瑙嗛鏃堕暱 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">
              瑙嗛鏃堕暱锛堢锛?            </label>
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

          {/* Prompt 鏅鸿兘鏀瑰啓 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#B43FEB]" />
              <span className="text-xs font-medium text-neutral-300">
                鏅鸿兘鏀瑰啓 prompt
              </span>
            </div>
            <Switch
            checked={promptExtend}
            onCheckedChange={handlePromptExtendChange}
            className="data-[state=checked]:bg-[#B43FEB]"
          />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
