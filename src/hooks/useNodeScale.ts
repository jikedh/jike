import { useStore } from "@xyflow/react";
import { useMemo } from "react";

/**
 * 获取当前视口缩放值（离散化处理，避免高频重渲染）
 *
 * 原理：
 * - React Flow 的 NodeToolbar 通过 Portal 渲染在 viewport transform 之外，
 *   其内容始终保持固定屏幕像素大小，不会随画布缩放变化。
 * - 通过在 NodeToolbar 内部子元素上应用 transform: scale(zoom)，
 *   可以让工具栏内容与节点保持视觉同步缩放。
 *
 * 性能优化：
 * - 使用 useStore 选择性订阅 transform[2]（即 zoom 值），
 *   而非 useViewport() 订阅整个视口对象，减少不必要的重渲染。
 * - 对 zoom 做离散化处理（步长 0.05），在视觉平滑和性能之间取得平衡。
 */
export const useNodeScale = () => {
  // 选择性订阅 zoom 值，仅在 zoom 变化时触发重渲染
  const rawZoom = useStore((s) => s.transform[2]);

  // 离散化：步长 0.05，减少微小变化带来的重渲染
  const zoom = useMemo(() => Math.round(rawZoom * 20) / 20, [rawZoom]);

  return { zoom };
};
