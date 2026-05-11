/**
 * Gemini 3 Pro 整合参数面板组件
 * 包含图像尺寸、分辨率的可视化选择
 * 适用于 gemini-3-pro-image-preview 模型
 */

import { ImageParamsPopover } from "./ImageParamsPopover";
import type { ImageParamOption } from "./ImageParamsPopover";

// Gemini 3 Pro 图像尺寸选项（与类型定义保持一致）
export const GEMINI_SIZES = [
  { label: "1:1", value: "1:1", description: "正方形" },
  { label: "2:3", value: "2:3", description: "竖向2:3" },
  { label: "3:2", value: "3:2", description: "横向3:2" },
  { label: "3:4", value: "3:4", description: "竖向3:4" },
  { label: "4:3", value: "4:3", description: "横向4:3" },
  { label: "4:5", value: "4:5", description: "竖向4:5" },
  { label: "5:4", value: "5:4", description: "横向5:4" },
  { label: "9:16", value: "9:16", description: "竖向长图" },
  { label: "16:9", value: "16:9", description: "横向宽屏" },
  { label: "21:9", value: "21:9", description: "超宽屏" },
];

export const NANO_BANANA_LOCAL_SIZES = GEMINI_SIZES.filter((item) =>
  ["1:1", "16:9", "9:16", "4:3", "3:4"].includes(item.value),
);

export const GROK_IMAGE_SIZES = [
  { label: "1:1", value: "1:1", description: "1024×1024" },
  { label: "16:9", value: "16:9", description: "1280×720" },
  { label: "9:16", value: "9:16", description: "720×1280" },
  { label: "3:2", value: "3:2", description: "1792×1024" },
  { label: "2:3", value: "2:3", description: "1024×1792" },
];

// Gemini 3 Pro 分辨率选项
export const GEMINI_RESOLUTIONS = [
  { label: "1K", value: "1K", description: "默认分辨率" },
  { label: "2K", value: "2K", description: "标准分辨率" },
  { label: "3K", value: "3K", description: "高清分辨率" },
];

export const NANO_BANANA_RESOLUTIONS = [
  { label: "1K", value: "1K", description: "默认分辨率" },
  { label: "2K", value: "2K", description: "标准分辨率" },
  { label: "4K", value: "4K", description: "高清分辨率" },
];

export const GROK_IMAGE_RESOLUTIONS = [
  { label: "标准", value: "standard", description: "Grok 原生尺寸" },
];

type GeminiParamsPanelProps = {
  // 当前图像尺寸
  size: string;
  // 当前分辨率
  resolution: string;
  // 可选尺寸列表
  sizeOptions?: ImageParamOption[];
  resolutionOptions?: ImageParamOption[];
  // 更新图像尺寸
  onSizeChange: (value: string) => void;
  // 更新分辨率
  onResolutionChange: (value: string) => void;
};

export const GeminiParamsPanel = ({
  size,
  resolution,
  sizeOptions = GEMINI_SIZES,
  resolutionOptions = GEMINI_RESOLUTIONS,
  onSizeChange,
  onResolutionChange,
}: GeminiParamsPanelProps) => {
  return (
    <ImageParamsPopover
      size={size}
      resolution={resolution}
      sizeOptions={sizeOptions}
      resolutionOptions={resolutionOptions}
      sizeLabel="图像尺寸"
      onSizeChange={onSizeChange}
      onResolutionChange={onResolutionChange}
    />
  );
};
