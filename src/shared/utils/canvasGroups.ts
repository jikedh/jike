import type { AllNodeType, EdgeType } from "shared/types/flow";
import type { CanvasGroup } from "shared/types/zustand/canvas-flow";

export type FlowRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NodeOffset = {
  x: number;
  y: number;
};

const DEFAULT_NODE_WIDTH = 175;
const DEFAULT_NODE_HEIGHT = 175;

export const getNodeSize = (node: AllNodeType) => {
  return {
    width: node.width ?? node.measured?.width ?? DEFAULT_NODE_WIDTH,
    height: node.height ?? node.measured?.height ?? DEFAULT_NODE_HEIGHT,
  };
};

export const getNodeRect = (node: AllNodeType): FlowRect => {
  const { width, height } = getNodeSize(node);
  return {
    x: node.position.x,
    y: node.position.y,
    width,
    height,
  };
};

export const getNodeRectWithPadding = (
  node: AllNodeType,
  padding: number,
): FlowRect => {
  const rect = getNodeRect(node);
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
};

export const getGroupNodeIds = (group: CanvasGroup) => {
  return Array.from(new Set(group.nodeIds)).filter(Boolean);
};

export const getGroupBounds = (
  nodes: AllNodeType[],
  nodeIds: string[],
  padding = 24,
): FlowRect | null => {
  const selectedNodes = nodes.filter((node) => nodeIds.includes(node.id));

  if (selectedNodes.length === 0) {
    return null;
  }

  let minLeft = Number.POSITIVE_INFINITY;
  let minTop = Number.POSITIVE_INFINITY;
  let maxRight = Number.NEGATIVE_INFINITY;
  let maxBottom = Number.NEGATIVE_INFINITY;

  selectedNodes.forEach((node) => {
    const rect = getNodeRect(node);
    minLeft = Math.min(minLeft, rect.x);
    minTop = Math.min(minTop, rect.y);
    maxRight = Math.max(maxRight, rect.x + rect.width);
    maxBottom = Math.max(maxBottom, rect.y + rect.height);
  });

  return {
    x: minLeft - padding,
    y: minTop - padding,
    width: maxRight - minLeft + padding * 2,
    height: maxBottom - minTop + padding * 2,
  };
};

export const translateNodesByIds = (
  nodes: AllNodeType[],
  nodeIds: string[],
  offset: NodeOffset,
): AllNodeType[] => {
  const nodeIdSet = new Set(nodeIds);

  return nodes.map((node) => {
    if (!nodeIdSet.has(node.id)) {
      return node;
    }

    return {
      ...node,
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y,
      },
    };
  });
};

export const normalizeGroupNodeIds = (
  nodeIds: string[],
  existingNodeIds: Set<string>,
) => {
  return Array.from(
    new Set(nodeIds.filter((nodeId) => existingNodeIds.has(nodeId))),
  );
};

