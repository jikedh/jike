import { useMemo } from "react";
import type {
  AudioGenerationNode,
  AllNodeType,
  ImageGenerationNode,
  NewVideoGenerationNode,
  NoteNodeData,
} from "shared/types/flow";
import {
  getDisplayMediaUrl,
  getRemoteMediaUrl,
} from "shared/utils/mediaPersistence";
import { toChineseNumber } from "shared/utils/utils";
import { useShallow } from "zustand/react/shallow";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { getPrimaryVideoUrlFromNodeData } from "../utils/video-url";

export interface VideoReferenceItem {
  id: string;
  url: string;
  label?: string;
  displayUrl?: string;
  relativePath?: string;
  fileName?: string;
}

export interface VideoMentionCandidate {
  id: string;
  label: string;
  value: string;
  thumbnail: string;
  type: "image" | "video" | "audio";
}

export const getVideoLocalImageMentionId = (url: string) => {
  return `local-image-${encodeURIComponent(url)}`;
};

export const getVideoParentImageMentionId = (nodeId: string) => {
  return `parent-image-${nodeId}`;
};

export const getVideoParentVideoMentionId = (nodeId: string) => {
  return `parent-video-${nodeId}`;
};

export const getVideoParentAudioMentionId = (nodeId: string) => {
  return `parent-audio-${nodeId}`;
};

const getNodeDisplayLabel = (node: Pick<AllNodeType, "type" | "data">) => {
  if (!node.data || typeof node.data !== "object") {
    return "";
  }

  const data = node.data as Record<string, unknown>;
  const nickname = typeof data.nickname === "string" ? data.nickname.trim() : "";
  if (nickname) {
    return nickname;
  }

  const badgeLabel =
    typeof data.badgeLabel === "string" ? data.badgeLabel.trim() : "";
  if (badgeLabel) {
    return badgeLabel;
  }

  if (node.type === "imageNode") {
    return data.isUpload ? "上传图片" : "生成图片";
  }
  if (node.type === "newVideoNode") {
    return data.isUpload ? "上传视频" : "生成视频";
  }
  if (node.type === "audioNode") {
    return data.isUpload ? "上传音频" : "生成音频";
  }

  return "";
};

