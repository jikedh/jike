/**
 * 统一视频参数面板
 * 根据模型动态渲染参数控件
 */

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "shared/utils/utils";
import { Volume2, VolumeX } from "lucide-react";

import { getModelParamConfig, type ParamItem } from "./modelParamsConfig";
import { AspectRatioIcon } from "../../ImageNode/components/AspectRatioIcon";
import { WanxVideoParamsPanel } from "./WanxVideoParamsPanel";
import { PixVerseParamsPanel } from "./PixVerseParamsPanel";

type UnifiedVideoParamsPanelProps = {
    /** 当前视频数据 */
    currentVideoData: any;
    /** 当前模型 */
    model: string;
    /** 更新回调 */
    onPatch: (patch: any) => void;
};

/**
 * 根据参数项获取当前值
 */
const getParamValue = (param: ParamItem, currentVideoData: any): string | number | boolean => {
    // duration 直接在顶层
    if (param.key === "duration") {
        return currentVideoData?.duration ?? param.defaultValue;
    }
    // resolution 和 mode 在 metadata 中
    if (param.key === "resolution" || param.key === "mode") {
        return currentVideoData?.metadata?.[param.key] ?? param.defaultValue;
    }
    // generate_audio 在 metadata 中
    if (param.key === "generate_audio") {
        return currentVideoData?.metadata?.[param.key] ?? param.defaultValue;
    }
    // aspect_ratio 在顶层
    if (param.key === "aspect_ratio") {
        return currentVideoData?.aspect_ratio ?? param.defaultValue;
    }
    // 默认从 metadata 获取
    return currentVideoData?.metadata?.[param.key] ?? param.defaultValue;
};

/**
 * 构建 Patch 对象
 */
const buildPatch = (
    param: ParamItem,
    value: string | number | boolean,
    currentVideoData: any,
): any => {
    // duration 直接在顶层
    if (param.key === "duration") {
        return { duration: value };
    }
    // aspect_ratio 直接在顶层
    if (param.key === "aspect_ratio") {
        return { aspect_ratio: value };
    }
    // 其他参数在 metadata 中
    return {
        metadata: {
            ...(currentVideoData?.metadata ?? {}),
            [param.key]: value,
        },
    };
};

/**
 * 渲染 buttons 类型控件
 */
