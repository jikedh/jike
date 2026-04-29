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
  edge: Omit<EdgeType, "id" | "source" | "target">;
}

const shouldKeepIncomingEdgeForCopiedNode = (node?: AllNodeType) => {
  return (
    node?.type === "imageNode" ||
    node?.type === "videoNode" ||
    node?.type === "newVideoNode"
  );
};

const resolveNodeTypeForCounter = (nodeType: AllNodeType["type"]): NodeType => {
  const nodeTypeMap: Partial<Record<AllNodeType["type"], NodeType>> = {
    noteNode: "note",
    imageNode: "image",
    videoNode: "video",
    agentNode: "agent",
    panoramaNode: "panorama",
    audioNode: "audio",
    textAgentNode: "textAgent",
    imageAgentNode: "imageAgent",
    videoAgentNode: "videoAgent",
    tableNode: "table",
    newVideoNode: "newVideo",
  };

  return nodeTypeMap[nodeType] ?? "default";
};

const getNodeResultUrls = (node?: AllNodeType): string[] => {
  const nodeData = node?.data as any;

  return (nodeData?.result?.data ?? [])
    .map((item: any) => item?.url)
    .filter(Boolean);
};

const getTargetMediaFieldByEdge = (
  sourceNode?: AllNodeType,
  targetNode?: AllNodeType,
) => {
  if (!sourceNode || !targetNode) return null;

  if (sourceNode.type === "imageNode") {
    if (
      targetNode.type === "imageNode" ||
      targetNode.type === "videoNode" ||
      targetNode.type === "newVideoNode"
    ) {
      return "image_urls";
    }
  }

  if (
    (targetNode.type === "videoNode" || targetNode.type === "newVideoNode") &&
    (sourceNode.type === "videoNode" || sourceNode.type === "newVideoNode")
  ) {
    return "video_urls";
  }

  if (
    (targetNode.type === "videoNode" || targetNode.type === "newVideoNode") &&
    sourceNode.type === "audioNode"
  ) {
    return "audio_urls";
  }

  return null;
};

const syncMediaUrlsForPastedEdges = (
  nodes: AllNodeType[],
  edges: EdgeType[],
): AllNodeType[] => {
  return edges.reduce((currentNodes, edge) => {
    const sourceNode = currentNodes.find((node) => node.id === edge.source);
    const targetNode = currentNodes.find((node) => node.id === edge.target);
    const targetField = getTargetMediaFieldByEdge(sourceNode, targetNode);
    const sourceUrls = getNodeResultUrls(sourceNode);

    if (!targetNode || !targetField || sourceUrls.length === 0) {
      return currentNodes;
    }

    return currentNodes.map((node) => {
      if (node.id !== targetNode.id) {
        return node;
      }

      const nodeData = node.data as any;
      const currentUrls = nodeData?.[targetField] ?? [];

      return {
        ...node,
        data: {
          ...nodeData,
          [targetField]: Array.from(new Set([...currentUrls, ...sourceUrls])),
        },
      } as AllNodeType;
    });
  }, nodes);
};

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

    const selectedNodeMap = new Map(
      selectedNodes.map((node) => [node.id, node]),
    );
    const copiedEdgeMap = new Map<string, CopiedEdgeTemplate>();

    state.edges.forEach((edge) => {
      const isInternalEdge =
        selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target);
      const shouldKeepIncomingEdge =
        selectedNodeIds.has(edge.target) &&
        shouldKeepIncomingEdgeForCopiedNode(selectedNodeMap.get(edge.target));

      if (!isInternalEdge && !shouldKeepIncomingEdge) {
        return;
      }

      const {
        id: _id,
        source: _source,
        target: _target,
        ...edgePayload
      } = JSON.parse(JSON.stringify(edge)) as EdgeType;

      copiedEdgeMap.set(
        `${edge.source}:${edge.sourceHandle ?? "output"}->${edge.target}:${edge.targetHandle ?? "input"}`,
        {
          originalSource: edge.source,
          originalTarget: edge.target,
          edge: edgePayload,
        },
      );
    });

    const copiedEdges = Array.from(copiedEdgeMap.values());

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
      const newId = state.getNextNodeId(
        resolveNodeTypeForCounter(nodeTemplate.type as AllNodeType["type"]),
      );
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
      .map((edgeTemplate, edgeIndex) => {
        const newSource =
          originalToNewIdMap.get(edgeTemplate.originalSource) ??
          (state.nodes.some((node) => node.id === edgeTemplate.originalSource)
            ? edgeTemplate.originalSource
            : undefined);
        const newTarget = originalToNewIdMap.get(edgeTemplate.originalTarget);

        if (!newSource || !newTarget) return null;

        return {
          ...edgeTemplate.edge,
          id: `edge-${newSource}-${newTarget}-${Date.now()}-${edgeIndex}`,
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
