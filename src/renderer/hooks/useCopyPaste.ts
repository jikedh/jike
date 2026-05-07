import { useCallback, useRef } from "react";
import {
  buildPastedNodesAndEdges,
  type CopiedEdgeTemplate,
  type CopiedNodeTemplate,
  createCopiedEdgeTemplates,
  createCopiedNodeTemplates,
  syncMediaUrlsForPastedEdges,
} from "shared/utils/canvasCopyPaste";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

export function useCopyPaste() {
  const copiedNodesRef = useRef<CopiedNodeTemplate[]>([]);
  const copiedEdgesRef = useRef<CopiedEdgeTemplate[]>([]);
  const pasteCountRef = useRef(0);

  const copySelectedNodes = useCallback(() => {
    const state = useCanvasFlowStore.getState();
    const selectedNodes = state.nodes.filter((n) => n.selected);

    if (selectedNodes.length === 0) return;

    copiedNodesRef.current = createCopiedNodeTemplates(selectedNodes);
    copiedEdgesRef.current = createCopiedEdgeTemplates(
      selectedNodes,
      state.edges,
    );
    pasteCountRef.current = 0;
  }, []);

  const pasteNodes = useCallback((mousePosition?: { x: number; y: number }) => {
    const copiedNodes = copiedNodesRef.current;
    const copiedEdges = copiedEdgesRef.current;

    if (copiedNodes.length === 0) return;

    const state = useCanvasFlowStore.getState();

    pasteCountRef.current += 1;
    const pasteCount = pasteCountRef.current;

    const { newNodes, newEdges } = buildPastedNodesAndEdges({
      copiedNodes,
      copiedEdges,
      existingNodes: state.nodes,
      getNextNodeId: state.getNextNodeId,
      pasteCount,
      mousePosition,
    });

    useCanvasFlowStore.setState((state) => {
      const updatedNodes = state.nodes.map((n) => ({
        ...n,
        selected: false,
      }));

      const nextNodes = syncMediaUrlsForPastedEdges(
        [...updatedNodes, ...newNodes],
        newEdges,
      );

      return {
        nodes: nextNodes,
        edges: [...state.edges, ...newEdges],
      };
    });

    useCanvasFlowStore.getState().requestHistorySave();
    useCanvasFlowStore.getState().saveGraph();
  }, []);

  return { copySelectedNodes, pasteNodes };
}
