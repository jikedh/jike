import {
  type NodeProps,
  Position,
  type Viewport,
  useReactFlow,
  useUpdateNodeInternals,
} from "@xyflow/react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { uploadFileToOSS } from "service/oss";
import {
  ADOBE_GPT_IMAGE2_MODEL,
  ADOBE_NANO_BANANA_PRO_MODEL,
  isGrokImageGenerationModel,
  isXimuImageGenerationModel,
  NANO_BANANA_LOCAL_MODEL,
  NANO_BANANA_LOCAL_PLATFORM,
} from "shared/constants/ai-models";
import { setProjectCoverFromMediaRef } from "service/projectStorage";
import { GenerationStatus } from "shared/constants/enum";
import type { ImageNodeType } from "shared/types/flow";
import { compressImage, MAX_IMAGE_SIZE_MB } from "shared/utils/imageCompress";
import { getRemoteMediaUrl } from "shared/utils/mediaPersistence";
import { assignMissingMediaSequences } from "shared/utils/mediaSequence";
import { cn } from "shared/utils/utils";
import { toast } from "sonner";
import { ButtonHandle } from "@/components/button-handle";
import { dispatchCreateAssetFromNode } from "@/pages/Canvas/components/CanvasSidebar";
import { PanoramaViewer } from "@/components/panorama/PanoramaViewer";
import { NodeContextMenu } from "@/pages/Canvas/components/NodeContextMenu";
import { requestCanvasDeleteConfirm } from "@/pages/Canvas/utils/deleteConfirm";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";
import { NodeNameBadge } from "../shared/NodeNameBadge";
import { saveToolMediaFileToProject } from "../utils/localMedia";
import { ImageAnnotationWorkspace } from "./ImageAnnotationWorkspace";
import { ImageContent } from "./ImageContent";
import { ImageGridCropDialog } from "./ImageGridCropDialog";
import { ImageLightingDialog } from "./ImageLightingDialog";
import { ImagePromptPanel } from "./ImagePromptPanel";
import { ImageToolbar } from "./ImageToolbar";
import { IconPhoto } from "@tabler/icons-react";
import {
  getAspectRatioFromMediaFile,
  getNodeSizeByAspectRatio,
} from "./utils/aspectRatioUtils";
import {
  buildLightingPrompt,
  type LightingGenerationConfig,
} from "./utils/lighting";

const DRAG_UI_RESTORE_DELAY = 140;
const FALLBACK_NODE_WIDTH = 350;
const FALLBACK_NODE_HEIGHT = 250;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * 图片节点组件
 * 职责：
 * - 不支持拖拽调整尺寸，使用内容驱动与样式约束
 * - 提供左右 Handle 用于流程连接
 * - 展示图片内容、生成状态与进度
 * - 提供工具栏操作（复制、删除、重新生成）
 * - 支持点击图片重新排序（将点击的图片移到首位）
 * - 支持查看全景图功能
 */
