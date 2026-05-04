/**
 * Midjourney 整合参数面板组件
 * 包含图像尺寸的可视化选择
 * 适用于 midjourney 和 midjourney-niji7 模型
 */

import { ImageParamsPopover } from "./ImageParamsPopover";

// Midjourney 图像尺寸选项（参考官方常用尺寸）
export const MIDJOURNEY_ASPECT_RATIOS = [
  { label: "1:1", value: "1:1", description: "正方形" },
  { label: "16:9", value: "16:9", description: "横向宽屏" },
  { label: "9:16", value: "9:16", description: "竖向长图" },
  { label: "3:4", value: "3:4", description: "竖向3:4" },
  { label: "4:3", value: "4:3", description: "横向4:3" },
  { label: "3:2", value: "3:2", description: "横向3:2" },
  { label: "2:3", value: "2:3", description: "竖向2:3" },
  { label: "21:9", value: "21:9", description: "超宽屏" },
];

type MidjourneyParamsPanelProps = {
  // 当前图像尺寸
  size: string;
  // 更新图像尺寸
  onSizeChange: (value: string) => void;
};

export const MidjourneyParamsPanel = ({
  size,
  onSizeChange,
}: MidjourneyParamsPanelProps) => {
  return (
    <ImageParamsPopover
      size={size}
      sizeOptions={MIDJOURNEY_ASPECT_RATIOS}
      sizeLabel="图像尺寸"
      onSizeChange={onSizeChange}
    />
  );
};
