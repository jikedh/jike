import { useCallback, useRef } from "react";
import type { AllNodeType, EdgeType } from "shared/types/flow";
import type { NodeType } from "shared/types/zustand/canvas-flow";
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
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

/** 运行时状态字段列表，复制时需要清除 */
const RUNTIME_FIELDS = ['status', 'isLoading', 'progress', 'error'] as const;

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
      const deepCopiedData = JSON.parse(JSON.stringify(node.data));
      // 清除运行时状态，避免 Loading 等状态被复制
      RUNTIME_FIELDS.forEach((field) => delete deepCopiedData[field]);
      return {
        originalId: node.id,
        type: node.type,
        position: { ...node.position },
        data: {
          ...deepCopiedData,
          createdAt: Date.now(),
        },
        ...(node.width !== undefined && { width: node.width }),
        ...(node.height !== undefined && { height: node.height }),
      };
    });

    const copiedEdges: CopiedEdgeTemplate[] = state.edges
      .filter((edge) => {
        const sourceSelected = selectedNodeIds.has(edge.source);
        const targetSelected = selectedNodeIds.has(edge.target);

        // 复制范围：
        // 1) 内部边（选中节点之间）
        // 2) 上游入边（未选中 source -> 选中 target）
        return (sourceSelected && targetSelected) || (!sourceSelected && targetSelected);
      })
      .map((edge) => ({
        originalSource: edge.source,
        originalTarget: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      }));

    copiedNodesRef.current = copiedNodes;
    copiedEdgesRef.current = copiedEdges;
    pasteCountRef.current = 0;
  }, []);

  const pasteNodes = useCallback(
    (mousePosition?: { x: number; y: number }) => {
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
          newPositionX = mousePosition.x + offsetX;
          newPositionY = mousePosition.y + offsetY;
        } else {
          const repeatOffset = pasteCount > 1 ? (pasteCount - 1) * REPEAT_OFFSET_X : 0;
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

      const existingEdgeKeys = new Set(
        state.edges.map(
          (edge) =>
            `${edge.source}:${edge.sourceHandle ?? "output"}->${edge.target}:${edge.targetHandle ?? "input"}`,
        ),
      );

      const newEdges: EdgeType[] = copiedEdges
        .map((edgeTemplate) => {
          const mappedSource = originalToNewIdMap.get(edgeTemplate.originalSource);
          const newTarget = originalToNewIdMap.get(edgeTemplate.originalTarget);

          // 上游入边场景：source 节点可能未被复制，允许回退到原 source
          const newSource = mappedSource ?? edgeTemplate.originalSource;

          if (!newSource || !newTarget) return null;

          const sourceHandle = edgeTemplate.sourceHandle ?? "output";
          const targetHandle = edgeTemplate.targetHandle ?? "input";
          const edgeKey = `${newSource}:${sourceHandle}->${newTarget}:${targetHandle}`;

          if (existingEdgeKeys.has(edgeKey)) {
            return null;
          }

          existingEdgeKeys.add(edgeKey);

          const uniqueSuffix =
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

          return {
            id: `edge-${newSource}-${newTarget}-${uniqueSuffix}`,
            source: newSource,
            target: newTarget,
            sourceHandle,
            targetHandle,
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
    },
    [],
  );

  return { copySelectedNodes, pasteNodes };
}
