import type { AllNodeType, EdgeType } from "shared/types/flow";
import type { NodeType } from "shared/types/zustand/canvas-flow";
import { getRemoteMediaUrl } from "shared/utils/mediaPersistence";
import { cloneNodeDataForCopy } from "shared/utils/nodeCopy";

export interface CopiedNodeTemplate {
  originalId: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  width?: number;
  height?: number;
}

export interface CopiedEdgeTemplate {
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

export const resolveNodeTypeForCopyCounter = (
  nodeType: AllNodeType["type"],
): NodeType => {
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

export const createCopiedNodeTemplates = (
  nodes: AllNodeType[],
): CopiedNodeTemplate[] =>
  nodes.map((node) => ({
    originalId: node.id,
    type: node.type,
    position: { ...node.position },
    data: {
      ...cloneNodeDataForCopy(node.type, node.data),
      createdAt: Date.now(),
    },
    ...(node.width !== undefined && { width: node.width }),
    ...(node.height !== undefined && { height: node.height }),
  }));

export const createCopiedEdgeTemplates = (
  nodes: AllNodeType[],
  edges: EdgeType[],
): CopiedEdgeTemplate[] => {
  const selectedNodeIds = new Set(nodes.map((node) => node.id));
  const selectedNodeMap = new Map(nodes.map((node) => [node.id, node]));
  const copiedEdgeMap = new Map<string, CopiedEdgeTemplate>();

  edges.forEach((edge) => {
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

  return Array.from(copiedEdgeMap.values());
};

const getNodeResultUrls = (node?: AllNodeType): string[] => {
  const nodeData = node?.data as any;

  return (nodeData?.result?.data ?? [])
    .map((item: any) => getRemoteMediaUrl(item) ?? item?.url)
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

export const syncMediaUrlsForPastedEdges = (
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

export const buildPastedNodesAndEdges = ({
  copiedNodes,
  copiedEdges,
  existingNodes,
  getNextNodeId,
  pasteCount,
  mousePosition,
}: {
  copiedNodes: CopiedNodeTemplate[];
  copiedEdges: CopiedEdgeTemplate[];
  existingNodes: AllNodeType[];
  getNextNodeId: (nodeType: NodeType) => string;
  pasteCount: number;
  mousePosition?: { x: number; y: number };
}) => {
  const originalToNewIdMap = new Map<string, string>();
  const groupCenterX =
    copiedNodes.reduce((sum, node) => sum + node.position.x, 0) /
    copiedNodes.length;
  const groupCenterY =
    copiedNodes.reduce((sum, node) => sum + node.position.y, 0) /
    copiedNodes.length;

  const PASTE_OFFSET_X = 50;
  const PASTE_OFFSET_Y = 50;
  const REPEAT_OFFSET_X = 200;

  const newNodes: AllNodeType[] = copiedNodes.map((nodeTemplate) => {
    const newId = getNextNodeId(
      resolveNodeTypeForCopyCounter(nodeTemplate.type as AllNodeType["type"]),
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

    return {
      ...nodeTemplate,
      id: newId,
      position: {
        x: newPositionX,
        y: newPositionY,
      },
      data: JSON.parse(JSON.stringify(nodeTemplate.data)),
      selected: true,
      dragging: false,
    } as AllNodeType;
  });

  const newEdges: EdgeType[] = copiedEdges
    .map((edgeTemplate, edgeIndex) => {
      const newSource =
        originalToNewIdMap.get(edgeTemplate.originalSource) ??
        (existingNodes.some((node) => node.id === edgeTemplate.originalSource)
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

  return { newNodes, newEdges };
};
