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
  ViewportPortal,
} from "@xyflow/react";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GenerationStatus } from "shared/constants/enum";
import type { AllNodeType, EdgeType } from "shared/types/flow";
import {
  getGroupBounds,
  getGroupBoundsFromNodeMap,
} from "shared/utils/canvasGroups";
import { cn } from "shared/utils/utils";
import { toast } from "sonner";
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
import {
  CANVAS_DELETE_CONFIRM_EVENT,
  type CanvasDeleteConfirmDetail,
} from "@/pages/Canvas/utils/deleteConfirm";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";
import { edgeTypes, nodeTypes } from "../constants/canvasConfig";
import { CanvasContextMenu, type CanvasNodeType } from "./CanvasContextMenu";
import { CanvasBatchToolbar } from "./CanvasBatchToolbar";
import { DragOverlay } from "./DragOverlay";
import { MultiSelectQuickCreate } from "./MultiSelectQuickCreate";

const FALLBACK_NODE_WIDTH = 175;
const FALLBACK_NODE_HEIGHT = 175;
const MIN_CANVAS_ZOOM = 0.05;
const MAX_CANVAS_ZOOM = 2;
const DEFAULT_OPEN_ZOOM = 0.67;
const STORE_NODE_CHANGE_THROTTLE_MS = 70;

