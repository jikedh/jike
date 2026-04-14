import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ControlButton,
  Controls,
  type FinalConnectionState,
  type InternalNode,
  MiniMap,
  type NodeChange,
  type OnConnectStartParams,
  ReactFlow,
  SelectionMode,
  useReactFlow,
} from "@xyflow/react";
import { ArrowLeft, Eye, EyeOff, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "react-router-dom";
import { uploadFileToOSS } from "service/oss";
import {
  getLocalFilePath,
  saveAudioToLocal,
  saveImageToLocal,
  saveVideoToLocal,
} from "service/projectStorage";
import { GenerationStatus } from "shared/constants/enum";
import type { AllNodeType, EdgeType } from "shared/types/flow";
import { compressImage, MAX_IMAGE_SIZE_MB } from "shared/utils/imageCompress";
import { NodeSearch } from "@/components/node-search";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";
import {
  getClosestAspectRatio,
  getImageDimensions,
} from "../CustomNodes/ImageNode/utils/aspectRatioUtils";
import { edgeTypes, nodeTypes } from "../constants/canvasConfig";
import { CanvasContextMenu, type CanvasNodeType } from "./CanvasContextMenu";

type CanvasFlowProps = {
  projectId: string | undefined;
};

// 画布流组件：仅负责 ReactFlow 相关状态与渲染。
export const CanvasFlow = ({ projectId }: CanvasFlowProps) => {
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

  // 确认对话框状态
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [generatingCount, setGeneratingCount] = useState(0);

  // 跟踪鼠标在画布上的位置，用于粘贴操作
  const [mouseFlowPosition, setMouseFlowPosition] = useState<{ x: number; y: number } | null>(null);

  // 获取正在生成的任务数量和取消方法
  const getGeneratingTasksCount = useCanvasFlowStore(
    (state) => state.getGeneratingTasksCount,
  );
  const cancelAllGeneratingTasks = useCanvasFlowStore(
    (state) => state.cancelAllGeneratingTasks,
  );

  // 获取撤销/重做方法
  const undo = useCanvasFlowStore((state) => state.undo);
  const redo = useCanvasFlowStore((state) => state.redo);
  const canUndo = useCanvasFlowStore((state) => state.canUndo);
  const canRedo = useCanvasFlowStore((state) => state.canRedo);

  // 获取复制/粘贴方法
  const copySelectedNodes = useCanvasFlowStore((state) => state.copySelectedNodes);
  const pasteNodes = useCanvasFlowStore((state) => state.pasteNodes);

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
        if (canUndo()) {
          undo();
        }
      }

      // Ctrl+Shift+Z 或 Cmd+Shift+Z 或 Ctrl+Y：重做
      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key === "y" || (event.key === "z" && event.shiftKey))
      ) {
        event.preventDefault();
        if (canRedo()) {
          redo();
        }
      }

      // Ctrl+C 或 Cmd+C：复制选中节点
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "c" &&
        !event.shiftKey
      ) {
        event.preventDefault();
        copySelectedNodes();
      }

      // Ctrl+V 或 Cmd+V：粘贴节点
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "v" &&
        !event.shiftKey
      ) {
        event.preventDefault();
        // 使用最近记录的鼠标在画布上的位置
        pasteNodes(mouseFlowPosition ?? undefined);
      }
    },
    [undo, redo, canUndo, canRedo, copySelectedNodes, pasteNodes, mouseFlowPosition],
  );

  // 监听键盘事件
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

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
  }, [
    reactFlowInstance,
    snapToGrid,
    snapGridSize,
    storeOnNodesChange,
  ]);

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

  // 当 projectId 变化时切换项目
  useEffect(() => {
    if (projectId && projectId !== currentProjectId) {
      switchProject(projectId);
    }
  }, [projectId, currentProjectId, switchProject]);

  const contextMenuTriggerRef = useRef<HTMLDivElement | null>(null);
  const [menuScreenPosition, setMenuScreenPosition] = useState({ x: 0, y: 0 });
  const [isMiniMapVisible, setIsMiniMapVisible] = useState(true);
  const pendingConnectRef = useRef<{
    nodeId: string;
    handleId: string | null;
    handleType: "source" | "target";
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

  // ==================== 图片拖拽上传逻辑 ====================

  const updateImageNodeData = useCanvasFlowStore(
    (state) => state.updateImageNodeData,
  );

  // 处理图片文件存储到本地项目目录
  const handleImageDrop = useCallback(
    async (files: File[], dropPosition: { x: number; y: number }) => {
      const flowPosition = screenToFlowPosition(dropPosition);
      const projectId = useCanvasFlowStore.getState().projectId;

      const nodeWidth = 350;
      const nodeHeight = 280;
      const gap = 20;
      const cols = 4;

      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const row = Math.floor(index / cols);
        const col = index % cols;

        const nodePosition = {
          x: flowPosition.x + col * (nodeWidth + gap),
          y: flowPosition.y + row * (nodeHeight + gap),
        };

        const newNodeId = addNode("image", nodePosition);

        // 设置初始状态为加载中
        updateImageNodeData(newNodeId, {
          status: GenerationStatus.IN_PROGRESS,
          isUpload: true,
        });

        try {
          // 检查文件大小，大于10MB时压缩
          let fileToUpload = file;
          if (file.size > MAX_IMAGE_SIZE_MB) {
            fileToUpload = await compressImage(file);
          }

          // 上传到 OSS
          const ossResult = await uploadFileToOSS(fileToUpload);
          const ossUrl = ossResult.url;

          if (!ossUrl) {
            updateImageNodeData(newNodeId, {
              status: GenerationStatus.FAILED,
              error: { message: "上传到 OSS 失败" },
            });
            continue;
          }

          // 获取文件扩展名
          const ext = file.name.split(".").pop()?.toLowerCase() || "png";

          // 读取文件为 ArrayBuffer
          const arrayBuffer = await file.arrayBuffer();

          // 存储到本地项目目录
          const fileName = await saveImageToLocal(
            projectId || "",
            arrayBuffer,
            ext,
          );

          if (fileName) {
            // 获取相对路径（用于存储到 canvas.json）
            const relativePath = getLocalFilePath(
              projectId || "",
              "image",
              fileName,
            );

            // 创建 blob URL 用于显示
            const blobUrl = URL.createObjectURL(file);

            // 获取图片尺寸并计算最接近的比例
            try {
              const dimensions = await getImageDimensions(blobUrl);
              const aspectRatio = getClosestAspectRatio(
                dimensions.width,
                dimensions.height,
              );

              updateImageNodeData(newNodeId, {
                status: GenerationStatus.COMPLETED,
                size: aspectRatio,
                isLocalFile: true,
                localFileName: fileName,
                image_urls: [ossUrl],
                result: {
                  type: "image",
                  data: [
                    { url: ossUrl, relativePath, localFileName: fileName },
                  ],
                },
              });
            } catch (error) {
              // 如果获取尺寸失败，使用默认比例
              updateImageNodeData(newNodeId, {
                status: GenerationStatus.COMPLETED,
                isLocalFile: true,
                localFileName: fileName,
                image_urls: [ossUrl],
                result: {
                  type: "image",
                  data: [
                    { url: ossUrl, relativePath, localFileName: fileName },
                  ],
                },
              });
            }
          } else {
            updateImageNodeData(newNodeId, {
              status: GenerationStatus.FAILED,
              error: { message: "存储失败，请检查存储路径设置" },
            });
          }
        } catch (error) {
          console.error("图片存储失败:", error);
          updateImageNodeData(newNodeId, {
            status: GenerationStatus.FAILED,
            error: { message: "存储失败，请重试" },
          });
        }
      }
    },
    [addNode, screenToFlowPosition, updateImageNodeData],
  );

  // ==================== 音频拖拽上传逻辑 ====================

  const updateAudioNodeData = useCanvasFlowStore(
    (state) => state.updateAudioNodeData,
  );

  // 处理音频文件存储到本地项目目录
  const handleAudioDrop = useCallback(
    async (files: File[], dropPosition: { x: number; y: number }) => {
      const flowPosition = screenToFlowPosition(dropPosition);
      const projectId = useCanvasFlowStore.getState().projectId;

      const nodeWidth = 350;
      const nodeHeight = 120;
      const gap = 20;
      const cols = 4;

      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const row = Math.floor(index / cols);
        const col = index % cols;

        const nodePosition = {
          x: flowPosition.x + col * (nodeWidth + gap),
          y: flowPosition.y + row * (nodeHeight + gap),
        };

        const newNodeId = addNode("audio", nodePosition);

        updateAudioNodeData(newNodeId, {
          status: GenerationStatus.IN_PROGRESS,
          isUpload: true,
        });

        try {
          // 获取文件扩展名
          const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";

          // 上传到 OSS
          const ossResult = await uploadFileToOSS(file);
          const ossUrl = ossResult.url;

          if (!ossUrl) {
            updateAudioNodeData(newNodeId, {
              status: GenerationStatus.FAILED,
              error: { message: "上传到 OSS 失败" },
            });
            continue;
          }

          // 读取文件为 ArrayBuffer
          const arrayBuffer = await file.arrayBuffer();

          // 存储到本地项目目录
          const fileName = await saveAudioToLocal(
            projectId || "",
            arrayBuffer,
            ext,
          );

          if (fileName) {
            // 获取相对路径（用于存储到 canvas.json）
            const relativePath = getLocalFilePath(
              projectId || "",
              "audio",
              fileName,
            );

            updateAudioNodeData(newNodeId, {
              status: GenerationStatus.COMPLETED,
              progress: 100,
              isUpload: true,
              isLocalFile: true,
              localFileName: fileName,
              result: {
                type: "audio",
                data: [{ url: ossUrl, relativePath, localFileName: fileName }],
              },
            });
          } else {
            updateAudioNodeData(newNodeId, {
              status: GenerationStatus.FAILED,
              error: { message: "存储失败，请检查存储路径设置" },
            });
          }
        } catch (error) {
          console.error("音频存储失败:", error);
          updateAudioNodeData(newNodeId, {
            status: GenerationStatus.FAILED,
            error: { message: "存储失败，请重试" },
          });
        }
      }
    },
    [addNode, screenToFlowPosition, updateAudioNodeData],
  );

  // ==================== 视频拖拽上传逻辑 ====================

  const updateVideoNodeData = useCanvasFlowStore(
    (state) => state.updateVideoNodeData,
  );

  // 处理视频文件存储到本地项目目录
  const handleVideoDrop = useCallback(
    async (files: File[], dropPosition: { x: number; y: number }) => {
      const flowPosition = screenToFlowPosition(dropPosition);
      const projectId = useCanvasFlowStore.getState().projectId;

      const nodeWidth = 350;
      const nodeHeight = 280;
      const gap = 20;
      const cols = 4;

      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const row = Math.floor(index / cols);
        const col = index % cols;

        const nodePosition = {
          x: flowPosition.x + col * (nodeWidth + gap),
          y: flowPosition.y + row * (nodeHeight + gap),
        };

        const newNodeId = addNode("video", nodePosition);

        updateVideoNodeData(newNodeId, {
          status: GenerationStatus.IN_PROGRESS,
          isUpload: true,
        });

        try {
          // 获取文件扩展名
          const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";

          // 读取文件为 ArrayBuffer
          const arrayBuffer = await file.arrayBuffer();

          // 存储到本地项目目录
          const fileName = await saveVideoToLocal(
            projectId || "",
            arrayBuffer,
            ext,
          );

          if (fileName) {
            // 获取相对路径（用于存储到 canvas.json）
            const relativePath = getLocalFilePath(
              projectId || "",
              "video",
              fileName,
            );

            // 创建 blob URL 用于播放
            const blobUrl = URL.createObjectURL(file);

            updateVideoNodeData(newNodeId, {
              status: GenerationStatus.COMPLETED,
              progress: 100,
              isUpload: true,
              isLocalFile: true,
              localFileName: fileName,
              result: {
                type: "video",
                data: [
                  {
                    url: blobUrl,
                    relativePath,
                    localFileName: fileName,
                    format: ext,
                  },
                ],
              },
            });
          } else {
            updateVideoNodeData(newNodeId, {
              status: GenerationStatus.FAILED,
              error: { message: "存储失败，请检查存储路径设置" },
            });
          }
        } catch (error) {
          console.error("视频存储失败:", error);
          updateVideoNodeData(newNodeId, {
            status: GenerationStatus.FAILED,
            error: { message: "存储失败，请重试" },
          });
        }
      }
    },
    [addNode, screenToFlowPosition, updateVideoNodeData],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [], "audio/*": [], "video/*": [] },
    noClick: true,
    noKeyboard: true,
    onDrop: (acceptedFiles, _rejectedFiles, event) => {
      const dropEvent = event as unknown as DragEvent;
      if (dropEvent && "clientX" in dropEvent && "clientY" in dropEvent) {
        const imageFiles = acceptedFiles.filter((f) =>
          f.type.startsWith("image/"),
        );
        const audioFiles = acceptedFiles.filter((f) =>
          f.type.startsWith("audio/"),
        );
        const videoFiles = acceptedFiles.filter((f) =>
          f.type.startsWith("video/"),
        );

        if (imageFiles.length > 0) {
          handleImageDrop(imageFiles, {
            x: dropEvent.clientX,
            y: dropEvent.clientY,
          });
        }

        if (audioFiles.length > 0) {
          handleAudioDrop(audioFiles, {
            x: dropEvent.clientX,
            y: dropEvent.clientY,
          });
        }

        if (videoFiles.length > 0) {
          handleVideoDrop(videoFiles, {
            x: dropEvent.clientX,
            y: dropEvent.clientY,
          });
        }
      }
    },
  });

  // 处理粘贴图片、音频和视频
  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      // 检查是否在输入框中
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const items = event.clipboardData?.items;
      if (!items) {
        return;
      }

      const imageFiles: File[] = [];
      const audioFiles: File[] = [];
      const videoFiles: File[] = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        } else if (item.type.startsWith("audio/")) {
          const file = item.getAsFile();
          if (file) {
            audioFiles.push(file);
          }
        } else if (item.type.startsWith("video/")) {
          const file = item.getAsFile();
          if (file) {
            videoFiles.push(file);
          }
        }
      }

      if (imageFiles.length > 0) {
        // 有图片，在画布中心位置创建节点
        event.preventDefault();
        handleImageDrop(imageFiles, {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
      }

      if (audioFiles.length > 0) {
        // 有音频，在画布中心位置创建节点
        event.preventDefault();
        handleAudioDrop(audioFiles, {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
      }

      if (videoFiles.length > 0) {
        // 有视频，在画布中心位置创建节点
        event.preventDefault();
        handleVideoDrop(videoFiles, {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
      }
    },
    [handleImageDrop, handleAudioDrop, handleVideoDrop],
  );

  // 监听粘贴事件
  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [handlePaste]);

  return (
    <>
      <CanvasContextMenu onCreateNode={handleCreateNodeFromMenu}>
        <div
          {...getRootProps()}
          ref={contextMenuTriggerRef}
          className="h-full w-full relative"
          onDoubleClick={handleNativeDblClick}
        >
          <input {...getInputProps()} />
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
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable
            fitView
            minZoom={0.2}
            maxZoom={2}
            colorMode="dark"
            deleteKeyCode={["Backspace", "Delete"]}
            panOnDrag={[1]}
            selectionOnDrag
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
            snapGrid={snapGridSize}
            connectionRadius={50}
            defaultEdgeOptions={defaultEdgeOptions}
          >
            {gridVisible && <Background variant={BackgroundVariant.Dots} />}
            <Controls>
              <ControlButton
                onClick={() => setIsMiniMapVisible((prev) => !prev)}
              >
                {isMiniMapVisible ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </ControlButton>
            </Controls>
            {isMiniMapVisible ? (
              <MiniMap
                pannable
                zoomable
                position="bottom-left"
                style={{ left: "48px" }}
                nodeStrokeWidth={0}
                nodeColor="#B43FEB"
                maskColor="rgba(0,0,0,0.5)"
              />
            ) : null}
          </ReactFlow>

          {/* 拖拽覆盖层 */}
          {isDragActive && (
            <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center gap-2 text-primary">
                <Upload className="size-12" />
                <span className="text-lg font-medium">释放图片到画布</span>
              </div>
            </div>
          )}

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
        </div>
      </CanvasContextMenu>

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
