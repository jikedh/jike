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

  // 确认对话框状态
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [generatingCount, setGeneratingCount] = useState(0);

  // 跟踪鼠标在画布上的位置，用于粘贴操作
  const [mouseFlowPosition, setMouseFlowPosition] = useState<{
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
    [undo, redo, canUndo, canRedo, copySelectedNodes],
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
  }, []);

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
  }, []);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
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
          mouseFlowPosition ??
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
            pasteNodes(mouseFlowPosition ?? undefined);
            return;
          }
        } catch {
          // not our data, ignore
        }
      }

      event.preventDefault();
      pasteNodes(mouseFlowPosition ?? undefined);
    };

    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [handleFiles, mouseFlowPosition, pasteNodes, screenToFlowPosition]);

  // 监听鼠标移动以更新画布上的鼠标位置
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      setMouseFlowPosition(position);
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [reactFlowInstance]);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
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
  }, [reactFlowInstance]);

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
    isDraggingRef.current = true;
  }, []);

  const handleNodeDragStop = useCallback(() => {
    isDraggingRef.current = false;

    // 从 ReactFlow 实例读取最新的节点状态
    const currentNodes = reactFlowInstance.getNodes() as AllNodeType[];
    const zustandStateNodes = useCanvasFlowStore.getState().nodes;

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
      const zustandNode = zustandStateNodes.find((n) => n.id === node.id);
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
  }, [reactFlowInstance, snapToGrid, snapGridSize, storeOnNodesChange]);

  // 点击画布空白区域时取消所有节点的选中状态
  const handlePaneClick = useCallback(() => {
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
  }, [storeOnNodesChange]);

  // 计算当前多选节点（仅在节点数组变化时更新）。
  const multiSelectedNodes = useMemo(
    () => displayNodes.filter((node) => node.selected),
    [displayNodes],
  );

  // 计算选区右侧中心点（流坐标）。
  const selectionRightCenterFlowPosition = useMemo(() => {
    if (multiSelectedNodes.length < 2) {
      return null;
    }

    let maxRight = Number.NEGATIVE_INFINITY;
    let minTop = Number.POSITIVE_INFINITY;
    let maxBottom = Number.NEGATIVE_INFINITY;

    multiSelectedNodes.forEach((node) => {
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

    return {
      // “+”出现在选区右侧，留一段固定偏移，避免贴边重叠。
      x: maxRight + 24,
      y: minTop + (maxBottom - minTop) / 2,
    };
  }, [multiSelectedNodes]);

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

  const handleViewportMove = useCallback((_: unknown, viewport: unknown) => {
    // 使用 unknown 避免在高频事件中引入额外类型噪音。
    setViewportState(viewport as { x: number; y: number; zoom: number });
  }, []);

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

  const openContextMenuAt = useCallback((x: number, y: number) => {
    setMenuScreenPosition({ x, y });
    const contextMenuEvent = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
    });
    contextMenuTriggerRef.current?.dispatchEvent(contextMenuEvent);
  }, []);

  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      pendingConnectRef.current = null;
      setMenuScreenPosition({ x: event.clientX, y: event.clientY });
    },
    [],
  );

  // 通过原生 dblclick 事件实现双击唤出菜单
  const handleNativeDblClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // 只响应点在画布空白区域（.react-flow__pane）上的双击
      const target = event.target as Element;
      if (target.closest(".react-flow__pane")) {
        // 阻止 ReactFlow 默认的双击缩放行为
        event.preventDefault();
        event.stopPropagation();
        openContextMenuAt(event.clientX, event.clientY);
      }
    },
    [openContextMenuAt],
  );

  const handleConnectStart = useCallback(
    (_: unknown, params: OnConnectStartParams) => {
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
    [],
  );

  const handleConnectEnd = useCallback(
    (
      event: MouseEvent | TouchEvent,
      connectionState: FinalConnectionState<InternalNode>,
    ) => {
      if (connectionState.isValid) {
        pendingConnectRef.current = null;
        return;
      }

      const pointer =
        "changedTouches" in event ? event.changedTouches[0] : event;
      if (!pointer) {
        pendingConnectRef.current = null;
        return;
      }

      const pendingConnect = pendingConnectRef.current;
      if (pendingConnect) {
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
            return;
          }
        }
      }

      openContextMenuAt(pointer.clientX, pointer.clientY);
    },
    [screenToFlowPosition, onConnect, openContextMenuAt],
  );

  const handleCreateNodeFromMenu = useCallback(
    (nodeType: CanvasNodeType) => {
      const flowPosition = screenToFlowPosition(menuScreenPosition);
      const newNodeId = addNode(nodeType, flowPosition);

      const pendingConnect = pendingConnectRef.current;
      if (!pendingConnect) {
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
    },
    [addNode, menuScreenPosition, onConnect, screenToFlowPosition],
  );

  // 按住“+”开始拖拽：显示预览连线；松手后在释放点打开类型菜单。
  const handleQuickAddPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (
        !selectionRightCenterScreenPosition ||
        multiSelectedNodes.length < 2
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      quickAddSelectionSnapshotRef.current = multiSelectedNodes.map(
        (node) => node.id,
      );

      const startX = selectionRightCenterScreenPosition.x;
      const startY = selectionRightCenterScreenPosition.y;

      setQuickAddDragPreview({
        active: true,
        startX,
        startY,
        endX: event.clientX,
        endY: event.clientY,
      });

      const handlePointerMove = (moveEvent: PointerEvent) => {
        setQuickAddDragPreview((prev) => ({
          ...prev,
          endX: moveEvent.clientX,
          endY: moveEvent.clientY,
        }));
      };

      const finishDrag = (endX: number, endY: number) => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerCancel);

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

        setQuickAddDragPreview((prev) => ({ ...prev, active: false }));
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerCancel);
    },
    [multiSelectedNodes, selectionRightCenterScreenPosition],
  );

  const handleQuickAddMenuOpenChange = useCallback((open: boolean) => {
    setQuickAddMenuOpen(open);
    if (!open) {
      setQuickAddMenuScreenPosition(null);
    }
  }, []);

  const handleCreateNodeFromQuickAddMenu = useCallback(
    (nodeType: CanvasNodeType) => {
      if (!quickAddMenuScreenPosition) {
        return;
      }

      const flowPosition = screenToFlowPosition(quickAddMenuScreenPosition);
      const newNodeId = addNode(nodeType, flowPosition);
      if (!newNodeId) {
        return;
      }

      const allNodes = useCanvasFlowStore.getState().nodes;
      const sourceNodeIds = quickAddSelectionSnapshotRef.current.filter((id) =>
        allNodes.some((node) => node.id === id),
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
    [addNode, onConnect, quickAddMenuScreenPosition, screenToFlowPosition],
  );

  return (
    <>
      <CanvasContextMenu onCreateNode={handleCreateNodeFromMenu}>
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
            onMove={handleViewportMove}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={!spacePressed}
            fitView
            minZoom={0.2}
            maxZoom={2}
            colorMode="dark"
            deleteKeyCode={["Backspace", "Delete"]}
            panOnDrag={spacePressed ? true : [1]}
            selectionOnDrag={!spacePressed}
            selectionMode={SelectionMode.Partial}
            multiSelectionKeyCode={["Shift"]}
            panOnScroll
            panOnScrollSpeed={0.5}
            zoomOnDoubleClick={false}
            zoomOnScroll
            zoomOnPinch={true}
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
              visible={multiSelectedNodes.length >= 2}
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
                width: "40px",
                height: "40px",
                left: `${quickAddDragPreview.endX}px`,
                top: `${quickAddDragPreview.endY}px`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="w-full h-full rounded-full bg-[#B43FEB] shadow-[0_0_20px_rgba(180,63,235,0.3)] border border-[#B43FEB]/60 flex items-center justify-center">
                <svg
                  width="20"
                  height="20"
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
