import { type NodeProps, Position } from "@xyflow/react";
import { memo, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { uploadFileToOSS } from "service/oss";
import { GenerationStatus } from "shared/constants/enum";
import type { ImageNodeType } from "shared/types/flow";
import { compressImage, MAX_IMAGE_SIZE_MB } from "shared/utils/imageCompress";
import { cn } from "shared/utils/utils";
import { toast } from "sonner";
import { ButtonHandle } from "@/components/button-handle";
import { PanoramaViewer } from "@/components/panorama/PanoramaViewer";
import { NodeContextMenu } from "@/pages/Canvas/components/NodeContextMenu";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { ImageContent } from "./ImageContent";
import { ImagePromptPanel } from "./ImagePromptPanel";
import { ImageToolbar } from "./ImageToolbar";

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

    // 全景图查看器状态
    const panoramaViewer = useCanvasFlowStore((state) => state.panoramaViewer);
    const closePanoramaViewer = useCanvasFlowStore(
      (state) => state.closePanoramaViewer,
    );

    // 使用 useMemo 缓存样式类名，避免每次渲染都重新拼接字符串
    const handleVisibilityClass = useMemo(
      () =>
        selected
          ? "visible opacity-100"
          : "invisible opacity-0 group-hover/node:visible group-hover/node:opacity-100",
      [selected],
    );

    // 使用 useMemo 缓存工具栏显示条件，避免每次渲染都重新计算
    const shouldShowToolbar = useMemo(
      () => selected && !isDragging && selectedNodesCount <= 1,
      [selected, isDragging, selectedNodesCount],
    );

    const isSourceHighlighted = useMemo(() => {
      return highlightedSourceNodeIds.includes(id);
    }, [highlightedSourceNodeIds, id]);

    const handleDelete = useCallback(() => {
      deleteNode(id);
    }, [deleteNode, id]);

    // 缓存传递给 NodeContextMenu 的回调函数
    const handleContextMenuDuplicate = useCallback(() => {
      duplicateNode(id);
    }, [duplicateNode, id]);

    const handleContextMenuDelete = useCallback(() => {
      deleteNode(id);
    }, [deleteNode, id]);

    const handleContextMenuSplitImage = useCallback(
      (gridSize: number) => {
        splitImage(id, gridSize);
      },
      [splitImage, id],
    );

    const handleContextMenuSeparateToNodes = useCallback(() => {
      separateToNodes(id);
    }, [separateToNodes, id]);

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
              data: [{ url: uploadResult.url }],
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

    // 点击图片重新排序：将指定索引的图片移到首位
    const handleReorder = useCallback(
      (fromIndex: number) => {
        const resultData = data.result?.data;
        if (!resultData || fromIndex <= 0 || fromIndex >= resultData.length)
          return;

        // 将被点击的图片元素移到数组首位
        const newData = [...resultData];
        const [movedItem] = newData.splice(fromIndex, 1);
        newData.unshift(movedItem);

        // 通过 store 更新节点数据
        updateImageNodeData(id, {
          result: {
            type: data.result?.type ?? "image",
            data: newData,
          },
        });
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
          hasMultipleResults={hasMultipleResults}
        >
          <div className="group/node relative">
            {/* 节点内顶部工具栏：直接参与节点缩放，保证几何一致性 */}
            {shouldShowToolbar && (
              <div className="nodrag nopan nowheel absolute -top-12 left-1/2 z-50 -translate-x-1/2">
                <ImageToolbar
                  nodeId={id}
                  data={data}
                  onDelete={handleDelete}
                  onCrop={handleCrop}
                />
              </div>
            )}

            <div
              className={cn(
                "group/card relative flex w-87.5 h-62.5 flex-col rounded-xl border bg-linear-to-br from-[#141418] to-[#0d0d10] transition-all duration-300 ease-out",
                selected
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
                className={`transition-opacity duration-150 ${handleVisibilityClass}`}
              />

              {/* 右侧输出 Handle */}
              <ButtonHandle
                type="source"
                position={Position.Right}
                id="output"
                visible
                className={`transition-opacity duration-150 ${handleVisibilityClass}`}
              />

              {/* 选中状态角落装饰 */}
              {selected && (
                <>
                  <div className="absolute -top-px -left-px w-4 h-4 border-l-2 border-t-2 border-[#B43FEB] rounded-tl-xl" />
                  <div className="absolute -top-px -right-px w-4 h-4 border-r-2 border-t-2 border-[#B43FEB] rounded-tr-xl" />
                  <div className="absolute -bottom-px -left-px w-4 h-4 border-l-2 border-b-2 border-[#B43FEB] rounded-bl-xl" />
                  <div className="absolute -bottom-px -right-px w-4 h-4 border-r-2 border-b-2 border-[#B43FEB] rounded-br-xl" />
                </>
              )}

              {/* 扫光效果 */}
              <div className="pointer-events-none absolute inset-0 rounded-xl bg-linear-to-tr from-transparent via-white/2 to-transparent opacity-0 transition-opacity duration-500 group-hover/card:opacity-100" />

              {/* 图片内容区 */}
              <div className="relative flex w-full min-h-62.5 aspect-7/5 overflow-hidden rounded-lg bg-black/30">
                <ImageContent
                  data={data}
                  onReorder={handleReorder}
                  nodeId={id}
                  updateImageNodeData={updateImageNodeData}
                />
              </div>
            </div>

            {/* 节点内底部增强输入区：与节点同一几何空间，缩放时保持一致 */}
            {shouldShowToolbar && (
              <div className="nodrag nopan nowheel absolute top-full left-1/2 z-50 mt-4 w-175 -translate-x-1/2">
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
      </>
    );
  },
);

ImageNode.displayName = "ImageNode";
