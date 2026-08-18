import { useCallback, useEffect, useRef, useState } from "react";
import type { CanvasPersistedState } from "shared/types/zustand/canvas-flow";
import {
  buildCanvasPersistedState,
  hydrateCanvasNodesForRuntime,
  normalizeCanvasNodeIdCounters,
  useCanvasFlowStore,
} from "@/stores/canvasFlowStore";
import {
  registerCanvasHistorySaver,
  unregisterCanvasHistorySaver,
} from "@/utils/canvasHistoryBridge";

const MAX_HISTORY_SIZE = 50;

type HistorySource = Pick<
  CanvasPersistedState,
  "nodes" | "edges" | "groups" | "nodeIdCounters"
>;

export function useUndoRedo() {
  const historyRef = useRef<CanvasPersistedState[]>([]);
  const historyIndexRef = useRef(-1);
  const lastSavedVersionRef = useRef(0);
  const pendingHistoryRef = useRef<HistorySource[]>([]);
  const historyIdleIdRef = useRef<number | null>(null);
  const historyTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(
    null,
  );

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateFlags = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  const commitHistoryEntry = useCallback((source: HistorySource) => {
    const entry: CanvasPersistedState = buildCanvasPersistedState({
      nodes: JSON.parse(JSON.stringify(source.nodes)),
      edges: JSON.parse(JSON.stringify(source.edges)),
      groups: JSON.parse(JSON.stringify(source.groups)),
      nodeIdCounters: { ...source.nodeIdCounters },
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

  const cancelScheduledHistory = useCallback(() => {
    if (historyIdleIdRef.current !== null) {
      window.cancelIdleCallback(historyIdleIdRef.current);
      historyIdleIdRef.current = null;
    }
    if (historyTimerRef.current !== null) {
      globalThis.clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
    }
  }, []);

  const flushPendingHistory = useCallback(() => {
    cancelScheduledHistory();
    const pendingHistory = pendingHistoryRef.current;
    pendingHistoryRef.current = [];
    pendingHistory.forEach(commitHistoryEntry);
  }, [cancelScheduledHistory, commitHistoryEntry]);

  const schedulePendingHistory = useCallback(() => {
    if (
      historyIdleIdRef.current !== null ||
      historyTimerRef.current !== null
    ) {
      return;
    }

    const flushNextEntry = () => {
      historyIdleIdRef.current = null;
      historyTimerRef.current = null;
      const source = pendingHistoryRef.current.shift();
      if (source) {
        commitHistoryEntry(source);
      }
      if (pendingHistoryRef.current.length > 0) {
        schedulePendingHistory();
      }
    };

    if ("requestIdleCallback" in window) {
      historyIdleIdRef.current = window.requestIdleCallback(flushNextEntry, {
        timeout: 500,
      });
      return;
    }

    historyTimerRef.current = globalThis.setTimeout(flushNextEntry, 0);
  }, [commitHistoryEntry]);

  const saveToHistory = useCallback(() => {
    const { nodes, edges, groups, nodeIdCounters } =
      useCanvasFlowStore.getState();
    pendingHistoryRef.current.push({ nodes, edges, groups, nodeIdCounters });
    if (pendingHistoryRef.current.length > MAX_HISTORY_SIZE) {
      pendingHistoryRef.current.shift();
    }
    schedulePendingHistory();
  }, [schedulePendingHistory]);

  useEffect(() => {
    registerCanvasHistorySaver(saveToHistory);
    return () => {
      unregisterCanvasHistorySaver(saveToHistory);
      cancelScheduledHistory();
      pendingHistoryRef.current = [];
    };
  }, [cancelScheduledHistory, saveToHistory]);

  const resetHistory = useCallback(() => {
    cancelScheduledHistory();
    pendingHistoryRef.current = [];
    historyRef.current = [];
    historyIndexRef.current = -1;
    updateFlags();
  }, [cancelScheduledHistory, updateFlags]);

  const undo = useCallback(async () => {
    flushPendingHistory();
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
      nodeIdCounters: normalizeCanvasNodeIdCounters(
        entry.nodeIdCounters,
        hydratedNodes,
      ),
      selectedGroupId: null,
      selectedNodesCount: hydratedNodes.filter((node) => node.selected).length,
    });

    historyIndexRef.current = newIndex;
    updateFlags();
  }, [flushPendingHistory, updateFlags]);

  const redo = useCallback(async () => {
    flushPendingHistory();
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
      nodeIdCounters: normalizeCanvasNodeIdCounters(
        entry.nodeIdCounters,
        hydratedNodes,
      ),
      selectedGroupId: null,
      selectedNodesCount: hydratedNodes.filter((node) => node.selected).length,
    });

    historyIndexRef.current = newIndex;
    updateFlags();
  }, [flushPendingHistory, updateFlags]);

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
