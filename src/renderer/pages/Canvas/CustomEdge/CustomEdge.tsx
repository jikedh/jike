import { BaseEdge, EdgeProps, EdgeToolbar, getBezierPath } from "@xyflow/react";
import { ScissorsLineDashed } from "lucide-react";
import { memo, useMemo } from "react";

import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

const DEFAULT_EDGE_STYLE = {
  stroke: "rgba(255, 255, 255, 0.28)",
  strokeWidth: 1.2,
};

const SELECTED_EDGE_STREAK_STYLE = {
  strokeWidth: 1.8,
  strokeDasharray: "7.5 92.5",
  animation: "selected-edge-streak 1.45s linear infinite",
  opacity: 0.5,
  filter:
    "drop-shadow(0 0 2px rgba(215,155,255,0.3)) drop-shadow(0 0 5px rgba(180,63,235,0.08))",
};

const SELECTED_EDGE_GLASS_STYLE = {
  strokeWidth: 0.55,
  opacity: 0.42,
  filter: "drop-shadow(0 0 3px rgba(215,155,255,0.18))",
};

const CustomEdgeComponent = (props: EdgeProps) => {
  const [edgePath, centerX, centerY] = getBezierPath(props);
  const deleteEdge = useCanvasFlowStore((state) => state.deleteEdge);
  const isHighlighted = useCanvasFlowStore((state) =>
    state.highlightedEdgeIds.includes(props.id),
  );
  const isConnectedToSelectedNode = useCanvasFlowStore((state) =>
    state.nodes.some(
      (node) =>
        node.selected && (node.id === props.source || node.id === props.target),
    ),
  );
  const edgeStyle = useMemo(() => {
    if (!isHighlighted) {
      return {
        ...(props.style ?? {}),
        ...DEFAULT_EDGE_STYLE,
        stroke: isConnectedToSelectedNode ? "#B43FEB" : DEFAULT_EDGE_STYLE.stroke,
        strokeWidth: isConnectedToSelectedNode
          ? 1.35
          : DEFAULT_EDGE_STYLE.strokeWidth,
        opacity: isConnectedToSelectedNode ? 0.66 : undefined,
      };
    }

    return {
      ...(props.style ?? {}),
      ...DEFAULT_EDGE_STYLE,
      stroke: "#D79BFF",
      strokeWidth: 3,
      strokeDasharray: "8 6",
      strokeDashoffset: 0,
      animation: "reference-edge-dash 1.2s linear infinite",
      filter: "drop-shadow(0 0 8px rgba(180,63,235,0.85))",
    };
  }, [isConnectedToSelectedNode, isHighlighted, props.style]);

  return (
    <>
      <BaseEdge id={props.id} path={edgePath} style={edgeStyle} className="" />
      {isConnectedToSelectedNode && !isHighlighted ? (
        <>
          <path
            d={edgePath}
            fill="none"
            pointerEvents="none"
            stroke="#E9CCFF"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={SELECTED_EDGE_GLASS_STYLE}
          />
          <path
            d={edgePath}
            fill="none"
            pathLength={100}
            pointerEvents="none"
            stroke="#D79BFF"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={SELECTED_EDGE_STREAK_STYLE}
          />
        </>
      ) : null}
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
    </>
  );
};

export const CustomEdge = memo(CustomEdgeComponent);
