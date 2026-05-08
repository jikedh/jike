import { useCallback, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import useMessage from "@/hooks/useMessage";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { uploadFileToOSS } from "service/oss";
import { compressImage, MAX_IMAGE_SIZE_MB } from "shared/utils/imageCompress";

export const useVideoReferenceActions = ({
  nodeId,
  currentImageUrls,
  updateNewVideoNodeData,
  deleteEdge,
  onDisconnectedNode,
  onRemovedReferenceImage,
}: {
  nodeId: string;
  currentImageUrls: string[];
  updateNewVideoNodeData: (nodeId: string, patch: any) => void;
  deleteEdge: (edgeId: string) => void;
  onDisconnectedNode?: (sourceNodeId: string) => void;
  onRemovedReferenceImage?: (url: string, index: number) => void;
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { success, error, warning } = useMessage();

  const handleDisconnectNode = useCallback(
    (sourceNodeId: string) => {
      const edges = useCanvasFlowStore.getState().edges;
      const edgeToDelete = edges.find(
        (edge) => edge.source === sourceNodeId && edge.target === nodeId,
      );
      if (edgeToDelete) {
        deleteEdge(edgeToDelete.id);
        onDisconnectedNode?.(sourceNodeId);
      }
    },
    [nodeId, deleteEdge, onDisconnectedNode],
  );

  const handleRemoveReferenceImage = useCallback(
    (targetUrl: string, targetIndex?: number) => {
      if (!targetUrl) {
        return;
      }

      const nextUrls = [...(currentImageUrls ?? [])];
      const removeIndex =
        typeof targetIndex === "number"
          ? targetIndex
          : nextUrls.findIndex((url) => url === targetUrl);
      if (removeIndex < 0 || removeIndex >= nextUrls.length) {
        return;
      }

      nextUrls.splice(removeIndex, 1);
      updateNewVideoNodeData(nodeId, {
        image_urls: nextUrls,
      });
      onRemovedReferenceImage?.(targetUrl, removeIndex);
    },
    [currentImageUrls, nodeId, onRemovedReferenceImage, updateNewVideoNodeData],
  );

  const handleUploadClick = useCallback(() => {
    if (isUploading) {
      return;
    }
    fileInputRef.current?.click();
  }, [isUploading]);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      setIsUploading(true);

      try {
        let fileToUpload = file;
        if (file.size > MAX_IMAGE_SIZE_MB) {
          fileToUpload = await compressImage(file);
        }

        const result = await uploadFileToOSS(fileToUpload);
        const nextUrl = result.url;

        if (!nextUrl) {
          warning("上传成功但未返回图片地址");
          return;
        }

        updateNewVideoNodeData(nodeId, {
          image_urls: [...(currentImageUrls ?? []), nextUrl],
        });
        success("上传成功");
      } catch (uploadError: any) {
        console.error("上传图片失败:", uploadError);
        error("上传失败，请重试");
      } finally {
        setIsUploading(false);
        event.target.value = "";
      }
    },
    [warning, updateNewVideoNodeData, nodeId, currentImageUrls, success, error],
  );

  return {
    isUploading,
    fileInputRef,
    handleDisconnectNode,
    handleRemoveReferenceImage,
    handleUploadClick,
    handleFileChange,
  };
};
