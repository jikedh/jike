import type { Connection, EdgeChange, NodeChange } from "@xyflow/react";
import type { AgentPresetId } from "shared/constants/agent-presets";
import type {
  AllNodeType,
  AudioGenerationNode,
  EdgeType,
  ImageGenerationNode,
  VideoGenerationNode,
} from "shared/types/flow";

/**
 * Canvas 持久化状态定义（内部用，不参与 data+setter 配对）。
 */
export type CanvasPersistedState = {
  version: number;
  savedAt: number;
  nodes: AllNodeType[];
  edges: EdgeType[];
  nodeIdCounters: {
    note: number;
    image: number;
    video: number;
    agent: number;
    panorama: number;
    audio: number;
    table: number;
  };
};

/**
 * 画布支持的节点类型标识。
 */
export type NodeType =
  | "note"
  | "image"
  | "video"
  | "agent"
  | "panorama"
  | "audio"
  | "textAgent"
  | "imageAgent"
  | "videoAgent"
  | "table";

/**
 * 节点坐标。
 */
export type NodePosition = {
  x: number;
  y: number;
};

/**
 * 新建节点时的可选参数。
 */
export type AddNodeOptions = {
  agentPresetId?: AgentPresetId;
  initialWidth?: number;
  initialHeight?: number;
  initialContent?: string;
  tableTitle?: string;
  tableRows?: unknown[];
};

/**
 * CanvasFlow Store 类型定义（data + 方法配对结构）。
 */
export type CanvasFlowStoreType = {
  // ── 数据字段 ──────────────────────────────────
  nodes: AllNodeType[];
  edges: EdgeType[];
  highlightedEdgeIds: string[];
  highlightedSourceNodeIds: string[];
  referenceHoverRefCounts: Record<string, number>;
  nodeIdCounters: {
    note: number;
    image: number;
    video: number;
    agent: number;
    panorama: number;
    audio: number;
    table: number;
  };
  hydrated: boolean;
  projectId: string | null;
  panoramaViewer: {
    open: boolean;
    imageUrl: string | null;
    sourceNodeId: string | null;
  };
  clipboard: AllNodeType | null;
  history: CanvasPersistedState[];
  historyIndex: number;
  maxHistorySize: number;
  // 选中的节点数量（用于避免 O(n²) 遍历计算）
  selectedNodesCount: number;

  // ── 配对 setter ───────────────────────────────
  setNodes: (nodes: AllNodeType[]) => void;
  setEdges: (edges: EdgeType[]) => void;
  setHighlightedEdgeIds: (ids: string[]) => void;
  setHighlightedSourceNodeIds: (ids: string[]) => void;
  setNodeIdCounters: (counters: {
    note: number;
    image: number;
    video: number;
    agent: number;
    panorama: number;
    audio: number;
    table: number;
  }) => void;
  setHydrated: (hydrated: boolean) => void;
  setProjectId: (projectId: string | null) => void;
  setPanoramaViewer: (viewer: {
    open: boolean;
    imageUrl: string | null;
    sourceNodeId: string | null;
  }) => void;
  setClipboard: (clipboard: AllNodeType | null) => void;
  setHistory: (history: CanvasPersistedState[]) => void;
  setHistoryIndex: (index: number) => void;
  setSelectedNodesCount: (count: number) => void;

  // ── 基础流程事件 ──────────────────────────────
  onNodesChange: (changes: NodeChange<AllNodeType>[]) => void;
  onEdgesChange: (changes: EdgeChange<EdgeType>[]) => void;
  onConnect: (connection: Connection) => void;

  // ── 持久化操作 ────────────────────────────────
  switchProject: (projectId: string) => Promise<void>;
  saveGraph: () => void;
  hydrateGraph: (projectId: string) => void;
  resetToSavedGraph: () => void;
  clearCanvas: () => void;

  // ── 导入导出 ─────────────────────────────────
  exportCanvasData: () => CanvasPersistedState;
  importCanvasData: (data: CanvasPersistedState) => void;

  // ── 节点操作 ─────────────────────────────────
  getNextNodeId: (nodeType: NodeType) => string;
  addNode: (
    nodeType: NodeType,
    position?: NodePosition,
    options?: AddNodeOptions,
  ) => string;
  deleteEdge: (edgeId: string) => void;
  duplicateNode: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;

  // ── 便签节点 ─────────────────────────────────
  setNoteNodeEditing: (nodeId: string, isEditing: boolean) => void;
  updateNoteNodeContent: (nodeId: string, content: string) => void;
  resizeNoteNode: (nodeId: string, width: number, height: number) => void;

  // ── 各类型节点数据更新 ─────────────────────────
  updateImageNodeData: (
    nodeId: string,
    patch: Partial<ImageGenerationNode>,
  ) => void;
  updateVideoNodeData: (
    nodeId: string,
    patch: Partial<VideoGenerationNode>,
  ) => void;
  updateAudioNodeData: (
    nodeId: string,
    patch: Partial<AudioGenerationNode>,
  ) => void;
  updateTextAgentNodeData: (
    nodeId: string,
    patch: Record<string, unknown>,
  ) => void;
  updateTableNodeData: (nodeId: string, patch: Record<string, unknown>) => void;

  // ── 图片生成 ─────────────────────────────────
  startImageGeneration: (nodeId: string, payload: any) => Promise<void>;
  stopImagePolling: (nodeId: string) => void;
  startGeminiPro2Generation: (nodeId: string, payload: any) => Promise<void>;
  splitImage: (nodeId: string, gridSize: number) => void;
  separateToNodes: (nodeId: string) => void;

  // ── 视频生成 ─────────────────────────────────
  startVideoGeneration: (nodeId: string, payload: any) => Promise<void>;
  stopVideoPolling: (nodeId: string) => void;

  // ── 任务管理 ─────────────────────────────────
  getGeneratingTasksCount: () => number;
  cancelAllGeneratingTasks: () => void;

  // ── 撤销/重做 ────────────────────────────────
  saveToHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // ── 全景图查看器 ─────────────────────────────
  openPanoramaViewer: (imageUrl: string, sourceNodeId?: string) => void;
  closePanoramaViewer: () => void;

  // ── 剪贴板 ─────────────────────────────────
  copySelectedNode: () => void;
  pasteNode: () => void;
  canPaste: () => boolean;

  // ── 参考高亮 ────────────────────────────────
  setReferenceHoverHighlight: (
    sourceNodeId: string,
    targetNodeId: string,
    isHovering: boolean,
  ) => void;
  clearReferenceHoverHighlights: () => void;
};
