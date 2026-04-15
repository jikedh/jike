import { useReactFlow } from "@xyflow/react";
import { useCallback, useState } from "react";
import { generateVideoSnapshotUrl, uploadFileToOSS } from "service/oss";
import { GenerationStatus } from "shared/constants/enum";
import { toast } from "sonner";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

/**
 * 视频截帧 Hook
 * 封装首帧提取和指定时间点截帧的逻辑，截帧后会创建新的图片节点
 */
export const useVideoFrameCapture = () => {
  const [isCapturingFirstFrame, setIsCapturingFirstFrame] = useState(false);
  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState(false);

  const { screenToFlowPosition } = useReactFlow();
  const addNode = useCanvasFlowStore((state) => state.addNode);
  const updateImageNodeData = useCanvasFlowStore(
    (state) => state.updateImageNodeData,
  );

  /**
   * 创建图片节点（内部方法）
   * 在画布中心位置创建新的图片节点
   */
  const createImageNodeFromSnapshot = useCallback(
    async (snapshotUrl: string) => {
      // 将新图片节点放到画布中心
      const centerPosition = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });

      const newNodeId = addNode("image", centerPosition);

      // 把截图写入新节点，并标记为已完成状态
      updateImageNodeData(newNodeId, {
        image_urls: [snapshotUrl],
        result: {
          type: "image",
          data: [{ url: snapshotUrl }],
        },
        status: GenerationStatus.COMPLETED,
        progress: 100,
      });

      return newNodeId;
    },
    [addNode, updateImageNodeData],
  );

  /**
   * 提取视频首帧
   * 1. 通过 OSS 生成首帧 URL（只读引用）
   * 2. 将首帧图片上传到 OSS（生成永久 URL）
   * 3. 创建新的图片节点
   */
  const captureFirstFrame = useCallback(
    async (videoUrl: string) => {
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

        // 3. 创建新的图片节点
        await createImageNodeFromSnapshot(uploadResult.url);

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
   * 截取视频指定时间点的帧
   * 1. 通过 OSS 生成截帧 URL
   * 2. 将截帧图片上传到 OSS
   * 3. 创建新的图片节点
   */
  const captureSnapshot = useCallback(
    async (videoUrl: string, timeMs: number) => {
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

        // 3. 创建新的图片节点
        await createImageNodeFromSnapshot(uploadResult.url);

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
    captureSnapshot,
    isCapturingFirstFrame,
    isCapturingSnapshot,
  };
};
