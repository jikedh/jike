/**
 * PixVerse（万象秒创）视频参数面板
 * 支持子模型选择、分辨率、时长、音频等参数配置
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
import { Volume2, VolumeX } from "lucide-react";

type PixVerseParamsPanelProps = {
    /** 当前视频数据 */
    currentVideoData: any;
    /** 更新回调 */
    onPatch: (patch: any) => void;
};

/** 获取当前子模型值 */
const getSubModel = (currentVideoData: any): string => {
    return currentVideoData?.metadata?.subModel ?? "pixverse/pixverse-v6-it2v";
};

/** 获取当前分辨率值 */
const getResolution = (currentVideoData: any): string => {
    return currentVideoData?.metadata?.resolution ?? "720P";
};

/** 获取当前时长值 */
const getDuration = (currentVideoData: any): number => {
    return currentVideoData?.duration ?? 5;
};

/** 获取当前音频状态 */
const getAudio = (currentVideoData: any): boolean => {
    return Boolean(currentVideoData?.metadata?.audio ?? false);
};

/** 子模型选项 */
const SUB_MODEL_OPTIONS = [
    { label: "V6（通用）", value: "pixverse/pixverse-v6-it2v" },
    { label: "C1（特效）", value: "pixverse/pixverse-c1-it2v" },
];

/** 分辨率选项 */
const RESOLUTION_OPTIONS = [
    { label: "360P", value: "360P" },
    { label: "540P", value: "540P" },
    { label: "720P", value: "720P" },
    { label: "1080P", value: "1080P" },
];

/** 时长选项 */
const DURATION_OPTIONS = [
    { label: "4秒", value: 4 },
    { label: "5秒", value: 5 },
    { label: "8秒", value: 8 },
];

/**
 * PixVerse 视频参数面板组件
 */
export const PixVerseParamsPanel = ({
    currentVideoData,
    onPatch,
}: PixVerseParamsPanelProps) => {
    const subModel = getSubModel(currentVideoData);
    const resolution = getResolution(currentVideoData);
    const duration = getDuration(currentVideoData);
    const audio = getAudio(currentVideoData);

    // 生成摘要文本
    const summary = useMemo(() => {
        const parts: string[] = [];
        // 显示子模型简称
        const subModelLabel = subModel.includes("v6") ? "V6" : "C1";
        parts.push(subModelLabel);
        parts.push(resolution);
        parts.push(`${duration}s`);
        if (audio) {
            parts.push("音频");
        }
        return parts;
    }, [subModel, resolution, duration, audio]);

    const handleSubModelChange = (value: string) => {
        onPatch({
            metadata: {
                ...(currentVideoData?.metadata ?? {}),
                subModel: value,
            },
        });
    };

    const handleResolutionChange = (value: string) => {
        onPatch({
            metadata: {
                ...(currentVideoData?.metadata ?? {}),
                resolution: value,
            },
        });
    };

    const handleDurationChange = (value: number) => {
        onPatch({ duration: value });
    };

    const handleAudioChange = (checked: boolean) => {
        onPatch({
            metadata: {
                ...(currentVideoData?.metadata ?? {}),
                audio: checked,
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
                                {text === "音频" ? (
                                    <>
                                        <Volume2 className="h-3.5 w-3.5 text-[#B43FEB]" />
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
                    {/* 子模型选择 */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-neutral-300">
                            子模型
                        </label>
                        <div className="flex gap-2">
                            {SUB_MODEL_OPTIONS.map((option) => {
                                const isActive = subModel === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => handleSubModelChange(option.value)}
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
                        <p className="text-xs text-neutral-500">
                            V6：通用场景推荐 | C1：打斗、法术特效及高速运动
                        </p>
                    </div>

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

                    {/* 视频时长 */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-neutral-300">
                            视频时长
                        </label>
                        <div className="flex gap-2">
                            {DURATION_OPTIONS.map((option) => {
                                const isActive = duration === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => handleDurationChange(option.value)}
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

                    {/* 生成音频 */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {audio ? (
                                <Volume2 className="h-4 w-4 text-[#B43FEB]" />
                            ) : (
                                <VolumeX className="h-4 w-4 text-neutral-400" />
                            )}
                            <span className="text-xs font-medium text-neutral-300">
                                生成音频
                            </span>
                        </div>
                        <Switch
                            checked={audio}
                            onCheckedChange={handleAudioChange}
                        />
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};
