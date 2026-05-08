import { useReactFlow } from "@xyflow/react";
import { useCallback, useState } from "react";
import { generateVideoSnapshotUrl, uploadFileToOSS } from "service/oss";
import { GenerationStatus } from "shared/constants/enum";
import type { NewVideoGenerationNode } from "shared/types/flow";
import { getVideoDuration } from "shared/utils/getVideoDuration";
import { toast } from "sonner";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { saveToolMediaFileToProject } from "../../utils/localMedia";

/**
 * 新版视频截帧 Hook
 * 封装首帧提取和指定时间点截帧的逻辑，截帧后会创建新的图片节点
 * 适配 newVideoNode 类型
 */
export const useVideoFrameCapture = () => {
  const [isCapturingFirstFrame, setIsCapturingFirstFrame] = useState(false);
  const [isCapturingLastFrame, setIsCapturingLastFrame] = useState(false);
  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState(false);

  const { screenToFlowPosition } = useReactFlow();
  const addNode = useCanvasFlowStore((state) => state.addNode);
  const projectId = useCanvasFlowStore((state) => state.projectId);
  const updateImageNodeData = useCanvasFlowStore(
    (state) => state.updateImageNodeData,
  );
  const onConnect = useCanvasFlowStore((state) => state.onConnect);

  /**
   * 创建图片节点（内部方法）
   */
  const createImageNodeFromSnapshot = useCallback(
    async (
      snapshotUrl: string,
      sourceVideoNodeId?: string,
      badgeLabel?: string,
      snapshotFile?: File,
    ) => {
      const centerPosition = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });

      const sourceVideoNode = sourceVideoNodeId
        ? useCanvasFlowStore
            .getState()
            .nodes.find((node) => node.id === sourceVideoNodeId)
        : null;
      const outputIndex = sourceVideoNodeId
        ? useCanvasFlowStore
            .getState()
            .edges.filter((edge) => edge.source === sourceVideoNodeId).length
        : 0;
      const newNodeId = addNode(
        "image",
        sourceVideoNode
          ? {
              x: sourceVideoNode.position.x - 390,
              y:
                sourceVideoNode.position.y +
                (sourceVideoNode.height ?? 250) +
                48 +
                outputIndex * 298,
            }
          : centerPosition,
      );
      const sourceAspectRatio = (() => {
        if (!sourceVideoNode) return undefined;
        if (sourceVideoNode.type === "newVideoNode") {
          return (sourceVideoNode.data as NewVideoGenerationNode).aspect_ratio;
        }
        return undefined;
      })();
      const resultItem = snapshotFile
        ? await saveToolMediaFileToProject(
            projectId,
            { url: snapshotUrl, remoteUrl: snapshotUrl },
            snapshotFile,
            "image",
            "jpg",
          )
        : { url: snapshotUrl, remoteUrl: snapshotUrl };

      updateImageNodeData(newNodeId, {
        ...(badgeLabel ? { badgeLabel } : {}),
        image_urls: [snapshotUrl],
        result: {
          type: "image",
          data: [resultItem],
        },
        ...(sourceAspectRatio ? { size: sourceAspectRatio } : {}),
        status: GenerationStatus.COMPLETED,
        progress: 100,
      });

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
    [addNode, onConnect, projectId, screenToFlowPosition, updateImageNodeData],
  );

  /**
   * 提取视频首帧
   */
  const captureFirstFrame = useCallback(
    async (videoUrl: string, videoNodeId?: string) => {
      if (!videoUrl) {
        toast.error("暂无可用视频");
        return;
      }

      setIsCapturingFirstFrame(true);

      try {
        const firstFrameOssUrl = generateVideoSnapshotUrl(videoUrl, {
          time: 100,
          format: "jpg",
        });

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

        await createImageNodeFromSnapshot(uploadResult.url, videoNodeId, undefined, file);

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
   */
  const captureLastFrame = useCallback(
    async (videoUrl: string, videoNodeId?: string) => {
      if (!videoUrl) {
        toast.error("暂无可用视频");
        return;
      }

      setIsCapturingLastFrame(true);

      try {
        const duration = await getVideoDuration(videoUrl);
        if (!duration) {
          throw new Error("无法获取视频时长");
        }

        const lastFrameTimeMs = Math.max(
          0,
          Math.round((duration - 0.1) * 1000),
        );

        const lastFrameOssUrl = generateVideoSnapshotUrl(videoUrl, {
          time: lastFrameTimeMs,
          format: "jpg",
        });

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

        await createImageNodeFromSnapshot(uploadResult.url, videoNodeId, "尾帧", file);

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
        const snapshotOssUrl = generateVideoSnapshotUrl(videoUrl, {
          time: timeMs,
          format: "jpg",
        });

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

        await createImageNodeFromSnapshot(uploadResult.url, videoNodeId, "截帧", file);

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