export const layoutGroupHorizontally = (
  nodes: AllNodeType[],
  edges: EdgeType[],
  nodeIds: string[],
  options?: {
    columnGap?: number;
    rowGap?: number;
    padding?: number;
  },
) => {
  const columnGap = options?.columnGap ?? 96;
  const rowGap = options?.rowGap ?? 28;
  const padding = options?.padding ?? 24;

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const groupNodeIds = normalizeGroupNodeIds(nodeIds, new Set(nodeById.keys()));
  const groupNodeSet = new Set(groupNodeIds);
  const groupNodes = groupNodeIds
    .map((nodeId) => nodeById.get(nodeId))
    .filter(Boolean) as AllNodeType[];

  if (groupNodes.length === 0) {
    return {
      nextNodes: nodes,
      bounds: null as FlowRect | null,
    };
  }

  const incoming = new Map<string, Set<string>>();
  const outgoing = new Map<string, Set<string>>();

  groupNodeIds.forEach((nodeId) => {
    incoming.set(nodeId, new Set());
    outgoing.set(nodeId, new Set());
  });

  edges.forEach((edge) => {
    if (!groupNodeSet.has(edge.source) || !groupNodeSet.has(edge.target)) {
      return;
    }

    incoming.get(edge.target)?.add(edge.source);
    outgoing.get(edge.source)?.add(edge.target);
  });

  const sortedByPosition = [...groupNodes].sort((a, b) => {
    const dx = a.position.x - b.position.x;
    if (dx !== 0) return dx;
    return a.position.y - b.position.y;
  });

  const layerById = new Map<string, number>();
  const unresolved = new Set(groupNodeIds);

  let progress = true;
  while (unresolved.size > 0 && progress) {
    progress = false;

    for (const node of sortedByPosition) {
      if (!unresolved.has(node.id)) {
        continue;
      }

      const parents = Array.from(incoming.get(node.id) ?? []);
      const resolvedParentLayers = parents
        .filter((parentId) => layerById.has(parentId))
        .map((parentId) => layerById.get(parentId) ?? 0);
      const hasUnresolvedParent = parents.some(
        (parentId) => !layerById.has(parentId),
      );

      if (hasUnresolvedParent) {
        continue;
      }

      const nextLayer =
        resolvedParentLayers.length > 0
          ? Math.max(...resolvedParentLayers) + 1
          : 0;
      layerById.set(node.id, nextLayer);
      unresolved.delete(node.id);
      progress = true;
    }
  }

  if (unresolved.size > 0) {
    const maxResolvedLayer = Math.max(
      0,
      ...Array.from(layerById.values()),
    );
    const fallbackNodes = sortedByPosition.filter((node) =>
      unresolved.has(node.id),
    );

    fallbackNodes.forEach((node, index) => {
      layerById.set(node.id, maxResolvedLayer + 1 + index);
      unresolved.delete(node.id);
    });
  }

  const columns = new Map<number, AllNodeType[]>();
  groupNodes.forEach((node) => {
    const layer = layerById.get(node.id) ?? 0;
    const column = columns.get(layer) ?? [];
    column.push(node);
    columns.set(layer, column);
  });

  const orderedColumns = Array.from(columns.entries()).sort((a, b) => a[0] - b[0]);
  const columnLayouts = orderedColumns.map(([layer, columnNodes]) => {
    const sortedColumnNodes = columnNodes.sort((a, b) => {
      const dy = a.position.y - b.position.y;
      if (dy !== 0) return dy;
      return a.position.x - b.position.x;
    });

    const columnWidth = Math.max(
      ...sortedColumnNodes.map((node) => getNodeSize(node).width),
    );

    return {
      layer,
      nodes: sortedColumnNodes,
      columnWidth,
      columnHeight:
        sortedColumnNodes.reduce((sum, node) => sum + getNodeSize(node).height, 0) +
        Math.max(0, sortedColumnNodes.length - 1) * rowGap,
    };
  });

  const layoutHeight = Math.max(
    ...columnLayouts.map((column) => column.columnHeight),
  );

  const bounds = getGroupBounds(nodes, groupNodeIds, padding);
  const anchorX = bounds?.x ?? 0;
  const anchorY = bounds?.y ?? 0;

  let currentX = anchorX + padding;
  const nextNodePositions = new Map<string, NodeOffset>();

  columnLayouts.forEach((column, columnIndex) => {
    const extraHeight = Math.max(0, layoutHeight - column.columnHeight);
    const extraGap = column.nodes.length > 0 ? extraHeight / column.nodes.length : 0;
    const startOffset = extraGap / 2;
    let currentY = anchorY + padding + startOffset;

    column.nodes.forEach((node) => {
      nextNodePositions.set(node.id, {
        x: currentX,
        y: currentY,
      });
      currentY += getNodeSize(node).height + rowGap + extraGap;
    });

    currentX += column.columnWidth + (columnIndex < columnLayouts.length - 1 ? columnGap : 0);
  });

  const nextNodes = nodes.map((node) => {
    const nextPosition = nextNodePositions.get(node.id);
    if (!nextPosition) {
      return node;
    }

    return {
      ...node,
      position: {
        x: nextPosition.x,
        y: nextPosition.y,
      },
    };
  });

  return {
    nextNodes,
    bounds: getGroupBounds(nextNodes, groupNodeIds, padding),
  };
};
