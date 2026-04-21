import {
  IconBrain,
  IconEye,
  IconMusic,
  IconNote,
  IconPhoto,
  IconSparkles,
  IconVideo,
} from "@tabler/icons-react";
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  type FinalConnectionState,
  type InternalNode,
  MiniMap,
  type NodeChange,
  type OnConnectStartParams,
  ReactFlow,
  SelectionMode,
  useReactFlow,
} from "@xyflow/react";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AllNodeType, EdgeType } from "shared/types/flow";
import { NodeSearch } from "@/components/node-search";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCopyPaste } from "@/hooks/useCopyPaste";
import { useDragUpload } from "@/hooks/useDragUpload";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";
import { edgeTypes, nodeTypes } from "../constants/canvasConfig";
import { CanvasContextMenu, type CanvasNodeType } from "./CanvasContextMenu";
import { DragOverlay } from "./DragOverlay";
import { MultiSelectQuickCreate } from "./MultiSelectQuickCreate";

const FALLBACK_NODE_WIDTH = 175;
const FALLBACK_NODE_HEIGHT = 175;

/**
 * 根据起点和终点绘制一条柔和的贝塞尔曲线。
 * 这里直接使用屏幕坐标，方便叠加到 fixed 覆盖层上。
 */
const buildConnectionPath = (
  startX: number,
  startY: number,
  endX: number,
  endY: number,
) => {
  const deltaX = Math.max(Math.abs(endX - startX) * 0.5, 80);
  const controlPointX = startX < endX ? startX + deltaX : startX - deltaX;

  return `M ${startX} ${startY} C ${controlPointX} ${startY}, ${controlPointX} ${endY}, ${endX} ${endY}`;
};

/**
 * 把线段的末端稍微往回缩一点，避免预览线直接顶到菜单或按钮中心。
 */
