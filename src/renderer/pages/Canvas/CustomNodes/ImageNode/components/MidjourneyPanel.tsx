import { Slider } from "@/components/ui/slider";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ImageParamsPopover } from "./ImageParamsPopover";
import type { ImageParamOption } from "./ImageParamsPopover";

export type MidjourneyQuality = "1" | "4";

type MidjourneyPanelProps = {
    size: string;
    resolution: string;
    quality: MidjourneyQuality;
    raw: boolean;
    chaos: number;
    stylize: number;
    imageWeight: number;
    sizeOptions: ImageParamOption[];
    resolutionOptions: ImageParamOption[];
    onSizeChange: (value: string) => void;
    onResolutionChange: (value: string) => void;
    onQualityChange: (value: MidjourneyQuality) => void;
    onRawChange: (value: boolean) => void;
    onChaosChange: (value: number) => void;
    onStylizeChange: (value: number) => void;
    onImageWeightChange: (value: number) => void;
};

type NumericParameterProps = {
    label: string;
    description: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
};

const NumericParameter = ({
    label,
    description,
    value,
    min,
    max,
    step,
    onChange,
}: NumericParameterProps) => (
    <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <div className="text-xs font-medium text-white/68">{label}</div>
                <div className="mt-0.5 text-[10px] leading-4 text-white/36">
                    {description}
                </div>
            </div>
            <span className="shrink-0 rounded-md bg-white/6 px-2 py-0.5 text-xs font-medium tabular-nums text-white/72">
                {value}
            </span>
        </div>
        <Slider
            value={[value]}
            min={min}
            max={max}
            step={step}
            onValueChange={(values) => onChange(values[0] ?? min)}
            aria-label={label}
        />
        <div className="flex justify-between text-[10px] tabular-nums text-white/28">
            <span>{min}</span>
            <span>{max}</span>
        </div>
    </div>
);

export const MidjourneyPanel = ({
    size,
    resolution,
    quality,
    raw,
    chaos,
    stylize,
    imageWeight,
    sizeOptions,
    resolutionOptions,
    onSizeChange,
    onResolutionChange,
    onQualityChange,
    onRawChange,
    onChaosChange,
    onStylizeChange,
    onImageWeightChange,
}: MidjourneyPanelProps) => (
    <ImageParamsPopover
        size={size}
        resolution={resolution}
        sizeOptions={sizeOptions}
        resolutionOptions={resolutionOptions}
        sizeLabel="图片比例"
        resolutionLabel="分辨率"
        onSizeChange={onSizeChange}
        onResolutionChange={onResolutionChange}
    >
        <div className="flex flex-col gap-4 border-t border-white/6 pt-4">
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <div className="text-xs font-medium text-white/68">图像模式</div>
                    <div className="mt-0.5 text-[10px] leading-4 text-white/36">
                        高质量模式会使用更多生成资源。
                    </div>
                </div>
                <Select
                    value={quality}
                    onValueChange={(value) =>
                        onQualityChange(value as MidjourneyQuality)
                    }
                >
                    <SelectTrigger className="w-32 shrink-0 border-white/10 bg-white/4 text-xs text-white/72">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectItem value="1">标准质量</SelectItem>
                            <SelectItem value="4">高质量模式</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <div className="text-xs font-medium text-white/68">创意处理（Raw）</div>
                    <div className="mt-0.5 text-[10px] leading-4 text-white/36">
                        开启后减少自动风格修饰，增强提示词控制。
                    </div>
                </div>
                <Switch
                    checked={raw}
                    onCheckedChange={onRawChange}
                />
            </div>
            <NumericParameter
                label="混沌程度（Chaos）"
                description="提高结果之间的随机性和差异。"
                value={chaos}
                min={0}
                max={100}
                step={1}
                onChange={onChaosChange}
            />
            <NumericParameter
                label="风格化强度（Stylize）"
                description="提高模型艺术风格对画面的影响。"
                value={stylize}
                min={0}
                max={1000}
                step={1}
                onChange={onStylizeChange}
            />
            <NumericParameter
                label="垫图权重（IW）"
                description="图像权重,控制图像提示的影响程度。"
                value={imageWeight}
                min={0}
                max={3}
                step={1}
                onChange={onImageWeightChange}
            />
        </div>
    </ImageParamsPopover>
);
