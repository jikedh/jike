import { useMemo } from "react";
import type {
  AudioGenerationNode,
  ImageGenerationNode,
  NoteNodeData,
  VideoGenerationNode,
} from "shared/types/flow";
import { toChineseNumber } from "shared/utils/utils";
import { getPrimaryVideoUrlFromNodeData } from "../utils/video-url";

/**
 * 视频节点引用项类型。
 * 统一用于参考资源条与 @ 提及列表。
 */
export interface VideoReferenceItem {
  id: string;
  url: string;
  relativePath?: string;
  fileName?: string;
  nickname?: string;
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
  nodes,
  edges,
  referenceImageUrls,
}: {
  nodeId: string;
  nodes: any[];
  edges: any[];
  referenceImageUrls: string[];
}) => {
  const parentNodeIds = useMemo(() => {
    return edges
      .filter((edge) => edge.target === nodeId)
      .map((edge) => edge.source);
  }, [edges, nodeId]);

  const parentVideoNodes = useMemo(() => {
    return parentNodeIds
      .map((parentId) => nodes.find((node) => node.id === parentId))
      .filter((node) => node?.type === "videoNode")
      .map((node) => ({
        id: node.id,
        url: getPrimaryVideoUrlFromNodeData(node.data as VideoGenerationNode),
      }))
      .filter((item) => item.url) as VideoReferenceItem[];
  }, [parentNodeIds, nodes]);

  const parentAudioNodes = useMemo(() => {
    return parentNodeIds
      .map((parentId) => nodes.find((node) => node.id === parentId))
      .filter((node) => node?.type === "audioNode")
      .map((node) => ({
        id: node.id,
        url: (node.data as AudioGenerationNode).result?.data?.[0]?.url,
        nickname: (node.data as AudioGenerationNode).nickname,
      }))
      .filter((item) => item.url) as VideoReferenceItem[];
  }, [parentNodeIds, nodes]);

  const parentImageNodes = useMemo(() => {
    return parentNodeIds
      .map((parentId) => nodes.find((node) => node.id === parentId))
      .filter((node) => node?.type === "imageNode")
      .map((node) => {
        const nodeData = node.data as ImageGenerationNode;
        const firstItem = nodeData.result?.data?.[0];
        return {
          id: node.id,
          url: firstItem?.url,
          relativePath: firstItem?.relativePath,
          fileName: firstItem?.localFileName,
        };
      })
      .filter((item) => item.url) as VideoReferenceItem[];
  }, [parentNodeIds, nodes]);

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
    const orderedParentIds: string[] = [];
    const seenParentIds = new Set<string>();

    edges.forEach((edge) => {
      if (edge.target !== nodeId || seenParentIds.has(edge.source)) {
        return;
      }

      seenParentIds.add(edge.source);
      orderedParentIds.push(edge.source);
    });

    return orderedParentIds
      .map((parentId) => nodes.find((node) => node.id === parentId))
      .filter((node) => node?.type === "noteNode")
      .map((node) => (node?.data as NoteNodeData).content?.trim())
      .filter((content) => Boolean(content)) as string[];
  }, [edges, nodes, nodeId]);

  const videoMentionItems = useMemo(() => {
    const items: VideoMentionCandidate[] = [];

    // 统一“本地上传图”和“节点继承图”的命名风格：全部使用“图片X”。
    // 同时按 URL 去重，避免同一张图在 @ 列表中出现两次。
    const mergedImageSources = [
      ...(referenceImageUrls ?? []).map((url) => ({
        id: getVideoLocalImageMentionId(url),
        url,
      })),
      ...parentImageNodes.map((item) => ({
        id: getVideoParentImageMentionId(item.id),
        url: item.url,
      })),
    ];

    const seenImageUrls = new Set<string>();
    const unifiedImageSources = mergedImageSources.filter((item) => {
      if (seenImageUrls.has(item.url)) {
        return false;
      }
      seenImageUrls.add(item.url);
      return true;
    });

    unifiedImageSources.forEach((item, index) => {
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

    parentAudioNodes.forEach((item) => {
      const audioNickname = item.nickname?.trim() || "-";
      items.push({
        id: getVideoParentAudioMentionId(item.id),
        label: audioNickname,
        value: audioNickname,
        thumbnail: "/audio-icon.svg",
        type: "audio",
      });
    });

    return items;
  }, [
    referenceImageUrls,
    parentImageNodes,
    parentVideoNodes,
    parentAudioNodes,
  ]);

  const allImageUrls = useMemo(() => {
    return [
      ...new Set([
        ...(referenceImageUrls ?? []),
        ...parentImageNodes.map((item) => item.url),
      ]),
    ];
  }, [referenceImageUrls, parentImageNodes]);

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
    parentImageNodeUrls,
    parentImageNodeIdByUrl,
    parentNoteContents,
    videoMentionItems,
    allImageUrls,
    allVideoUrls,
    allAudioUrls,
  };
};
