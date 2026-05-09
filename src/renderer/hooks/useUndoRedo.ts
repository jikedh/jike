import { useCallback, useEffect, useRef, useState } from "react";
import type { CanvasPersistedState } from "shared/types/zustand/canvas-flow";
import {
  buildCanvasPersistedState,
  hydrateCanvasNodesForRuntime,
  useCanvasFlowStore,
} from "@/stores/canvasFlowStore";
import {
  registerCanvasHistorySaver,
  unregisterCanvasHistorySaver,
} from "@/utils/canvasHistoryBridge";

const MAX_HISTORY_SIZE = 50;

export function useUndoRedo() {
  const historyRef = useRef<CanvasPersistedState[]>([]);
  const historyIndexRef = useRef(-1);
  const lastSavedVersionRef = useRef(0);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateFlags = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  const saveToHistory = useCallback(() => {
    const state = useCanvasFlowStore.getState();
    const { nodes, edges, groups, nodeIdCounters } = state;

    const entry: CanvasPersistedState = buildCanvasPersistedState({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      groups: JSON.parse(JSON.stringify(groups)),
      nodeIdCounters: { ...nodeIdCounters },
    });

    const currentHistory = historyRef.current;
    const currentIndex = historyIndexRef.current;

    const newHistory =
      currentIndex < currentHistory.length - 1
        ? currentHistory.slice(0, currentIndex + 1)
        : [...currentHistory];

    newHistory.push(entry);

    if (newHistory.length > MAX_HISTORY_SIZE) {
      newHistory.shift();
    }

    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
    updateFlags();
  }, [updateFlags]);

  useEffect(() => {
    registerCanvasHistorySaver(saveToHistory);
    return () => {
      unregisterCanvasHistorySaver(saveToHistory);
    };
  }, [saveToHistory]);

  const resetHistory = useCallback(() => {
    historyRef.current = [];
    historyIndexRef.current = -1;
    updateFlags();
  }, [updateFlags]);

  const undo = useCallback(async () => {
    if (historyIndexRef.current <= 0) return;

    const newIndex = historyIndexRef.current - 1;
    const entry = historyRef.current[newIndex];
    const hydratedNodes = await hydrateCanvasNodesForRuntime(
      JSON.parse(JSON.stringify(entry.nodes)),
    );

    useCanvasFlowStore.setState({
      nodes: hydratedNodes,
      edges: JSON.parse(JSON.stringify(entry.edges)),
      groups: JSON.parse(JSON.stringify(entry.groups)),
      nodeIdCounters: { ...entry.nodeIdCounters },
      selectedGroupId: null,
      selectedNodesCount: hydratedNodes.filter((node) => node.selected).length,
    });

    historyIndexRef.current = newIndex;
    updateFlags();
  }, [updateFlags]);

  const redo = useCallback(async () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;

    const newIndex = historyIndexRef.current + 1;
    const entry = historyRef.current[newIndex];
    const hydratedNodes = await hydrateCanvasNodesForRuntime(
      JSON.parse(JSON.stringify(entry.nodes)),
    );

    useCanvasFlowStore.setState({
      nodes: hydratedNodes,
      edges: JSON.parse(JSON.stringify(entry.edges)),
      groups: JSON.parse(JSON.stringify(entry.groups)),
      nodeIdCounters: { ...entry.nodeIdCounters },
      selectedGroupId: null,
      selectedNodesCount: hydratedNodes.filter((node) => node.selected).length,
    });

    historyIndexRef.current = newIndex;
    updateFlags();
  }, [updateFlags]);

  return {
    saveToHistory,
    resetHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    lastSavedVersionRef,
  };
}
