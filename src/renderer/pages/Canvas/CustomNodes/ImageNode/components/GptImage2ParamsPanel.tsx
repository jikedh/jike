import { ImageParamsPopover } from "./ImageParamsPopover";
import type { ImageParamOption } from "./ImageParamsPopover";

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
  onSizeChange: (value: string) => void;
  onResolutionChange: (value: string) => void;
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
  onSizeChange,
  onResolutionChange,
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
    />
  );
};
