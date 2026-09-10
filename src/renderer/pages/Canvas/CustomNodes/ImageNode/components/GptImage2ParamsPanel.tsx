import { ImageParamsPopover } from "./ImageParamsPopover";
import type { ImageParamOption } from "./ImageParamsPopover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const GPTIMAGE2_SIZES = [
  { label: "1:1", value: "1:1", description: "正方形" },
  { label: "3:2", value: "3:2", description: "横向3:2" },
  { label: "2:3", value: "2:3", description: "竖向2:3" },
  { label: "4:3", value: "4:3", description: "横向4:3" },
  { label: "3:4", value: "3:4", description: "竖向3:4" },
  { label: "16:9", value: "16:9", description: "横向宽屏" },
  { label: "9:16", value: "9:16", description: "竖向长图" },
  { label: "21:9", value: "21:9", description: "超宽屏" },
  { label: "9:21", value: "9:21", description: "超窄屏" },
  { label: "2:1", value: "2:1", description: "横向全景" },
  { label: "1:2", value: "1:2", description: "竖向长图" },
  { label: "5:4", value: "5:4", description: "横向5:4" },
  { label: "4:5", value: "4:5", description: "竖向4:5" },
];

type GptImage2ParamsPanelProps = {
  size: string;
  resolution: string;
  sizeOptions?: ImageParamOption[];
  resolutionOptions?: ImageParamOption[];
  quality?: string;
  qualityOptions?: ImageParamOption[];
  onSizeChange: (value: string) => void;
  onResolutionChange: (value: string) => void;
  onQualityChange?: (value: string) => void;
};

export const GptImage2ParamsPanel = ({
  size,
  resolution,
  sizeOptions = GPTIMAGE2_SIZES,
  resolutionOptions = [
    { label: "1K", value: "1K", description: "标准" },
    { label: "2K", value: "2K", description: "高清" },
    { label: "4K", value: "4K", description: "超清" },
  ],
  quality,
  qualityOptions,
  onSizeChange,
  onResolutionChange,
  onQualityChange,
}: GptImage2ParamsPanelProps) => {
  return (
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
      {quality && qualityOptions?.length && onQualityChange ? (
        <div className="flex items-center justify-between gap-4 border-t border-white/6 pt-4">
          <div className="min-w-0">
            <div className="text-xs font-medium text-white/68">图片质量</div>
            <div className="mt-0.5 text-[10px] leading-4 text-white/36">
              质量越高，生成耗时和资源消耗通常越高。
            </div>
          </div>
          <Select value={quality} onValueChange={onQualityChange}>
            <SelectTrigger className="w-32 shrink-0 border-white/10 bg-white/4 text-xs text-white/72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-10001">
              {qualityOptions.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </ImageParamsPopover>
  );
};
