import { useCallback, useRef, useState } from "react";
import type { CanvasPersistedState } from "shared/types/zustand/canvas-flow";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

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
    const { nodes, edges, nodeIdCounters } = state;

    const entry: CanvasPersistedState = {
      version: 1,
      savedAt: Date.now(),
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      nodeIdCounters: { ...nodeIdCounters },
    };

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

  const resetHistory = useCallback(() => {
    historyRef.current = [];
    historyIndexRef.current = -1;
    updateFlags();
  }, [updateFlags]);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;

    const newIndex = historyIndexRef.current - 1;
    const entry = historyRef.current[newIndex];

    useCanvasFlowStore.setState({
      nodes: JSON.parse(JSON.stringify(entry.nodes)),
      edges: JSON.parse(JSON.stringify(entry.edges)),
      nodeIdCounters: { ...entry.nodeIdCounters },
    });

    historyIndexRef.current = newIndex;
    updateFlags();
  }, [updateFlags]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;

    const newIndex = historyIndexRef.current + 1;
    const entry = historyRef.current[newIndex];

    useCanvasFlowStore.setState({
      nodes: JSON.parse(JSON.stringify(entry.nodes)),
      edges: JSON.parse(JSON.stringify(entry.edges)),
      nodeIdCounters: { ...entry.nodeIdCounters },
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
