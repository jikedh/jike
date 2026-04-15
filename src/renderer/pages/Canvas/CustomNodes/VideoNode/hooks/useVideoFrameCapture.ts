import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  generateVideoLastFrameUrl,
  generateVideoSnapshotUrl,
  uploadFileToOSS,
} from "service/oss";

/**
 * 视频截帧结果
 */
export interface VideoFrameCaptureResult {
  /** OSS 处理后的 URL（只读引用，可直接用于回显） */
  ossUrl: string;
  /** 上传后的永久 URL（用于节点数据存储） */
  uploadedUrl?: string;
}

/**
 * 视频截帧 Hook
 * 封装尾帧提取和指定时间点截帧的逻辑
 */
export const useVideoFrameCapture = ({
  updateVideoNodeData,
  nodeId,
}: {
  updateVideoNodeData: (nodeId: string, patch: any) => void;
  nodeId: string;
}) => {
  const [isCapturingLastFrame, setIsCapturingLastFrame] = useState(false);
  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState(false);

  /**
   * 提取视频尾帧
   * 1. 通过 OSS 生成尾帧 URL（只读引用）
   * 2. 将尾帧图片上传到 OSS（生成永久 URL）
   * 3. 更新节点数据，添加到 image_urls
   */
  const captureLastFrame = useCallback(
    async (videoUrl: string) => {
      if (!videoUrl) {
        toast.error("暂无可用视频");
        return;
      }

      setIsCapturingLastFrame(true);

      try {
        // 1. 生成尾帧 OSS URL（只读引用）
        const lastFrameOssUrl = generateVideoLastFrameUrl(videoUrl, {
          format: "jpg",
        });

        // 2. 将尾帧图片上传到 OSS 生成永久 URL
        // 先获取尾帧图片数据
        const response = await fetch(lastFrameOssUrl);
        if (!response.ok) {
          throw new Error("获取尾帧图片失败");
        }
        const blob = await response.blob();

        const file = new File(
          [blob],
          `lastframe-${Date.now()}.jpg`,
          { type: "image/jpeg" }
        );

        const uploadResult = await uploadFileToOSS(file);
        if (!uploadResult.url) {
          throw new Error("上传尾帧图片失败");
        }

        // 3. 更新节点数据，添加到 image_urls
        updateVideoNodeData(nodeId, {
          image_urls: [uploadResult.url],
          lastFrame: uploadResult.url, // 同时存储到专门的 lastFrame 字段
        });

        toast.success("尾帧提取成功");
      } catch (error) {
        const message = error instanceof Error ? error.message : "提取尾帧失败";
        toast.error(message);
        console.error("[VideoFrameCapture] 提取尾帧失败:", error);
      } finally {
        setIsCapturingLastFrame(false);
      }
    },
    [nodeId, updateVideoNodeData],
  );

  /**
   * 截取视频指定时间点的帧
   * 1. 通过 OSS 生成截帧 URL
   * 2. 将截帧图片上传到 OSS
   * 3. 更新节点数据，添加到 image_urls
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
          { type: "image/jpeg" }
        );

        const uploadResult = await uploadFileToOSS(file);
        if (!uploadResult.url) {
          throw new Error("上传截帧图片失败");
        }

        // 3. 更新节点数据，添加到 image_urls
        updateVideoNodeData(nodeId, {
          image_urls: [uploadResult.url],
        });

        toast.success(`截取 ${(timeMs / 1000).toFixed(1)}s 成功`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "截帧失败";
        toast.error(message);
        console.error("[VideoFrameCapture] 截帧失败:", error);
      } finally {
        setIsCapturingSnapshot(false);
      }
    },
    [nodeId, updateVideoNodeData],
  );

  return {
    captureLastFrame,
    captureSnapshot,
    isCapturingLastFrame,
    isCapturingSnapshot,
  };
};
