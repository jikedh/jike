import {
  BaseEdge,
  EdgeProps,
  EdgeToolbar,
  getBezierPath,
  useReactFlow,
} from "@xyflow/react";
import { ScissorsLineDashed } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";

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

const EDGE_CUT_BUTTON_ANIMATION_MS = 220;
const EDGE_HOVER_GRACE_MS = 800;

const isSpacePanActive = () => {
  return document
    .querySelector(".react-flow")
    ?.hasAttribute("data-space-pressed");
};

const CustomEdgeComponent = (props: EdgeProps) => {
  const [edgePath] = getBezierPath(props);
  const { screenToFlowPosition } = useReactFlow();
  const [isHovered, setIsHovered] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [showCutButton, setShowCutButton] = useState(false);
  const [cutButtonPosition, setCutButtonPosition] = useState({ x: 0, y: 0 });
  const hideTimerRef = useRef<number | null>(null);
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
  const edgeAnimationEnabled = useChatSettingsStore(
    (state) => state.edgeAnimationEnabled,
  );
  const edgeStyle = useMemo(() => {
    const isActive = isConnectedToSelectedNode || isHovered;

    if (!isHighlighted) {
      return {
        ...(props.style ?? {}),
        ...DEFAULT_EDGE_STYLE,
        stroke: isActive ? "#B43FEB" : DEFAULT_EDGE_STYLE.stroke,
        strokeWidth: isActive ? 1.35 : DEFAULT_EDGE_STYLE.strokeWidth,
        opacity: isActive ? 0.66 : undefined,
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
  }, [isConnectedToSelectedNode, isHighlighted, isHovered, props.style]);

  const handleHoverStart = useCallback((event?: React.PointerEvent) => {
    setIsHovered(true);

    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const handleEdgeClick = useCallback(
    (event: React.PointerEvent<SVGPathElement>) => {
      if (event.button !== 0 || isSpacePanActive()) {
        return;
      }

      event.stopPropagation();

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      setCutButtonPosition(position);
      setIsHovered(true);
      setToolbarVisible(true);
      setShowCutButton(true);
    },
    [screenToFlowPosition],
  );

  const handleHoverEnd = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
    }

    setShowCutButton(false);

    hideTimerRef.current = window.setTimeout(
      () => {
        setIsHovered(false);
        setToolbarVisible(false);
        hideTimerRef.current = null;
      },
      Math.max(EDGE_HOVER_GRACE_MS, EDGE_CUT_BUTTON_ANIMATION_MS),
    );
  }, []);

  const handleCutButtonEnter = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    setIsHovered(true);
    setToolbarVisible(true);
    setShowCutButton(true);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  const isFlowing = isHighlighted || isConnectedToSelectedNode || isHovered;

  return (
    <>
      <BaseEdge id={props.id} path={edgePath} style={edgeStyle} className="" />
      {isFlowing && !isHighlighted ? (
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
          {edgeAnimationEnabled ? (
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
          ) : null}
        </>
      ) : null}
      <path
        d={edgePath}
        fill="none"
        pointerEvents="stroke"
        stroke="rgba(0,0,0,0.001)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={22}
        data-canvas-edge-hitbox="true"
        onPointerEnter={handleHoverStart}
        onPointerLeave={handleHoverEnd}
        onPointerDown={handleEdgeClick}
      />
      <EdgeToolbar
        edgeId={props.id}
        isVisible={toolbarVisible}
        x={cutButtonPosition.x}
        y={cutButtonPosition.y}
        className={[
          "nodrag nopan",
          showCutButton ? "pointer-events-auto" : "pointer-events-none",
        ].join(" ")}
      >
        <button
          type="button"
          aria-label="断开连线"
          onClick={(event) => {
            event.stopPropagation();
            deleteEdge(props.id);
          }}
          onPointerEnter={handleCutButtonEnter}
          onPointerLeave={handleHoverEnd}
          className={[
            "flex size-11 items-center justify-center rounded-xl border border-[#B43FEB]/35 bg-[#121214]/92 text-[#F0D9FF] shadow-[0_10px_26px_rgba(0,0,0,0.32),0_0_24px_rgba(180,63,235,0.22)] backdrop-blur-md transition-[opacity,transform,box-shadow,border-color] duration-200 ease-out",
            showCutButton
              ? "pointer-events-auto scale-100 opacity-100"
              : "pointer-events-none scale-50 opacity-0",
          ].join(" ")}
        >
          <ScissorsLineDashed className="size-5" />
        </button>
      </EdgeToolbar>
    </>
  );
};

export const CustomEdge = memo(CustomEdgeComponent);
