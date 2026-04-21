import { useReactFlow } from "@xyflow/react";
import { useCallback } from "react";
import type { AllNodeType, EdgeType } from "shared/types/flow";
import { toast } from "sonner";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import type { FloatingSidebarProps } from "./FloatingSidebar";
import { FloatingSidebar } from "./FloatingSidebar";

export const CanvasSidebar = () => {
  const addNode = useCanvasFlowStore((state) => state.addNode);
  const saveGraph = useCanvasFlowStore((state) => state.saveGraph);
  const { screenToFlowPosition } = useReactFlow<AllNodeType, EdgeType>();

  const handleSidebarAction = useCallback<
    NonNullable<FloatingSidebarProps["onAction"]>
  >(
    (actionId) => {
      const centerFlowPosition = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });

      switch (actionId) {
        case "create-note":
          addNode("note", centerFlowPosition);
          break;
        case "create-image":
          addNode("image", centerFlowPosition);
          break;
        case "create-video":
          addNode("video", centerFlowPosition);
          break;
        case "create-audio":
          addNode("audio", centerFlowPosition);
          break;
        case "create-textAgent":
          addNode("textAgent", centerFlowPosition);
          break;
        case "create-imageAgent":
          addNode("imageAgent", centerFlowPosition);
          break;
        case "create-videoAgent":
          addNode("videoAgent", centerFlowPosition);
          break;
        case "save":
          saveGraph();
          toast.success("画布已保存");
          break;
        default:
          break;
      }
    },
    [addNode, saveGraph, screenToFlowPosition],
  );

  return <FloatingSidebar onAction={handleSidebarAction} />;
};
