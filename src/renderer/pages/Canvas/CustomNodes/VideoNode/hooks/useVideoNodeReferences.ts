import { useMemo } from "react";
import type {
  AudioGenerationNode,
  ImageGenerationNode,
  NewVideoGenerationNode,
  NoteNodeData,
  VideoGenerationNode,
} from "shared/types/flow";
import {
  getDisplayMediaUrl,
  getRemoteMediaUrl,
} from "shared/utils/mediaPersistence";
import { toChineseNumber } from "shared/utils/utils";
import { useShallow } from "zustand/react/shallow";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { getPrimaryVideoUrlFromNodeData } from "../utils/video-url";

const getPrimaryVideoUrlFromAnyVideoNode = (
  data?: Partial<VideoGenerationNode | NewVideoGenerationNode> | null,
) => {
  if (!data) {
    return undefined;
  }

  const resultUrl = data.result?.data?.find((item) => item?.url)?.url;
  const metadataUrl = (data.metadata as Record<string, unknown> | undefined)
    ?.url as string | undefined;
  const legacyUrl = (data as Record<string, unknown>)?.video_url as
    | string
    | undefined;

  return resultUrl ?? metadataUrl ?? legacyUrl;
};

/**
 * 视频节点引用项类型。
 * 统一用于参考资源条与 @ 提及列表。
 */
export interface VideoReferenceItem {
  id: string;
  url: string;
  displayUrl?: string;
  relativePath?: string;
  fileName?: string;
}

/**
 * 视频节点 mention 候选项类型。
 */
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

/**
 * 聚合视频节点的上游资源与提及候选项。
 * 将主组件中的 edges/nodes 扫描逻辑集中到一个 hook，减少容器复杂度。
 */
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
    }> = [];

    for (let i = 0; i < parentNodeEntryValues.length; i += 3) {
      entries.push({
        id: String(parentNodeEntryValues[i] ?? ""),
        type: String(parentNodeEntryValues[i + 1] ?? ""),
        data: parentNodeEntryValues[i + 2],
      });
    }

    return entries.filter((entry) => entry.id);
  }, [parentNodeEntryValues]);

  const parentVideoNodes = useMemo(() => {
    return (
      parentNodeEntries
        // 新旧视频节点都可以作为视频智能输入和参考视频来源。
        .filter(
          (entry) =>
            entry.type === "videoNode" || entry.type === "newVideoNode",
        )
        .map((entry) => ({
          id: entry.id,
          url:
            entry.type === "videoNode"
              ? getPrimaryVideoUrlFromNodeData(
                entry.data as VideoGenerationNode,
              )
              : getPrimaryVideoUrlFromAnyVideoNode(
                entry.data as NewVideoGenerationNode,
              ),
        }))
        .filter((item) => item.url) as VideoReferenceItem[]
    );
  }, [parentNodeEntries]);

  const parentAudioNodes = useMemo(() => {
    return parentNodeEntries
      .filter((entry) => entry.type === "audioNode")
      .map((entry) => {
        const firstItem = (entry.data as AudioGenerationNode).result?.data?.[0];
        return {
          id: entry.id,
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
          url: referenceUrl,
          displayUrl,
          relativePath: firstItem?.relativePath,
          fileName: firstItem?.localFileName,
        };
      })
      .filter((item) => item.url) as VideoReferenceItem[];
  }, [parentNodeEntries]);

  const parentImageNodeUrls = useMemo(() => {
    return new Set(parentImageNodes.map((item) => item.url));
  }, [parentImageNodes]);

  const parentImageNodeIdByUrl = useMemo(() => {
    return parentImageNodes.reduce(
      (acc, item) => {
        acc[item.url] = item.id;
        return acc;
      },
      {} as Record<string, string>,
    );
  }, [parentImageNodes]);

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

    // 统一“本地上传图”和“节点继承图”的命名风格：全部使用“图片X”。
    // 同时按 URL 去重，避免同一张图在 @ 列表中出现两次。
    const mergedImageSources = [
      ...localReferenceImageUrls.map((url) => ({
        id: getVideoLocalImageMentionId(url),
        url,
      })),
      ...parentImageNodes.map((item) => ({
        id: getVideoParentImageMentionId(item.id),
        url: item.displayUrl ?? item.url,
      })),
    ];

    // 相同 URL 可能来自不同连接，不能按 URL 去重，否则 UI 和生成参数都会少一个参考位。
    mergedImageSources.forEach((item, index) => {
      items.push({
        id: item.id,
        label: `图片${toChineseNumber(index + 1)}`,
        value: `图片${toChineseNumber(index + 1)}`,
        thumbnail: item.url,
        type: "image",
      });
    });

    parentVideoNodes.forEach((item, index) => {
      items.push({
        id: getVideoParentVideoMentionId(item.id),
        label: `视频${toChineseNumber(index + 1)}`,
        value: `视频${toChineseNumber(index + 1)}`,
        thumbnail: item.url,
        type: "video",
      });
    });

    parentAudioNodes.forEach((item, index) => {
      items.push({
        id: getVideoParentAudioMentionId(item.id),
        label: `音频${toChineseNumber(index + 1)}`,
        value: `音频${toChineseNumber(index + 1)}`,
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
    parentImageNodeUrls,
    parentImageNodeIdByUrl,
    parentNoteContents,
    videoMentionItems,
    allImageUrls,
    allVideoUrls,
    allAudioUrls,
  };
};
