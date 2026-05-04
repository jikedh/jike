/**
 * Seedream 5.0 整合参数面板组件
 * 包含宽高比、分辨率的可视化选择
 * 适用于 doubao-seedream-5-0 模型
 */

import { ImageParamsPopover } from "./ImageParamsPopover";

// Seedream 5.0 宽高比选项（与类型定义保持一致）
export const SEEDREAM_ASPECT_RATIOS = [
  { label: "1:1", value: "1:1", description: "正方形" },
  { label: "4:3", value: "4:3", description: "横向4:3" },
  { label: "3:4", value: "3:4", description: "竖向3:4" },
  { label: "16:9", value: "16:9", description: "横向宽屏" },
  { label: "9:16", value: "9:16", description: "竖向长图" },
  { label: "3:2", value: "3:2", description: "横向3:2" },
  { label: "2:3", value: "2:3", description: "竖向2:3" },
  { label: "21:9", value: "21:9", description: "超宽屏" },
  { label: "9:21", value: "9:21", description: "超窄屏" },
];

// Seedream 5.0 分辨率选项
export const SEEDREAM_RESOLUTIONS = [
  { label: "2K", value: "2K", description: "标准分辨率" },
  { label: "3K", value: "3K", description: "高清分辨率" },
];

type SeedreamParamsPanelProps = {
  // 当前宽高比
  size: string;
  // 当前分辨率
  resolution: string;
  // 更新宽高比
  onSizeChange: (value: string) => void;
  // 更新分辨率
  onResolutionChange: (value: string) => void;
};

export const SeedreamParamsPanel = ({
  size,
  resolution,
  onSizeChange,
  onResolutionChange,
}: SeedreamParamsPanelProps) => {
  return (
    <ImageParamsPopover
      size={size}
      resolution={resolution}
      sizeOptions={SEEDREAM_ASPECT_RATIOS}
      resolutionOptions={SEEDREAM_RESOLUTIONS}
      sizeLabel="宽高比"
      onSizeChange={onSizeChange}
      onResolutionChange={onResolutionChange}
    />
  );
};
