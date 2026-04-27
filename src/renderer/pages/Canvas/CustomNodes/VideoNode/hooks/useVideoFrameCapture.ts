import { useReactFlow } from "@xyflow/react";
import { useCallback, useState } from "react";
import { generateVideoSnapshotUrl, uploadFileToOSS } from "service/oss";
import { GenerationStatus } from "shared/constants/enum";
import type { VideoGenerationNode } from "shared/types/flow";
import { getVideoDuration } from "shared/utils/getVideoDuration";
import { toast } from "sonner";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

/**
 * 视频截帧 Hook
 * 封装首帧提取和指定时间点截帧的逻辑，截帧后会创建新的图片节点
 */
export const useVideoFrameCapture = () => {
  const [isCapturingFirstFrame, setIsCapturingFirstFrame] = useState(false);
  const [isCapturingLastFrame, setIsCapturingLastFrame] = useState(false);
  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState(false);

  const { screenToFlowPosition } = useReactFlow();
  const addNode = useCanvasFlowStore((state) => state.addNode);
  const updateImageNodeData = useCanvasFlowStore(
    (state) => state.updateImageNodeData,
  );
  const onConnect = useCanvasFlowStore((state) => state.onConnect);

  /**
   * 创建图片节点（内部方法）
   * 在画布中心位置创建新的图片节点，并连接到指定的源视频节点
   * @param snapshotUrl 截帧图片 URL
   * @param sourceVideoNodeId 源视频节点 ID，用于创建连接
   */
  const createImageNodeFromSnapshot = useCallback(
    async (snapshotUrl: string, sourceVideoNodeId?: string) => {
      // 将新图片节点放到画布中心
      const centerPosition = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });

      const newNodeId = addNode("image", centerPosition);
      const sourceVideoNode = sourceVideoNodeId
        ? useCanvasFlowStore
            .getState()
            .nodes.find((node) => node.id === sourceVideoNodeId)
        : null;
      const sourceAspectRatio =
        sourceVideoNode?.type === "videoNode"
          ? (sourceVideoNode.data as VideoGenerationNode).aspect_ratio
          : undefined;

      // 把截图写入新节点，并标记为已完成状态
      updateImageNodeData(newNodeId, {
        image_urls: [snapshotUrl],
        result: {
          type: "image",
          data: [{ url: snapshotUrl }],
        },
        ...(sourceAspectRatio ? { size: sourceAspectRatio } : {}),
        status: GenerationStatus.COMPLETED,
        progress: 100,
      });

      // 如果有源视频节点 ID，创建从源节点到新图片节点的连接
      if (sourceVideoNodeId) {
        setTimeout(() => {
          onConnect({
            source: sourceVideoNodeId,
            sourceHandle: "output",
            target: newNodeId,
            targetHandle: "input",
          });
        }, 50);
      }

      return newNodeId;
    },
    [addNode, updateImageNodeData, onConnect],
  );

  /**
   * 提取视频首帧
   * 1. 通过 OSS 生成首帧 URL（只读引用）
   * 2. 将首帧图片上传到 OSS（生成永久 URL）
   * 3. 创建新的图片节点并连接到源视频节点
   */
  const captureFirstFrame = useCallback(
    async (videoUrl: string, videoNodeId?: string) => {
      if (!videoUrl) {
        toast.error("暂无可用视频");
        return;
      }

      setIsCapturingFirstFrame(true);

      try {
        // 首帧使用 t_100（100ms），因为 t_0 是尾帧
        const firstFrameOssUrl = generateVideoSnapshotUrl(videoUrl, {
          time: 100, // 100ms 靠近视频开头
          format: "jpg",
        });

        // 2. 将首帧图片上传到 OSS 生成永久 URL
        const response = await fetch(firstFrameOssUrl);
        if (!response.ok) {
          throw new Error("获取首帧图片失败");
        }
        const blob = await response.blob();

        const file = new File([blob], `firstframe-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });

        const uploadResult = await uploadFileToOSS(file);
        if (!uploadResult.url) {
          throw new Error("上传首帧图片失败");
        }

        // 3. 创建新的图片节点并连接
        await createImageNodeFromSnapshot(uploadResult.url, videoNodeId);

        toast.success("首帧提取成功，已创建图片节点");
      } catch (error) {
        const message = error instanceof Error ? error.message : "提取首帧失败";
        toast.error(message);
        console.error("[VideoFrameCapture] 提取首帧失败:", error);
      } finally {
        setIsCapturingFirstFrame(false);
      }
    },
    [createImageNodeFromSnapshot],
  );

  /**
   * 提取视频尾帧
   * 1. 获取视频时长
   * 2. 通过 OSS 生成尾帧 URL（使用实际最后一帧时间点）
   * 3. 将尾帧图片上传到 OSS（生成永久 URL）
   * 4. 创建新的图片节点并连接到源视频节点
   */
  const captureLastFrame = useCallback(
    async (videoUrl: string, videoNodeId?: string) => {
      if (!videoUrl) {
        toast.error("暂无可用视频");
        return;
      }

      setIsCapturingLastFrame(true);

      try {
        // 1. 获取视频时长，用于精确定位最后一帧
        const duration = await getVideoDuration(videoUrl);
        if (!duration) {
          throw new Error("无法获取视频时长");
        }

        // 2. 取视频末尾附近的一帧（倒数 100ms），确保取到真正的最后一帧
        // OSS 的 t_0 在某些视频上可能不精准，使用实际时间点更可靠
        const lastFrameTimeMs = Math.max(
          0,
          Math.round((duration - 0.1) * 1000),
        );

        const lastFrameOssUrl = generateVideoSnapshotUrl(videoUrl, {
          time: lastFrameTimeMs,
          format: "jpg",
        });

        // 3. 将尾帧图片上传到 OSS 生成永久 URL
        const response = await fetch(lastFrameOssUrl);
        if (!response.ok) {
          throw new Error("获取尾帧图片失败");
        }
        const blob = await response.blob();

        const file = new File([blob], `lastframe-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });

        const uploadResult = await uploadFileToOSS(file);
        if (!uploadResult.url) {
          throw new Error("上传尾帧图片失败");
        }

        // 4. 创建新的图片节点并连接
        await createImageNodeFromSnapshot(uploadResult.url, videoNodeId);

        toast.success("尾帧提取成功，已创建图片节点");
      } catch (error) {
        const message = error instanceof Error ? error.message : "提取尾帧失败";
        toast.error(message);
        console.error("[VideoFrameCapture] 提取尾帧失败:", error);
      } finally {
        setIsCapturingLastFrame(false);
      }
    },
    [createImageNodeFromSnapshot],
  );

  /**
   * 截取视频指定时间点的帧
   * 1. 通过 OSS 生成截帧 URL
   * 2. 将截帧图片上传到 OSS
   * 3. 创建新的图片节点并连接到源视频节点
   */
  const captureSnapshot = useCallback(
    async (videoUrl: string, timeMs: number, videoNodeId?: string) => {
      if (!videoUrl) {
        toast.error("暂无可用视频");
        return;
      }

      if (timeMs < 0) {
        toast.error("时间点不能为负数");
        return;
      }

      setIsCapturingSnapshot(true);

      try {
        // 1. 生成截帧 OSS URL（只读引用）
        const snapshotOssUrl = generateVideoSnapshotUrl(videoUrl, {
          time: timeMs,
          format: "jpg",
        });

        // 2. 将截帧图片上传到 OSS 生成永久 URL
        const response = await fetch(snapshotOssUrl);
        if (!response.ok) {
          throw new Error("获取截帧图片失败");
        }
        const blob = await response.blob();

        const file = new File(
          [blob],
          `snapshot-${timeMs}ms-${Date.now()}.jpg`,
          { type: "image/jpeg" },
        );

        const uploadResult = await uploadFileToOSS(file);
        if (!uploadResult.url) {
          throw new Error("上传截帧图片失败");
        }

        // 3. 创建新的图片节点并连接
        await createImageNodeFromSnapshot(uploadResult.url, videoNodeId);

        toast.success(
          `截取 ${(timeMs / 1000).toFixed(1)}s 成功，已创建图片节点`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "截帧失败";
        toast.error(message);
        console.error("[VideoFrameCapture] 截帧失败:", error);
      } finally {
        setIsCapturingSnapshot(false);
      }
    },
    [createImageNodeFromSnapshot],
  );

  return {
    captureFirstFrame,
    captureLastFrame,
    captureSnapshot,
    isCapturingFirstFrame,
    isCapturingLastFrame,
    isCapturingSnapshot,
  };
};
