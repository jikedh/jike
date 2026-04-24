import {
  type NodeProps,
  Position,
  useUpdateNodeInternals,
} from "@xyflow/react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { setProjectCoverFromMediaRef } from "service/projectStorage";
import { uploadFileToOSS } from "service/oss";
import { GenerationStatus } from "shared/constants/enum";
import type { ImageNodeType } from "shared/types/flow";
import { compressImage, MAX_IMAGE_SIZE_MB } from "shared/utils/imageCompress";
import { cn } from "shared/utils/utils";
import { toast } from "sonner";
import { ButtonHandle } from "@/components/button-handle";
import { requestCanvasDeleteConfirm } from "@/pages/Canvas/utils/deleteConfirm";
import { PanoramaViewer } from "@/components/panorama/PanoramaViewer";
import { NodeContextMenu } from "@/pages/Canvas/components/NodeContextMenu";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { ImageAnnotationWorkspace } from "./ImageAnnotationWorkspace";
import { ImageContent } from "./ImageContent";
import { ImagePromptPanel } from "./ImagePromptPanel";
import { ImageToolbar } from "./ImageToolbar";
import { getNodeSizeByAspectRatio } from "./utils/aspectRatioUtils";

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
    const [isGalleryExpanded, setIsGalleryExpanded] = useState(false);
    const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode);
    const deleteNode = useCanvasFlowStore((state) => state.deleteNode);
    const addNode = useCanvasFlowStore((state) => state.addNode);
    const splitImage = useCanvasFlowStore((state) => state.splitImage);
    const separateToNodes = useCanvasFlowStore(
      (state) => state.separateToNodes,
    );
    const updateImageNodeData = useCanvasFlowStore(
      (state) => state.updateImageNodeData,
    );
    const onConnect = useCanvasFlowStore((state) => state.onConnect);
    const highlightedSourceNodeIds = useCanvasFlowStore(
      (state) => state.highlightedSourceNodeIds,
    );
    // 从 store 直接读取选中节点数量，避免 O(n²) 遍历
    const selectedNodesCount = useCanvasFlowStore(
      (state) => state.selectedNodesCount,
    );
    const projectId = useCanvasFlowStore((state) => state.projectId);

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

    // 使用 useMemo 缓存样式类名，避免每次渲染都重新拼接字符串
    const handleVisibilityClass = useMemo(
      () =>
        isGalleryExpanded || isAnnotationMode
          ? "invisible opacity-0"
          : selected
            ? "visible opacity-100"
            : "invisible opacity-0 group-hover/node:visible group-hover/node:opacity-100",
      [isAnnotationMode, isGalleryExpanded, selected],
    );

    // 使用 useMemo 缓存工具栏显示条件，避免每次渲染都重新计算
    const shouldShowToolbar = useMemo(
      () =>
        selected &&
        !isDragging &&
        selectedNodesCount <= 1 &&
        !isAnnotationMode,
      [selected, isDragging, isAnnotationMode, selectedNodesCount],
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

    const isGenerating = useMemo(() => {
      const status = data.status ?? GenerationStatus.COMPLETED;
      return (
        status === GenerationStatus.IN_PROGRESS ||
        status === GenerationStatus.QUEUED
      );
    }, [data.status]);

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

    const handleContextMenuSplitImage = useCallback(
      (gridSize: number) => {
        splitImage(id, gridSize);
      },
      [splitImage, id],
    );

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

    // 裁剪完成后：上传裁剪文件、创建子节点，并把裁剪结果挂到新节点上
    const handleCrop = useCallback(
      async (file: File) => {
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
            image_urls: [uploadResult.url],
            result: {
              type: "image",
              data: [{ url: uploadResult.url, remoteUrl: uploadResult.url }],
            },
            status: GenerationStatus.COMPLETED,
            progress: 100,
          });

          toast.success("裁剪成功");
        } catch (error: any) {
          console.error("裁剪图片失败:", error);
          toast.error(error?.message || "裁剪失败，请重试");
          throw error;
        }
      },
      [addNode, id, onConnect, updateImageNodeData],
    );

    const handleAnnotate = useCallback(() => {
      const currentUrl = data.result?.data?.[0]?.url;
      if (!currentUrl) {
        toast.info("暂无可标注图片");
        return;
      }
      openImageAnnotation(currentUrl, id);
    }, [data.result?.data, id, openImageAnnotation]);

    // 点击“设为主图”时交换主图与目标图，保持其余顺序不变
    const handleReorder = useCallback(
      (fromIndex: number) => {
        const resultData = data.result?.data;
        if (!resultData || fromIndex <= 0 || fromIndex >= resultData.length)
          return;

        const newData = [...resultData];
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
          onSeparateToNodes={handleContextMenuSeparateToNodes}
          onSetAsCover={handleContextMenuSetAsCover}
          hasMultipleResults={hasMultipleResults}
        >
          <div
            className={cn(
              "group/node relative",
              isGalleryExpanded && "z-40",
            )}
            style={{
              width: `${nodeSize.width}px`,
              height: `${nodeSize.height}px`,
            }}
          >
            {/* 节点内顶部工具栏：直接参与节点缩放，保证几何一致性 */}
            {shouldShowToolbar && (
              <div className="nodrag nopan nowheel absolute -top-12 left-1/2 z-50 -translate-x-1/2">
                <ImageToolbar
                  nodeId={id}
                  data={data}
                  onDelete={handleDelete}
                  onCrop={handleCrop}
                  onAnnotate={handleAnnotate}
                />
              </div>
            )}

            <div
              className={cn(
                "group/card relative flex h-full w-full flex-col rounded-xl border",
                hasMultipleResults && "bg-linear-to-br from-[#141418] to-[#0d0d10]",
                isAnnotationMode
                  ? "border-transparent shadow-none ring-0"
                  : selected
                    ? "border-[#B43FEB]/80 shadow-[0_0_25px_rgba(180,63,235,0.4),0_0_50px_rgba(180,63,235,0.15)] ring-1 ring-[#B43FEB]/30"
                    : isSourceHighlighted
                      ? "border-[#B43FEB]/65 shadow-[0_0_18px_rgba(180,63,235,0.28),0_0_36px_rgba(180,63,235,0.12)] ring-1 ring-[#B43FEB]/20"
                      : "border-white/6 hover:border-white/12 hover:bg-linear-to-br hover:from-[#18181c] hover:to-[#101014]",
              )}
            >
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
              {selected && !isAnnotationMode && (
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
                  frameSize={{
                    width: nodeSize.width,
                    height: nodeSize.height,
                  }}
                />
              </div>
            </div>

            {/* 节点内底部增强输入区：与节点同一几何空间，缩放时保持一致 */}
            {/* 使用 CSS 控制显隐，避免条件渲染导致 DOM 销毁重建，TipTap editor 状态丢失 */}
            <div
              className={cn(
                "nodrag nopan nowheel absolute top-full left-1/2 z-50 mt-4 w-175 -translate-x-1/2 transition-opacity duration-200",
                shouldShowToolbar
                  ? "opacity-100 visible"
                  : "opacity-0 invisible pointer-events-none",
              )}
            >
              <ImagePromptPanel nodeId={id} />
            </div>
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
              onClose={() => useCanvasFlowStore.getState().closeImageAnnotation()}
            />,
            document.body,
          )
          : null}
      </>
    );
  },
);

ImageNode.displayName = "ImageNode";