export const useVideoNodeReferences = ({
  nodeId,
  referenceImageUrls,
}: {
  nodeId: string;
  referenceImageUrls: string[];
}) => {
  const parentNodeEntryValues = useCanvasFlowStore(
    useShallow((state) => {
      return state.edges.flatMap((edge) => {
        if (edge.target !== nodeId) {
          return [];
        }

        const sourceNode = state.nodes.find((node) => node.id === edge.source);
        return [edge.source, sourceNode?.type ?? "", sourceNode?.data ?? null];
      });
    }),
  );

  const parentNodeEntries = useMemo(() => {
    const entries: Array<{
      id: string;
      type: string;
      data: unknown;
      label: string;
    }> = [];

    for (let i = 0; i < parentNodeEntryValues.length; i += 3) {
      const type = String(parentNodeEntryValues[i + 1] ?? "");
      const data = parentNodeEntryValues[i + 2];
      entries.push({
        id: String(parentNodeEntryValues[i] ?? ""),
        type,
        data,
        label: getNodeDisplayLabel({
          type: type as AllNodeType["type"],
          data: data as AllNodeType["data"],
        }),
      });
    }

    return entries.filter((entry) => entry.id);
  }, [parentNodeEntryValues]);

  const parentVideoNodes = useMemo(() => {
    return parentNodeEntries
      .filter((entry) => entry.type === "newVideoNode")
      .map((entry) => ({
        id: entry.id,
        label: entry.label,
        url: getPrimaryVideoUrlFromNodeData(
          entry.data as NewVideoGenerationNode,
        ),
      }))
      .filter((item) => item.url) as VideoReferenceItem[];
  }, [parentNodeEntries]);

  const parentAudioNodes = useMemo(() => {
    return parentNodeEntries
      .filter((entry) => entry.type === "audioNode")
      .map((entry) => {
        const firstItem = (entry.data as AudioGenerationNode).result?.data?.[0];
        return {
          id: entry.id,
          label: entry.label,
          url: getRemoteMediaUrl(firstItem),
        };
      })
      .filter((item) => item.url) as VideoReferenceItem[];
  }, [parentNodeEntries]);

  const parentImageNodes = useMemo(() => {
    return parentNodeEntries
      .filter((entry) => entry.type === "imageNode")
      .map((entry) => {
        const nodeData = entry.data as ImageGenerationNode;
        const firstItem = nodeData.result?.data?.[0];
        const referenceUrl = getRemoteMediaUrl(firstItem) ?? firstItem?.url;
        const displayUrl = getDisplayMediaUrl(firstItem) ?? referenceUrl;
        return {
          id: entry.id,
          label: entry.label,
          url: referenceUrl,
          displayUrl,
          relativePath: firstItem?.relativePath,
          fileName: firstItem?.localFileName,
        };
      })
      .filter((item) => item.url) as VideoReferenceItem[];
  }, [parentNodeEntries]);

  const parentNoteContents = useMemo(() => {
    const seenParentIds = new Set<string>();

    return parentNodeEntries
      .filter((entry) => {
        if (seenParentIds.has(entry.id)) {
          return false;
        }

        seenParentIds.add(entry.id);
        return entry.type === "noteNode";
      })
      .map((entry) => (entry.data as NoteNodeData).content?.trim())
      .filter((content) => Boolean(content)) as string[];
  }, [parentNodeEntries]);

  const localReferenceImageItems = useMemo(() => {
    const parentUrlCounts = new Map<string, number>();
    parentImageNodes.forEach((item) => {
      parentUrlCounts.set(item.url, (parentUrlCounts.get(item.url) ?? 0) + 1);
    });

    return (referenceImageUrls ?? []).flatMap((url, index) => {
      const count = parentUrlCounts.get(url) ?? 0;
      if (count > 0) {
        parentUrlCounts.set(url, count - 1);
        return [];
      }
      return [{ url, index }];
    });
  }, [parentImageNodes, referenceImageUrls]);

  const localReferenceImageUrls = useMemo(
    () => localReferenceImageItems.map((item) => item.url),
    [localReferenceImageItems],
  );

  const localReferenceImageIndexes = useMemo(
    () => localReferenceImageItems.map((item) => item.index),
    [localReferenceImageItems],
  );

  const videoMentionItems = useMemo(() => {
    const items: VideoMentionCandidate[] = [];

    const mergedImageSources = [
      ...localReferenceImageUrls.map((url) => ({
        id: getVideoLocalImageMentionId(url),
        label: undefined,
        url,
      })),
      ...parentImageNodes.map((item) => ({
        id: getVideoParentImageMentionId(item.id),
        label: item.label,
        url: item.displayUrl ?? item.url,
      })),
    ];

    mergedImageSources.forEach((item, index) => {
      const label = item.label || `图片${toChineseNumber(index + 1)}`;
      items.push({
        id: item.id,
        label,
        value: label,
        thumbnail: item.url,
        type: "image",
      });
    });

    parentVideoNodes.forEach((item, index) => {
      const label = item.label || `视频${toChineseNumber(index + 1)}`;
      items.push({
        id: getVideoParentVideoMentionId(item.id),
        label,
        value: label,
        thumbnail: item.url,
        type: "video",
      });
    });

    parentAudioNodes.forEach((item, index) => {
      const label = item.label || `音频${toChineseNumber(index + 1)}`;
      items.push({
        id: getVideoParentAudioMentionId(item.id),
        label,
        value: label,
        thumbnail: "/audio-icon.svg",
        type: "audio",
      });
    });

    return items;
  }, [
    localReferenceImageUrls,
    parentImageNodes,
    parentVideoNodes,
    parentAudioNodes,
  ]);

  const allImageUrls = useMemo(() => {
    return [
      ...localReferenceImageUrls,
      ...parentImageNodes.map((item) => item.url),
    ];
  }, [localReferenceImageUrls, parentImageNodes]);

  const allVideoUrls = useMemo(() => {
    return parentVideoNodes.map((item) => item.url);
  }, [parentVideoNodes]);

  const allAudioUrls = useMemo(() => {
    return parentAudioNodes.map((item) => item.url);
  }, [parentAudioNodes]);

  return {
    parentVideoNodes,
    parentAudioNodes,
    parentImageNodes,
    localReferenceImageUrls,
    localReferenceImageIndexes,
    parentNoteContents,
    videoMentionItems,
    allImageUrls,
    allVideoUrls,
    allAudioUrls,
  };
};