export const ImageNode = memo(
  ({ id, data, selected, dragging }: NodeProps<ImageNodeType>) => {
    const isDragging = Boolean(dragging);
    const [isDragUiSettled, setIsDragUiSettled] = useState(!isDragging);
    const [isGalleryExpanded, setIsGalleryExpanded] = useState(false);
    const [isGridCropOpen, setIsGridCropOpen] = useState(false);
    const [isLightingDialogOpen, setIsLightingDialogOpen] = useState(false);
    const [isLightingGenerating, setIsLightingGenerating] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const previousLightingViewportRef = useRef<Viewport | null>(null);
    const reactFlowInstance = useReactFlow();
    const reactFlowInstanceRef = useRef(reactFlowInstance);
    reactFlowInstanceRef.current = reactFlowInstance;
    const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode);
    const deleteNode = useCanvasFlowStore((state) => state.deleteNode);
    const updateNodeNickname = useCanvasFlowStore(
      (state) => state.updateNodeNickname,
    );
    const addNode = useCanvasFlowStore((state) => state.addNode);
    const splitImage = useCanvasFlowStore((state) => state.splitImage);
    const createGroup = useCanvasFlowStore((state) => state.createGroup);
    const separateToNodes = useCanvasFlowStore(
      (state) => state.separateToNodes,
    );
    const updateImageNodeData = useCanvasFlowStore(
      (state) => state.updateImageNodeData,
    );
    const updateNodeDimensions = useCanvasFlowStore(
      (state) => state.updateNodeDimensions,
    );
    const onConnect = useCanvasFlowStore((state) => state.onConnect);
    const startImageGeneration = useCanvasFlowStore(
      (state) => state.startImageGeneration,
    );
    const startGeminiPro2Generation = useCanvasFlowStore(
      (state) => state.startGeminiPro2Generation,
    );
    const highlightedSourceNodeIds = useCanvasFlowStore(
      (state) => state.highlightedSourceNodeIds,
    );
    const activeNodeId = useCanvasFlowStore((state) => state.activeNodeId);
    // 从 store 直接读取选中节点数量，避免 O(n²) 遍历
    const selectedNodesCount = useCanvasFlowStore(
      (state) => state.selectedNodesCount,
    );
    const projectId = useCanvasFlowStore((state) => state.projectId);
    const setDefaultImagePreset = useChatSettingsStore(
      (state) => state.setDefaultImagePreset,
    );

    // 全景图查看器状态
    const panoramaViewer = useCanvasFlowStore((state) => state.panoramaViewer);
    const closePanoramaViewer = useCanvasFlowStore(
      (state) => state.closePanoramaViewer,
    );
    const annotationWorkspace = useCanvasFlowStore(
      (state) => state.annotationWorkspace,
    );
    const openImageAnnotation = useCanvasFlowStore(
      (state) => state.openImageAnnotation,
    );

    const isAnnotationMode = annotationWorkspace.open;
    const isAnnotationTarget = annotationWorkspace.sourceNodeId === id;
    const isActiveNode = activeNodeId === id && selected;

    // 使用 useMemo 缓存样式类名，避免每次渲染都重新拼接字符串
    useEffect(() => {
      if (isDragging) {
        setIsDragUiSettled(false);
        return;
      }

      const timer = window.setTimeout(() => {
        setIsDragUiSettled(true);
      }, DRAG_UI_RESTORE_DELAY);

      return () => {
        window.clearTimeout(timer);
      };
    }, [isDragging]);

    const handleVisibilityClass = useMemo(
      () =>
        isGalleryExpanded || isAnnotationMode
          ? "invisible opacity-0"
          : isActiveNode
            ? "visible opacity-100"
            : "invisible opacity-0 group-hover/node:visible group-hover/node:opacity-100",
      [isActiveNode, isAnnotationMode, isGalleryExpanded],
    );

    // 使用 useMemo 缓存工具栏显示条件，避免每次渲染都重新计算
    const shouldShowToolbar = useMemo(
      () =>
        isActiveNode &&
        !isDragging &&
        isDragUiSettled &&
        selectedNodesCount <= 1 &&
        !isAnnotationMode,
      [
        isActiveNode,
        isDragging,
        isDragUiSettled,
        isAnnotationMode,
        selectedNodesCount,
      ],
    );

    const isSourceHighlighted = useMemo(() => {
      return highlightedSourceNodeIds.includes(id);
    }, [highlightedSourceNodeIds, id]);

    // 根据 data.size（如 "1:1", "16:9"）动态计算节点尺寸，按图片原始比例展示
    const nodeSize = useMemo(() => {
      const sizeStr = data.size;
      if (!sizeStr || !sizeStr.includes(":")) {
        return { width: 350, height: 250, aspectRatio: "7/5" };
      }
      const [w, h] = sizeStr.split(":").map(Number);
      if (!w || !h) {
        return { width: 350, height: 250, aspectRatio: "7/5" };
      }
      const computed = getNodeSizeByAspectRatio(sizeStr, 250);
      return {
        width: computed.width,
        height: computed.height,
        aspectRatio: `${w}/${h}`,
      };
    }, [data.size]);

    // 节点尺寸变化时，通知 ReactFlow 重新计算 Handle 位置，确保连线贴合节点边缘
    const updateNodeInternals = useUpdateNodeInternals();
    useEffect(() => {
      updateNodeInternals(id);
    }, [nodeSize.width, nodeSize.height, id, updateNodeInternals]);

    useEffect(() => {
      updateNodeDimensions(id, nodeSize.width, nodeSize.height);
    }, [id, nodeSize.height, nodeSize.width, updateNodeDimensions]);

    const isGenerating = useMemo(() => {
      const status = data.status ?? GenerationStatus.COMPLETED;
      return (
        status === GenerationStatus.IN_PROGRESS ||
        status === GenerationStatus.QUEUED
      );
    }, [data.status]);
    const isUploadImage = data.isUpload ?? false;
    const badgeLabel =
      data.nickname ??
      data.badgeLabel ??
      (isUploadImage ? "上传图片" : "生成图片");

    const confirmDeleteIfNeeded = useCallback(() => {
      if (!isGenerating) {
        return true;
      }

      requestCanvasDeleteConfirm({
        message: "当前图片节点还在生成中，确定要删除吗？",
        onConfirm: () => deleteNode(id),
      });
      return false;
    }, [deleteNode, id, isGenerating]);

    const handleDelete = useCallback(() => {
      if (!confirmDeleteIfNeeded()) {
        return;
      }
      deleteNode(id);
    }, [confirmDeleteIfNeeded, deleteNode, id]);

    // 缓存传递给 NodeContextMenu 的回调函数
    const handleContextMenuDuplicate = useCallback(() => {
      duplicateNode(id);
    }, [duplicateNode, id]);

    const handleContextMenuDelete = useCallback(() => {
      if (!confirmDeleteIfNeeded()) {
        return;
      }
      deleteNode(id);
    }, [confirmDeleteIfNeeded, deleteNode, id]);

    const handleRenameStart = useCallback(() => {
      if (isActiveNode) {
        setIsRenaming(true);
      }
    }, [isActiveNode]);

    const handleRename = useCallback(
      (name: string) => {
        updateNodeNickname(id, name);
      },
      [id, updateNodeNickname],
    );

    const handleContextMenuSplitImage = useCallback(
      (gridSize: number) => {
        splitImage(id, gridSize);
      },
      [splitImage, id],
    );

    const handleContextMenuGridCrop = useCallback(() => {
      const currentUrl = data.result?.data?.[0]?.url;
      if (!currentUrl) {
        toast.info("暂无可宫格裁剪图片");
        return;
      }
      setIsGridCropOpen(true);
    }, [data.result?.data]);

    const handleContextMenuSeparateToNodes = useCallback(() => {
      separateToNodes(id);
    }, [separateToNodes, id]);

    const handleContextMenuSetAsCover = useCallback(async () => {
      if (!projectId) {
        toast.error("当前项目不存在");
        return;
      }

      const primaryImage = data.result?.data?.[0];
      if (!primaryImage) {
        toast.info("当前图片节点暂无可用图片");
        return;
      }

      try {
        const savedCoverName = await setProjectCoverFromMediaRef(
          projectId,
          primaryImage,
        );

        if (!savedCoverName) {
          toast.error("封面图设置失败");
          return;
        }

        toast.success("已设置为项目封面图");
      } catch (error) {
        console.error("设置项目封面图失败:", error);
        toast.error("封面图设置失败");
      }
    }, [data.result?.data, projectId]);

    const hasMultipleResults = (data.result?.data?.length ?? 0) > 1;
    const currentImageUrl =
      getRemoteMediaUrl(data.result?.data?.[0]) ?? data.result?.data?.[0]?.url;

    const restoreLightingViewport = useCallback(() => {
      const previousViewport = previousLightingViewportRef.current;
      previousLightingViewportRef.current = null;

      if (previousViewport) {
        reactFlowInstanceRef.current.setViewport(previousViewport, {
          duration: 260,
        });
      }
    }, []);

    const focusLightingSourceNode = useCallback(() => {
      const sourceNode = useCanvasFlowStore
        .getState()
        .nodes.find((node) => node.id === id);
      if (!sourceNode) {
        return;
      }

      if (!previousLightingViewportRef.current) {
        previousLightingViewportRef.current =
          reactFlowInstanceRef.current.getViewport();
      }

      const flowElement = document.querySelector(
        ".react-flow",
      ) as HTMLElement | null;
      const bounds = flowElement?.getBoundingClientRect();
      const viewportWidth = bounds?.width ?? window.innerWidth;
      const viewportHeight = bounds?.height ?? window.innerHeight;
      const nodeWidth = sourceNode.width ?? FALLBACK_NODE_WIDTH;
      const nodeHeight = sourceNode.height ?? FALLBACK_NODE_HEIGHT;
      const targetZoom = clamp(
        Math.min(
          (viewportWidth * 0.7) / nodeWidth,
          (viewportHeight * 0.64) / nodeHeight,
        ),
        0.45,
        1.85,
      );
      const centerX = sourceNode.position.x + nodeWidth / 2;
      const centerY = sourceNode.position.y + nodeHeight / 2;
      const nextViewport = {
        x: viewportWidth / 2 - centerX * targetZoom,
        y: viewportHeight / 2 - centerY * targetZoom + viewportHeight * 0.035,
        zoom: targetZoom,
      };

      reactFlowInstanceRef.current.setViewport(nextViewport, { duration: 280 });
    }, [id]);

    const handleLightingDialogOpenChange = useCallback(
      (open: boolean) => {
        if (open && isLightingGenerating) {
          return;
        }

        if (open) {
          focusLightingSourceNode();
        } else {
          restoreLightingViewport();
        }

        setIsLightingDialogOpen(open);
      },
      [focusLightingSourceNode, isLightingGenerating, restoreLightingViewport],
    );

    useEffect(() => {
      return () => {
        restoreLightingViewport();
      };
    }, [restoreLightingViewport]);

    // 裁剪完成后：上传裁剪文件、创建子节点，并把裁剪结果挂到新节点上
    const handleCrop = useCallback(
      async (file: File, cropRatio?: string) => {
        try {
          const sourceNode = useCanvasFlowStore
            .getState()
            .nodes.find((node) => node.id === id);
          if (!sourceNode || sourceNode.type !== "imageNode") {
            throw new Error("当前图片节点不存在");
          }

          // 检查文件大小，大于10MB时压缩
          let fileToUpload = file;
          if (file.size > MAX_IMAGE_SIZE_MB) {
            fileToUpload = await compressImage(file);
          }

          const uploadResult = await uploadFileToOSS(fileToUpload);
          if (!uploadResult.url) {
            throw new Error("裁剪图片上传失败");
          }
          const resultItem = await saveToolMediaFileToProject(
            projectId,
            { url: uploadResult.url, remoteUrl: uploadResult.url },
            fileToUpload,
            "image",
            "png",
          );
          const croppedSize =
            cropRatio && cropRatio !== "custom" && cropRatio !== "original"
              ? cropRatio
              : await getAspectRatioFromMediaFile(fileToUpload, "image");

          const childPosition = {
            x: sourceNode.position.x + (sourceNode.width ?? 350) + 80,
            y: sourceNode.position.y,
          };

          const childId = addNode("image", childPosition);

          // 先建立父子连边，方便后续工作流继续沿用图结构。
          onConnect({
            source: id,
            target: childId,
            sourceHandle: "output",
            targetHandle: "input",
          });

          // 再把裁剪后的图片写入子节点，让子节点本身就具备可展示的结果。
          updateImageNodeData(childId, {
            badgeLabel: "裁剪",
            isUpload: true,
            ...(croppedSize ? { size: croppedSize } : {}),
            image_urls: [uploadResult.url],
            result: {
              type: "image",
              data: [resultItem],
            },
            status: GenerationStatus.COMPLETED,
            progress: 100,
          });

          const flowStore = useCanvasFlowStore.getState();
          flowStore.requestHistorySave();
          flowStore.saveGraph();

          toast.success("裁剪成功");
        } catch (error: any) {
          console.error("裁剪图片失败:", error);
          toast.error(error?.message || "裁剪失败，请重试");
          throw error;
        }
      },
      [addNode, id, onConnect, projectId, updateImageNodeData],
    );

    const handleGridCrop = useCallback(
      async (files: File[]) => {
        try {
          const sourceNode = useCanvasFlowStore
            .getState()
            .nodes.find((node) => node.id === id);
          if (!sourceNode || sourceNode.type !== "imageNode") {
            throw new Error("当前图片节点不存在");
          }

          const uploadedItems: Array<{
            resultItem: {
              url: string;
              remoteUrl?: string;
              localName?: string;
              localPath?: string;
            };
            size?: string;
          }> = [];
          let failedCount = 0;

          for (const file of files) {
            try {
              let fileToUpload = file;
              if (file.size > MAX_IMAGE_SIZE_MB) {
                fileToUpload = await compressImage(file);
              }

              const uploadResult = await uploadFileToOSS(fileToUpload);
              if (!uploadResult.url) {
                throw new Error("宫格裁剪图片上传失败");
              }

              const croppedSize = await getAspectRatioFromMediaFile(
                fileToUpload,
                "image",
              );
              const resultItem = await saveToolMediaFileToProject(
                projectId,
                { url: uploadResult.url, remoteUrl: uploadResult.url },
                fileToUpload,
                "image",
                "png",
              );
              uploadedItems.push({ resultItem, size: croppedSize });
            } catch (error) {
              failedCount += 1;
              console.error("宫格裁剪图片失败:", error);
            }
          }

          if (uploadedItems.length === 0) {
            throw new Error("宫格裁剪图片上传失败");
          }

          const layoutCols = Math.max(
            1,
            Math.ceil(Math.sqrt(uploadedItems.length)),
          );
          const baseX = sourceNode.position.x + (sourceNode.width ?? 350) + 80;
          const baseY = sourceNode.position.y;
          const gap = 56;

          const createdNodeIds: string[] = [];

          uploadedItems.forEach((item, index) => {
            const row = Math.floor(index / layoutCols);
            const col = index % layoutCols;
            const childSize = item.size
              ? getNodeSizeByAspectRatio(item.size, 250)
              : { width: 350, height: 250 };
            const childPosition = {
              x: baseX + col * (childSize.width + gap),
              y: baseY + row * (childSize.height + gap),
            };
            const childId = addNode("image", childPosition);
            if (childId) {
              createdNodeIds.push(childId);
            }

            onConnect({
              source: id,
              target: childId,
              sourceHandle: "output",
              targetHandle: "input",
            });

            updateImageNodeData(childId, {
              badgeLabel: "宫格裁剪",
              isUpload: true,
              ...(item.size ? { size: item.size } : {}),
              image_urls: [item.resultItem.url],
              result: {
                type: "image",
                data: [item.resultItem],
              },
              status: GenerationStatus.COMPLETED,
              progress: 100,
            });
          });

          if (createdNodeIds.length > 1) {
            createGroup(createdNodeIds);
          }

          const flowStore = useCanvasFlowStore.getState();
          flowStore.requestHistorySave();
          flowStore.saveGraph();

          toast.success(
            `已裁剪 ${uploadedItems.length} 张宫格图片` +
              (failedCount > 0 ? `，${failedCount} 张失败` : ""),
          );
        } catch (error: any) {
          console.error("宫格裁剪失败:", error);
          toast.error(error?.message || "宫格裁剪失败，请重试");
          throw error;
        }
      },
      [addNode, createGroup, id, onConnect, projectId, updateImageNodeData],
    );

    const handleAnnotate = useCallback(() => {
      const currentUrl = data.result?.data?.[0]?.url;
      if (!currentUrl) {
        toast.info("暂无可标注图片");
        return;
      }
      openImageAnnotation(currentUrl, id, "annotate");
    }, [data.result?.data, id, openImageAnnotation]);

    const handleErase = useCallback(() => {
      const currentUrl = data.result?.data?.[0]?.url;
      if (!currentUrl) {
        toast.info("暂无可擦除图片");
        return;
      }
      openImageAnnotation(currentUrl, id, "erase");
    }, [data.result?.data, id, openImageAnnotation]);

    const handleLightingGenerate = useCallback(
      async (config: LightingGenerationConfig) => {
        if (!currentImageUrl) {
          toast.info("暂无可调光图片");
          throw new Error("暂无可调光图片");
        }

        setIsLightingGenerating(true);

        try {
          const sourceNode = useCanvasFlowStore
            .getState()
            .nodes.find((node) => node.id === id);
          if (!sourceNode || sourceNode.type !== "imageNode") {
            throw new Error("当前图片节点不存在");
          }

          const childPosition = {
            x: sourceNode.position.x + (sourceNode.width ?? 350) + 80,
            y: sourceNode.position.y,
          };
          const childId = addNode("image", childPosition);
          if (!childId) {
            throw new Error("灯光图片节点创建失败");
          }

          onConnect({
            source: id,
            target: childId,
            sourceHandle: "output",
            targetHandle: "input",
          });

          const isNiji7Model = config.model === "midjourney-niji7";
          const isMidjourneyModel =
            config.model === "midjourney" || isNiji7Model;
          const isAdobeImageModel =
            config.model === ADOBE_GPT_IMAGE2_MODEL ||
            config.model === ADOBE_NANO_BANANA_PRO_MODEL;
          const isXimuImageModel = isXimuImageGenerationModel(config.model);
          const isGrokImageModel = isGrokImageGenerationModel(config.model);
          const isNanoBananaLocalModel =
            config.model === NANO_BANANA_LOCAL_MODEL &&
            config.platform === NANO_BANANA_LOCAL_PLATFORM;
          const isLocalDirectModel =
            isAdobeImageModel ||
            isXimuImageModel ||
            isGrokImageModel ||
            isNanoBananaLocalModel;
          const backendModel = isNiji7Model ? "midjourney" : config.model;
          const size = config.size ?? data.size ?? "1:1";
          const resolution = config.resolution ?? data.resolution ?? "2K";
          const prompt = buildLightingPrompt(config);
          let finalPrompt = prompt;

          if (isMidjourneyModel && !finalPrompt.includes("--ar")) {
            finalPrompt = `${finalPrompt} --ar ${size}`;
            if (isNiji7Model) {
              finalPrompt = `${finalPrompt} --niji 7`;
            }
          }

          const payload = {
            model: backendModel,
            originalModel: config.model,
            platform: config.platform,
            prompt: finalPrompt,
            resolution,
            n: 1,
            image_urls: [currentImageUrl],
            promptDraft: config.aiPrompt ?? "",
            promptDraftHtml: `<p>${config.aiPrompt ?? ""}</p>`,
            size,
            metadata: { resolution },
            lighting: config,
            ...(isMidjourneyModel
              ? {
                  aspectRatio: data.aspectRatio ?? "1:1",
                  midjourneyAdvanced: data.midjourneyAdvanced,
                }
              : {}),
          };

          updateImageNodeData(childId, {
            badgeLabel: "灯光",
            model: config.model,
            originalModel: config.model,
            platform: config.platform,
            prompt: finalPrompt,
            promptDraft: config.aiPrompt ?? "",
            promptDraftHtml: `<p>${config.aiPrompt ?? ""}</p>`,
            image_urls: [currentImageUrl],
            size,
            resolution,
            result: {
              type: "image",
              data: [],
            },
            lighting: config,
          });

          setDefaultImagePreset({
            model: config.model,
            platform: config.platform,
            size,
            resolution,
          });

          if (isLocalDirectModel) {
            await startGeminiPro2Generation(childId, payload);
          } else {
            await startImageGeneration(childId, payload);
          }

          toast.success("已开始灯光重绘生成");
        } catch (error: any) {
          console.error("灯光处理失败:", error);
          toast.error(error?.message || "灯光处理失败，请重试");
          throw error;
        } finally {
          setIsLightingGenerating(false);
        }
      },
      [
        addNode,
        currentImageUrl,
        data.aspectRatio,
        data.midjourneyAdvanced,
        data.resolution,
        data.size,
        id,
        onConnect,
        setDefaultImagePreset,
        startGeminiPro2Generation,
        startImageGeneration,
        updateImageNodeData,
      ],
    );

    // 点击“设为主图”时交换主图与目标图，保持其余顺序不变
    const handleReorder = useCallback(
      (fromIndex: number) => {
        const resultData = data.result?.data;
        if (!resultData || fromIndex <= 0 || fromIndex >= resultData.length)
          return;

        const newData = assignMissingMediaSequences(resultData);
        [newData[0], newData[fromIndex]] = [newData[fromIndex], newData[0]];

        // 通过 store 更新节点数据
        updateImageNodeData(id, {
          result: {
            type: data.result?.type ?? "image",
            data: newData,
          },
        });

        const flowStore = useCanvasFlowStore.getState();
        flowStore.requestHistorySave();
        if (useChatSettingsStore.getState().autoSaveEnabled) {
          flowStore.saveGraph();
        }
      },
      [data.result, id, updateImageNodeData],
    );

    return (
      <>
        <NodeContextMenu
          onDuplicate={handleContextMenuDuplicate}
          onDelete={handleContextMenuDelete}
          onSplitImage={handleContextMenuSplitImage}
          onGridCrop={handleContextMenuGridCrop}
          onSeparateToNodes={handleContextMenuSeparateToNodes}
          onSetAsCover={handleContextMenuSetAsCover}
          onCreateAsset={() => dispatchCreateAssetFromNode(id)}
          hasMultipleResults={hasMultipleResults}
        >
          <div
            className={cn("group/node relative", isGalleryExpanded && "z-40")}
            style={{
              width: `${nodeSize.width}px`,
              height: `${nodeSize.height}px`,
            }}
          >
            {/* 节点内顶部工具栏：直接参与节点缩放，保证几何一致性 */}
            {shouldShowToolbar && (
              <div className="selection-box-deferred-ui nodrag nopan nowheel absolute -top-22 left-1/2 z-50 -translate-x-1/2">
                <ImageToolbar
                  nodeId={id}
                  data={data}
                  onDelete={handleDelete}
                  onCrop={handleCrop}
                  onAnnotate={handleAnnotate}
                  onErase={handleErase}
                  onLighting={() => handleLightingDialogOpenChange(true)}
                  isLightingGenerating={isLightingGenerating}
                />
              </div>
            )}

            <div
              className={cn(
                "group/card relative flex h-full w-full flex-col rounded-xl border",
                hasMultipleResults &&
                  "bg-linear-to-br from-[#141418] to-[#0d0d10]",
                isAnnotationMode
                  ? "border-transparent shadow-none ring-0"
                  : isActiveNode
                    ? "border-[#B43FEB]/80 shadow-[0_0_25px_rgba(180,63,235,0.4),0_0_50px_rgba(180,63,235,0.15)] ring-1 ring-[#B43FEB]/30"
                    : isSourceHighlighted
                      ? "border-[#B43FEB]/65 shadow-[0_0_18px_rgba(180,63,235,0.28),0_0_36px_rgba(180,63,235,0.12)] ring-1 ring-[#B43FEB]/20"
                      : "border-white/6 hover:border-white/12 hover:bg-linear-to-br hover:from-[#18181c] hover:to-[#101014]",
              )}
            >
              <NodeNameBadge
                icon={<IconPhoto size={14} />}
                selected={isActiveNode}
                isEditing={isRenaming}
                onEditStart={handleRenameStart}
                onEditEnd={() => setIsRenaming(false)}
                onRename={handleRename}
              >
                {badgeLabel}
              </NodeNameBadge>

              {/* 左侧输入 Handle */}
              <ButtonHandle
                type="target"
                position={Position.Left}
                id="input"
                visible
                className={`transition-opacity duration-150 ${isAnnotationMode ? "invisible opacity-0" : handleVisibilityClass}`}
              />

              {/* 右侧输出 Handle */}
              <ButtonHandle
                type="source"
                position={Position.Right}
                id="output"
                visible
                className={`transition-opacity duration-150 ${isAnnotationMode ? "invisible opacity-0" : handleVisibilityClass}`}
              />

              {/* 选中状态角落装饰 */}
              {isActiveNode && !isDragging && !isAnnotationMode && (
                <>
                  <div className="absolute -top-px -left-px w-4 h-4 border-l-2 border-t-2 border-[#B43FEB] rounded-tl-xl" />
                  <div className="absolute -top-px -right-px w-4 h-4 border-r-2 border-t-2 border-[#B43FEB] rounded-tr-xl" />
                  <div className="absolute -bottom-px -left-px w-4 h-4 border-l-2 border-b-2 border-[#B43FEB] rounded-bl-xl" />
                  <div className="absolute -bottom-px -right-px w-4 h-4 border-r-2 border-b-2 border-[#B43FEB] rounded-br-xl" />
                </>
              )}

              {/* 扫光效果 */}
              {!isAnnotationMode ? (
                <div
                  className={cn(
                    "pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-500 group-hover/card:opacity-100",
                    hasMultipleResults &&
                      "bg-linear-to-tr from-transparent via-white/2 to-transparent",
                  )}
                />
              ) : null}

              {/* 图片内容区 - 根据图片比例动态调整 */}
              <div
                className={cn(
                  "relative flex h-full w-full",
                  hasMultipleResults ? "rounded-lg bg-black/30" : "rounded-xl",
                  isGalleryExpanded ? "overflow-visible" : "overflow-hidden",
                )}
                style={{ aspectRatio: nodeSize.aspectRatio }}
              >
                <ImageContent
                  data={data}
                  onReorder={handleReorder}
                  nodeId={id}
                  updateImageNodeData={updateImageNodeData}
                  onGalleryExpandedChange={setIsGalleryExpanded}
                  isNodeActive={isActiveNode}
                  frameSize={{
                    width: nodeSize.width,
                    height: nodeSize.height,
                  }}
                />
              </div>
            </div>

            {/* 节点内底部增强输入区：与节点同一几何空间，缩放时保持一致 */}
            {/* 拖动结束后再挂载，降低首次拖拽时的渲染负担 */}
            {shouldShowToolbar && !isUploadImage && (
              <div className="selection-box-deferred-ui nodrag nopan nowheel absolute top-full left-1/2 z-50 mt-4 w-175 -translate-x-1/2">
                <ImagePromptPanel nodeId={id} />
              </div>
            )}
          </div>
        </NodeContextMenu>

        {/* 全景图查看器 - 使用 Portal 渲染到 body，避免 React Flow 的 CSS 隔离影响 fixed 定位 */}
        {typeof document !== "undefined" &&
        panoramaViewer.open &&
        panoramaViewer.sourceNodeId === id
          ? createPortal(
              <PanoramaViewer
                open={panoramaViewer.open}
                onClose={closePanoramaViewer}
                initialImage={panoramaViewer.imageUrl ?? undefined}
                sourceNodeId={panoramaViewer.sourceNodeId}
              />,
              document.body,
            )
          : null}

        {typeof document !== "undefined" &&
        isAnnotationTarget &&
        annotationWorkspace.open
          ? createPortal(
              <ImageAnnotationWorkspace
                open={annotationWorkspace.open}
                imageUrl={annotationWorkspace.imageUrl}
                sourceNodeId={annotationWorkspace.sourceNodeId}
                mode={annotationWorkspace.mode}
                onClose={() =>
                  useCanvasFlowStore.getState().closeImageAnnotation()
                }
              />,
              document.body,
            )
          : null}

        <ImageGridCropDialog
          open={isGridCropOpen}
          imageUrl={data.result?.data?.[0]?.url}
          onOpenChange={setIsGridCropOpen}
          onConfirm={handleGridCrop}
        />

        <ImageLightingDialog
          open={isLightingDialogOpen}
          imageUrl={currentImageUrl}
          initialModel={data.model}
          initialPlatform={data.platform}
          initialSize={data.size}
          initialResolution={data.resolution}
          onOpenChange={handleLightingDialogOpenChange}
          onConfirm={handleLightingGenerate}
        />
      </>
    );
  },
);

ImageNode.displayName = "ImageNode";
