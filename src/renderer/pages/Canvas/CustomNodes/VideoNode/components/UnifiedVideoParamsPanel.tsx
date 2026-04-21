/**
 * 统一视频参数面板
 * 根据模型动态渲染参数控件
 */

import { IconSettings } from "@tabler/icons-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "shared/utils/utils";

import { getModelParamConfig, type ParamItem } from "./modelParamsConfig";

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
}: {
    param: ParamItem;
    value: string | number | boolean;
    onChange: (value: string | number | boolean) => void;
}) => {
    if (!param.options) return null;

    return (
        <div className="flex gap-2">
            {param.options.map((option) => {
                const isActive = value === option.value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onChange(option.value)}
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
}: {
    param: ParamItem;
    value: string | number | boolean;
    onChange: (value: string | number | boolean) => void;
}) => {
    if (param.controlType === "switch") {
        return (
            <SwitchControl param={param} value={value} onChange={onChange} />
        );
    }

    return (
        <ButtonsControl param={param} value={value} onChange={onChange} />
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

    // 如果没有配置，隐藏面板或显示默认
    if (!paramConfig) {
        return null;
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
                    <IconSettings size={14} />
                    <span>整合参数</span>
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
                        return (
                            <div key={param.key} className="space-y-2">
                                <label className="text-xs font-medium text-neutral-300">
                                    {param.label}
                                </label>
                                <ParamControl
                                    param={param}
                                    value={value}
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
