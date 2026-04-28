/**
 * PixVerse锛堜竾璞＄鍒涳級瑙嗛鍙傛暟闈㈡澘
 * 鏀寔瀛愭ā鍨嬮€夋嫨銆佸垎杈ㄧ巼銆佹椂闀裤€侀煶棰戠瓑鍙傛暟閰嶇疆
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
    /** 褰撳墠瑙嗛鏁版嵁 */
    currentVideoData: any;
    /** 鏇存柊鍥炶皟 */
    onPatch: (patch: any) => void;
};

/** 鑾峰彇褰撳墠瀛愭ā鍨嬪€?*/
const getSubModel = (currentVideoData: any): string => {
    return currentVideoData?.metadata?.subModel ?? "pixverse/pixverse-v6-it2v";
};

/** 鑾峰彇褰撳墠鍒嗚鲸鐜囧€?*/
const getResolution = (currentVideoData: any): string => {
    return currentVideoData?.metadata?.resolution ?? "720P";
};

/** 鑾峰彇褰撳墠鏃堕暱鍊?*/
const getDuration = (currentVideoData: any): number => {
    return currentVideoData?.duration ?? 5;
};

/** 鑾峰彇褰撳墠闊抽鐘舵€?*/
const getAudio = (currentVideoData: any): boolean => {
    return Boolean(currentVideoData?.metadata?.audio ?? true);
};

/** 瀛愭ā鍨嬮€夐」 */
const SUB_MODEL_OPTIONS = [
    { label: "V6（通用）", value: "pixverse/pixverse-v6-it2v" },
    { label: "C1锛堢壒鏁堬級", value: "pixverse/pixverse-c1-it2v" },
];

/** 鍒嗚鲸鐜囬€夐」 */
const RESOLUTION_OPTIONS = [
    { label: "360p", value: "360P" },
    { label: "540p", value: "540P" },
    { label: "720p", value: "720P" },
    { label: "1080p", value: "1080P" },
];

/** 鏃堕暱閫夐」 */
const DURATION_OPTIONS = [
    { label: "4s", value: 4 },
    { label: "5s", value: 5 },
    { label: "8s", value: 8 },
];

/**
 * PixVerse 瑙嗛鍙傛暟闈㈡澘缁勪欢
 */
export const PixVerseParamsPanel = ({
    currentVideoData,
    onPatch,
}: PixVerseParamsPanelProps) => {
    const subModel = getSubModel(currentVideoData);
    const resolution = getResolution(currentVideoData);
    const duration = getDuration(currentVideoData);
    const audio = getAudio(currentVideoData);

    // 鐢熸垚鎽樿鏁版嵁
    const summaryItems = useMemo(() => {
        const parts: Array<{ kind: "text"; value: string } | { kind: "audio"; enabled: boolean }> = [];
        // 显示子模型简称
        const subModelLabel = subModel.includes("v6") ? "V6" : "C1";
        parts.push({ kind: "text", value: subModelLabel });
        parts.push({ kind: "text", value: resolution.toLowerCase() });
        parts.push({ kind: "text", value: `${duration}s` });
        parts.push({ kind: "audio", enabled: audio });
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
                generate_audio: checked, // 缁熶竴浣跨敤 generate_audio
                audio: checked, // 鍏煎鏃ч€昏緫
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
                        {summaryItems.map((item, index) => {
                            const separator = index > 0 && (
                                <span className="text-neutral-500">|</span>
                            );

                            if (item.kind === "audio") {
                                return (
                                    <span key={index} className="flex items-center gap-1.5">
                                        {separator}
                                        {item.enabled ? (
                                            <Volume2 className="h-3.5 w-3.5 text-neutral-300" />
                                        ) : (
                                            <VolumeX className="h-3.5 w-3.5 text-neutral-400" />
                                        )}
                                    </span>
                                );
                            }

                            return (
                                <span key={index} className="flex items-center gap-1.5">
                                    {separator}
                                    <span>{item.value}</span>
                                </span>
                            );
                        })}
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                side="top"
                className="w-80 border border-neutral-700 bg-neutral-900 p-4 shadow-xl"
            >
                <div className="space-y-5">
                    {/* 瀛愭ā鍨嬮€夋嫨 */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-neutral-300">
                            瀛愭ā鍨?                        </label>
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
                            V6锛氶€氱敤鍦烘櫙鎺ㄨ崘 | C1锛氭墦鏂椼€佹硶鏈壒鏁堝強楂橀€熻繍鍔?                        </p>
                    </div>

                    {/* 鍒嗚鲸鐜?*/}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-neutral-300">
                            鍒嗚鲸鐜?                        </label>
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

                    {/* 瑙嗛鏃堕暱 */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-neutral-300">
                            瑙嗛鏃堕暱
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

                    {/* 鐢熸垚闊抽 */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-300">
                            鐢熸垚闊抽
                        </span>
                        <Switch
                            checked={audio}
                            onCheckedChange={handleAudioChange}
                            className="data-[state=checked]:bg-[#B43FEB]"
                        />
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};
