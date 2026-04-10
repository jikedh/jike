/**
 * 宽高比图标组件
 * 根据比例值渲染不同形状的线框图标
 */

type AspectRatioIconProps = {
  // 比例值，如 "1:1", "16:9", "9:16", "4:3", "3:4"
  ratio: string;
  // 图标尺寸
  size?: number;
  // 是否选中
  active?: boolean;
  // 额外类名
  className?: string;
};

// 解析比例字符串为宽高数值
const parseRatio = (ratio: string): [number, number] => {
  const parts = ratio.split(":");
  if (parts.length !== 2) {
    return [1, 1];
  }
  const width = parseFloat(parts[0]) || 1;
  const height = parseFloat(parts[1]) || 1;
  return [width, height];
};

export const AspectRatioIcon = ({
  ratio,
  size = 24,
  active = false,
  className = "",
}: AspectRatioIconProps) => {
  const [w, h] = parseRatio(ratio);

  // 计算图标内矩形的实际尺寸，保持比例
  // 最大边长为 size，按比例缩放
  const maxSize = size - 4; // 留出边距
  const scale = maxSize / Math.max(w, h);
  const rectWidth = Math.max(4, w * scale);
  const rectHeight = Math.max(4, h * scale);

  // 居中偏移
  const offsetX = (size - rectWidth) / 2;
  const offsetY = (size - rectHeight) / 2;

  const strokeColor = active ? "#B43FEB" : "#737373";
  const strokeWidth = active ? 1.5 : 1;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x={offsetX}
        y={offsetY}
        width={rectWidth}
        height={rectHeight}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        rx={2}
      />
    </svg>
  );
};
