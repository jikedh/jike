import { useCallback } from "react";

import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

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

  return {
    handleDisconnectNode,
    handleRemoveReferenceImage,
  };
};
