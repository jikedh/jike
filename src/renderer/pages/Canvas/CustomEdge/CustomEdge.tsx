import { BaseEdge, EdgeProps, EdgeToolbar, getBezierPath } from "@xyflow/react";
import { ScissorsLineDashed } from "lucide-react";
import { memo, useMemo } from "react";

import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

const DEFAULT_EDGE_STYLE = {
  stroke: "rgba(255, 255, 255, 0.28)",
  strokeWidth: 1.2,
};

const SELECTED_EDGE_TRAIL_STYLE = {
  strokeWidth: 1.05,
  strokeDasharray: "34 66",
  animation: "selected-edge-comet-trail 3.2s linear infinite",
  opacity: 0.3,
  filter:
    "drop-shadow(0 0 3px rgba(180,63,235,0.12)) drop-shadow(0 0 7px rgba(180,63,235,0.06))",
};

const SELECTED_EDGE_CORE_STYLE = {
  strokeWidth: 1.65,
  strokeDasharray: "19 81",
  animation: "selected-edge-comet-core 3.2s linear infinite",
  filter:
    "drop-shadow(0 0 2px rgba(215,155,255,0.26)) drop-shadow(0 0 6px rgba(180,63,235,0.1))",
};

const SELECTED_EDGE_HEAD_STYLE = {
  strokeWidth: 2.55,
  strokeDasharray: "4.2 95.8",
  animation: "selected-edge-comet-head 3.2s linear infinite",
  opacity: 0.82,
  filter:
    "drop-shadow(0 0 3px rgba(215,155,255,0.38)) drop-shadow(0 0 8px rgba(180,63,235,0.16))",
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
  const flowGradientId = `selected-edge-flow-${props.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  const edgeStyle = useMemo(() => {
    if (!isHighlighted) {
      return {
        ...(props.style ?? {}),
        ...DEFAULT_EDGE_STYLE,
        opacity: isConnectedToSelectedNode ? 0.52 : undefined,
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
          <defs>
            <linearGradient
              id={flowGradientId}
              gradientUnits="userSpaceOnUse"
              x1={props.sourceX}
              y1={props.sourceY}
              x2={props.targetX}
              y2={props.targetY}
            >
              <stop offset="0%" stopColor="#B43FEB" stopOpacity="0" />
              <stop offset="18%" stopColor="#B43FEB" stopOpacity="0.34" />
              <stop offset="48%" stopColor="#B43FEB" stopOpacity="0.74" />
              <stop offset="72%" stopColor="#D79BFF" stopOpacity="0.58" />
              <stop offset="86%" stopColor="#B43FEB" stopOpacity="0.26" />
              <stop offset="100%" stopColor="#B43FEB" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={edgePath}
            fill="none"
            pathLength={100}
            pointerEvents="none"
            stroke="#B43FEB"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={SELECTED_EDGE_TRAIL_STYLE}
          />
          <path
            className="react-flow__edge-path"
            d={edgePath}
            fill="none"
            pathLength={100}
            pointerEvents="none"
            stroke={`url(#${flowGradientId})`}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={SELECTED_EDGE_CORE_STYLE}
          />
          <path
            d={edgePath}
            fill="none"
            pathLength={100}
            pointerEvents="none"
            stroke="#D79BFF"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={SELECTED_EDGE_HEAD_STYLE}
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
