import { BaseEdge, EdgeProps, EdgeToolbar, getBezierPath } from "@xyflow/react";
import { ScissorsLineDashed } from "lucide-react";
import { memo, useMemo } from "react";

import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

/**
 * 自定义边组件
 * 在边的中心点显示工具栏，支持删除操作
 */
const CustomEdgeComponent = (props: EdgeProps) => {
  // 使用 getBezierPath 获取贝塞尔曲线路径和中心点坐标
  const [edgePath, centerX, centerY] = getBezierPath(props);
  // 从 store 获取删除边的方法
  const deleteEdge = useCanvasFlowStore((state) => state.deleteEdge);
  const isHighlighted = useCanvasFlowStore((state) =>
    state.highlightedEdgeIds.includes(props.id),
  );

  const edgeStyle = useMemo(() => {
    if (!isHighlighted) {
      return props.style;
    }

    return {
      ...(props.style ?? {}),
      stroke: "#D79BFF",
      strokeWidth: 3,
      strokeDasharray: "8 6",
      strokeDashoffset: 0,
      animation: "reference-edge-dash 1.2s linear infinite",
      filter: "drop-shadow(0 0 8px rgba(180,63,235,0.85))",
    };
  }, [isHighlighted, props.style]);

  return (
    <>
      <BaseEdge id={props.id} path={edgePath} style={edgeStyle} className="">
        {/* 在边的中心点显示工具栏，默认透明，悬浮时显示 */}
        <EdgeToolbar
          edgeId={props.id}
          x={centerX}
          y={centerY}
          className="group"
        >
          <ScissorsLineDashed
            onClick={() => deleteEdge(props.id)}
            className="p-1.5 w-12 h-12 rounded-md bg-accent text-destructive border border-border opacity-0 group-hover:opacity-100"
          />
        </EdgeToolbar>
      </BaseEdge>
    </>
  );
};

export const CustomEdge = memo(CustomEdgeComponent);