const shortenLineEnd = (
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  inset = 14,
) => {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const length = Math.hypot(deltaX, deltaY);

  if (!length || length <= inset) {
    return { x: endX, y: endY };
  }

  const ratio = (length - inset) / length;
  return {
    x: startX + deltaX * ratio,
    y: startY + deltaY * ratio,
  };
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

/**
 * 优先从 DOM 直接读取 handle 的真实屏幕坐标。
 * 这样可以避免仅根据节点宽高推算时，ghost 线落到节点内部。
 */
const getHandleScreenPosition = (
  nodeId: string,
  handleId: string | null,
  handleType: "source" | "target",
) => {
  if (typeof document === "undefined") {
    return null;
  }

  const normalizedHandleId =
    handleId ?? (handleType === "source" ? "output" : "input");
  const selector = `[data-nodeid="${nodeId}"][data-handleid="${normalizedHandleId}"]`;
  const handleElement = document.querySelector(selector) as HTMLElement | null;

  if (!handleElement) {
    return null;
  }

  const rect = handleElement.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
};

type CanvasFlowProps = {
  projectId: string | undefined;
  isMiniMapVisible: boolean;
};

// 画布流组件：仅负责 ReactFlow 相关状态与渲染。
export const CanvasFlow = ({
  projectId,
  isMiniMapVisible,
}: CanvasFlowProps) => {
  // 通过 zustand 读取图状态，避免业务动作散落在多个组件。
  // 注：nodes 和 edges 不在此订阅（高频变化），使用本地 displayNodes/displayEdges 和 getState() 获取
  const currentProjectId = useCanvasFlowStore((state) => state.projectId);
  const annotationWorkspace = useCanvasFlowStore(
    (state) => state.annotationWorkspace,
  );
  const storeOnNodesChange = useCanvasFlowStore((state) => state.onNodesChange);
  const onEdgesChange = useCanvasFlowStore((state) => state.onEdgesChange);
  const onConnect = useCanvasFlowStore((state) => state.onConnect);
  const addNode = useCanvasFlowStore((state) => state.addNode);
  const switchProject = useCanvasFlowStore((state) => state.switchProject);
  const gridVisible = useChatSettingsStore((state) => state.gridVisible);
  const snapToGrid = useChatSettingsStore((state) => state.snapToGrid);
  const snapGridSize = useChatSettingsStore((state) => state.snapGridSize);
  const nodeSearchVisible = useChatSettingsStore(
    (state) => state.nodeSearchVisible,
  );
  const reactFlowInstance = useReactFlow<AllNodeType, EdgeType>();
  const { screenToFlowPosition } = reactFlowInstance;
  const navigate = useNavigate();

  // 拖拽上传功能
  const {
    dragState,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFiles,
  } = useDragUpload();

  // 空格键按下状态，用于控制画布平移和光标
  const [spacePressed, setSpacePressed] = useState(false);
  const previousAnnotationViewportRef = useRef<{
    x: number;
    y: number;
    zoom: number;
  } | null>(null);
  const annotationWasOpenRef = useRef(false);
  const isAnnotationLocked = annotationWorkspace.open;

  // 确认对话框状态
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [generatingCount, setGeneratingCount] = useState(0);

  // 跟踪鼠标在画布上的位置（仅供事件处理读取），用 ref 避免 mousemove 导致整树重渲染。
  const mouseFlowPositionRef = useRef<{
    x: number;
    y: number;
  } | null>(null);

  // 获取正在生成的任务数量和取消方法
  const getGeneratingTasksCount = useCanvasFlowStore(
    (state) => state.getGeneratingTasksCount,
  );
  const cancelAllGeneratingTasks = useCanvasFlowStore(
    (state) => state.cancelAllGeneratingTasks,
  );

  // 获取撤销/重做方法（通过 useUndoRedo hook）
  const {
    undo,
    redo,
    canUndo,
    canRedo,
    saveToHistory,
    resetHistory,
    lastSavedVersionRef,
  } = useUndoRedo();

  // 获取复制/粘贴方法（通过 useCopyPaste hook）
  const { copySelectedNodes, pasteNodes } = useCopyPaste();

  // 处理键盘快捷键
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // 检查是否在输入框中
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (annotationWorkspace.open) {
        return;
      }

      // Ctrl+Z 或 Cmd+Z：撤销
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "z" &&
        !event.shiftKey
      ) {
        event.preventDefault();
        if (canUndo) {
          undo();
        }
      }

      // Ctrl+Shift+Z 或 Cmd+Shift+Z 或 Ctrl+Y：重做
      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key === "y" || (event.key === "z" && event.shiftKey))
      ) {
        event.preventDefault();
        if (canRedo) {
          redo();
        }
      }

      // Ctrl+C 或 Cmd+C：复制选中节点
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "c" &&
        !event.shiftKey
      ) {
        copySelectedNodes();
      }

      // Ctrl+V 或 Cmd+V：粘贴节点
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "v" &&
        !event.shiftKey
      ) {
        return;
      }
    },
    [
      undo,
      redo,
      canUndo,
      canRedo,
      copySelectedNodes,
      annotationWorkspace.open,
    ],
  );

  // 监听键盘事件
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  useEffect(() => {
    const handleCopy = (event: ClipboardEvent) => {
      if (annotationWorkspace.open) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isEditableTarget) return;

      const state = useCanvasFlowStore.getState();
      const selectedNodes = state.nodes.filter((n) => n.selected);
      if (selectedNodes.length === 0) return;

      event.preventDefault();
      event.clipboardData?.setData(
        "application/json",
        JSON.stringify({ type: "canvas-nodes", count: selectedNodes.length }),
      );
      event.clipboardData?.setData("text/plain", "");
    };

    document.addEventListener("copy", handleCopy);
    return () => {
      document.removeEventListener("copy", handleCopy);
    };
  }, [annotationWorkspace.open]);

  // 监听 store 的 historyVersion 变化，触发历史记录保存
  const historyVersion = useCanvasFlowStore((state) => state.historyVersion);
  const historyResetTrigger = useCanvasFlowStore(
    (state) => state.historyResetTrigger,
  );
  useEffect(() => {
    resetHistory();
    lastSavedVersionRef.current = 0;
  }, [historyResetTrigger, resetHistory]);

  useEffect(() => {
    if (historyVersion > 0 && historyVersion !== lastSavedVersionRef.current) {
      lastSavedVersionRef.current = historyVersion;
      saveToHistory();
    }
  }, [historyVersion, saveToHistory, lastSavedVersionRef]);

  // 画布光标交互：空格=抓手，Ctrl=放大镜，节点=小手，默认=箭头
  useEffect(() => {
    const reactFlowEl = document.querySelector(".react-flow");
    if (!reactFlowEl) return;

    let isSpacePressed = false;
    let isCtrlPressed = false;

    const updateCursorState = () => {
      if (annotationWorkspace.open) {
        reactFlowEl.removeAttribute("data-space-pressed");
        reactFlowEl.removeAttribute("data-ctrl-pressed");
        setSpacePressed(false);
        return;
      }

      if (isSpacePressed) {
        reactFlowEl.setAttribute("data-space-pressed", "true");
        reactFlowEl.removeAttribute("data-ctrl-pressed");
        setSpacePressed(true);
      } else if (isCtrlPressed) {
        reactFlowEl.setAttribute("data-ctrl-pressed", "true");
        reactFlowEl.removeAttribute("data-space-pressed");
        setSpacePressed(false);
      } else {
        reactFlowEl.removeAttribute("data-space-pressed");
        reactFlowEl.removeAttribute("data-ctrl-pressed");
        setSpacePressed(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (annotationWorkspace.open) {
        return;
      }

      if (e.code === "Space" && !isSpacePressed) {
        e.preventDefault();
        isSpacePressed = true;
        updateCursorState();
      }
      if ((e.ctrlKey || e.metaKey) && !isCtrlPressed) {
        isCtrlPressed = true;
        updateCursorState();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        isSpacePressed = false;
        updateCursorState();
      }
      if (!e.ctrlKey && !e.metaKey) {
        isCtrlPressed = false;
        updateCursorState();
      }
    };

    const onBlur = () => {
      isSpacePressed = false;
      isCtrlPressed = false;
      updateCursorState();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      reactFlowEl.removeAttribute("data-space-pressed");
      reactFlowEl.removeAttribute("data-ctrl-pressed");
    };
  }, [annotationWorkspace.open]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (annotationWorkspace.open) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      const files = Array.from(event.clipboardData?.items ?? [])
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);

      if (files.length > 0) {
        if (isEditableTarget) {
          return;
        }

        event.preventDefault();
        void handleFiles(
          files,
          mouseFlowPositionRef.current ??
          screenToFlowPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          }),
        );
        return;
      }

      if (isEditableTarget) {
        return;
      }

      const clipboardText = event.clipboardData?.getData("application/json");
      if (clipboardText) {
        try {
          const data = JSON.parse(clipboardText);
          if (data.type === "canvas-nodes") {
            event.preventDefault();
            pasteNodes(mouseFlowPositionRef.current ?? undefined);
            return;
          }
        } catch {
          // not our data, ignore
        }
      }

      event.preventDefault();
      pasteNodes(mouseFlowPositionRef.current ?? undefined);
    };

    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [annotationWorkspace.open, handleFiles, pasteNodes, screenToFlowPosition]);

  // 监听鼠标移动以更新画布上的鼠标位置
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      mouseFlowPositionRef.current = position;
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [reactFlowInstance]);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (annotationWorkspace.open) {
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();

        const { zoom: currentZoom, x, y } = reactFlowInstance.getViewport();
        const zoomStep = 0.15;
        const newZoom =
          event.deltaY < 0
            ? Math.min(currentZoom * (1 + zoomStep), 2)
            : Math.max(currentZoom * (1 - zoomStep), 0.1);

        const reactFlowBounds = (
          event.currentTarget as HTMLElement
        ).getBoundingClientRect();
        const mouseX = event.clientX - reactFlowBounds.left;
        const mouseY = event.clientY - reactFlowBounds.top;

        const zoomRatio = newZoom / currentZoom;

        const newX = mouseX - (mouseX - x) * zoomRatio;
        const newY = mouseY - (mouseY - y) * zoomRatio;

        reactFlowInstance.setViewport(
          {
            x: newX,
            y: newY,
            zoom: newZoom,
          },
          { duration: 100 },
        );
      }
    };

    const reactFlowContainer = document.querySelector(".react-flow");
    if (reactFlowContainer) {
      reactFlowContainer.addEventListener(
        "wheel",
        handleWheel as EventListener,
        { passive: false },
      );
    }

    return () => {
      if (reactFlowContainer) {
        reactFlowContainer.removeEventListener(
          "wheel",
          handleWheel as EventListener,
        );
      }
    };
  }, [annotationWorkspace.open, reactFlowInstance]);

  // 处理返回按钮点击
  const handleBackClick = useCallback(() => {
    const count = getGeneratingTasksCount();
    if (count > 0) {
      setGeneratingCount(count);
      setShowExitDialog(true);
    } else {
      navigate("/home");
    }
  }, [getGeneratingTasksCount, navigate]);

  // 确认退出
  const handleConfirmExit = useCallback(() => {
    cancelAllGeneratingTasks();
    setShowExitDialog(false);
    navigate("/home");
  }, [cancelAllGeneratingTasks, navigate]);

  // 取消退出
  const handleCancelExit = useCallback(() => {
    setShowExitDialog(false);
  }, []);

  // ==================== 拖动性能优化：本地 nodes 状态隔离 ====================
  //
  // 问题：ReactFlow 受控模式下，拖动时每帧调用 onNodesChange → Zustand set →
  //       CanvasFlow 重渲染（因为订阅了 zustandNodes） → React DevTools 跟踪
  //       每次重渲染开销 → 打开开发者工具时卡顿。
  //
  // 解法：维护本地 displayNodes 状态用于 ReactFlow 渲染：
  //   - 拖动时：只更新本地 displayNodes（视觉流畅），不写入 Zustand（不触发全局重渲染）
  //   - 拖动结束：同步最终位置到 Zustand（持久化）
  //   - 外部变更（添加/删除节点、图片生成结果等）：Zustand 变化时同步到 displayNodes

  // 初始化本地状态
  const [displayNodes, setDisplayNodes] = useState<AllNodeType[]>(
    () => useCanvasFlowStore.getState().nodes,
  );
  const [displayEdges, setDisplayEdges] = useState<EdgeType[]>(
    () => useCanvasFlowStore.getState().edges,
  );
  const [viewportState, setViewportState] = useState(() =>
    reactFlowInstance.getViewport(),
  );
  const viewportStateRef = useRef(reactFlowInstance.getViewport());
  const pendingViewportRef = useRef(reactFlowInstance.getViewport());
  const viewportRafRef = useRef<number | null>(null);
  const latestStoreNodesRef = useRef(useCanvasFlowStore.getState().nodes);
  const latestStoreEdgesRef = useRef(useCanvasFlowStore.getState().edges);
  // 用 ref 而非 state 追踪拖动状态，避免引发额外渲染
  const isDraggingRef = useRef(false);

  // 稳定 ReactFlow 对象型 props 的引用，避免每次 render 生成新对象导致子树无效更新
  const connectionLineStyle = useMemo(
    () => ({ stroke: "#B43FEB", strokeWidth: 2, fill: "none" }),
    [],
  );
  const defaultEdgeOptions = useMemo(
    () => ({
      type: "default",
      style: { stroke: "#B43FEB", strokeWidth: 2 },
      animated: false,
    }),
    [],
  );

  // 监听 Zustand 状态变化（外部变更如添加/删除节点、图片生成结果等）
  useEffect(() => {
    const unsubscribe = useCanvasFlowStore.subscribe((newState) => {
      // 只在非拖动时更新显示节点，并且仅在引用变化时 setState
      if (
        !isDraggingRef.current &&
        latestStoreNodesRef.current !== newState.nodes
      ) {
        latestStoreNodesRef.current = newState.nodes;
        setDisplayNodes(newState.nodes);
      }

      // 边数组仅在引用变化时更新，避免无效 setState
      if (latestStoreEdgesRef.current !== newState.edges) {
        latestStoreEdgesRef.current = newState.edges;
        setDisplayEdges(newState.edges);
      }
    });
    return unsubscribe;
  }, []);

  // 本地 onNodesChange：只负责更新 displayNodes，位置变更在拖动结束时处理
  const onNodesChange = useCallback(
    (changes: NodeChange<AllNodeType>[]) => {
      // 始终更新本地显示状态，保证拖动视觉流畅
      setDisplayNodes((prev) => applyNodeChanges(changes, prev));

      // 只处理非位置相关的变更（选中、删除等），位置变更在 handleNodeDragStop 中处理
      const nonPositionChanges = changes.filter((c) => c.type !== "position");
      if (nonPositionChanges.length > 0) {
        storeOnNodesChange(nonPositionChanges);
      }
    },
    [storeOnNodesChange],
  );

  const handleNodeDragStart = useCallback(() => {
    if (annotationWorkspace.open) {
      return;
    }
    isDraggingRef.current = true;
  }, [annotationWorkspace.open]);

  const handleNodeDragStop = useCallback(() => {
    if (annotationWorkspace.open) {
      return;
    }

    isDraggingRef.current = false;

    // 从 ReactFlow 实例读取最新的节点状态
    const currentNodes = reactFlowInstance.getNodes() as AllNodeType[];
    const zustandStateNodes = useCanvasFlowStore.getState().nodes;
    const zustandNodeById = new Map(
      zustandStateNodes.map((node) => [node.id, node]),
    );

    // 收集位置发生变化的节点
    const positionChanges: NodeChange<AllNodeType>[] = [];

    // 将节点位置对齐到网格点（当吸附开关开启时生效）
    const alignPositionToGrid = (position: { x: number; y: number }) => {
      if (!snapToGrid) {
        return position;
      }

      const [gridX, gridY] = snapGridSize;
      return {
        x: Math.round(position.x / gridX) * gridX,
        y: Math.round(position.y / gridY) * gridY,
      };
    };

    currentNodes.forEach((node) => {
      const alignedPosition = alignPositionToGrid(node.position);
      const zustandNode = zustandNodeById.get(node.id);
      if (
        zustandNode &&
        (zustandNode.position.x !== alignedPosition.x ||
          zustandNode.position.y !== alignedPosition.y)
      ) {
        positionChanges.push({
          id: node.id,
          type: "position",
          position: alignedPosition,
        });
      }
    });

    // 批量写入 Zustand
    if (positionChanges.length > 0) {
      storeOnNodesChange(positionChanges);
    }
  }, [
    annotationWorkspace.open,
    reactFlowInstance,
    snapToGrid,
    snapGridSize,
    storeOnNodesChange,
  ]);

  // 点击画布空白区域时取消所有节点的选中状态
  const handlePaneClick = useCallback(() => {
    if (annotationWorkspace.open) {
      return;
    }

    const allNodes = useCanvasFlowStore.getState().nodes;
    const selectedNodes = allNodes.filter((node) => node.selected);

    if (selectedNodes.length > 0) {
      const changes: NodeChange<AllNodeType>[] = selectedNodes.map((node) => ({
        id: node.id,
        type: "select",
        selected: false,
      }));
      storeOnNodesChange(changes);
    }
  }, [annotationWorkspace.open, storeOnNodesChange]);

  // 为高频读取场景建立节点索引，避免重复线性扫描。
  const displayNodeById = useMemo(() => {
    const nodeMap = new Map<string, AllNodeType>();
    displayNodes.forEach((node) => {
      nodeMap.set(node.id, node);
    });
    return nodeMap;
  }, [displayNodes]);

  const displayNodeIdSet = useMemo(() => {
    return new Set(displayNodes.map((node) => node.id));
  }, [displayNodes]);

  const annotationTargetNode = useMemo(() => {
    const sourceNodeId = annotationWorkspace.sourceNodeId;
    if (!annotationWorkspace.open || !sourceNodeId) {
      return null;
    }

    return displayNodeById.get(sourceNodeId) ?? null;
  }, [
    annotationWorkspace.open,
    annotationWorkspace.sourceNodeId,
    displayNodeById,
  ]);

  // 单次遍历完成多选统计：同时得到选中节点 id 列表与选区右侧中心点。
  const multiSelectedSummary = useMemo(() => {
    const selectedNodeIds: string[] = [];
    let maxRight = Number.NEGATIVE_INFINITY;
    let minTop = Number.POSITIVE_INFINITY;
    let maxBottom = Number.NEGATIVE_INFINITY;

    displayNodes.forEach((node) => {
      if (!node.selected) {
        return;
      }

      selectedNodeIds.push(node.id);

      const nodeWidth = node.width || 175;
      const nodeHeight = node.height || 175;
      const left = node.position.x;
      const top = node.position.y;
      const right = left + nodeWidth;
      const bottom = top + nodeHeight;

      if (right > maxRight) maxRight = right;
      if (top < minTop) minTop = top;
      if (bottom > maxBottom) maxBottom = bottom;
    });

    const count = selectedNodeIds.length;

    if (count < 2) {
      return {
        selectedNodeIds,
        count,
        selectionRightCenterFlowPosition: null,
      };
    }

    return {
      selectedNodeIds,
      count,
      selectionRightCenterFlowPosition: {
        // “+”出现在选区右侧，留一段固定偏移，避免贴边重叠。
        x: maxRight + 32,
        y: minTop + (maxBottom - minTop) / 2,
      },
    };
  }, [displayNodes]);

  const multiSelectedNodeIds = multiSelectedSummary.selectedNodeIds;
  const multiSelectedCount = multiSelectedSummary.count;
  const selectionRightCenterFlowPosition =
    multiSelectedSummary.selectionRightCenterFlowPosition;

  // 将流坐标转换为屏幕坐标，用于绝对定位浮动按钮。
  const selectionRightCenterScreenPosition = useMemo(() => {
    if (!selectionRightCenterFlowPosition) {
      return null;
    }

    return {
      x:
        selectionRightCenterFlowPosition.x * viewportState.zoom +
        viewportState.x,
      y:
        selectionRightCenterFlowPosition.y * viewportState.zoom +
        viewportState.y,
    };
  }, [selectionRightCenterFlowPosition, viewportState]);

  // 当 projectId 变化时切换项目
  useEffect(() => {
    if (projectId && projectId !== currentProjectId) {
      switchProject(projectId);
    }
  }, [projectId, currentProjectId, switchProject]);

  const contextMenuTriggerRef = useRef<HTMLDivElement | null>(null);
  const [menuScreenPosition, setMenuScreenPosition] = useState({ x: 0, y: 0 });
  const pendingConnectRef = useRef<{
    nodeId: string;
    handleId: string | null;
    handleType: "source" | "target";
  } | null>(null);
  const [connectionGhost, setConnectionGhost] = useState<{
    nodeId: string;
    handleId: string | null;
    handleType: "source" | "target";
  } | null>(null);
  const quickAddSelectionSnapshotRef = useRef<string[]>([]);
  const [quickAddDragPreview, setQuickAddDragPreview] = useState<{
    active: boolean;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
  });
  const [quickAddMenuOpen, setQuickAddMenuOpen] = useState(false);
  const [quickAddMenuScreenPosition, setQuickAddMenuScreenPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // 仅在叠加层需要跟随缩放/平移时，才追踪 viewport，避免 onMove 高频触发整树重渲染。
  const shouldTrackViewport =
    Boolean(selectionRightCenterFlowPosition) ||
    Boolean(connectionGhost) ||
    quickAddDragPreview.active ||
    Boolean(quickAddMenuOpen && quickAddMenuScreenPosition);

  // 使用 rAF 合帧更新 viewport 状态，避免每次 onMove 都 setState。
  const flushViewportState = useCallback(() => {
    viewportRafRef.current = null;
    const nextViewport = pendingViewportRef.current;
    const prevViewport = viewportStateRef.current;

    if (
      prevViewport.x === nextViewport.x &&
      prevViewport.y === nextViewport.y &&
      prevViewport.zoom === nextViewport.zoom
    ) {
      return;
    }

    viewportStateRef.current = nextViewport;
    setViewportState(nextViewport);
  }, []);

  const scheduleViewportState = useCallback(
    (nextViewport: { x: number; y: number; zoom: number }) => {
      pendingViewportRef.current = nextViewport;

      if (viewportRafRef.current !== null) {
        return;
      }

      viewportRafRef.current = window.requestAnimationFrame(flushViewportState);
    },
    [flushViewportState],
  );

  const handleViewportMove = useCallback(
    (_: unknown, viewport: unknown) => {
      // 使用 unknown 避免在高频事件中引入额外类型噪音。
      if (!shouldTrackViewport) {
        return;
      }

      scheduleViewportState(viewport as { x: number; y: number; zoom: number });
    },
    [scheduleViewportState, shouldTrackViewport],
  );

  // 当开始需要追踪 viewport 时，先同步一次最新值，避免出现位置跳变。
  useEffect(() => {
    if (!shouldTrackViewport) {
      return;
    }

    const latestViewport = reactFlowInstance.getViewport();
    viewportStateRef.current = latestViewport;
    pendingViewportRef.current = latestViewport;
    setViewportState(latestViewport);
  }, [reactFlowInstance, shouldTrackViewport]);

  // 组件卸载时清理 rAF，避免潜在内存泄漏。
  useEffect(() => {
    return () => {
      if (viewportRafRef.current !== null) {
        window.cancelAnimationFrame(viewportRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!annotationWorkspace.open) {
      if (!annotationWasOpenRef.current) {
        return;
      }

      annotationWasOpenRef.current = false;
      pendingConnectRef.current = null;
      setConnectionGhost(null);
      setQuickAddDragPreview({
        active: false,
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0,
      });
      setQuickAddMenuOpen(false);
      setQuickAddMenuScreenPosition(null);
      quickAddSelectionSnapshotRef.current = [];

      const previousViewport = previousAnnotationViewportRef.current;
      previousAnnotationViewportRef.current = null;
      if (previousViewport) {
        reactFlowInstance.setViewport(previousViewport, { duration: 260 });
      }
      return;
    }

    if (!annotationTargetNode) {
      return;
    }

    const allNodes = useCanvasFlowStore.getState().nodes;
    const selectedNodes = allNodes.filter((node) => node.selected);
    if (selectedNodes.length > 0) {
      storeOnNodesChange(
        selectedNodes.map((node) => ({
          id: node.id,
          type: "select" as const,
          selected: false,
        })),
      );
    }

    if (!annotationWasOpenRef.current) {
      previousAnnotationViewportRef.current = reactFlowInstance.getViewport();
      annotationWasOpenRef.current = true;
    }

    const viewportElement = document.querySelector(
      ".react-flow__viewport",
    ) as HTMLElement | null;
    const flowElement = document.querySelector(".react-flow") as HTMLElement | null;
    const bounds = flowElement?.getBoundingClientRect();
    const viewportWidth = bounds?.width ?? window.innerWidth;
    const viewportHeight = bounds?.height ?? window.innerHeight;

    const nodeWidth = annotationTargetNode.width ?? FALLBACK_NODE_WIDTH;
    const nodeHeight = annotationTargetNode.height ?? FALLBACK_NODE_HEIGHT;
    const targetZoom = clamp(
      Math.min((viewportWidth * 0.7) / nodeWidth, (viewportHeight * 0.64) / nodeHeight),
      0.45,
      1.85,
    );
    const centerX = annotationTargetNode.position.x + nodeWidth / 2;
    const centerY = annotationTargetNode.position.y + nodeHeight / 2;
    const offsetY = viewportHeight * 0.035;
    const nextViewport = {
      x: viewportWidth / 2 - centerX * targetZoom,
      y: viewportHeight / 2 - centerY * targetZoom + offsetY,
      zoom: targetZoom,
    };

    reactFlowInstance.setViewport(nextViewport, { duration: 280 });
    viewportStateRef.current = nextViewport;
    pendingViewportRef.current = nextViewport;
    setViewportState(nextViewport);
    viewportElement?.classList.add("transition-transform", "duration-300", "ease-out");
  }, [
    annotationTargetNode,
    annotationWorkspace.open,
    reactFlowInstance,
    storeOnNodesChange,
  ]);

  const openContextMenuAt = useCallback(
    (x: number, y: number) => {
      if (annotationWorkspace.open) {
        return;
      }

      setMenuScreenPosition({ x, y });
      const contextMenuEvent = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
      });
      contextMenuTriggerRef.current?.dispatchEvent(contextMenuEvent);
    },
    [annotationWorkspace.open],
  );

  useEffect(() => {
    const handler = (event: Event) => {
      if (annotationWorkspace.open) {
        return;
      }

      const detail = (event as CustomEvent<{ x: number; y: number }>).detail;
      if (!detail) {
        return;
      }
      openContextMenuAt(detail.x, detail.y);
    };
    window.addEventListener("jike:open-canvas-context-menu", handler);
    return () => {
      window.removeEventListener("jike:open-canvas-context-menu", handler);
    };
  }, [annotationWorkspace.open, openContextMenuAt]);

  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      if (annotationWorkspace.open) {
        event.preventDefault();
        return;
      }

      pendingConnectRef.current = null;
      setConnectionGhost(null);
      setMenuScreenPosition({ x: event.clientX, y: event.clientY });
    },
    [annotationWorkspace.open],
  );

  // 菜单关闭时，统一清理拖线状态，避免预览线残留。
  const handleCanvasContextMenuOpenChange = useCallback((open: boolean) => {
    if (open) {
      return;
    }

    pendingConnectRef.current = null;
    setConnectionGhost(null);
  }, []);

  // 通过原生 dblclick 事件实现双击唤出菜单
  const handleNativeDblClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (annotationWorkspace.open) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // 只响应点在画布空白区域（.react-flow__pane）上的双击
      const target = event.target as Element;
      if (target.closest(".react-flow__pane")) {
        // 阻止 ReactFlow 默认的双击缩放行为
        event.preventDefault();
        event.stopPropagation();
        openContextMenuAt(event.clientX, event.clientY);
      }
    },
    [annotationWorkspace.open, openContextMenuAt],
  );

  const handleConnectStart = useCallback(
    (_: unknown, params: OnConnectStartParams) => {
      if (annotationWorkspace.open) {
        pendingConnectRef.current = null;
        return;
      }

      if (!params?.nodeId || !params?.handleType) {
        pendingConnectRef.current = null;
        return;
      }

      pendingConnectRef.current = {
        nodeId: params.nodeId,
        handleId: params.handleId ?? null,
        handleType: params.handleType,
      };
    },
    [annotationWorkspace.open],
  );

  const handleConnectEnd = useCallback(
    (
      event: MouseEvent | TouchEvent,
      connectionState: FinalConnectionState<InternalNode>,
    ) => {
      if (annotationWorkspace.open) {
        pendingConnectRef.current = null;
        setConnectionGhost(null);
        return;
      }

      if (connectionState.isValid) {
        pendingConnectRef.current = null;
        setConnectionGhost(null);
        return;
      }

      const pointer =
        "changedTouches" in event ? event.changedTouches[0] : event;
      if (!pointer) {
        pendingConnectRef.current = null;
        setConnectionGhost(null);
        return;
      }

      const pendingConnect = pendingConnectRef.current;
      if (pendingConnect) {
        setConnectionGhost(pendingConnect);
        const allNodes = useCanvasFlowStore.getState().nodes;
        const pointerPos = screenToFlowPosition({
          x: pointer.clientX,
          y: pointer.clientY,
        });

        for (const targetNode of allNodes) {
          if (targetNode.id === pendingConnect.nodeId) continue;

          const nodeWidth = targetNode.width || 175;
          const nodeHeight = targetNode.height || 175;
          const nodeLeft = targetNode.position.x;
          const nodeRight = targetNode.position.x + nodeWidth;
          const nodeTop = targetNode.position.y;
          const nodeBottom = targetNode.position.y + nodeHeight;

          const isInsideNode =
            pointerPos.x >= nodeLeft &&
            pointerPos.x <= nodeRight &&
            pointerPos.y >= nodeTop &&
            pointerPos.y <= nodeBottom;

          if (isInsideNode) {
            const existingEdges = useCanvasFlowStore.getState().edges;
            const hasConnection = existingEdges.some(
              (edge) =>
                (edge.source === pendingConnect.nodeId &&
                  edge.target === targetNode.id) ||
                (edge.source === targetNode.id &&
                  edge.target === pendingConnect.nodeId),
            );

            if (!hasConnection) {
              if (pendingConnect.handleType === "source") {
                onConnect({
                  source: pendingConnect.nodeId,
                  sourceHandle: pendingConnect.handleId ?? "output",
                  target: targetNode.id,
                  targetHandle: "input",
                });
              } else {
                onConnect({
                  source: targetNode.id,
                  sourceHandle: "output",
                  target: pendingConnect.nodeId,
                  targetHandle: pendingConnect.handleId ?? "input",
                });
              }
            }

            pendingConnectRef.current = null;
            setConnectionGhost(null);
            return;
          }
        }
      }

      // 未命中节点时，保留虚拟连线并打开菜单。
      openContextMenuAt(pointer.clientX, pointer.clientY);
    },
    [annotationWorkspace.open, screenToFlowPosition, onConnect, openContextMenuAt],
  );

  const handleCreateNodeFromMenu = useCallback(
    (nodeType: CanvasNodeType) => {
      if (annotationWorkspace.open) {
        setConnectionGhost(null);
        return;
      }

      const flowPosition = screenToFlowPosition(menuScreenPosition);
      const newNodeId = addNode(nodeType, flowPosition);

      const pendingConnect = pendingConnectRef.current;
      if (!pendingConnect) {
        setConnectionGhost(null);
        return;
      }

      if (pendingConnect.handleType === "source") {
        onConnect({
          source: pendingConnect.nodeId,
          sourceHandle: pendingConnect.handleId ?? "output",
          target: newNodeId,
          targetHandle: "input",
        });
      } else {
        onConnect({
          source: newNodeId,
          sourceHandle: "output",
          target: pendingConnect.nodeId,
          targetHandle: pendingConnect.handleId ?? "input",
        });
      }

      pendingConnectRef.current = null;
      setConnectionGhost(null);
    },
    [annotationWorkspace.open, addNode, menuScreenPosition, onConnect, screenToFlowPosition],
  );

  // 菜单态预览线：根据拖线开始的节点和菜单位置，计算出一个稳定的显示路径。
  const connectionGhostPath = useMemo(() => {
    if (!connectionGhost) {
      return null;
    }

    const handleScreenPosition = getHandleScreenPosition(
      connectionGhost.nodeId,
      connectionGhost.handleId,
      connectionGhost.handleType,
    );

    if (!handleScreenPosition) {
      const sourceNode = displayNodeById.get(connectionGhost.nodeId);

      if (!sourceNode) {
        return null;
      }

      const nodeWidth = sourceNode.width ?? FALLBACK_NODE_WIDTH;
      const nodeHeight = sourceNode.height ?? FALLBACK_NODE_HEIGHT;
      const startFlowX =
        connectionGhost.handleType === "source"
          ? sourceNode.position.x + nodeWidth
          : sourceNode.position.x;
      const startFlowY = sourceNode.position.y + nodeHeight / 2;

      const startX = startFlowX * viewportState.zoom + viewportState.x;
      const startY = startFlowY * viewportState.zoom + viewportState.y;
      const endPoint = shortenLineEnd(
        startX,
        startY,
        menuScreenPosition.x,
        menuScreenPosition.y,
        16,
      );

      return buildConnectionPath(startX, startY, endPoint.x, endPoint.y);
    }

    const endPoint = shortenLineEnd(
      handleScreenPosition.x,
      handleScreenPosition.y,
      menuScreenPosition.x,
      menuScreenPosition.y,
      16,
    );

    return buildConnectionPath(
      handleScreenPosition.x,
      handleScreenPosition.y,
      endPoint.x,
      endPoint.y,
    );
  }, [
    connectionGhost,
    displayNodeById,
    menuScreenPosition.x,
    menuScreenPosition.y,
    viewportState,
  ]);

  // Quick Add 预览线：每个选中节点都绘制一条线，统一指向拖拽点或菜单落点。
  const quickAddConnectionPaths = useMemo(() => {
    const hasDragTarget = quickAddDragPreview.active;
    const hasMenuTarget = quickAddMenuOpen && quickAddMenuScreenPosition;

    if (!hasDragTarget && !hasMenuTarget) {
      return [];
    }

    const sourceNodeIds = quickAddSelectionSnapshotRef.current.filter((id) =>
      displayNodeIdSet.has(id),
    );

    if (sourceNodeIds.length === 0) {
      return [];
    }

    const targetX = hasDragTarget
      ? quickAddDragPreview.endX
      : (quickAddMenuScreenPosition?.x ?? 0);
    const targetY = hasDragTarget
      ? quickAddDragPreview.endY
      : (quickAddMenuScreenPosition?.y ?? 0);
    const inset = hasDragTarget ? 12 : 16;

    return sourceNodeIds
      .map((nodeId) => {
        const handleScreenPosition = getHandleScreenPosition(
          nodeId,
          "output",
          "source",
        );

        if (handleScreenPosition) {
          const endPoint = shortenLineEnd(
            handleScreenPosition.x,
            handleScreenPosition.y,
            targetX,
            targetY,
            inset,
          );

          return {
            nodeId,
            path: buildConnectionPath(
              handleScreenPosition.x,
              handleScreenPosition.y,
              endPoint.x,
              endPoint.y,
            ),
          };
        }

        const sourceNode = displayNodeById.get(nodeId);
        if (!sourceNode) {
          return null;
        }

        const nodeWidth = sourceNode.width ?? FALLBACK_NODE_WIDTH;
        const nodeHeight = sourceNode.height ?? FALLBACK_NODE_HEIGHT;
        const startFlowX = sourceNode.position.x + nodeWidth;
        const startFlowY = sourceNode.position.y + nodeHeight / 2;
        const startX = startFlowX * viewportState.zoom + viewportState.x;
        const startY = startFlowY * viewportState.zoom + viewportState.y;
        const endPoint = shortenLineEnd(startX, startY, targetX, targetY, inset);

        return {
          nodeId,
          path: buildConnectionPath(startX, startY, endPoint.x, endPoint.y),
        };
      })
      .filter(Boolean) as Array<{ nodeId: string; path: string }>;
  }, [
    displayNodeById,
    displayNodeIdSet,
    quickAddDragPreview.active,
    quickAddDragPreview.endX,
    quickAddDragPreview.endY,
    quickAddMenuOpen,
    quickAddMenuScreenPosition,
    viewportState,
  ]);

  // 按住“+”开始拖拽：显示预览连线；松手后在释放点打开类型菜单。
  const handleQuickAddPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (annotationWorkspace.open) {
        return;
      }

      if (
        !selectionRightCenterScreenPosition ||
        multiSelectedCount < 2
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      quickAddSelectionSnapshotRef.current = [...multiSelectedNodeIds];

      const startX = selectionRightCenterScreenPosition.x;
      const startY = selectionRightCenterScreenPosition.y;

      setQuickAddDragPreview({
        active: true,
        startX,
        startY,
        endX: event.clientX,
        endY: event.clientY,
      });

      // 拖拽预览采用 rAF 合帧，降低 pointermove 风暴下的 setState 频率。
      let pointerRafId: number | null = null;
      let latestPointerPoint = { x: event.clientX, y: event.clientY };

      const flushPointerMove = () => {
        pointerRafId = null;
        setQuickAddDragPreview((prev) => ({
          ...prev,
          endX: latestPointerPoint.x,
          endY: latestPointerPoint.y,
        }));
      };

      const schedulePointerMove = () => {
        if (pointerRafId !== null) {
          return;
        }

        pointerRafId = window.requestAnimationFrame(flushPointerMove);
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        latestPointerPoint = { x: moveEvent.clientX, y: moveEvent.clientY };
        schedulePointerMove();
      };

      const finishDrag = (endX: number, endY: number) => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerCancel);

        if (pointerRafId !== null) {
          window.cancelAnimationFrame(pointerRafId);
          pointerRafId = null;
        }

        setQuickAddDragPreview((prev) => ({
          ...prev,
          active: false,
          endX,
          endY,
        }));

        setQuickAddMenuScreenPosition({ x: endX, y: endY });
        setQuickAddMenuOpen(true);
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        finishDrag(upEvent.clientX, upEvent.clientY);
      };

      const handlePointerCancel = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerCancel);

        if (pointerRafId !== null) {
          window.cancelAnimationFrame(pointerRafId);
          pointerRafId = null;
        }

        setQuickAddDragPreview((prev) => ({ ...prev, active: false }));
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerCancel);
    },
    [
      annotationWorkspace.open,
      multiSelectedCount,
      multiSelectedNodeIds,
      selectionRightCenterScreenPosition,
    ],
  );

  const handleQuickAddMenuOpenChange = useCallback((open: boolean) => {
    setQuickAddMenuOpen(open);
    if (!open) {
      setQuickAddMenuScreenPosition(null);
      quickAddSelectionSnapshotRef.current = [];
    }
  }, []);

  const handleCreateNodeFromQuickAddMenu = useCallback(
    (nodeType: CanvasNodeType) => {
      if (annotationWorkspace.open) {
        return;
      }

      if (!quickAddMenuScreenPosition) {
        return;
      }

      const flowPosition = screenToFlowPosition(quickAddMenuScreenPosition);
      const newNodeId = addNode(nodeType, flowPosition);
      if (!newNodeId) {
        return;
      }

      const allNodes = useCanvasFlowStore.getState().nodes;
      const allNodeIdSet = new Set(allNodes.map((node) => node.id));
      const sourceNodeIds = quickAddSelectionSnapshotRef.current.filter((id) =>
        allNodeIdSet.has(id),
      );

      const existingEdges = useCanvasFlowStore.getState().edges;
      const edgeKeySet = new Set(
        existingEdges.map(
          (edge) =>
            `${edge.source}:${edge.sourceHandle ?? "output"}->${edge.target}:${edge.targetHandle ?? "input"}`,
        ),
      );

      sourceNodeIds.forEach((sourceId) => {
        if (sourceId === newNodeId) {
          return;
        }

        const edgeKey = `${sourceId}:output->${newNodeId}:input`;
        if (edgeKeySet.has(edgeKey)) {
          return;
        }

        edgeKeySet.add(edgeKey);
        onConnect({
          source: sourceId,
          sourceHandle: "output",
          target: newNodeId,
          targetHandle: "input",
        });
      });

      setQuickAddMenuOpen(false);
      setQuickAddMenuScreenPosition(null);
    },
    [
      annotationWorkspace.open,
      addNode,
      onConnect,
      quickAddMenuScreenPosition,
      screenToFlowPosition,
    ],
  );

  return (
    <>
      <CanvasContextMenu
        onCreateNode={handleCreateNodeFromMenu}
        onOpenChange={handleCanvasContextMenuOpenChange}
      >
        <div
          ref={contextMenuTriggerRef}
          className="h-full w-full relative"
          onDoubleClick={handleNativeDblClick}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="region"
          aria-label="Canvas drop zone"
        >
          {annotationWorkspace.open ? (
            <>
              <div className="pointer-events-none absolute inset-0 z-[9] bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.03)_0%,rgba(126,58,242,0.05)_14%,rgba(10,10,14,0.18)_32%,rgba(6,6,8,0.58)_100%)] backdrop-blur-[2px]" />
              <div className="pointer-events-none absolute inset-x-0 top-0 z-[9] h-32 bg-[linear-gradient(180deg,rgba(0,0,0,0.34)_0%,rgba(0,0,0,0)_100%)]" />
              <div className="pointer-events-none absolute bottom-0 left-1/2 z-[9] h-56 w-[46vw] -translate-x-1/2 rounded-full bg-[#B43FEB]/[0.05] blur-[120px]" />
            </>
          ) : null}

          {/* 菜单态虚拟连线：在拖线释放后保留连接感。 */}
          <svg
            className="pointer-events-none fixed inset-0 z-20 overflow-visible"
            aria-hidden="true"
          >
            {connectionGhostPath ? (
              <path
                d={connectionGhostPath}
                fill="none"
                stroke="#B43FEB"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.9}
              />
            ) : null}

            {quickAddConnectionPaths.map((item) => (
              <path
                key={`quick-add-ghost-${item.nodeId}`}
                d={item.path}
                fill="none"
                stroke="#B43FEB"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.72}
                strokeDasharray="8 6"
              />
            ))}
          </svg>

          <ReactFlow<AllNodeType, EdgeType>
            nodes={displayNodes}
            edges={displayEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={handleConnectStart}
            onPaneContextMenu={handlePaneContextMenu}
            onConnectEnd={handleConnectEnd}
            onNodeDragStart={handleNodeDragStart}
            onNodeDragStop={handleNodeDragStop}
            onPaneClick={handlePaneClick}
            onMove={shouldTrackViewport ? handleViewportMove : undefined}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={isAnnotationLocked ? false : !spacePressed}
            nodesConnectable={!isAnnotationLocked}
            nodesFocusable={!isAnnotationLocked}
            edgesFocusable={!isAnnotationLocked}
            elementsSelectable={!isAnnotationLocked}
            fitView
            minZoom={0.2}
            maxZoom={2}
            colorMode="dark"
            deleteKeyCode={isAnnotationLocked ? null : ["Backspace", "Delete"]}
            panOnDrag={isAnnotationLocked ? false : spacePressed ? true : [1]}
            selectionOnDrag={isAnnotationLocked ? false : !spacePressed}
            selectionMode={SelectionMode.Partial}
            multiSelectionKeyCode={["Shift"]}
            panOnScroll={!isAnnotationLocked}
            panOnScrollSpeed={0.5}
            zoomOnDoubleClick={false}
            zoomOnScroll={!isAnnotationLocked}
            zoomOnPinch={!isAnnotationLocked}
            preventScrolling={false}
            connectionLineStyle={connectionLineStyle}
            // 吸附开关与网格尺寸由设置中心驱动
            snapToGrid={snapToGrid}
            snapGrid={[20, 20]}
            connectionRadius={50}
            defaultEdgeOptions={defaultEdgeOptions}
          >
            {gridVisible && <Background variant={BackgroundVariant.Dots} />}
            {isMiniMapVisible ? (
              <MiniMap
                pannable
                zoomable
                position="bottom-left"
                style={{ left: "16px", bottom: "92px" }}
                nodeStrokeWidth={0}
                nodeColor="#B43FEB"
                maskColor="rgba(0,0,0,0.5)"
              />
            ) : null}
          </ReactFlow>

          {/* 节点搜索框 */}
          {nodeSearchVisible && (
            <div className="absolute top-4 right-4 z-10">
              <NodeSearch
                onSearch={(searchString) => {
                  const allNodes = useCanvasFlowStore.getState().nodes;
                  return allNodes.filter((node) =>
                    node.data?.promptDraft
                      ?.toLowerCase()
                      .includes(searchString.toLowerCase()),
                  );
                }}
              />
            </div>
          )}

          {/* 返回按钮 */}
          <div className="absolute top-4 left-4 z-10">
            <Button
              variant="default"
              size="sm"
              onClick={handleBackClick}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="size-4" />
              返回
            </Button>
          </div>

          {/* 多选右侧快捷创建按钮（拖拽时隐藏，改用跟踪图标） */}
          {selectionRightCenterScreenPosition && !quickAddDragPreview.active ? (
            <MultiSelectQuickCreate
              visible={multiSelectedCount >= 2}
              x={selectionRightCenterScreenPosition.x}
              y={selectionRightCenterScreenPosition.y}
              onPointerDown={handleQuickAddPointerDown}
            />
          ) : null}

          {/* 拖拽时跟踪光标的 + 符号 */}
          {quickAddDragPreview.active ? (
            <div
              className="fixed z-20 pointer-events-none"
              style={{
                width: "34px",
                height: "34px",
                left: `${quickAddDragPreview.endX}px`,
                top: `${quickAddDragPreview.endY}px`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="w-full h-full rounded-full bg-[#B43FEB] shadow-[0_0_20px_rgba(180,63,235,0.3)] border border-[#B43FEB]/60 flex items-center justify-center">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
            </div>
          ) : null}

          {/* 释放点节点类型菜单（用于批量连线创建） */}
          {quickAddMenuScreenPosition ? (
            <DropdownMenu
              open={quickAddMenuOpen}
              onOpenChange={handleQuickAddMenuOpenChange}
            >
              <DropdownMenuTrigger asChild>
                <div
                  className="absolute size-2"
                  style={{
                    left: `${quickAddMenuScreenPosition.x}px`,
                    top: `${quickAddMenuScreenPosition.y}px`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={6}
                className="w-52 bg-[#121214] border border-white/10 rounded-xl shadow-2xl overflow-hidden p-1"
              >
                <DropdownMenuLabel className="text-white/70 text-xs font-medium px-3 py-2">
                  创建并连接到新节点
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/5 h-px" />

                <DropdownMenuItem
                  className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer"
                  onSelect={() => handleCreateNodeFromQuickAddMenu("note")}
                >
                  <IconNote size={16} />
                  新建便签节点
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer"
                  onSelect={() => handleCreateNodeFromQuickAddMenu("image")}
                >
                  <IconPhoto size={16} />
                  新建图片节点
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer"
                  onSelect={() => handleCreateNodeFromQuickAddMenu("video")}
                >
                  <IconVideo size={16} />
                  新建视频节点
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer"
                  onSelect={() => handleCreateNodeFromQuickAddMenu("audio")}
                >
                  <IconMusic size={16} />
                  新建音频节点
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer"
                  onSelect={() => handleCreateNodeFromQuickAddMenu("panorama")}
                >
                  <IconEye size={16} />
                  新建全景图节点
                </DropdownMenuItem>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer">
                    <IconSparkles size={16} />
                    智能体
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-44 bg-[#121214] border border-white/10 rounded-xl shadow-2xl overflow-hidden p-1">
                    <DropdownMenuItem
                      className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer"
                      onSelect={() =>
                        handleCreateNodeFromQuickAddMenu("textAgent")
                      }
                    >
                      <IconBrain size={15} />
                      文本智能体
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer"
                      onSelect={() =>
                        handleCreateNodeFromQuickAddMenu("imageAgent")
                      }
                    >
                      <IconPhoto size={15} />
                      图片智能体
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer"
                      onSelect={() =>
                        handleCreateNodeFromQuickAddMenu("videoAgent")
                      }
                    >
                      <IconVideo size={15} />
                      视频智能体
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </CanvasContextMenu>

      {/* 拖拽上传遮罩 */}
      <DragOverlay
        isVisible={dragState.isDragging}
        fileCount={dragState.fileCount}
        acceptedTypes={dragState.acceptedTypes}
      />

      {/* 确认退出对话框 */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="bg-[#1a1a1f] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white">
              确认离开
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-400">
              目前有{" "}
              <span className="font-semibold text-[#B43FEB]">
                {generatingCount}
              </span>{" "}
              个正在生成的任务，离开后这些任务将取消生成。
            </p>
            <p className="text-sm text-gray-400 mt-2">确定要离开吗？</p>
          </div>
          <DialogFooter className="border-white/10">
            <Button
              variant="default"
              size="sm"
              onClick={handleCancelExit}
              className="border border-white/10 bg-transparent hover:bg-white/5 text-gray-300"
            >
              取消
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleConfirmExit}
              className="bg-[#B43FEB] hover:bg-[#B43FEB]/80 text-white"
            >
              确认离开
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