/**
 * 鏍规嵁璧风偣鍜岀粓鐐圭粯鍒朵竴鏉℃煍鍜岀殑璐濆灏旀洸绾裤€?
 * 杩欓噷鐩存帴浣跨敤灞忓箷鍧愭爣锛屾柟渚垮彔鍔犲埌 fixed 瑕嗙洊灞備笂銆?
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
 * 鎶婄嚎娈电殑鏈绋嶅井寰€鍥炵缉涓€鐐癸紝閬垮厤棰勮绾跨洿鎺ラ《鍒拌彍鍗曟垨鎸夐挳涓績銆?
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

const DELETE_CONFIRM_NODE_LABEL: Partial<Record<AllNodeType["type"], string>> =
  {
    imageNode: "图片节点",
    videoNode: "视频节点",
    newVideoNode: "新版视频节点",
    agentNode: "智能体节点",
    textAgentNode: "文本智能体节点",
    imageAgentNode: "图片智能体节点",
    videoAgentNode: "视频智能体节点",
  };

const getCanvasNodeTypeFromFlowNode = (
  node: AllNodeType | undefined,
): CanvasNodeType | null => {
  if (!node) {
    return null;
  }

  if (node.type === "imageNode") {
    return "image";
  }

  if (node.type === "videoNode" || node.type === "newVideoNode") {
    return "video";
  }

  if (node.type === "audioNode") {
    return "audio";
  }

  return null;
};

const canPassMediaToNodeType = (
  sourceNode: AllNodeType | undefined,
  targetNodeType: CanvasNodeType | null,
) => {
  const sourceNodeType = getCanvasNodeTypeFromFlowNode(sourceNode);

  if (!sourceNodeType || !targetNodeType) {
    return false;
  }

  if (targetNodeType === "image") {
    return sourceNodeType === "image";
  }

  if (targetNodeType === "video" || targetNodeType === "newVideo") {
    return (
      sourceNodeType === "image" ||
      sourceNodeType === "video" ||
      sourceNodeType === "audio"
    );
  }

  return false;
};

const needsGeneratingDeleteConfirm = (node: AllNodeType) => {
  if (!(node.type in DELETE_CONFIRM_NODE_LABEL)) {
    return false;
  }

  const status = (node.data as { status?: string })?.status;
  return (
    status === GenerationStatus.IN_PROGRESS ||
    status === GenerationStatus.QUEUED ||
    status === "generating"
  );
};

const isEditableEventTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable ||
    Boolean(target.closest('[contenteditable="true"], [role="textbox"]'))
  );
};

const isMacOs = () => {
  return (
    typeof navigator !== "undefined" && navigator.userAgent.includes("Mac")
  );
};

const scheduleIdleWork = (callback: () => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  if ("requestIdleCallback" in window) {
    const idleId = window.requestIdleCallback(callback, { timeout: 3000 });
    return () => window.cancelIdleCallback(idleId);
  }

  const timer = globalThis.setTimeout(callback, 1200);
  return () => globalThis.clearTimeout(timer);
};

/**
 * 浼樺厛浠?DOM 鐩存帴璇诲彇 handle 鐨勭湡瀹炲睆骞曞潗鏍囥€?
 * 杩欐牱鍙互閬垮厤浠呮牴鎹妭鐐瑰楂樻帹绠楁椂锛実host 绾胯惤鍒拌妭鐐瑰唴閮ㄣ€?
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

// 鐢诲竷娴佺粍浠讹細浠呰礋璐?ReactFlow 鐩稿叧鐘舵€佷笌娓叉煋銆?
export const CanvasFlow = ({
  projectId,
  isMiniMapVisible,
}: CanvasFlowProps) => {
  // 閫氳繃 zustand 璇诲彇鍥剧姸鎬侊紝閬垮厤涓氬姟鍔ㄤ綔鏁ｈ惤鍦ㄥ涓粍浠躲€?
  // 娉細nodes 鍜?edges 涓嶅湪姝よ闃咃紙楂橀鍙樺寲锛夛紝浣跨敤鏈湴 displayNodes/displayEdges 鍜?getState() 鑾峰彇
  const currentProjectId = useCanvasFlowStore((state) => state.projectId);
  const annotationWorkspace = useCanvasFlowStore(
    (state) => state.annotationWorkspace,
  );
  const storeOnNodesChange = useCanvasFlowStore((state) => state.onNodesChange);
  const onEdgesChange = useCanvasFlowStore((state) => state.onEdgesChange);
  const onConnect = useCanvasFlowStore((state) => state.onConnect);
  const addNode = useCanvasFlowStore((state) => state.addNode);
  const deleteNode = useCanvasFlowStore((state) => state.deleteNode);
  const deleteEdge = useCanvasFlowStore((state) => state.deleteEdge);
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

  // 鎷栨嫿涓婁紶鍔熻兘
  const {
    dragState,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFiles,
  } = useDragUpload();

  // 绌烘牸閿寜涓嬬姸鎬佸悓鏃堕┍鍔?React Flow 鐨勫钩绉?妗嗛€夊垏鎹€?
  const spacePressedRef = useRef(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const previousAnnotationViewportRef = useRef<{
    x: number;
    y: number;
    zoom: number;
  } | null>(null);
  const annotationWasOpenRef = useRef(false);
  const isAnnotationLocked = annotationWorkspace.open;

  // 纭瀵硅瘽妗嗙姸鎬?
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [generatingCount, setGeneratingCount] = useState(0);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: (() => void) | null;
  }>({
    open: false,
    title: "确认删除",
    message: "",
    confirmText: "确认删除",
    onConfirm: null,
  });

  // 璺熻釜榧犳爣鍦ㄧ敾甯冧笂鐨勪綅缃紙浠呬緵浜嬩欢澶勭悊璇诲彇锛夛紝鐢?ref 閬垮厤 mousemove 瀵艰嚧鏁存爲閲嶆覆鏌撱€?
  const mouseFlowPositionRef = useRef<{
    x: number;
    y: number;
  } | null>(null);

  // 鑾峰彇姝ｅ湪鐢熸垚鐨勪换鍔℃暟閲忓拰鍙栨秷鏂规硶
  const getGeneratingTasksCount = useCanvasFlowStore(
    (state) => state.getGeneratingTasksCount,
  );
  const cancelAllGeneratingTasks = useCanvasFlowStore(
    (state) => state.cancelAllGeneratingTasks,
  );

  // 鑾峰彇鎾ら攢/閲嶅仛鏂规硶锛堥€氳繃 useUndoRedo hook锛?
  const {
    undo,
    redo,
    canUndo,
    canRedo,
    saveToHistory,
    resetHistory,
    lastSavedVersionRef,
  } = useUndoRedo();

  // 鑾峰彇澶嶅埗/绮樿创鏂规硶锛堥€氳繃 useCopyPaste hook锛?
  const { copySelectedNodes, pasteNodes } = useCopyPaste();

  useEffect(() => {
    return scheduleIdleWork(() => {
      void import("../CustomNodes/ImageNode/ImagePromptPanel");
      void import("../CustomNodes/VideoNode/VideoPromptPanel");
      void import("../CustomNodes/VideoNode/components/VideoPromptEditor");
    });
  }, []);

  const openDeleteConfirmDialog = useCallback(
    ({
      title = "确认删除",
      message,
      confirmText = "确认删除",
      onConfirm,
    }: CanvasDeleteConfirmDetail) => {
      setDeleteConfirmDialog({
        open: true,
        title,
        message,
        confirmText,
        onConfirm,
      });
    },
    [],
  );

  const handleCloseDeleteConfirmDialog = useCallback(() => {
    setDeleteConfirmDialog((prev) => ({
      ...prev,
      open: false,
      onConfirm: null,
    }));
  }, []);

  const handleConfirmDeleteDialog = useCallback(() => {
    const confirmAction = deleteConfirmDialog.onConfirm;
    handleCloseDeleteConfirmDialog();
    confirmAction?.();
  }, [deleteConfirmDialog.onConfirm, handleCloseDeleteConfirmDialog]);

  // 澶勭悊閿洏蹇嵎閿?
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // 妫€鏌ユ槸鍚﹀湪杈撳叆妗嗕腑
      if (isEditableEventTarget(event.target)) {
        return;
      }

      if (annotationWorkspace.open) {
        return;
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        const state = useCanvasFlowStore.getState();
        const selectedNodes = state.nodes.filter((node) => node.selected);
        const selectedEdges = state.edges.filter((edge) => edge.selected);

        if (selectedNodes.length === 0 && selectedEdges.length === 0) {
          return;
        }

        const generatingNodes = selectedNodes.filter(
          needsGeneratingDeleteConfirm,
        );
        if (generatingNodes.length > 0) {
          const uniqueLabels = Array.from(
            new Set(
              generatingNodes.map(
                (node) => DELETE_CONFIRM_NODE_LABEL[node.type] ?? "节点",
              ),
            ),
          );
          const message =
            generatingNodes.length === 1
              ? `当前${uniqueLabels[0]}还在生成中，确定要删除吗？`
              : `当前选中的节点里有 ${generatingNodes.length} 个生成中的节点（${uniqueLabels.join("、")}），确定要删除吗？`;
          const nodesToDelete = [...selectedNodes];
          const edgesToDelete = [...selectedEdges];
          event.preventDefault();
          openDeleteConfirmDialog({
            message,
            onConfirm: () => {
              edgesToDelete.forEach((edge) => deleteEdge(edge.id));
              nodesToDelete.forEach((node) => deleteNode(node.id));
            },
          });
          return;
        }

        event.preventDefault();
        selectedEdges.forEach((edge) => deleteEdge(edge.id));
        selectedNodes.forEach((node) => deleteNode(node.id));
        return;
      }

      // Ctrl+Z 鎴?Cmd+Z锛氭挙閿€
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

      // Ctrl+Shift+Z 鎴?Cmd+Shift+Z 鎴?Ctrl+Y锛氶噸鍋?
      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key === "y" || (event.key === "z" && event.shiftKey))
      ) {
        event.preventDefault();
        if (canRedo) {
          redo();
        }
      }

      // Ctrl+C 鎴?Cmd+C锛氬鍒堕€変腑鑺傜偣
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "c" &&
        !event.shiftKey
      ) {
        copySelectedNodes();
      }

      // Ctrl+V 鎴?Cmd+V锛氱矘璐磋妭鐐?
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "v" &&
        !event.shiftKey
      ) {
        return;
      }

      // Ctrl+S 鎴?Cmd+S锛氫繚瀛樼敾甯?
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "s" &&
        !event.shiftKey
      ) {
        event.preventDefault();
        try {
          useCanvasFlowStore.getState().saveGraph();
          toast.success("画布已保存");
        } catch {
          toast.error("保存失败，请重试");
        }
      }
    },
    [
      undo,
      redo,
      canUndo,
      canRedo,
      copySelectedNodes,
      openDeleteConfirmDialog,
      deleteEdge,
      deleteNode,
      annotationWorkspace.open,
    ],
  );

  // 鐩戝惉閿洏浜嬩欢
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  useEffect(() => {
    const handleDeleteConfirmRequest = (event: Event) => {
      const detail = (event as CustomEvent<CanvasDeleteConfirmDetail>).detail;
      if (!detail?.message || !detail.onConfirm) {
        return;
      }

      openDeleteConfirmDialog(detail);
    };

    window.addEventListener(
      CANVAS_DELETE_CONFIRM_EVENT,
      handleDeleteConfirmRequest,
    );

    return () => {
      window.removeEventListener(
        CANVAS_DELETE_CONFIRM_EVENT,
        handleDeleteConfirmRequest,
      );
    };
  }, [openDeleteConfirmDialog]);

  useEffect(() => {
    const handleCopy = (event: ClipboardEvent) => {
      if (annotationWorkspace.open) {
        return;
      }

      const isEditableTarget = isEditableEventTarget(event.target);

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

  // 鐩戝惉 store 鐨?historyVersion 鍙樺寲锛岃Е鍙戝巻鍙茶褰曚繚瀛?
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

  // 鐢诲竷鍏夋爣浜や簰锛氱┖鏍?鎶撴墜锛孋trl=鏀惧ぇ闀滐紝鑺傜偣=灏忔墜锛岄粯璁?绠ご
  useEffect(() => {
    const reactFlowEl = document.querySelector(".react-flow");
    if (!reactFlowEl) return;

    let isSpacePressed = false;
    let isCtrlPressed = false;

    const updateCursorState = () => {
      if (annotationWorkspace.open) {
        reactFlowEl.removeAttribute("data-space-pressed");
        reactFlowEl.removeAttribute("data-ctrl-pressed");
        spacePressedRef.current = false;
        setIsSpacePressed(false);
        return;
      }

      if (isSpacePressed) {
        reactFlowEl.setAttribute("data-space-pressed", "true");
        reactFlowEl.removeAttribute("data-ctrl-pressed");
        spacePressedRef.current = true;
        setIsSpacePressed(true);
      } else if (isCtrlPressed) {
        reactFlowEl.setAttribute("data-ctrl-pressed", "true");
        reactFlowEl.removeAttribute("data-space-pressed");
        spacePressedRef.current = false;
        setIsSpacePressed(false);
      } else {
        reactFlowEl.removeAttribute("data-space-pressed");
        reactFlowEl.removeAttribute("data-ctrl-pressed");
        spacePressedRef.current = false;
        setIsSpacePressed(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableEventTarget(e.target)) {
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
      spacePressedRef.current = false;
      setIsSpacePressed(false);
    };
  }, [annotationWorkspace.open]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (annotationWorkspace.open) {
        return;
      }

      const isEditableTarget = isEditableEventTarget(event.target);

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
    };

    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [annotationWorkspace.open, handleFiles, pasteNodes, screenToFlowPosition]);

  // 鐩戝惉榧犳爣绉诲姩浠ユ洿鏂扮敾甯冧笂鐨勯紶鏍囦綅缃?
  useEffect(() => {
    let pendingMouseEvent: MouseEvent | null = null;
    let mouseMoveRaf: number | null = null;

    const updateMouseFlowPosition = () => {
      mouseMoveRaf = null;
      if (!pendingMouseEvent) {
        return;
      }

      const event = pendingMouseEvent;
      pendingMouseEvent = null;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      mouseFlowPositionRef.current = position;
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (isDraggingRef.current) {
        pendingMouseEvent = null;
        return;
      }

      pendingMouseEvent = event;
      if (mouseMoveRaf !== null) {
        return;
      }
      mouseMoveRaf = window.requestAnimationFrame(updateMouseFlowPosition);
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      if (mouseMoveRaf !== null) {
        window.cancelAnimationFrame(mouseMoveRaf);
      }
    };
  }, [reactFlowInstance]);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (annotationWorkspace.open) {
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        const target = event.target as HTMLElement | null;
        if (!target?.closest(".nowheel")) {
          return;
        }

        event.preventDefault();

        const { zoom: currentZoom, x, y } = reactFlowInstance.getViewport();
        const deltaModeFactor =
          event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002;
        const wheelDelta =
          -event.deltaY *
          deltaModeFactor *
          (event.ctrlKey && isMacOs() ? 10 : 1);
        const newZoom = Math.min(
          MAX_CANVAS_ZOOM,
          Math.max(MIN_CANVAS_ZOOM, currentZoom * 2 ** wheelDelta),
        );

        const reactFlowBounds = (
          event.currentTarget as HTMLElement
        ).getBoundingClientRect();
        const mouseX = event.clientX - reactFlowBounds.left;
        const mouseY = event.clientY - reactFlowBounds.top;

        const zoomRatio = newZoom / currentZoom;

        const newX = mouseX - (mouseX - x) * zoomRatio;
        const newY = mouseY - (mouseY - y) * zoomRatio;

        reactFlowInstance.setViewport({
          x: newX,
          y: newY,
          zoom: newZoom,
        });
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

  // ==================== 鎷栧姩鎬ц兘浼樺寲锛氭湰鍦?nodes 鐘舵€侀殧绂?====================
  //
  // 闂锛歊eactFlow 鍙楁帶妯″紡涓嬶紝鎷栧姩鏃舵瘡甯ц皟鐢?onNodesChange 鈫?Zustand set 鈫?
  //       CanvasFlow 閲嶆覆鏌擄紙鍥犱负璁㈤槄浜?zustandNodes锛?鈫?React DevTools 璺熻釜
  //       姣忔閲嶆覆鏌撳紑閿€ 鈫?鎵撳紑寮€鍙戣€呭伐鍏锋椂鍗￠】銆?
  //
  // 瑙ｆ硶锛氱淮鎶ゆ湰鍦?displayNodes 鐘舵€佺敤浜?ReactFlow 娓叉煋锛?
  //   - 鎷栧姩鏃讹細鍙洿鏂版湰鍦?displayNodes锛堣瑙夋祦鐣咃級锛屼笉鍐欏叆 Zustand锛堜笉瑙﹀彂鍏ㄥ眬閲嶆覆鏌擄級
  //   - 鎷栧姩缁撴潫锛氬悓姝ユ渶缁堜綅缃埌 Zustand锛堟寔涔呭寲锛?
  //   - 澶栭儴鍙樻洿锛堟坊鍔?鍒犻櫎鑺傜偣銆佸浘鐗囩敓鎴愮粨鏋滅瓑锛夛細Zustand 鍙樺寲鏃跺悓姝ュ埌 displayNodes

  // 鍒濆鍖栨湰鍦扮姸鎬?
  const [displayNodes, setDisplayNodes] = useState<AllNodeType[]>(
    () => useCanvasFlowStore.getState().nodes,
  );
  const [displayEdges, setDisplayEdges] = useState<EdgeType[]>(
    () => useCanvasFlowStore.getState().edges,
  );
  const isSelectionBoxActive = useCanvasFlowStore(
    (state) => state.isSelectionBoxActive,
  );
  const setSelectionBoxActive = useCanvasFlowStore(
    (state) => state.setSelectionBoxActive,
  );
  const groups = useCanvasFlowStore((state) => state.groups);
  const selectedGroupId = useCanvasFlowStore((state) => state.selectedGroupId);
  const setSelectedGroupId = useCanvasFlowStore(
    (state) => state.setSelectedGroupId,
  );
  const createGroup = useCanvasFlowStore((state) => state.createGroup);
  const layoutGroupHorizontal = useCanvasFlowStore(
    (state) => state.layoutGroupHorizontal,
  );
  const layoutGroupGrid = useCanvasFlowStore((state) => state.layoutGroupGrid);
  const ungroup = useCanvasFlowStore((state) => state.ungroup);
  const [viewportState, setViewportState] = useState(() =>
    reactFlowInstance.getViewport(),
  );
  const viewportStateRef = useRef(reactFlowInstance.getViewport());
  const pendingViewportRef = useRef(reactFlowInstance.getViewport());
  const viewportRafRef = useRef<number | null>(null);
  const latestStoreNodesRef = useRef(useCanvasFlowStore.getState().nodes);
  const latestStoreEdgesRef = useRef(useCanvasFlowStore.getState().edges);
  // 鐢?ref 鑰岄潪 state 杩借釜鎷栧姩鐘舵€侊紝閬垮厤寮曞彂棰濆娓叉煋
  const isDraggingRef = useRef(false);
  const pendingNodeChangesRef = useRef<NodeChange<AllNodeType>[]>([]);
  const nodeChangeRafRef = useRef<number | null>(null);
  const pendingStoreNodeChangesRef = useRef<NodeChange<AllNodeType>[]>([]);
  const storeNodeChangeTimerRef = useRef<number | null>(null);
  const lastStoreNodeChangeFlushRef = useRef(0);

  // 绋冲畾 ReactFlow 瀵硅薄鍨?props 鐨勫紩鐢紝閬垮厤姣忔 render 鐢熸垚鏂板璞″鑷村瓙鏍戞棤鏁堟洿鏂?
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

  // 鐩戝惉 Zustand 鐘舵€佸彉鍖栵紙澶栭儴鍙樻洿濡傛坊鍔?鍒犻櫎鑺傜偣銆佸浘鐗囩敓鎴愮粨鏋滅瓑锛?
  useEffect(() => {
    const unsubscribe = useCanvasFlowStore.subscribe((newState) => {
      // 鍙湪闈炴嫋鍔ㄦ椂鏇存柊鏄剧ず鑺傜偣锛屽苟涓斾粎鍦ㄥ紩鐢ㄥ彉鍖栨椂 setState
      if (
        !isDraggingRef.current &&
        latestStoreNodesRef.current !== newState.nodes
      ) {
        latestStoreNodesRef.current = newState.nodes;
        setDisplayNodes(newState.nodes);
      }

      // 杈规暟缁勪粎鍦ㄥ紩鐢ㄥ彉鍖栨椂鏇存柊锛岄伩鍏嶆棤鏁?setState
      if (latestStoreEdgesRef.current !== newState.edges) {
        latestStoreEdgesRef.current = newState.edges;
        setDisplayEdges(newState.edges);
      }
    });
    return unsubscribe;
  }, []);

  // 鏈湴 onNodesChange锛氬彧璐熻矗鏇存柊 displayNodes锛屼綅缃彉鏇村湪鎷栧姩缁撴潫鏃跺鐞?
  const compactNodeChanges = useCallback(
    (changes: NodeChange<AllNodeType>[]) => {
      const latestPositionChanges = new Map<string, NodeChange<AllNodeType>>();
      const latestSelectChanges = new Map<string, NodeChange<AllNodeType>>();
      const latestDimensionChanges = new Map<string, NodeChange<AllNodeType>>();
      const otherChanges: NodeChange<AllNodeType>[] = [];

      changes.forEach((change) => {
        if (change.type === "position") {
          latestPositionChanges.set(change.id, change);
          return;
        }

        if (change.type === "select") {
          latestSelectChanges.set(change.id, change);
          return;
        }

        if (change.type === "dimensions") {
          latestDimensionChanges.set(change.id, change);
          return;
        }

        otherChanges.push(change);
      });

      return [
        ...otherChanges,
        ...latestPositionChanges.values(),
        ...latestDimensionChanges.values(),
        ...latestSelectChanges.values(),
      ];
    },
    [],
  );

  const scheduleDisplayNodeChanges = useCallback(
    (changes: NodeChange<AllNodeType>[]) => {
      pendingNodeChangesRef.current.push(...changes);

      if (nodeChangeRafRef.current !== null) {
        return;
      }

      nodeChangeRafRef.current = window.requestAnimationFrame(() => {
        nodeChangeRafRef.current = null;
        const pendingChanges = compactNodeChanges(
          pendingNodeChangesRef.current,
        );
        pendingNodeChangesRef.current = [];

        if (pendingChanges.length === 0) {
          return;
        }

        setDisplayNodes((prev) => applyNodeChanges(pendingChanges, prev));
      });
    },
    [compactNodeChanges],
  );

  const flushStoreNodeChanges = useCallback(() => {
    storeNodeChangeTimerRef.current = null;
    const pendingChanges = compactNodeChanges(
      pendingStoreNodeChangesRef.current,
    );
    pendingStoreNodeChangesRef.current = [];

    if (pendingChanges.length === 0) {
      return;
    }

    lastStoreNodeChangeFlushRef.current = Date.now();
    storeOnNodesChange(pendingChanges);
  }, [compactNodeChanges, storeOnNodesChange]);

  const scheduleStoreNodeChanges = useCallback(
    (changes: NodeChange<AllNodeType>[]) => {
      pendingStoreNodeChangesRef.current.push(...changes);

      if (storeNodeChangeTimerRef.current !== null) {
        return;
      }

      const elapsed = Date.now() - lastStoreNodeChangeFlushRef.current;
      if (elapsed >= STORE_NODE_CHANGE_THROTTLE_MS) {
        flushStoreNodeChanges();
        return;
      }

      storeNodeChangeTimerRef.current = window.setTimeout(
        flushStoreNodeChanges,
        STORE_NODE_CHANGE_THROTTLE_MS - elapsed,
      );
    },
    [flushStoreNodeChanges],
  );

  useEffect(() => {
    return () => {
      if (nodeChangeRafRef.current !== null) {
        window.cancelAnimationFrame(nodeChangeRafRef.current);
      }
      if (storeNodeChangeTimerRef.current !== null) {
        window.clearTimeout(storeNodeChangeTimerRef.current);
      }
    };
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange<AllNodeType>[]) => {
      // 濮嬬粓鏇存柊鏈湴鏄剧ず鐘舵€侊紝淇濊瘉鎷栧姩瑙嗚娴佺晠
      scheduleDisplayNodeChanges(changes);

      // 高频变更按 70ms 节流写入 store；尺寸变更仍由拖拽结束/外部流程处理。
      const storeChanges = changes.filter((c) => c.type !== "dimensions");
      if (storeChanges.length > 0) {
        scheduleStoreNodeChanges(storeChanges);
      }
    },
    [scheduleDisplayNodeChanges, scheduleStoreNodeChanges],
  );

  const alignPositionToGrid = useCallback(
    (position: { x: number; y: number }) => {
      if (!snapToGrid) {
        return position;
      }

      const [gridX, gridY] = snapGridSize;
      return {
        x: Math.round(position.x / gridX) * gridX,
        y: Math.round(position.y / gridY) * gridY,
      };
    },
    [snapGridSize, snapToGrid],
  );

  const handleNodeDragStart = useCallback(() => {
    if (annotationWorkspace.open) {
      return;
    }
    isDraggingRef.current = true;
    setSelectedGroupId(null);
  }, [annotationWorkspace.open, setSelectedGroupId]);

  const handleNodeDragStop = useCallback(() => {
    if (annotationWorkspace.open) {
      return;
    }

    if (nodeChangeRafRef.current !== null) {
      window.cancelAnimationFrame(nodeChangeRafRef.current);
      nodeChangeRafRef.current = null;
    }

    const pendingChanges = compactNodeChanges(pendingNodeChangesRef.current);
    pendingNodeChangesRef.current = [];

    if (storeNodeChangeTimerRef.current !== null) {
      window.clearTimeout(storeNodeChangeTimerRef.current);
      storeNodeChangeTimerRef.current = null;
    }
    flushStoreNodeChanges();

    isDraggingRef.current = false;

    // 浠?ReactFlow 瀹炰緥璇诲彇鏈€鏂扮殑鑺傜偣鐘舵€?
    let currentNodes = reactFlowInstance.getNodes() as AllNodeType[];
    if (pendingChanges.length > 0) {
      currentNodes = applyNodeChanges(pendingChanges, currentNodes);
      setDisplayNodes(currentNodes);
    }
    const zustandStateNodes = useCanvasFlowStore.getState().nodes;
    const zustandNodeById = new Map(
      zustandStateNodes.map((node) => [node.id, node]),
    );

    // 鏀堕泦浣嶇疆鍙戠敓鍙樺寲鐨勮妭鐐?
    const positionChanges: NodeChange<AllNodeType>[] = [];

    // 灏嗚妭鐐逛綅缃榻愬埌缃戞牸鐐癸紙褰撳惛闄勫紑鍏冲紑鍚椂鐢熸晥锛?
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

    // 鎵归噺鍐欏叆 Zustand
    if (positionChanges.length > 0) {
      storeOnNodesChange(positionChanges);
    }
  }, [
    annotationWorkspace.open,
    compactNodeChanges,
    reactFlowInstance,
    alignPositionToGrid,
    flushStoreNodeChanges,
    storeOnNodesChange,
  ]);

  const flushAndSaveCanvas = useCallback(() => {
    if (nodeChangeRafRef.current !== null) {
      window.cancelAnimationFrame(nodeChangeRafRef.current);
      nodeChangeRafRef.current = null;
    }

    if (storeNodeChangeTimerRef.current !== null) {
      window.clearTimeout(storeNodeChangeTimerRef.current);
      storeNodeChangeTimerRef.current = null;
    }

    const displayChanges = compactNodeChanges(pendingNodeChangesRef.current);
    pendingNodeChangesRef.current = [];
    const storeChanges = compactNodeChanges(pendingStoreNodeChangesRef.current);
    pendingStoreNodeChangesRef.current = [];
    const pendingChanges = compactNodeChanges([
      ...displayChanges,
      ...storeChanges,
    ]);

    // 返回主页前先把拖拽/选择等还在 RAF 或定时器里的变更写回 store，再触发画布项目保存。
    if (pendingChanges.length > 0) {
      storeOnNodesChange(pendingChanges);
    }

    useCanvasFlowStore.getState().saveGraph();
  }, [compactNodeChanges, storeOnNodesChange]);

  // 处理返回按钮点击：返回主页前强制保存当前画布项目。
  const handleBackClick = useCallback(() => {
    flushAndSaveCanvas();
    const count = getGeneratingTasksCount();
    if (count > 0) {
      setGeneratingCount(count);
      setShowExitDialog(true);
    } else {
      navigate("/home");
    }
  }, [flushAndSaveCanvas, getGeneratingTasksCount, navigate]);

  // 确认退出时也再保存一次，确保取消任务后的状态被写入项目。
  const handleConfirmExit = useCallback(() => {
    cancelAllGeneratingTasks();
    setShowExitDialog(false);
    window.setTimeout(() => {
      flushAndSaveCanvas();
      navigate("/home");
    }, 0);
  }, [cancelAllGeneratingTasks, flushAndSaveCanvas, navigate]);

  const handleCancelExit = useCallback(() => {
    setShowExitDialog(false);
  }, []);

  const handleSelectionStart = useCallback(() => {
    if (annotationWorkspace.open) {
      return;
    }

    setSelectionBoxActive(true);
    setSelectedGroupId(null);
  }, [annotationWorkspace.open, setSelectionBoxActive, setSelectedGroupId]);

  const handleSelectionEnd = useCallback(() => {
    setSelectionBoxActive(false);
  }, [setSelectionBoxActive]);

  useEffect(() => {
    return () => {
      setSelectionBoxActive(false);
    };
  }, [setSelectionBoxActive]);

  // 鐐瑰嚮鐢诲竷绌虹櫧鍖哄煙鏃跺彇娑堟墍鏈夎妭鐐圭殑閫変腑鐘舵€?
  const handlePaneClick = useCallback(() => {
    if (annotationWorkspace.open) {
      return;
    }

    setSelectionBoxActive(false);
    setSelectedGroupId(null);

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
  }, [
    annotationWorkspace.open,
    setSelectionBoxActive,
    setSelectedGroupId,
    storeOnNodesChange,
  ]);

  const beginGroupDrag = useCallback(
    (groupId: string, clientX: number, clientY: number) => {
      const group = groups.find((item) => item.id === groupId);
      if (!group) {
        return;
      }

      const currentState = useCanvasFlowStore.getState();
      const selectedNodes = currentState.nodes.filter((node) => node.selected);
      if (selectedNodes.length > 0) {
        storeOnNodesChange(
          selectedNodes.map((node) => ({
            id: node.id,
            type: "select" as const,
            selected: false,
          })),
        );
      }

      setSelectionBoxActive(false);
      setSelectedGroupId(groupId);

      const nodeByIdForDrag = new Map(
        displayNodes.map((node) => [node.id, node]),
      );
      const startPositions = new Map(
        group.nodeIds.map((nodeId) => {
          const node = nodeByIdForDrag.get(nodeId);
          return [
            nodeId,
            {
              x: node?.position.x ?? 0,
              y: node?.position.y ?? 0,
            },
          ] as const;
        }),
      );
      const startNodeIndexes = new Map<string, number>();
      displayNodes.forEach((node, index) => {
        if (startPositions.has(node.id)) {
          startNodeIndexes.set(node.id, index);
        }
      });

      groupDragStateRef.current = {
        groupId,
        startClientX: clientX,
        startClientY: clientY,
        startZoom: viewportStateRef.current.zoom || 1,
        latestClientX: clientX,
        latestClientY: clientY,
        startPositions,
        startNodeIndexes,
        dragging: false,
      };

      const handlePointerMove = (event: PointerEvent) => {
        const dragState = groupDragStateRef.current;
        if (!dragState || dragState.groupId !== groupId) {
          return;
        }

        dragState.latestClientX = event.clientX;
        dragState.latestClientY = event.clientY;

        if (!dragState.dragging) {
          const deltaX = event.clientX - dragState.startClientX;
          const deltaY = event.clientY - dragState.startClientY;
          if (
            deltaX * deltaX + deltaY * deltaY <
            GROUP_DRAG_THRESHOLD * GROUP_DRAG_THRESHOLD
          ) {
            return;
          }

          dragState.dragging = true;
          isDraggingRef.current = true;
        }

        if (groupDragRafRef.current !== null) {
          return;
        }

        groupDragRafRef.current = window.requestAnimationFrame(() => {
          groupDragRafRef.current = null;
          const latestDragState = groupDragStateRef.current;
          if (!latestDragState || latestDragState.groupId !== groupId) {
            return;
          }

          const delta = {
            x:
              (latestDragState.latestClientX -
                latestDragState.startClientX) /
              latestDragState.startZoom,
            y:
              (latestDragState.latestClientY -
                latestDragState.startClientY) /
              latestDragState.startZoom,
          };

          setDisplayNodes((prev) => {
            const next = prev.slice();
            let hasChanged = false;

            latestDragState.startPositions.forEach((startPosition, nodeId) => {
              const index = latestDragState.startNodeIndexes.get(nodeId);
              if (index === undefined || next[index]?.id !== nodeId) {
                return;
              }

              const prevNode = next[index];
              next[index] = {
                ...prevNode,
                position: {
                  x: startPosition.x + delta.x,
                  y: startPosition.y + delta.y,
                },
              };
              hasChanged = true;
            });

            return hasChanged ? next : prev;
          });
        });
      };

      const finishGroupDrag = (event: PointerEvent) => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", finishGroupDrag);
        window.removeEventListener("pointercancel", cancelGroupDrag);

        if (groupDragRafRef.current !== null) {
          window.cancelAnimationFrame(groupDragRafRef.current);
          groupDragRafRef.current = null;
        }

        const dragState = groupDragStateRef.current;
        groupDragStateRef.current = null;

        if (!dragState || dragState.groupId !== groupId) {
          isDraggingRef.current = false;
          return;
        }

        if (!dragState.dragging) {
          isDraggingRef.current = false;
          return;
        }

        const startFlow = screenToFlowPosition({
          x: dragState.startClientX,
          y: dragState.startClientY,
        });
        const currentFlow = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        const delta = {
          x: currentFlow.x - startFlow.x,
          y: currentFlow.y - startFlow.y,
        };

        const nextNodePositions = new Map<string, { x: number; y: number }>();
        dragState.startPositions.forEach((position, nodeId) => {
          nextNodePositions.set(
            nodeId,
            alignPositionToGrid({
              x: position.x + delta.x,
              y: position.y + delta.y,
            }),
          );
        });

        setDisplayNodes((prev) =>
          prev.map((node) => {
            const nextPosition = nextNodePositions.get(node.id);
            if (!nextPosition) {
              return node;
            }

            return {
              ...node,
              position: nextPosition,
            };
          }),
        );

        const positionChanges = Array.from(nextNodePositions.entries()).map(
          ([nodeId, position]) => ({
            id: nodeId,
            type: "position" as const,
            position,
          }),
        );

        isDraggingRef.current = false;

        if (positionChanges.length > 0) {
          storeOnNodesChange(positionChanges);
        }
      };

      const cancelGroupDrag = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", finishGroupDrag);
        window.removeEventListener("pointercancel", cancelGroupDrag);

        if (groupDragRafRef.current !== null) {
          window.cancelAnimationFrame(groupDragRafRef.current);
          groupDragRafRef.current = null;
        }

        groupDragStateRef.current = null;
        isDraggingRef.current = false;
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", finishGroupDrag);
      window.addEventListener("pointercancel", cancelGroupDrag);
    },
    [
      alignPositionToGrid,
      displayNodes,
      groups,
      screenToFlowPosition,
      setSelectionBoxActive,
      setSelectedGroupId,
      setDisplayNodes,
      storeOnNodesChange,
    ],
  );

  const handleCanvasPointerDownCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (annotationWorkspace.open || event.button !== 0) {
        return;
      }

      const target = event.target as Element | null;
      if (
        target?.closest(
          ".react-flow__node, .react-flow__edge, .react-flow__handle, .react-flow__connection",
        )
      ) {
        return;
      }

      const flowPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const hitGroup = groups.find((group) => {
        const groupBounds = getGroupBounds(displayNodes, group.nodeIds, 18);
        if (!groupBounds) {
          return false;
        }

        const withinGroup =
          flowPosition.x >= groupBounds.x &&
          flowPosition.x <= groupBounds.x + groupBounds.width &&
          flowPosition.y >= groupBounds.y &&
          flowPosition.y <= groupBounds.y + groupBounds.height;
        if (!withinGroup) {
          return false;
        }

        return !group.nodeIds.some((nodeId) => {
          const node = displayNodes.find((item) => item.id === nodeId);
          if (!node) {
            return false;
          }

          const nodeWidth =
            node.width ?? node.measured?.width ?? FALLBACK_NODE_WIDTH;
          const nodeHeight =
            node.height ?? node.measured?.height ?? FALLBACK_NODE_HEIGHT;

          return (
            flowPosition.x >= node.position.x &&
            flowPosition.x <= node.position.x + nodeWidth &&
            flowPosition.y >= node.position.y &&
            flowPosition.y <= node.position.y + nodeHeight
          );
        });
      });

      if (!hitGroup) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      beginGroupDrag(hitGroup.id, event.clientX, event.clientY);
    },
    [
      annotationWorkspace.open,
      beginGroupDrag,
      displayNodes,
      groups,
      screenToFlowPosition,
    ],
  );

  // 涓洪珮棰戣鍙栧満鏅缓绔嬭妭鐐圭储寮曪紝閬垮厤閲嶅绾挎€ф壂鎻忋€?
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

  // 鍗曟閬嶅巻瀹屾垚澶氶€夌粺璁★細鍚屾椂寰楀埌閫変腑鑺傜偣 id 鍒楄〃涓庨€夊尯鍙充晶涓績鐐广€?
  const multiSelectedSummary = useMemo(() => {
    const selectedNodeIds: string[] = [];
    let minLeft = Number.POSITIVE_INFINITY;
    let maxRight = Number.NEGATIVE_INFINITY;
    let minTop = Number.POSITIVE_INFINITY;
    let maxBottom = Number.NEGATIVE_INFINITY;

    displayNodes.forEach((node) => {
      if (!node.selected) {
        return;
      }

      selectedNodeIds.push(node.id);

      const nodeWidth =
        node.width ?? node.measured?.width ?? FALLBACK_NODE_WIDTH;
      const nodeHeight =
        node.height ?? node.measured?.height ?? FALLBACK_NODE_HEIGHT;
      const left = node.position.x;
      const top = node.position.y;
      const right = left + nodeWidth;
      const bottom = top + nodeHeight;

      if (left < minLeft) minLeft = left;
      if (right > maxRight) maxRight = right;
      if (top < minTop) minTop = top;
      if (bottom > maxBottom) maxBottom = bottom;
    });

    const count = selectedNodeIds.length;

    if (count < 2) {
      return {
        selectedNodeIds,
        count,
        selectionBoundsFlow: null,
        selectionRightCenterFlowPosition: null,
      };
    }

    return {
      selectedNodeIds,
      count,
      selectionBoundsFlow: {
        x: minLeft,
        y: minTop,
        width: maxRight - minLeft,
        height: maxBottom - minTop,
      },
      selectionRightCenterFlowPosition: {
        // 鈥?鈥濆嚭鐜板湪閫夊尯鍙充晶锛岀暀涓€娈靛浐瀹氬亸绉伙紝閬垮厤璐磋竟閲嶅彔銆?
        x: maxRight + 32,
        y: minTop + (maxBottom - minTop) / 2,
      },
    };
  }, [displayNodes]);

  const multiSelectedNodeIds = multiSelectedSummary.selectedNodeIds;
  const multiSelectedCount = multiSelectedSummary.count;
  const selectionBoundsFlow = multiSelectedSummary.selectionBoundsFlow;
  const selectionRightCenterFlowPosition =
    multiSelectedSummary.selectionRightCenterFlowPosition;
  const selectedNodeIdSet = useMemo(
    () => new Set(multiSelectedNodeIds),
    [multiSelectedNodeIds],
  );

  // 灏嗘祦鍧愭爣杞崲涓哄睆骞曞潗鏍囷紝鐢ㄤ簬缁濆瀹氫綅娴姩鎸夐挳銆?
  const selectionBoundsScreen = useMemo(() => {
    if (!selectionBoundsFlow) {
      return null;
    }

    const padding = 8;
    return {
      x: selectionBoundsFlow.x * viewportState.zoom + viewportState.x - padding,
      y: selectionBoundsFlow.y * viewportState.zoom + viewportState.y - padding,
      width: selectionBoundsFlow.width * viewportState.zoom + padding * 2,
      height: selectionBoundsFlow.height * viewportState.zoom + padding * 2,
    };
  }, [selectionBoundsFlow, viewportState]);

  const selectionToolbarPosition = useMemo(() => {
    if (!selectionBoundsScreen || multiSelectedCount < 2) {
      return null;
    }

    const viewportWidth =
      typeof window !== "undefined" ? window.innerWidth : 0;
    return {
      x: clamp(
        selectionBoundsScreen.x + selectionBoundsScreen.width / 2,
        24,
        Math.max(viewportWidth - 24, 24),
      ),
      y: Math.max(selectionBoundsScreen.y - 12, 24),
    };
  }, [multiSelectedCount, selectionBoundsScreen]);

  const groupFrames = useMemo(() => {
    return groups
      .map((group) => {
        const bounds = getGroupBoundsFromNodeMap(
          displayNodeById,
          group.nodeIds,
          18,
        );
        if (!bounds) {
          return null;
        }

        return {
          ...group,
          bounds,
        };
      })
      .filter(Boolean) as Array<
      {
        id: string;
        nodeIds: string[];
        createdAt: number;
        bounds: {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      }
    >;
  }, [displayNodeById, groups]);

  const selectedGroup = useMemo(() => {
    if (!selectedGroupId) {
      return null;
    }

    return groupFrames.find((group) => group.id === selectedGroupId) ?? null;
  }, [groupFrames, selectedGroupId]);

  const selectedGroupFromSelection = useMemo(() => {
    if (multiSelectedCount < 2 || groupFrames.length === 0) {
      return null;
    }

    const matchedGroup = groupFrames.find((group) => {
      if (group.nodeIds.length !== multiSelectedCount) {
        return false;
      }

      return group.nodeIds.every((nodeId) => selectedNodeIdSet.has(nodeId));
    });

    return matchedGroup ?? null;
  }, [groupFrames, multiSelectedCount, selectedNodeIdSet]);

  const activeBatchGroup = selectedGroup ?? selectedGroupFromSelection;

  const selectedUngroupedCount = useMemo(() => {
    if (multiSelectedCount === 0) {
      return 0;
    }

    return multiSelectedNodeIds.filter((nodeId) => {
      return !groups.some((group) => group.nodeIds.includes(nodeId));
    }).length;
  }, [groups, multiSelectedCount, multiSelectedNodeIds]);

  const selectedGroupToolbarPosition = useMemo(() => {
    if (!activeBatchGroup) {
      return null;
    }

    const screenLeft =
      activeBatchGroup.bounds.x * viewportState.zoom + viewportState.x;
    const screenTop =
      activeBatchGroup.bounds.y * viewportState.zoom + viewportState.y;
    const screenWidth = activeBatchGroup.bounds.width * viewportState.zoom;
    const gap = 12;
    const viewportWidth =
      typeof window !== "undefined" ? window.innerWidth : 0;
    const anchorX = clamp(
      screenLeft + screenWidth / 2,
      24,
      Math.max(viewportWidth - 24, 24),
    );
    const anchorY = Math.max(screenTop - gap, 24);

    return {
      x: anchorX,
      y: anchorY,
    };
  }, [activeBatchGroup, viewportState]);

  const batchToolbarMode =
    activeBatchGroup && activeBatchGroup.nodeIds.length >= 2
      ? "group"
      : multiSelectedCount >= 2 && selectedUngroupedCount === multiSelectedCount
        ? "selection"
        : null;

  // 褰?projectId 鍙樺寲鏃跺垏鎹㈤」鐩?
  useEffect(() => {
    if (projectId && projectId !== currentProjectId) {
      switchProject(projectId);
    }
  }, [projectId, currentProjectId, switchProject]);

  const contextMenuTriggerRef = useRef<HTMLDivElement | null>(null);
  const [menuScreenPosition, setMenuScreenPosition] = useState({ x: 0, y: 0 });
  const [canvasMenuMode, setCanvasMenuMode] = useState<"create" | "upload">(
    "create",
  );
  const uploadMediaInputRef = useRef<HTMLInputElement | null>(null);
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
  const groupDragStateRef = useRef<{
    groupId: string;
    startClientX: number;
    startClientY: number;
    startZoom: number;
    startPositions: Map<string, { x: number; y: number }>;
    startNodeIndexes: Map<string, number>;
    latestClientX: number;
    latestClientY: number;
    dragging: boolean;
  } | null>(null);
  const groupDragRafRef = useRef<number | null>(null);
  const GROUP_DRAG_THRESHOLD = 4;

  // 浠呭湪鍙犲姞灞傞渶瑕佽窡闅忕缉鏀?骞崇Щ鏃讹紝鎵嶈拷韪?viewport锛岄伩鍏?onMove 楂橀瑙﹀彂鏁存爲閲嶆覆鏌撱€?
  const shouldTrackViewport =
    Boolean(selectionRightCenterFlowPosition) ||
    Boolean(activeBatchGroup) ||
    Boolean(connectionGhost) ||
    quickAddDragPreview.active ||
    Boolean(quickAddMenuOpen && quickAddMenuScreenPosition);

  // 浣跨敤 rAF 鍚堝抚鏇存柊 viewport 鐘舵€侊紝閬垮厤姣忔 onMove 閮?setState銆?
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
      // 浣跨敤 unknown 閬垮厤鍦ㄩ珮棰戜簨浠朵腑寮曞叆棰濆绫诲瀷鍣煶銆?
      if (!shouldTrackViewport) {
        return;
      }

      scheduleViewportState(viewport as { x: number; y: number; zoom: number });
    },
    [scheduleViewportState, shouldTrackViewport],
  );

  // 褰撳紑濮嬮渶瑕佽拷韪?viewport 鏃讹紝鍏堝悓姝ヤ竴娆℃渶鏂板€硷紝閬垮厤鍑虹幇浣嶇疆璺冲彉銆?
  useEffect(() => {
    if (!shouldTrackViewport) {
      return;
    }

    const latestViewport = reactFlowInstance.getViewport();
    viewportStateRef.current = latestViewport;
    pendingViewportRef.current = latestViewport;
    setViewportState(latestViewport);
  }, [reactFlowInstance, shouldTrackViewport]);

  // 缁勪欢鍗歌浇鏃舵竻鐞?rAF锛岄伩鍏嶆綔鍦ㄥ唴瀛樻硠婕忋€?
  useEffect(() => {
    return () => {
      if (viewportRafRef.current !== null) {
        window.cancelAnimationFrame(viewportRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (groupDragRafRef.current !== null) {
        window.cancelAnimationFrame(groupDragRafRef.current);
        groupDragRafRef.current = null;
      }
      groupDragStateRef.current = null;
      isDraggingRef.current = false;
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
    const flowElement = document.querySelector(
      ".react-flow",
    ) as HTMLElement | null;
    const bounds = flowElement?.getBoundingClientRect();
    const viewportWidth = bounds?.width ?? window.innerWidth;
    const viewportHeight = bounds?.height ?? window.innerHeight;

    const nodeWidth = annotationTargetNode.width ?? FALLBACK_NODE_WIDTH;
    const nodeHeight = annotationTargetNode.height ?? FALLBACK_NODE_HEIGHT;
    const targetZoom = clamp(
      Math.min(
        (viewportWidth * 0.7) / nodeWidth,
        (viewportHeight * 0.64) / nodeHeight,
      ),
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
    viewportElement?.classList.add(
      "transition-transform",
      "duration-300",
      "ease-out",
    );
  }, [
    annotationTargetNode,
    annotationWorkspace.open,
    reactFlowInstance,
    storeOnNodesChange,
  ]);

  const openContextMenuAt = useCallback(
    (x: number, y: number, mode: "create" | "upload" = "create") => {
      if (annotationWorkspace.open) {
        return;
      }

      setCanvasMenuMode(mode);
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

      const detail = (event as CustomEvent<{
        x: number;
        y: number;
        mode?: "create" | "upload";
      }>).detail;
      if (!detail) {
        return;
      }
      openContextMenuAt(detail.x, detail.y, detail.mode ?? "create");
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

      event.preventDefault();
    },
    [annotationWorkspace.open],
  );

  // 鑿滃崟鍏抽棴鏃讹紝缁熶竴娓呯悊鎷栫嚎鐘舵€侊紝閬垮厤棰勮绾挎畫鐣欍€?
  const handleCanvasContextMenuOpenChange = useCallback((open: boolean) => {
    if (open) {
      return;
    }

    pendingConnectRef.current = null;
    setConnectionGhost(null);
    setCanvasMenuMode("create");
  }, []);

  // 閫氳繃鍘熺敓 dblclick 浜嬩欢瀹炵幇鍙屽嚮鍞ゅ嚭鑿滃崟
  const handleNativeDblClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (annotationWorkspace.open) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // 鍙搷搴旂偣鍦ㄧ敾甯冪┖鐧藉尯鍩燂紙.react-flow__pane锛変笂鐨勫弻鍑?
      const target = event.target as Element;
      if (
        target.closest(
          'input, textarea, select, button, [contenteditable="true"], .ProseMirror, .nodrag, .nopan',
        )
      ) {
        return;
      }

      if (target.closest(".react-flow__pane")) {
        // 闃绘 ReactFlow 榛樿鐨勫弻鍑荤缉鏀捐涓?
        event.preventDefault();
        event.stopPropagation();
        openContextMenuAt(event.clientX, event.clientY, "create");
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
                const sourceNode = allNodes.find(
                  (node) => node.id === pendingConnect.nodeId,
                );
                const targetNodeType =
                  getCanvasNodeTypeFromFlowNode(targetNode);
                if (canPassMediaToNodeType(sourceNode, targetNodeType)) {
                  onConnect({
                    source: pendingConnect.nodeId,
                    sourceHandle: pendingConnect.handleId ?? "output",
                    target: targetNode.id,
                    targetHandle: "input",
                  });
                }
              } else {
                const pendingNode = allNodes.find(
                  (node) => node.id === pendingConnect.nodeId,
                );
                const targetNodeType =
                  getCanvasNodeTypeFromFlowNode(pendingNode);
                if (canPassMediaToNodeType(targetNode, targetNodeType)) {
                  onConnect({
                    source: targetNode.id,
                    sourceHandle: "output",
                    target: pendingConnect.nodeId,
                    targetHandle: pendingConnect.handleId ?? "input",
                  });
                }
              }
            }

            pendingConnectRef.current = null;
            setConnectionGhost(null);
            return;
          }
        }
      }

      // 鏈懡涓妭鐐规椂锛屼繚鐣欒櫄鎷熻繛绾垮苟鎵撳紑鑿滃崟銆?
      openContextMenuAt(pointer.clientX, pointer.clientY);
    },
    [
      annotationWorkspace.open,
      screenToFlowPosition,
      onConnect,
      openContextMenuAt,
    ],
  );

  const handleCreateNodeFromMenu = useCallback(
    (nodeType: CanvasNodeType) => {
      if (annotationWorkspace.open) {
        setConnectionGhost(null);
        return;
      }

      const flowPosition = screenToFlowPosition(menuScreenPosition);
      const newNodeId = addNode(nodeType, flowPosition);
      const allNodes = useCanvasFlowStore.getState().nodes;
      const sourceNodeById = new Map(allNodes.map((node) => [node.id, node]));

      const pendingConnect = pendingConnectRef.current;
      if (!pendingConnect) {
        setConnectionGhost(null);
        return;
      }

      if (pendingConnect.handleType === "source") {
        if (
          canPassMediaToNodeType(
            sourceNodeById.get(pendingConnect.nodeId),
            nodeType,
          )
        ) {
          onConnect({
            source: pendingConnect.nodeId,
            sourceHandle: pendingConnect.handleId ?? "output",
            target: newNodeId,
            targetHandle: "input",
          });
        }
      } else {
        const pendingTargetNodeType = getCanvasNodeTypeFromFlowNode(
          sourceNodeById.get(pendingConnect.nodeId),
        );
        if (
          canPassMediaToNodeType(
            sourceNodeById.get(newNodeId),
            pendingTargetNodeType,
          )
        ) {
          onConnect({
            source: newNodeId,
            sourceHandle: "output",
            target: pendingConnect.nodeId,
            targetHandle: pendingConnect.handleId ?? "input",
          });
        }
      }

      pendingConnectRef.current = null;
      setConnectionGhost(null);
    },
    [
      annotationWorkspace.open,
      addNode,
      menuScreenPosition,
      onConnect,
      screenToFlowPosition,
    ],
  );

  const handleUploadMediaFromMenu = useCallback(() => {
    if (annotationWorkspace.open) {
      return;
    }

    const input = uploadMediaInputRef.current;
    if (!input) {
      return;
    }

    input.value = "";
    input.click();
  }, [annotationWorkspace.open]);

  const handleUploadMediaInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.currentTarget.files ?? []);
      event.currentTarget.value = "";

      if (annotationWorkspace.open || files.length === 0) {
        return;
      }

      void handleFiles(files, screenToFlowPosition(menuScreenPosition));
    },
    [
      annotationWorkspace.open,
      handleFiles,
      menuScreenPosition,
      screenToFlowPosition,
    ],
  );

  // 鑿滃崟鎬侀瑙堢嚎锛氭牴鎹嫋绾垮紑濮嬬殑鑺傜偣鍜岃彍鍗曚綅缃紝璁＄畻鍑轰竴涓ǔ瀹氱殑鏄剧ず璺緞銆?
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

  // Quick Add 棰勮绾匡細姣忎釜閫変腑鑺傜偣閮界粯鍒朵竴鏉＄嚎锛岀粺涓€鎸囧悜鎷栨嫿鐐规垨鑿滃崟钀界偣銆?
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
        const endPoint = shortenLineEnd(
          startX,
          startY,
          targetX,
          targetY,
          inset,
        );

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

  // 鎸変綇鈥?鈥濆紑濮嬫嫋鎷斤細鏄剧ず棰勮杩炵嚎锛涙澗鎵嬪悗鍦ㄩ噴鏀剧偣鎵撳紑绫诲瀷鑿滃崟銆?
  const handleQuickAddPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (annotationWorkspace.open) {
        return;
      }

      if (!selectionRightCenterFlowPosition || multiSelectedCount < 2) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      quickAddSelectionSnapshotRef.current = [...multiSelectedNodeIds];

      setQuickAddDragPreview({
        active: true,
        startX: event.clientX,
        startY: event.clientY,
        endX: event.clientX,
        endY: event.clientY,
      });

      // 鎷栨嫿棰勮閲囩敤 rAF 鍚堝抚锛岄檷浣?pointermove 椋庢毚涓嬬殑 setState 棰戠巼銆?
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

        const flowPosition = screenToFlowPosition({ x: endX, y: endY });
        const allNodes = useCanvasFlowStore.getState().nodes;
        const targetNode = allNodes.find((node) => {
          const nodeWidth =
            node.width ?? node.measured?.width ?? FALLBACK_NODE_WIDTH;
          const nodeHeight =
            node.height ?? node.measured?.height ?? FALLBACK_NODE_HEIGHT;

          return (
            flowPosition.x >= node.position.x &&
            flowPosition.x <= node.position.x + nodeWidth &&
            flowPosition.y >= node.position.y &&
            flowPosition.y <= node.position.y + nodeHeight
          );
        });

        const targetNodeType = getCanvasNodeTypeFromFlowNode(targetNode);
        if (targetNode && targetNodeType) {
          const nodeById = new Map(allNodes.map((node) => [node.id, node]));
          const existingEdges = useCanvasFlowStore.getState().edges;
          const edgeKeySet = new Set(
            existingEdges.map(
              (edge) =>
                `${edge.source}:${edge.sourceHandle ?? "output"}->${edge.target}:${edge.targetHandle ?? "input"}`,
            ),
          );

          quickAddSelectionSnapshotRef.current
            .filter((sourceId) => sourceId !== targetNode.id)
            .filter((sourceId) =>
              canPassMediaToNodeType(nodeById.get(sourceId), targetNodeType),
            )
            .forEach((sourceId) => {
              const edgeKey = `${sourceId}:output->${targetNode.id}:input`;
              if (edgeKeySet.has(edgeKey)) {
                return;
              }

              edgeKeySet.add(edgeKey);
              onConnect({
                source: sourceId,
                sourceHandle: "output",
                target: targetNode.id,
                targetHandle: "input",
              });
            });

          quickAddSelectionSnapshotRef.current = [];
          setQuickAddMenuScreenPosition(null);
          setQuickAddMenuOpen(false);
          return;
        }

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
      onConnect,
      screenToFlowPosition,
      selectionRightCenterFlowPosition,
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
      const sourceNodeById = new Map(allNodes.map((node) => [node.id, node]));
      const connectableSourceNodeIds = sourceNodeIds.filter((sourceId) =>
        canPassMediaToNodeType(sourceNodeById.get(sourceId), nodeType),
      );

      const existingEdges = useCanvasFlowStore.getState().edges;
      const edgeKeySet = new Set(
        existingEdges.map(
          (edge) =>
            `${edge.source}:${edge.sourceHandle ?? "output"}->${edge.target}:${edge.targetHandle ?? "input"}`,
        ),
      );

      connectableSourceNodeIds.forEach((sourceId) => {
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
        onUploadMedia={handleUploadMediaFromMenu}
        onOpenChange={handleCanvasContextMenuOpenChange}
        mode={canvasMenuMode}
      >
        <div
          ref={contextMenuTriggerRef}
          className="h-full w-full relative"
          data-selection-box-active={isSelectionBoxActive ? "true" : undefined}
          onPointerDownCapture={handleCanvasPointerDownCapture}
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

          {/* 鑿滃崟鎬佽櫄鎷熻繛绾匡細鍦ㄦ嫋绾块噴鏀惧悗淇濈暀杩炴帴鎰熴€?*/}
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

          <input
            ref={uploadMediaInputRef}
            accept="image/*,video/*,audio/*"
            className="hidden"
            multiple
            onChange={handleUploadMediaInputChange}
            type="file"
          />

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
            onSelectionStart={handleSelectionStart}
            onSelectionEnd={handleSelectionEnd}
            onPaneClick={handlePaneClick}
            onMove={shouldTrackViewport ? handleViewportMove : undefined}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={!isAnnotationLocked && !isSpacePressed}
            nodesConnectable={!isAnnotationLocked}
            nodesFocusable={!isAnnotationLocked}
            edgesFocusable={!isAnnotationLocked}
            elementsSelectable={!isAnnotationLocked && !isSpacePressed}
            fitView
            fitViewOptions={{
              padding: 0.1,
              minZoom: DEFAULT_OPEN_ZOOM,
              maxZoom: DEFAULT_OPEN_ZOOM,
            }}
            minZoom={MIN_CANVAS_ZOOM}
            maxZoom={MAX_CANVAS_ZOOM}
            colorMode="dark"
            style={{ background: "#090909" }}
            deleteKeyCode={null}
            panOnDrag={
              isAnnotationLocked ? false : isSpacePressed ? [0, 2] : [2]
            }
            panActivationKeyCode={isAnnotationLocked ? null : "Space"}
            noPanClassName={isSpacePressed ? "__space-pan-disabled" : "nopan"}
            selectionOnDrag={!isAnnotationLocked && !isSpacePressed}
            selectionKeyCode={null}
            selectionMode={SelectionMode.Full}
            multiSelectionKeyCode={["Shift"]}
            panOnScroll={!isAnnotationLocked}
            panOnScrollSpeed={0.5}
            zoomOnDoubleClick={false}
            zoomOnScroll={!isAnnotationLocked}
            zoomOnPinch={!isAnnotationLocked}
            preventScrolling={false}
            connectionLineStyle={connectionLineStyle}
            // 鍚搁檮寮€鍏充笌缃戞牸灏哄鐢辫缃腑蹇冮┍鍔?
            snapToGrid={snapToGrid}
            snapGrid={[20, 20]}
            connectionRadius={50}
            defaultEdgeOptions={defaultEdgeOptions}
          >
            <ViewportPortal>
              <div className="pointer-events-none absolute left-0 top-0 z-[-1]">
                {groupFrames.map((group) => {
                  const isSelected = group.id === selectedGroupId;

                  return (
                    <div
                      key={group.id}
                      className={cn(
                        "absolute left-0 top-0 rounded-[16px] border transition-colors duration-150 will-change-transform",
                        isSelected
                          ? "border-[#B43FEB]/75 bg-[#272b33]/34 shadow-[0_12px_34px_rgba(0,0,0,0.26),0_0_0_1px_rgba(180,63,235,0.22),0_0_24px_rgba(180,63,235,0.12),inset_0_1px_0_rgba(255,255,255,0.1)]"
                          : "border-white/18 bg-[#272b33]/24 shadow-[0_8px_24px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.06)]",
                      )}
                      style={{
                        transform: `translate3d(${group.bounds.x}px, ${group.bounds.y}px, 0)`,
                        width: `${group.bounds.width}px`,
                        height: `${group.bounds.height}px`,
                      }}
                    >
                      <div
                        className={cn(
                          "absolute inset-x-0 top-0 h-8 rounded-t-[16px] bg-gradient-to-b from-white/8 to-transparent",
                          isSelected ? "opacity-70" : "opacity-40",
                        )}
                      />
                    </div>
                  );
                })}
              </div>

              {selectionBoundsFlow &&
              !isSelectionBoxActive &&
              !isSpacePressed ? (
                <div
                  className="pointer-events-none absolute left-0 top-0 z-[11] rounded-lg border border-dashed border-[#B43FEB]/70 bg-[#B43FEB]/10 shadow-[0_0_0_1px_rgba(180,63,235,0.18),0_0_24px_rgba(180,63,235,0.18)]"
                  style={{
                    transform: `translate3d(${selectionBoundsFlow.x - 8}px, ${selectionBoundsFlow.y - 8}px, 0)`,
                    width: `${selectionBoundsFlow.width + 16}px`,
                    height: `${selectionBoundsFlow.height + 16}px`,
                  }}
                />
              ) : null}

              {selectionRightCenterFlowPosition &&
              multiSelectedCount >= 2 &&
              !isSelectionBoxActive &&
              !quickAddDragPreview.active ? (
                <MultiSelectQuickCreate
                  visible
                  x={selectionRightCenterFlowPosition.x}
                  y={selectionRightCenterFlowPosition.y}
                  onPointerDown={handleQuickAddPointerDown}
                />
              ) : null}
            </ViewportPortal>

            {gridVisible && (
              <Background
                id="canvas-grid-dots"
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1}
              />
            )}
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

          <CanvasBatchToolbar
            mode={batchToolbarMode}
            selectedCount={multiSelectedCount}
            groupCount={activeBatchGroup?.nodeIds.length ?? 0}
            position={selectedGroupToolbarPosition ?? selectionToolbarPosition}
            onCreateGroup={() => {
              createGroup(multiSelectedNodeIds);
            }}
            onLayoutHorizontal={() => {
              if (!activeBatchGroup) {
                return;
              }
              layoutGroupHorizontal(activeBatchGroup.id);
            }}
            onGridLayout={() => {
              if (!activeBatchGroup) {
                return;
              }
              layoutGroupGrid(activeBatchGroup.id);
            }}
            onUngroup={() => {
              if (!activeBatchGroup) {
                return;
              }
              ungroup(activeBatchGroup.id);
            }}
          />

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

          {/* 杩斿洖鎸夐挳 */}
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

          {/* 鎷栨嫿鏃惰窡韪厜鏍囩殑 + 绗﹀彿 */}
          {quickAddDragPreview.active ? (
            <div
              className="fixed left-0 top-0 z-20 pointer-events-none"
              style={{
                width: "34px",
                height: "34px",
                transform: `translate3d(${quickAddDragPreview.endX}px, ${quickAddDragPreview.endY}px, 0) translate(-50%, -50%)`,
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

          {/* 閲婃斁鐐硅妭鐐圭被鍨嬭彍鍗曪紙鐢ㄤ簬鎵归噺杩炵嚎鍒涘缓锛?*/}
          {quickAddMenuScreenPosition ? (
            <DropdownMenu
              open={quickAddMenuOpen}
              onOpenChange={handleQuickAddMenuOpenChange}
            >
              <DropdownMenuTrigger asChild>
                <div
                  className="absolute left-0 top-0 size-2"
                  style={{
                    transform: `translate3d(${quickAddMenuScreenPosition.x}px, ${quickAddMenuScreenPosition.y}px, 0) translate(-50%, -50%)`,
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
                  新建生成图片节点
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer"
                  onSelect={() => handleCreateNodeFromQuickAddMenu("video")}
                >
                  <IconVideo size={16} />
                  新建生成视频节点
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer"
                  onSelect={() => handleCreateNodeFromQuickAddMenu("newVideo")}
                >
                  <IconVideo size={16} />
                  新建生成视频节点(新版)
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer"
                  onSelect={() => handleCreateNodeFromQuickAddMenu("audio")}
                >
                  <IconMusic size={16} />
                  新建生成音频节点
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

      {/* 鎷栨嫿涓婁紶閬僵 */}
      <DragOverlay
        isVisible={dragState.isDragging}
        fileCount={dragState.fileCount}
        acceptedTypes={dragState.acceptedTypes}
      />

      {/* 纭閫€鍑哄璇濇 */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="bg-[#1a1a1f] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white">
              确认离开
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-400">
              当前有{" "}
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

      <Dialog
        open={deleteConfirmDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseDeleteConfirmDialog();
          }
        }}
      >
        <DialogContent className="border-white/10 bg-[#1a1a1f] shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white">
              {deleteConfirmDialog.title}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm leading-6 text-gray-300">
              {deleteConfirmDialog.message}
            </p>
          </div>
          <DialogFooter className="border-white/10">
            <Button
              variant="default"
              size="sm"
              onClick={handleCloseDeleteConfirmDialog}
              className="flex items-center gap-2 border border-white/10 bg-transparent text-gray-300 hover:bg-white/5"
            >
              取消
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleConfirmDeleteDialog}
              className="flex items-center gap-2 bg-[#B43FEB] text-white hover:bg-[#B43FEB]/80"
            >
              {deleteConfirmDialog.confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