const ButtonsControl = ({
    param,
    value,
    onChange,
    twoRows,
}: {
    param: ParamItem;
    value: string | number | boolean;
    onChange: (value: string | number | boolean) => void;
    twoRows?: boolean;
}) => {
    if (!param.options) return null;

    return (
        <div className="w-full">
            <div className={cn(twoRows ? "grid grid-cols-4 gap-2" : "flex w-full gap-2")}>
                {param.options.map((option) => {
                    const isActive = value === option.value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => onChange(option.value)}
                            className={cn(
                                "flex flex-col items-center gap-0.5 rounded-lg border px-3 py-2 transition-all",
                                twoRows ? "w-full" : "flex-1",
                                isActive
                                    ? "border-[#B43FEB] bg-[#B43FEB]/10"
                                    : "border-neutral-700 bg-neutral-800 hover:border-neutral-500 hover:bg-neutral-750",
                            )}
                        >
                            <span
                                className={cn(
                                    "text-xs font-medium whitespace-nowrap",
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
    );
};

/**
 * 渲染 switch 类型控件
 */
const SwitchControl = ({
    param,
    value,
    onChange,
}: {
    param: ParamItem;
    value: string | number | boolean;
    onChange: (value: string | number | boolean) => void;
}) => {
    return (
        <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-300">{param.label}</span>
            <Switch
                checked={Boolean(value)}
                onCheckedChange={(checked) => onChange(checked)}
                className="data-[state=checked]:bg-[#B43FEB]"
            />
        </div>
    );
};

/**
 * 渲染 slider 类型控件
 */
const SliderControl = ({
    param,
    value,
    onChange,
}: {
    param: ParamItem;
    value: string | number | boolean;
    onChange: (value: string | number | boolean) => void;
}) => {
    const min = param.range?.min ?? 0;
    const max = param.range?.max ?? 100;
    const numValue = Number(value);

    return (
        <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-500">{min}s</span>
                <span className="text-xs font-bold text-[#B43FEB]">{numValue}s</span>
                <span className="text-[10px] text-neutral-500">{max}s</span>
            </div>
            <Slider
                value={[numValue]}
                min={min}
                max={max}
                step={1}
                onValueChange={(vals) => onChange(vals[0])}
                className="[&_[data-slot=slider-range]]:bg-[#B43FEB] [&_[data-slot=slider-thumb]]:border-[#B43FEB]"
            />
        </div>
    );
};

/**
 * 渲染单个参数控件
 */
const ParamControl = ({
    param,
    value,
    onChange,
    twoRowButtons,
}: {
    param: ParamItem;
    value: string | number | boolean;
    onChange: (value: string | number | boolean) => void;
    twoRowButtons?: boolean;
}) => {
    if (param.controlType === "switch") {
        return (
            <SwitchControl param={param} value={value} onChange={onChange} />
        );
    }

    if (param.controlType === "slider") {
        return (
            <SliderControl param={param} value={value} onChange={onChange} />
        );
    }

    return (
        <ButtonsControl
            param={param}
            value={value}
            onChange={onChange}
            twoRows={twoRowButtons}
        />
    );
};

/**
 * 统一视频参数面板组件
 */
export const UnifiedVideoParamsPanel = ({
    currentVideoData,
    model,
    onPatch,
}: UnifiedVideoParamsPanelProps) => {
    // 获取模型参数配置
    const paramConfig = useMemo(() => {
        return getModelParamConfig(model);
    }, [model]);

    const summary = useMemo(() => {
        if (!paramConfig) {
            return [];
        }

        const keySet = new Set(paramConfig.params.map((item) => item.key));
        const parts: Array<
            | { kind: "ratio"; value: string }
            | { kind: "resolution"; value: string }
            | { kind: "duration"; value: string }
            | { kind: "audio"; enabled: boolean }
        > = [];

        if (keySet.has("aspect_ratio")) {
            const raw = String(getParamValue({ key: "aspect_ratio", label: "", controlType: "buttons", defaultValue: "16:9" } as any, currentVideoData));
            const ratio = raw === "adaptive" ? "Auto" : raw;
            parts.push({ kind: "ratio", value: ratio });
        }

        if (keySet.has("resolution")) {
            const raw = String(getParamValue({ key: "resolution", label: "", controlType: "buttons", defaultValue: "" } as any, currentVideoData));
            const normalized = raw ? raw.toUpperCase() : "";
            if (normalized) {
                parts.push({ kind: "resolution", value: normalized });
            }
        }

        if (keySet.has("duration")) {
            const raw = getParamValue({ key: "duration", label: "", controlType: "buttons", defaultValue: 0 } as any, currentVideoData);
            const numberValue = Number(raw);
            if (Number.isFinite(numberValue) && numberValue > 0) {
                parts.push({ kind: "duration", value: `${Math.round(numberValue)}s` });
            }
        }

        if (keySet.has("generate_audio")) {
            const raw = getParamValue({ key: "generate_audio", label: "", controlType: "switch", defaultValue: true } as any, currentVideoData);
            parts.push({ kind: "audio", enabled: Boolean(raw) });
        }

        return parts;
    }, [currentVideoData, paramConfig]);

    // 如果没有配置，隐藏面板或显示默认
    if (!paramConfig) {
        return null;
    }

    // 万象模型使用独立的参数面板
    if (model === "wan2.7-r2v") {
        return <WanxVideoParamsPanel currentVideoData={currentVideoData} onPatch={onPatch} />;
    }

    // PixVerse 模型使用独立的参数面板
    if (model === "pixverse-i2v") {
        return <PixVerseParamsPanel currentVideoData={currentVideoData} onPatch={onPatch} />;
    }

    const handleParamChange = (param: ParamItem, value: string | number | boolean) => {
        const patch = buildPatch(param, value, currentVideoData);
        onPatch(patch);
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    unstyled
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-100"
                >
                    {summary.length === 0 ? (
                        <span>整合参数</span>
                    ) : (
                        <span className="flex items-center gap-1.5">
                            {summary.map((item, index) => {
                                const separator =
                                    index === 0 ? null : (
                                        <span
                                            key={`sep_${index}`}
                                            className="text-neutral-500"
                                        >
                                            |
                                        </span>
                                    );

                                if (item.kind === "ratio") {
                                    const isAuto = item.value === "Auto";
                                    return (
                                        <span
                                            key={`part_${index}`}
                                            className="flex items-center gap-1.5"
                                        >
                                            {separator}
                                            {isAuto ? null : (
                                                <AspectRatioIcon
                                                    ratio={item.value}
                                                    size={14}
                                                    active={false}
                                                />
                                            )}
                                            <span className="text-neutral-300">
                                                {item.value}
                                            </span>
                                        </span>
                                    );
                                }

                                if (item.kind === "audio") {
                                    return (
                                        <span
                                            key={`part_${index}`}
                                            className="flex items-center gap-1.5"
                                        >
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
                                    <span
                                        key={`part_${index}`}
                                        className="flex items-center gap-1.5"
                                    >
                                        {separator}
                                        <span className="text-neutral-300">
                                            {item.value}
                                        </span>
                                    </span>
                                );
                            })}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                side="top"
                className="w-80 border border-neutral-700 bg-neutral-900 p-4 shadow-xl"
            >
                <div className="space-y-5">
                    {paramConfig.params.map((param) => {
                        const value = getParamValue(param, currentVideoData);
                        const isSwitch = param.controlType === "switch";
                        const enableTwoRowAspectRatio =
                            (model === "doubao-seedance-2.0-fast" || model === "doubao-seedance-2.0-pro") &&
                            param.key === "aspect_ratio";

                        return (
                            <div key={param.key} className={isSwitch ? undefined : "space-y-2"}>
                                {isSwitch ? null : (
                                    <label className="text-xs font-medium text-neutral-300">
                                        {param.label}
                                    </label>
                                )}
                                <ParamControl
                                    param={param}
                                    value={value}
                                    twoRowButtons={enableTwoRowAspectRatio}
                                    onChange={(newValue) => handleParamChange(param, newValue)}
                                />
                            </div>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
};
