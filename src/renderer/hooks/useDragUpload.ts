import { useReactFlow } from "@xyflow/react";
import { useCallback, useState } from "react";
import { uploadFileToOSS } from "service/oss";
import { GenerationStatus } from "shared/constants/enum";
import { getMediaType, type MediaType } from "shared/constants/mediaTypes";
import { toast } from "sonner";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { getAspectRatioFromMediaFile } from "@/pages/Canvas/CustomNodes/ImageNode/utils/aspectRatioUtils";

/** 拖拽状态 */
interface DragState {
  isDragging: boolean;
  dragPosition: { x: number; y: number } | null;
  fileCount: number;
  acceptedTypes: MediaType[];
}

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
          // 上传文件
          const result = await uploadFile(file, updateProgress);
          const aspectRatio =
            mediaType === "image" || mediaType === "video"
              ? await getAspectRatioFromMediaFile(file, mediaType)
              : null;

          // 上传完成，更新为完成状态
          if (mediaType === "image") {
            updateImageNodeData(nodeId, {
              status: GenerationStatus.COMPLETED,
              progress: 100,
              isUpload: true,
              ...(aspectRatio ? { size: aspectRatio } : {}),
              result: { type: "image", data: [{ url: result.url }] },
            });
          } else if (mediaType === "video") {
            const ext = result.url.split(".").pop()?.toLowerCase() || "mp4";
            updateVideoNodeData(nodeId, {
              status: GenerationStatus.COMPLETED,
              progress: 100,
              isUpload: true,
              ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
              result: {
                type: "video",
                data: [{ url: result.url, format: ext }],
              },
            });
          } else {
            const ext = result.url.split(".").pop()?.toLowerCase() || "mp3";
            updateAudioNodeData(nodeId, {
              status: GenerationStatus.COMPLETED,
              progress: 100,
              isUpload: true,
              result: {
                type: "audio",
                data: [{ url: result.url, format: ext }],
              },
            });
          }

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
   * 处理拖拽进入
   */
  const handleDragEnter = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const files = Array.from(event.dataTransfer.items)
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);

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

      const files = Array.from(event.dataTransfer.items)
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);

      // 重置拖拽状态
      setDragState({
        isDragging: false,
        dragPosition: null,
        fileCount: 0,
        acceptedTypes: [],
      });

      if (files.length === 0) return;

      const flowPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      handleFiles(files, flowPosition);
    },
    [screenToFlowPosition, handleFiles],
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
