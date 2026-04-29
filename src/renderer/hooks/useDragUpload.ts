import { useReactFlow } from "@xyflow/react";
import { useCallback, useState } from "react";
import { uploadFileToOSS } from "service/oss";
import {
<<<<<<< HEAD
  CANVAS_IMAGE_DRAG_MIME,
  CANVAS_IMAGE_DRAG_TYPE,
  type CanvasImageDragPayload,
} from "shared/constants/canvasDrag";
import { GenerationStatus } from "shared/constants/enum";
import { getMediaType, type MediaType } from "shared/constants/mediaTypes";
import { toast } from "sonner";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import {
  getAspectRatioFromImageUrl,
  getAspectRatioFromMediaFile,
  getExactAspectRatio,
} from "@/pages/Canvas/CustomNodes/ImageNode/utils/aspectRatioUtils";
=======
  getLocalFilePath,
  saveImageToLocal,
  saveVideoToLocal,
  saveAudioToLocal,
} from "service/projectStorage";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { GenerationStatus } from "shared/constants/enum";
import { getMediaType, type MediaType } from "shared/constants/mediaTypes";
import { toast } from "sonner";
import { getAspectRatioFromMediaFile } from "@/pages/Canvas/CustomNodes/ImageNode/utils/aspectRatioUtils";
>>>>>>> origin/develop

/** 拖拽状态 */
interface DragState {
  isDragging: boolean;
  dragPosition: { x: number; y: number } | null;
  fileCount: number;
  acceptedTypes: MediaType[];
}

const parseCanvasImageDragPayload = (
  dataTransfer: DataTransfer,
): CanvasImageDragPayload | null => {
  const rawPayload = dataTransfer.getData(CANVAS_IMAGE_DRAG_MIME);
  if (!rawPayload) {
    return null;
  }

  try {
    const payload = JSON.parse(rawPayload) as CanvasImageDragPayload;
    const images = Array.isArray(payload.images)
      ? payload.images.filter((image) => Boolean(image?.url))
      : [];

    if (payload.type !== CANVAS_IMAGE_DRAG_TYPE || images.length === 0) {
      return null;
    }

    return {
      type: CANVAS_IMAGE_DRAG_TYPE,
      images,
    };
  } catch {
    return null;
  }
};

const getImageAspectRatioFromDragItem = async (
  image: CanvasImageDragPayload["images"][number],
) => {
  if (image.width && image.height) {
    return getExactAspectRatio(image.width, image.height);
  }

  return getAspectRatioFromImageUrl(image.previewUrl ?? image.url);
};

const hasCanvasImageDragPayload = (dataTransfer: DataTransfer) => {
  return Array.from(dataTransfer.types).includes(CANVAS_IMAGE_DRAG_MIME);
};

