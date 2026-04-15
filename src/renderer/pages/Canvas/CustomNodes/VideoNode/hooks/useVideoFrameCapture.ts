import { useCallback, useState } from "react";
import {
  generateVideoLastFrameUrl,
  generateVideoSnapshotUrl,
  uploadFileToOSS,
} from "service/oss";
import { GenerationStatus } from "shared/constants/enum";
import { toast } from "sonner";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { getAspectRatioFromMediaFile } from "@/pages/Canvas/CustomNodes/ImageNode/utils/aspectRatioUtils";

const DEFAULT_VIDEO_NODE_WIDTH = 350;
const SNAPSHOT_OFFSET_X = 80;
const SNAPSHOT_STAGGER_X = 28;
const SNAPSHOT_STAGGER_Y = 22;

type SnapshotCaptureParams = {
  videoUrl: string;
  sourceNodeId: string;
  aspectRatio?: string;
  timeMs?: number;
};

type ExtractedFrameResult = {
  success: boolean;
  data?: {
    bytes: Uint8Array;
    mimeType: string;
    width?: number;
    height?: number;
    duration?: number;
  };
  error?: string;
};

/**
 * 视频尾帧提取 Hook
 * 点击后提取当前视频最后一帧，并创建新的图片节点
 */
export const useVideoFrameCapture = () => {
  const [isCapturingLastFrame, setIsCapturingLastFrame] = useState(false);
  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState(false);

  const addNode = useCanvasFlowStore((state) => state.addNode);
  const onConnect = useCanvasFlowStore((state) => state.onConnect);
  const updateImageNodeData = useCanvasFlowStore(
    (state) => state.updateImageNodeData,
  );

  const extractFrame = useCallback(
    async ({
      videoUrl,
      timeMs,
      mode,
    }: {
      videoUrl: string;
      timeMs?: number;
      mode: "time" | "last";
    }): Promise<ExtractedFrameResult> => {
      const electronInvoke = (
        window.electron as
          | {
              ipcRenderer?: {
                invoke?: (
                  channel: string,
                  payload: unknown,
                ) => Promise<ExtractedFrameResult>;
              };
            }
          | undefined
      )?.ipcRenderer?.invoke;

      let ipcResult: ExtractedFrameResult | null = null;

      try {
        if (window.media?.extractVideoFrame) {
          ipcResult = await window.media.extractVideoFrame({
            videoUrl,
            timeMs,
            mode,
            format: "png",
          });
        } else if (electronInvoke) {
          ipcResult = await electronInvoke("media:extractVideoFrame", {
            videoUrl,
            timeMs,
            mode,
            format: "png",
          });
        }

        if (ipcResult?.success && ipcResult.data) {
          return ipcResult;
        }
      } catch (e) {
        console.warn("[VideoFrameCapture] IPC/ffmpeg 抽帧失败，回退至 OSS 链路:", e);
      }

      console.warn("[VideoFrameCapture] 走 OSS 兜底截帧链路...");
      const fallbackUrl =
        mode === "last"
          ? generateVideoLastFrameUrl(videoUrl, { format: "png" })
          : generateVideoSnapshotUrl(videoUrl, {
              time: timeMs ?? 0,
              format: "png",
            });

      const response = await fetch(fallbackUrl);
      if (!response.ok) {
        return {
          success: false,
          error: "获取视频帧图片失败",
        };
      }

      const arrayBuffer = await response.arrayBuffer();
      return {
        success: true,
        data: {
          bytes: new Uint8Array(arrayBuffer),
          mimeType: "image/png",
        },
      };
    },
    [],
  );

  /**
   * 创建图片节点（内部方法）
   * 在当前视频节点后方创建新的图片节点，并自动连线
   */
  const createImageNodeFromSnapshot = useCallback(
    async (
      snapshotUrl: string,
      sourceNodeId: string,
      aspectRatio?: string | null,
    ) => {
      const { nodes, edges } = useCanvasFlowStore.getState();
      const sourceNode = nodes.find((node) => node.id === sourceNodeId);
      const childCount = edges.filter((edge) => edge.source === sourceNodeId).length;

      const position = sourceNode
        ? {
            x:
              sourceNode.position.x +
              (sourceNode.width ?? DEFAULT_VIDEO_NODE_WIDTH) +
              SNAPSHOT_OFFSET_X +
              childCount * SNAPSHOT_STAGGER_X,
            y: sourceNode.position.y + childCount * SNAPSHOT_STAGGER_Y,
          }
        : { x: 50, y: 50 };

      const newNodeId = addNode("image", position);

      // 把截图写入新节点，并标记为已完成状态
      updateImageNodeData(newNodeId, {
        image_urls: [snapshotUrl],
        ...(aspectRatio ? { size: aspectRatio } : {}),
        result: {
          type: "image",
          data: [{ url: snapshotUrl }],
        },
        status: GenerationStatus.COMPLETED,
        progress: 100,
      });

      onConnect({
        source: sourceNodeId,
        sourceHandle: "output",
        target: newNodeId,
        targetHandle: "input",
      });

      return newNodeId;
    },
    [addNode, onConnect, updateImageNodeData],
  );

  /**
   * 提取视频指定时间点的帧，并生成新的图片节点。
   */
  const captureSnapshotAtTime = useCallback(
    async ({
      videoUrl,
      sourceNodeId,
      aspectRatio,
      timeMs = 0,
    }: SnapshotCaptureParams) => {
      if (!videoUrl) {
        toast.error("暂无可用视频");
        return;
      }

      if (!sourceNodeId) {
        toast.error("当前视频节点不存在");
        return;
      }

      if (timeMs < 0) {
        toast.error("时间点不能为负数");
        return;
      }

      setIsCapturingSnapshot(true);

      try {
        const extracted = await extractFrame({
          videoUrl,
          timeMs,
          mode: "time",
        });
        if (!extracted.success || !extracted.data) {
          throw new Error(extracted.error || "提取视频帧图片失败");
        }

        const normalizedBytes = new Uint8Array(extracted.data.bytes);
        const file = new File(
          [normalizedBytes],
          `videoframe-${timeMs}-${Date.now()}.png`,
          {
            type: extracted.data.mimeType || "image/png",
          },
        );
        const nextAspectRatio =
          aspectRatio || (await getAspectRatioFromMediaFile(file, "image"));

        const uploadResult = await uploadFileToOSS(file);
        if (!uploadResult.url) {
          throw new Error("上传视频帧图片失败");
        }

        await createImageNodeFromSnapshot(
          uploadResult.url,
          sourceNodeId,
          nextAspectRatio,
        );

        return uploadResult.url;
      } catch (error) {
        const message = error instanceof Error ? error.message : "提取视频帧失败";
        toast.error(message);
        console.error("[VideoFrameCapture] 提取视频帧失败:", error);
        throw error;
      } finally {
        setIsCapturingSnapshot(false);
      }
    },
    [createImageNodeFromSnapshot, extractFrame],
  );

  /**
   * 提取视频尾帧，并生成新的图片节点。
   */
  const captureLastFrame = useCallback(
    async ({ videoUrl, sourceNodeId, aspectRatio }: SnapshotCaptureParams) => {
      setIsCapturingLastFrame(true);

      try {
        const extracted = await extractFrame({
          videoUrl,
          mode: "last",
        });
        if (!extracted.success || !extracted.data) {
          throw new Error(extracted.error || "获取尾帧图片失败");
        }

        const normalizedBytes = new Uint8Array(extracted.data.bytes);
        const file = new File(
          [normalizedBytes],
          `lastframe-${Date.now()}.png`,
          {
            type: extracted.data.mimeType || "image/png",
          },
        );

        const uploadResult = await uploadFileToOSS(file);
        if (!uploadResult.url) {
          throw new Error("上传尾帧图片失败");
        }

        await createImageNodeFromSnapshot(
          uploadResult.url,
          sourceNodeId,
          aspectRatio,
        );
        toast.success("尾帧提取成功，已创建图片节点");
      } catch (error) {
        const message = error instanceof Error ? error.message : "提取尾帧失败";
        toast.error(message);
        console.error("[VideoFrameCapture] 提取尾帧失败:", error);
      } finally {
        setIsCapturingLastFrame(false);
      }
    },
    [createImageNodeFromSnapshot, extractFrame],
  );

  return {
    captureLastFrame,
    captureSnapshotAtTime,
    isCapturingLastFrame,
    isCapturingSnapshot,
  };
};
