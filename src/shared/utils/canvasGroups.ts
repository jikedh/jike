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
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  return getGroupBoundsFromNodeMap(nodeById, nodeIds, padding);
};

export const getGroupBoundsFromNodeMap = (
  nodeById: ReadonlyMap<string, AllNodeType>,
  nodeIds: string[],
  padding = 24,
): FlowRect | null => {
  const groupNodeIds = Array.from(new Set(nodeIds)).filter(Boolean);

  if (groupNodeIds.length === 0) {
    return null;
  }

  let minLeft = Number.POSITIVE_INFINITY;
  let minTop = Number.POSITIVE_INFINITY;
  let maxRight = Number.NEGATIVE_INFINITY;
  let maxBottom = Number.NEGATIVE_INFINITY;
  let foundNode = false;

  groupNodeIds.forEach((nodeId) => {
    const node = nodeById.get(nodeId);
    if (!node) {
      return;
    }

    foundNode = true;
    const rect = getNodeRect(node);
    minLeft = Math.min(minLeft, rect.x);
    minTop = Math.min(minTop, rect.y);
    maxRight = Math.max(maxRight, rect.x + rect.width);
    maxBottom = Math.max(maxBottom, rect.y + rect.height);
  });

  if (!foundNode) {
    return null;
  }

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

const sortNodesByPosition = (a: AllNodeType, b: AllNodeType) => {
  const dx = a.position.x - b.position.x;
  if (dx !== 0) {
    return dx;
  }

  const dy = a.position.y - b.position.y;
  if (dy !== 0) {
    return dy;
  }

  return a.id.localeCompare(b.id);
};

const collectGridOrderedNodes = (
  groupNodes: AllNodeType[],
  incoming: Map<string, Set<string>>,
  outgoing: Map<string, Set<string>>,
) => {
  const nodeById = new Map(groupNodes.map((node) => [node.id, node]));
  const sortedNodes = [...groupNodes].sort(sortNodesByPosition);
  const visited = new Set<string>();
  const orderedNodes: AllNodeType[] = [];

  const walkTree = (startNode: AllNodeType) => {
    if (visited.has(startNode.id)) {
      return;
    }

    let currentLevel = [startNode];

    while (currentLevel.length > 0) {
      const levelNodes = Array.from(
        new Map(
          currentLevel.map((node) => [node.id, node] as const),
        ).values(),
      ).sort(sortNodesByPosition);

      const nextLevelCandidates = new Set<string>();

      levelNodes.forEach((node) => {
        if (visited.has(node.id)) {
          return;
        }

        visited.add(node.id);
        orderedNodes.push(node);

        const children = Array.from(outgoing.get(node.id) ?? [])
          .map((childId) => nodeById.get(childId))
          .filter(Boolean) as AllNodeType[];

        children.forEach((child) => {
          if (!visited.has(child.id)) {
            nextLevelCandidates.add(child.id);
          }
        });
      });

      currentLevel = Array.from(nextLevelCandidates)
        .map((nodeId) => nodeById.get(nodeId))
        .filter(Boolean) as AllNodeType[];
      currentLevel.sort(sortNodesByPosition);
    }
  };

  const roots = sortedNodes.filter(
    (node) => (incoming.get(node.id)?.size ?? 0) === 0,
  );

  roots.forEach(walkTree);

  sortedNodes.forEach((node) => {
    if (!visited.has(node.id)) {
      walkTree(node);
    }
  });

  return orderedNodes;
};

export const layoutGroupHorizontally = (
  nodes: AllNodeType[],
  edges: EdgeType[],
  nodeIds: string[],
  options?: {
    columnGap?: number;
    rowGap?: number;
    padding?: number;
    anchor?: {
      x: number;
      y: number;
    };
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
  const anchorX = options?.anchor?.x ?? bounds?.x ?? 0;
  const anchorY = options?.anchor?.y ?? bounds?.y ?? 0;

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

export const layoutGroupGrid = (
  nodes: AllNodeType[],
  edges: EdgeType[],
  nodeIds: string[],
  options?: {
    columnGap?: number;
    rowGap?: number;
    padding?: number;
    preferredOrderNodeIds?: string[];
    anchor?: {
      x: number;
      y: number;
    };
  },
) => {
  const columnGap = options?.columnGap ?? 72;
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

  const orderedNodes = collectGridOrderedNodes(groupNodes, incoming, outgoing);
  const preferredOrderNodeIds = normalizeGroupNodeIds(
    options?.preferredOrderNodeIds ?? [],
    groupNodeSet,
  );
  const preferredOrderSet = new Set(preferredOrderNodeIds);
  const fallbackOrderNodeIds = orderedNodes.map((node) => node.id);
  const mergedOrderNodeIds = [
    ...preferredOrderNodeIds,
    ...fallbackOrderNodeIds.filter((nodeId) => !preferredOrderSet.has(nodeId)),
  ];
  const finalOrderNodeIds =
    mergedOrderNodeIds.length > 0 ? mergedOrderNodeIds : fallbackOrderNodeIds;
  const finalOrderedNodes = finalOrderNodeIds
    .map((nodeId) => nodeById.get(nodeId))
    .filter(Boolean) as AllNodeType[];

  if (finalOrderedNodes.length === 0) {
    return {
      nextNodes: nodes,
      bounds: null as FlowRect | null,
      orderedNodeIds: [] as string[],
    };
  }

  const totalNodes = finalOrderedNodes.length;
  const averageNodeWidth =
    finalOrderedNodes.reduce((sum, node) => sum + getNodeSize(node).width, 0) /
    totalNodes;
  const averageNodeHeight =
    finalOrderedNodes.reduce((sum, node) => sum + getNodeSize(node).height, 0) /
    totalNodes;
  const estimatedColumnCount = Math.max(
    1,
    Math.round(
      Math.sqrt((totalNodes * averageNodeHeight) / averageNodeWidth),
    ),
  );
  const columnCount = Math.min(totalNodes, estimatedColumnCount);
  const rowCount = Math.max(1, Math.ceil(totalNodes / columnCount));

  const rows = Array.from({ length: rowCount }, () => [] as AllNodeType[]);
  finalOrderedNodes.forEach((node, index) => {
    const rowIndex = Math.floor(index / columnCount);
    rows[rowIndex]?.push(node);
  });

  const columnWidths = Array.from({ length: columnCount }, (_, columnIndex) => {
    return rows.reduce((maxWidth, row) => {
      const node = row[columnIndex];
      if (!node) {
        return maxWidth;
      }

      return Math.max(maxWidth, getNodeSize(node).width);
    }, 0);
  });

  const rowHeights = rows.map((row) =>
    row.reduce(
      (maxHeight, node) => Math.max(maxHeight, getNodeSize(node).height),
      0,
    ),
  );

  const bounds = getGroupBounds(nodes, groupNodeIds, padding);
  const anchorX = options?.anchor?.x ?? bounds?.x ?? 0;
  const anchorY = options?.anchor?.y ?? bounds?.y ?? 0;

  const columnStarts = columnWidths.reduce<number[]>((starts, width, index) => {
    const previousStart = starts[index - 1];
    const previousWidth = columnWidths[index - 1] ?? 0;
    const nextStart =
      index === 0
        ? anchorX + padding
        : previousStart + previousWidth + columnGap;
    starts.push(nextStart);
    return starts;
  }, []);

  const rowStarts = rowHeights.reduce<number[]>((starts, height, index) => {
    const previousStart = starts[index - 1];
    const previousHeight = rowHeights[index - 1] ?? 0;
    const nextStart =
      index === 0
        ? anchorY + padding
        : previousStart + previousHeight + rowGap;
    starts.push(nextStart);
    return starts;
  }, []);

  const nextNodePositions = new Map<string, NodeOffset>();

  rows.forEach((row, rowIndex) => {
    row.forEach((node, columnIndex) => {
      nextNodePositions.set(node.id, {
        x: columnStarts[columnIndex] ?? anchorX + padding,
        y: rowStarts[rowIndex] ?? anchorY + padding,
      });
    });
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
    orderedNodeIds: finalOrderNodeIds,
  };
};