const getFilesFromDataTransfer = (dataTransfer: DataTransfer) => {
  return Array.from(dataTransfer.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
};

/**
 * 拖拽上传 Hook
 * 负责处理文件拖拽验证、上传到 OSS、创建对应的媒体节点
 */
export function useDragUpload() {
  const { screenToFlowPosition } = useReactFlow();
  const addNode = useCanvasFlowStore((state) => state.addNode);
  const updateImageNodeData = useCanvasFlowStore(
    (state) => state.updateImageNodeData,
  );
  const updateVideoNodeData = useCanvasFlowStore(
    (state) => state.updateVideoNodeData,
  );
  const updateAudioNodeData = useCanvasFlowStore(
    (state) => state.updateAudioNodeData,
  );

  // 拖拽状态
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragPosition: null,
    fileCount: 0,
    acceptedTypes: [],
  });

  /**
   * 验证文件列表，返回有效和无效文件
   */
  const validateFiles = useCallback((files: File[]) => {
    const valid: File[] = [];
    const invalid: { file: File; reason: string }[] = [];

    for (const file of files) {
      const mediaType = getMediaType(file);
      if (!mediaType) {
        invalid.push({
          file,
          reason: `不支持 "${file.name}" 的文件类型`,
        });
      } else {
        valid.push(file);
      }
    }

    return { valid, invalid };
  }, []);

  /**
   * 上传单个文件到 OSS（带模拟进度）
   */
  const uploadFile = useCallback(
    async (file: File, onProgress?: (progress: number) => void) => {
      // 模拟上传进度（ali-oss SDK 不提供内置进度回调）
      const progressInterval = setInterval(() => {
        onProgress?.(Math.random() * 30 + 10);
      }, 300);

      try {
        const result = await uploadFileToOSS(file);
        clearInterval(progressInterval);
        onProgress?.(100);
        return result;
      } catch (error) {
        clearInterval(progressInterval);
        throw error;
      }
    },
    [],
  );

  /**
   * 计算多个节点的平铺位置（避免重叠）
   */
  const calculateTiledPositions = useCallback(
    (basePosition: { x: number; y: number }, count: number) => {
      const positions: { x: number; y: number }[] = [];
      const nodeWidth = 350;
      const nodeHeight = 280;
      const gap = 30;
      const perRow = 3;

      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        positions.push({
          x: basePosition.x + col * (nodeWidth + gap),
          y: basePosition.y + row * (nodeHeight + gap),
        });
      }

      return positions;
    },
    [],
  );

  /**
   * 处理文件上传并创建节点
   */
  const handleFiles = useCallback(
    async (
      files: File[],
      flowPosition: { x: number; y: number },
    ): Promise<void> => {
      const { valid, invalid } = validateFiles(files);

      // 显示不支持文件的警告
      if (invalid.length > 0) {
        const reasons = invalid
          .slice(0, 3)
          .map((i) => i.reason)
          .join("; ");
        toast.warning(
          `以下文件不支持: ${reasons}${invalid.length > 3 ? "..." : ""}`,
        );
      }

      if (valid.length === 0) return;

      // 计算位置（平铺布局）
      const positions = calculateTiledPositions(flowPosition, valid.length);

      // 依次上传并创建节点
      for (let i = 0; i < valid.length; i++) {
        const file = valid[i];
        const position = positions[i];
        const mediaType = getMediaType(file)!;

        // 先创建 pending 状态的节点
        const nodeId =
          mediaType === "image"
            ? addNode("image", position)
            : mediaType === "video"
              ? addNode("video", position)
              : addNode("audio", position);

        // 更新节点状态为上传中
        const updateProgress = (progress: number) => {
          if (mediaType === "image") {
            updateImageNodeData(nodeId, {
              status: GenerationStatus.IN_PROGRESS,
              progress,
            });
          } else if (mediaType === "video") {
            updateVideoNodeData(nodeId, {
              status: GenerationStatus.IN_PROGRESS,
              progress,
            });
          } else {
            updateAudioNodeData(nodeId, {
              status: GenerationStatus.IN_PROGRESS,
              progress,
            });
          }
        };

        try {
          const result = await uploadFile(file, updateProgress);
          const aspectRatio =
            mediaType === "image" || mediaType === "video"
              ? await getAspectRatioFromMediaFile(file, mediaType)
              : null;

          const projectId = useCanvasFlowStore.getState().projectId;
          const ext = file.name.split(".").pop()?.toLowerCase() || (mediaType === "video" ? "mp4" : mediaType === "audio" ? "mp3" : "png");

          let localName: string | null = null;
          let localPath: string | null = null;

          if (projectId) {
            try {
              const arrayBuffer = await file.arrayBuffer();
              if (mediaType === "image") {
                localName = await saveImageToLocal(projectId, arrayBuffer, ext);
              } else if (mediaType === "video") {
                localName = await saveVideoToLocal(projectId, arrayBuffer, ext);
              } else {
                localName = await saveAudioToLocal(projectId, arrayBuffer, ext);
              }
              if (localName) {
                const folderType = mediaType === "image" ? "image" : mediaType === "video" ? "video" : "audio";
                localPath = getLocalFilePath(projectId, folderType, localName);
              }
            } catch (saveErr) {
              console.warn("[useDragUpload] 保存到本地失败:", saveErr);
            }
          }

          if (mediaType === "image") {
            updateImageNodeData(nodeId, {
              status: GenerationStatus.COMPLETED,
              progress: 100,
              isUpload: true,
              ...(aspectRatio ? { size: aspectRatio } : {}),
              result: {
                type: "image",
                data: [{
                  url: result.url,
                  ...(localName ? { localName } : {}),
                  ...(localPath ? { localPath } : {}),
                }],
              },
            });
          } else if (mediaType === "video") {
            updateVideoNodeData(nodeId, {
              status: GenerationStatus.COMPLETED,
              progress: 100,
              isUpload: true,
              ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
              result: {
                type: "video",
                data: [{
                  url: result.url,
                  format: ext,
                  ...(localName ? { localName } : {}),
                  ...(localPath ? { localPath } : {}),
                }],
              },
            });
          } else {
            updateAudioNodeData(nodeId, {
              status: GenerationStatus.COMPLETED,
              progress: 100,
              isUpload: true,
              result: {
                type: "audio",
                data: [{
                  url: result.url,
                  format: ext,
                  ...(localName ? { localName } : {}),
                  ...(localPath ? { localPath } : {}),
                }],
              },
            });
          }

          useCanvasFlowStore.getState().saveGraph();

          toast.success(`${file.name} 上传成功`);
        } catch (error) {
          console.error(`上传失败: ${file.name}`, error);

          // 更新为失败状态
          if (mediaType === "image") {
            updateImageNodeData(nodeId, {
              status: GenerationStatus.FAILED,
              error: { message: "上传失败，请重试" },
            });
          } else if (mediaType === "video") {
            updateVideoNodeData(nodeId, {
              status: GenerationStatus.FAILED,
              error: { message: "上传失败，请重试" },
            });
          } else {
            updateAudioNodeData(nodeId, {
              status: GenerationStatus.FAILED,
              error: { message: "上传失败，请重试" },
            });
          }

          useCanvasFlowStore.getState().saveGraph();

          toast.error(`上传 ${file.name} 失败`);
        }
      }
    },
    [
      validateFiles,
      calculateTiledPositions,
      uploadFile,
      addNode,
      updateImageNodeData,
      updateVideoNodeData,
      updateAudioNodeData,
    ],
  );

  /**
   * Create image nodes directly from images dragged out of the canvas chat.
   */
  const handleCanvasImages = useCallback(
    async (
      payload: CanvasImageDragPayload,
      flowPosition: { x: number; y: number },
    ): Promise<void> => {
      const images = payload.images.filter((image) => Boolean(image.url));
      if (images.length === 0) return;

      const positions = calculateTiledPositions(flowPosition, images.length);

      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const nodeId = addNode("image", positions[i]);

        try {
          const aspectRatio = await getImageAspectRatioFromDragItem(image);

          updateImageNodeData(nodeId, {
            status: GenerationStatus.COMPLETED,
            progress: 100,
            isUpload: false,
            ...(aspectRatio ? { size: aspectRatio } : {}),
            result: {
              type: "image",
              data: [
                {
                  url: image.url,
                  localPath: image.localPath,
                  localName: image.localName,
                },
              ],
            },
          });
        } catch (error) {
          console.error("[canvas-image-drag] create image node failed", error);
          updateImageNodeData(nodeId, {
            status: GenerationStatus.FAILED,
            error: { message: "图片拖入失败，请重试" },
          });
        }
      }

      toast.success(
        images.length === 1
          ? "已创建图片节点"
          : `已创建 ${images.length} 个图片节点`,
      );
    },
    [addNode, calculateTiledPositions, updateImageNodeData],
  );

  /**
   * 处理拖拽进入
   */
  const handleDragEnter = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "copy";

      if (hasCanvasImageDragPayload(event.dataTransfer)) {
        const flowPosition = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        setDragState({
          isDragging: true,
          dragPosition: flowPosition,
          fileCount: 1,
          acceptedTypes: ["image"],
        });
        return;
      }

      const files = getFilesFromDataTransfer(event.dataTransfer);

      if (files.length === 0) return;

      const { valid } = validateFiles(files);
      if (valid.length === 0) {
        toast.warning("拖拽的文件均不支持");
        return;
      }

      const acceptedTypes = [...new Set(valid.map((f) => getMediaType(f)!))];
      const flowPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      setDragState({
        isDragging: true,
        dragPosition: flowPosition,
        fileCount: valid.length,
        acceptedTypes,
      });
    },
    [screenToFlowPosition, validateFiles],
  );

  /**
   * 处理拖拽悬停
   */
  const handleDragOver = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "copy";

      const flowPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      setDragState((prev) => ({
        ...prev,
        dragPosition: flowPosition,
      }));
    },
    [screenToFlowPosition],
  );

  /**
   * 处理拖拽离开
   */
  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    // 只有离开 canvas 区域时才清除状态
    const relatedTarget = event.relatedTarget as HTMLElement;
    if (!event.currentTarget.contains(relatedTarget)) {
      setDragState({
        isDragging: false,
        dragPosition: null,
        fileCount: 0,
        acceptedTypes: [],
      });
    }
  }, []);

  /**
   * 处理文件释放
   */
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const flowPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // 重置拖拽状态
      setDragState({
        isDragging: false,
        dragPosition: null,
        fileCount: 0,
        acceptedTypes: [],
      });

      const canvasImagePayload = parseCanvasImageDragPayload(
        event.dataTransfer,
      );
      if (canvasImagePayload) {
        handleCanvasImages(canvasImagePayload, flowPosition);
        return;
      }

      const files = getFilesFromDataTransfer(event.dataTransfer);
      if (files.length === 0) return;

      handleFiles(files, flowPosition);
    },
    [screenToFlowPosition, handleFiles, handleCanvasImages],
  );

  return {
    dragState,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFiles,
  };
}
