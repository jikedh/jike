import { useCallback, useRef } from "react";
import type { AllNodeType, EdgeType } from "shared/types/flow";
import type { NodeType } from "shared/types/zustand/canvas-flow";
import { cloneNodeDataForCopy } from "shared/utils/nodeCopy";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

interface CopiedNodeTemplate {
  originalId: string;
  type: string;
  position: { x: number; y: number };
  data: any;
  width?: number;
  height?: number;
}

interface CopiedEdgeTemplate {
  originalSource: string;
  originalTarget: string;
}

export function useCopyPaste() {
  const copiedNodesRef = useRef<CopiedNodeTemplate[]>([]);
  const copiedEdgesRef = useRef<CopiedEdgeTemplate[]>([]);
  const pasteCountRef = useRef(0);

  const copySelectedNodes = useCallback(() => {
    const state = useCanvasFlowStore.getState();
    const selectedNodes = state.nodes.filter((n) => n.selected);

    if (selectedNodes.length === 0) return;

    const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));

    const copiedNodes: CopiedNodeTemplate[] = selectedNodes.map((node) => {
      return {
        originalId: node.id,
        type: node.type,
        position: { ...node.position },
        data: {
          ...cloneNodeDataForCopy(node.type, node.data),
          createdAt: Date.now(),
        },
        ...(node.width !== undefined && { width: node.width }),
        ...(node.height !== undefined && { height: node.height }),
      };
    });

    const copiedEdges: CopiedEdgeTemplate[] = state.edges
      .filter(
        (edge) =>
          selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target),
      )
      .map((edge) => ({
        originalSource: edge.source,
        originalTarget: edge.target,
      }));

    copiedNodesRef.current = copiedNodes;
    copiedEdgesRef.current = copiedEdges;
    pasteCountRef.current = 0;
  }, []);

  const pasteNodes = useCallback((mousePosition?: { x: number; y: number }) => {
    const copiedNodes = copiedNodesRef.current;
    const copiedEdges = copiedEdgesRef.current;

    if (copiedNodes.length === 0) return;

    const state = useCanvasFlowStore.getState();

    const originalToNewIdMap = new Map<string, string>();

    let groupCenterX = 0;
    let groupCenterY = 0;

    if (copiedNodes.length > 0) {
      const sumX = copiedNodes.reduce((sum, n) => sum + n.position.x, 0);
      const sumY = copiedNodes.reduce((sum, n) => sum + n.position.y, 0);
      groupCenterX = sumX / copiedNodes.length;
      groupCenterY = sumY / copiedNodes.length;
    }

    pasteCountRef.current += 1;
    const pasteCount = pasteCountRef.current;

    const PASTE_OFFSET_X = 50;
    const PASTE_OFFSET_Y = 50;
    const REPEAT_OFFSET_X = 200;

    const newNodes: AllNodeType[] = copiedNodes.map((nodeTemplate) => {
      const newId = state.getNextNodeId(nodeTemplate.type as NodeType);
      originalToNewIdMap.set(nodeTemplate.originalId, newId);

      let newPositionX: number;
      let newPositionY: number;

      if (mousePosition) {
        const offsetX = nodeTemplate.position.x - groupCenterX;
        const offsetY = nodeTemplate.position.y - groupCenterY;
        const repeatOffset =
          pasteCount > 1 ? (pasteCount - 1) * REPEAT_OFFSET_X : 0;
        newPositionX = mousePosition.x + offsetX + repeatOffset;
        newPositionY = mousePosition.y + offsetY;
      } else {
        const repeatOffset =
          pasteCount > 1 ? (pasteCount - 1) * REPEAT_OFFSET_X : 0;
        newPositionX = nodeTemplate.position.x + PASTE_OFFSET_X + repeatOffset;
        newPositionY = nodeTemplate.position.y + PASTE_OFFSET_Y;
      }

      const dataCopy = JSON.parse(JSON.stringify(nodeTemplate.data));

      return {
        ...nodeTemplate,
        id: newId,
        position: {
          x: newPositionX,
          y: newPositionY,
        },
        data: dataCopy,
        selected: true,
        dragging: false,
      } as AllNodeType;
    });

    const newEdges: EdgeType[] = copiedEdges
      .map((edgeTemplate) => {
        const newSource = originalToNewIdMap.get(edgeTemplate.originalSource);
        const newTarget = originalToNewIdMap.get(edgeTemplate.originalTarget);

        if (!newSource || !newTarget) return null;

        return {
          id: `edge-${newSource}-${newTarget}-${Date.now()}`,
          source: newSource,
          target: newTarget,
        } as EdgeType;
      })
      .filter(Boolean) as EdgeType[];

    useCanvasFlowStore.setState((state) => {
      const updatedNodes = state.nodes.map((n) => ({
        ...n,
        selected: false,
      }));

      return {
        nodes: [...updatedNodes, ...newNodes],
        edges: [...state.edges, ...newEdges],
      };
    });

    useCanvasFlowStore.getState().requestHistorySave();
    useCanvasFlowStore.getState().saveGraph();
  }, []);

  return { copySelectedNodes, pasteNodes };
}
