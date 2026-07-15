import { addEdge, applyEdgeChanges, applyNodeChanges } from "@xyflow/react";
import { copyMediaUrlToOss, copyVideoUrlToOss } from "service/oss";
import {
  AGNES_IMAGE_2_FLASH_MODEL,
  getVisibleImageModels,
  NANO_BANANA_LOCAL_MODEL,
  NANO_BANANA_LOCAL_PLATFORM,
  RUNNINGHUB_GPT_IMAGE2_MODEL,
  RUNNINGHUB_IMAGE_MODEL_IDS,
  RUNNINGHUB_NANO_BANANA_PRO_MODEL
} from "shared/constants/ai-models";
import { GenerationStatus } from "shared/constants/enum";
import type { GeminiYwResponseBody } from "shared/types/detail/Yunwu/gemini-yw";
import type {
  AllNodeType,
  AudioGenerationNode,
  EdgeType,
  ImageGenerationNode,
  NewVideoGenerationNode
} from "shared/types/flow";
import type {
  AddNodeOptions,
  CanvasFlowStoreType,
  CanvasGroup,
  CanvasPersistedState,
  NodeIdCounters,
  NodePosition,
  NodeType
} from "shared/types/zustand/canvas-flow";
import {
  getGroupBounds,
  getNodeSize,
  layoutGroupGrid,
  layoutGroupHorizontally,
  normalizeGroupNodeIds,
  translateNodesByIds
} from "shared/utils/canvasGroups";
import { uploadBase64ToOSS } from "shared/utils/base64ToImage";
import {
  getRemoteMediaUrl,
  hydrateMediaForRuntime
} from "shared/utils/mediaPersistence";
import {
  appendMediaSequences,
  assignMissingMediaSequences
} from "shared/utils/mediaSequence";
import {
  buildPastedNodesAndEdges,
  createCopiedEdgeTemplates,
  createCopiedNodeTemplates,
  syncMediaUrlsForPastedEdges
} from "shared/utils/canvasCopyPaste";
import { resetNodeDataRuntimeState } from "shared/utils/nodeCopy";
import { nodeFactoryMap } from "shared/utils/nodeFactory";
import {
  buildReferenceHighlightState,
  buildReferenceHoverKey,
  getNextNodePosition,
  IMAGE_POLL_INTERVAL,
  IMAGE_TIMEOUT,
  imagePollingControllers,
  pendingTaskCounts,
  stopImagePollingInternal,
  stopVideoPollingInternal,
  updateAudioNodeInList,
  updateImageAgentNodeInList,
  updateImageNodeInList,
  updateNewVideoNodeInList,
  updateTableNodeInList,
  updateTextAgentNodeInList,
  updateVideoAgentNodeInList,
  VIDEO_POLL_INTERVAL,
  VIDEO_RESULT_WAIT_TIMEOUT,
  VIDEO_TIMEOUT,
  videoPollingControllers,
  wait
} from "shared/utils/reactflowUtils";
import { getRequestErrorMessage } from "shared/utils/requestErrorHandler";
import { toChineseNumber } from "shared/utils/utils";
import { normalizeVideoTaskResponse } from "shared/utils/video-response-normalizer";
import { withVideoPosterFields } from "shared/utils/videoPoster";
import { toast } from "sonner";
import { create } from "zustand";
import {
  createAgnesImageGeneration,
  createAgnesVideoTask,
  createDashscopeVideoSynthesis,
  createImageGeneration,
  extractAgnesImageUrls,
  createLzVideoTask,
  createOverseasSeedanceVideoTask,
  fetchMjTask,
  generateGeminiContent,
  getAgnesVideoTaskStatus,
  getDashscopeVideoTaskStatus,
  getImageTaskStatus,
  getLzVideoTaskStatus,
  getOverseasSeedanceVideoTaskStatus,
  submitMjImagine
} from "@/api/ai";
import {
  confirmDesktopProxyScore,
  createRhartImageG2ImageToImage,
  createRhartImageG2OfficialImageToImage,
  createRhartImageG2OfficialTextToImage,
  createRhartImageG2TextToImage,
  createRhartImageNProEdit,
  createRhartImageNProOfficialEdit,
  createRhartImageNProOfficialTextToImage,
  createRhartImageNProTextToImage,
  queryRunningHubV2Task,
  refundDesktopProxyScore
} from "@/api/jikeGo";
import {
  getClosestAspectRatio,
  getImageDimensions,
  getNodeSizeByAspectRatio,
  getVideoDimensions
} from "@/pages/Canvas/CustomNodes/ImageNode/utils/aspectRatioUtils";
import { buildMidjourneyPrompt } from "@/pages/Canvas/CustomNodes/ImageNode/utils/buildMidjourneyPrompt";
import { getVisibleVideoModels } from "@/pages/Canvas/CustomNodes/New-VideoNode/constants/videoModelCapabilities";
import { aiVideoTrackingService } from "@/services/aiVideoTracking";
import { useUserStore } from "@/stores/useUserStore";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";
import { saveCurrentCanvasToHistory } from "@/utils/canvasHistoryBridge";
import { getCanvas, saveCanvas } from "@/api/projects";

// ==================== 持久化配置 ====================

const LEGACY_CANVAS_STORAGE_VERSION = 1;
const CANVAS_STORAGE_VERSION = 2;

const makeGroupId = (): string => {
  return `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const normalizeCanvasGroups = (
  groups: CanvasGroup[] | undefined,
  nodes: AllNodeType[],
): CanvasGroup[] => {
  if (!groups || groups.length === 0) {
    return [];
  }

  const existingNodeIds = new Set(nodes.map((node) => node.id));
  return groups
    .map((group) => {
      const nodeIds = normalizeGroupNodeIds(group.nodeIds, existingNodeIds);
      const frame = group.frame ?? getGroupBounds(nodes, nodeIds, 24);

      return {
        ...group,
        name: group.name,
        nodeIds,
        gridLayoutOrder: group.gridLayoutOrder
          ? normalizeGroupNodeIds(group.gridLayoutOrder, existingNodeIds)
          : group.gridLayoutOrder,
        layoutOrigin:
          group.layoutOrigin ??
          (frame
            ? {
              x: frame.x,
              y: frame.y,
            }
            : undefined),
        frame: frame ?? undefined,
      };
    })
    .filter((group) => group.nodeIds.length > 0 || Boolean(group.frame));
};

type NewVideoResultItem = NonNullable<
  NewVideoGenerationNode["result"]
>["data"][number];

const normalizeVideoResultItemForPersistence = (item: NewVideoResultItem) => {
  const remoteUrl = getRemoteMediaUrl(item);
  return withVideoPosterFields({
    ...item,
    ...(remoteUrl ? { url: remoteUrl } : {}),
    ...(remoteUrl ? { remoteUrl } : {}),
  });
};
export const normalizeCanvasNodesForPersistence = (
  nodes: AllNodeType[],
): AllNodeType[] =>
  nodes.map((node) => {
    if (node.type !== "newVideoNode" || !node.data.result?.data) {
      return node;
    }

    return {
      ...node,
      data: {
        ...node.data,
        result: {
          ...node.data.result,
          data: node.data.result.data.map(
            normalizeVideoResultItemForPersistence,
          ),
        },
      },
    };
  });

const EMPTY_NODE_ID_COUNTERS = {
  note: 1,
  image: 1,
  newVideo: 1,
  video: 1,
  agent: 1,
  panorama: 1,
  directorDesk: 1,
  audio: 1,
  textAgent: 1,
  imageAgent: 1,
  videoAgent: 1,
  table: 1,
  default: 1,
} satisfies NodeIdCounters;

const getNodeCounterKey = (node: AllNodeType): NodeType => {
  switch (node.type) {
    case "noteNode":
      return "note";
    case "imageNode":
      return "image";
    case "newVideoNode":
      return "newVideo";
    case "agentNode":
      return "agent";
    case "panoramaNode":
      return "panorama";
    case "directorDeskNode":
      return "directorDesk";
    case "audioNode":
      return "audio";
    case "textAgentNode":
      return "textAgent";
    case "imageAgentNode":
      return "imageAgent";
    case "videoAgentNode":
      return "videoAgent";
    case "tableNode":
      return "table";
    default:
      return "default";
  }
};

const normalizeNodeIdCounters = (
  counters?: Partial<NodeIdCounters>,
  nodes: AllNodeType[] = [],
): NodeIdCounters => {
  const nextCounters: NodeIdCounters = {
    ...EMPTY_NODE_ID_COUNTERS,
    ...(counters ?? {}),
  };

  nodes.forEach((node) => {
    const counterKey = getNodeCounterKey(node);
    const prefix = `${counterKey}-`;
    if (!node.id.startsWith(prefix)) {
      return;
    }

    const numericSuffix = Number(node.id.slice(prefix.length));
    if (!Number.isInteger(numericSuffix) || numericSuffix < 0) {
      return;
    }

    nextCounters[counterKey] = Math.max(
      nextCounters[counterKey] ?? 1,
      numericSuffix + 1,
    );
  });

  return nextCounters;
};

export const normalizeCanvasNodeIdCounters = normalizeNodeIdCounters;

export const buildCanvasPersistedState = ({
  nodes,
  edges,
  groups,
  nodeIdCounters,
}: Pick<
  CanvasPersistedState,
  "nodes" | "edges" | "groups" | "nodeIdCounters"
>): CanvasPersistedState => {
  const persistedNodes = normalizeCanvasNodesForPersistence(nodes);

  return {
    version: CANVAS_STORAGE_VERSION,
    savedAt: Date.now(),
    nodes: persistedNodes,
    edges,
    groups: normalizeCanvasGroups(groups, persistedNodes),
    nodeIdCounters: normalizeNodeIdCounters(nodeIdCounters, persistedNodes),
  };
};

const unwrapApiData = <T,>(response: T | { data: T }): T => {
  if (response && typeof response === "object" && "data" in response) {
    return (response as { data: T }).data;
  }

  return response as T;
};

const toCanvasPersistedState = (canvas: {
  version?: number;
  saved_at?: number;
  data?: {
    nodes?: AllNodeType[];
    edges?: EdgeType[];
    groups?: CanvasGroup[];
    node_id_counters?: CanvasPersistedState["nodeIdCounters"];
  };
}): CanvasPersistedState => ({
  version: canvas.version || CANVAS_STORAGE_VERSION,
  savedAt: canvas.saved_at || Date.now(),
  nodes: canvas.data?.nodes || [],
  edges: canvas.data?.edges || [],
  groups: canvas.data?.groups || [],
  nodeIdCounters: normalizeNodeIdCounters(
    canvas.data?.node_id_counters,
    canvas.data?.nodes || [],
  ),
});

const toCanvasSaveRequest = (state: CanvasPersistedState) => ({
  version: state.version,
  saved_at: state.savedAt,
  data: {
    nodes: state.nodes,
    edges: state.edges,
    groups: state.groups,
    node_id_counters: state.nodeIdCounters,
  },
});

const removeNodeIdsFromGroups = (
  groups: CanvasGroup[],
  nodeIds: string[],
): CanvasGroup[] => {
  if (groups.length === 0 || nodeIds.length === 0) {
    return groups;
  }

  const removedNodeIdSet = new Set(nodeIds);
  return groups
    .map((group) => ({
      ...group,
      nodeIds: group.nodeIds.filter((nodeId) => !removedNodeIdSet.has(nodeId)),
      gridLayoutOrder: group.gridLayoutOrder
        ? group.gridLayoutOrder.filter(
          (nodeId) => !removedNodeIdSet.has(nodeId),
        )
        : group.gridLayoutOrder,
      layoutOrigin: group.layoutOrigin,
      frame: group.frame,
    }))
    .filter((group) => group.nodeIds.length > 0 || Boolean(group.frame));
};

const hasNodePositionChanges = (
  prevNodes: AllNodeType[],
  nextNodes: AllNodeType[],
) => {
  if (prevNodes.length !== nextNodes.length) {
    return true;
  }

  const nextNodeById = new Map(nextNodes.map((node) => [node.id, node]));

  for (const prevNode of prevNodes) {
    const nextNode = nextNodeById.get(prevNode.id);
    if (!nextNode) {
      return true;
    }

    if (
      prevNode.position.x !== nextNode.position.x ||
      prevNode.position.y !== nextNode.position.y
    ) {
      return true;
    }
  }

  return false;
};

const updateVideoTrackFinalStatus = async (
  taskId: string | undefined,
  status: "SUCCESS" | "FAIL",
  errorMessage?: string,
  generatedVideoUrl?: string,
) => {
  if (!taskId) {
    return;
  }
  await aiVideoTrackingService.updateStatus(
    taskId,
    status,
    errorMessage,
    generatedVideoUrl,
  );
};

const NANO_BANANA_MODEL_MAPPING: Record<string, Record<string, string>> = {
  "1K": {
    "16:9": "gemini-3.0-pro-image-landscape",
    "9:16": "gemini-3.0-pro-image-portrait",
    "1:1": "gemini-3.0-pro-image-square",
    "4:3": "gemini-3.0-pro-image-four-three",
    "3:4": "gemini-3.0-pro-image-three-four",
  },
  "2K": {
    "16:9": "gemini-3.0-pro-image-landscape-2k",
    "9:16": "gemini-3.0-pro-image-portrait-2k",
    "1:1": "gemini-3.0-pro-image-square-2k",
    "4:3": "gemini-3.0-pro-image-four-three-2k",
    "3:4": "gemini-3.0-pro-image-three-four-2k",
  },
  "4K": {
    "16:9": "gemini-3.0-pro-image-landscape-4k",
    "9:16": "gemini-3.0-pro-image-portrait-4k",
    "1:1": "gemini-3.0-pro-image-square-4k",
    "4:3": "gemini-3.0-pro-image-four-three-4k",
    "3:4": "gemini-3.0-pro-image-three-four-4k",
  },
};

const resolveLocalGeminiImageModel = ({
  model,
  platform,
  size,
  resolution,
}: {
  model?: string;
  platform?: string;
  size?: string;
  resolution?: string;
}) => {
  if (
    model !== NANO_BANANA_LOCAL_MODEL ||
    platform !== NANO_BANANA_LOCAL_PLATFORM
  ) {
    return "gemini-3-pro-image-preview";
  }

  const resolutionMapping = resolution
    ? NANO_BANANA_MODEL_MAPPING[resolution]
    : undefined;
  const resolvedModel = size ? resolutionMapping?.[size] : undefined;
  if (resolvedModel) {
    return resolvedModel;
  }

  throw new Error(
    `Nano Banana Pro 暂不支持 ${size ?? "未知比例"} / ${resolution ?? "未知分辨率"}，请使用 1:1、16:9、9:16、4:3、3:4，并选择 1K/2K/4K`,
  );
};

type RunningHubImageRoute = {
  model: "gpt-image-2" | "nano-banana-pro";
  textToImage: (data: {
    prompt: string;
    aspectRatio?: string;
    resolution?: string;
    quality?: string;
  }) => any;
  imageToImage: (data: {
    prompt: string;
    imageUrls: string[];
    aspectRatio?: string;
    resolution?: string;
    quality?: string;
  }) => any;
};
const resolveRunningHubImageRoutes = (model?: string) => {
  if (model === RUNNINGHUB_GPT_IMAGE2_MODEL) {
    return {
      lowCost: {
        model: "gpt-image-2",
        textToImage: createRhartImageG2TextToImage,
        imageToImage: createRhartImageG2ImageToImage,
      },
      official: {
        model: "gpt-image-2",
        textToImage: createRhartImageG2OfficialTextToImage,
        imageToImage: createRhartImageG2OfficialImageToImage,
      },
    } as const;
  }
  if (model === RUNNINGHUB_NANO_BANANA_PRO_MODEL) {
    return {
      lowCost: {
        model: "nano-banana-pro",
        textToImage: createRhartImageNProTextToImage,
        imageToImage: createRhartImageNProEdit,
      },
      official: {
        model: "nano-banana-pro",
        textToImage: createRhartImageNProOfficialTextToImage,
        imageToImage: createRhartImageNProOfficialEdit,
      },
    } as const;
  }
  return undefined;
};
const normalizeRunningHubResolution = (resolution?: string) =>
  (resolution || "1k").toLowerCase();
const buildRunningHubImageRequest = ({
  prompt,
  imageUrls,
  size,
  resolution,
  route,
  scoreCost,
}: {
  prompt?: string;
  imageUrls: string[];
  size?: string;
  resolution?: string;
  route: RunningHubImageRoute;
  scoreCost?: number;
}) => {
  const baseRequest = {
    prompt: prompt || "",
    aspectRatio: size || "1:1",
    resolution: normalizeRunningHubResolution(resolution),
    ...(route.model === "gpt-image-2" ? { quality: "medium" } : {}),
    ...(scoreCost != null ? { scoreCost } : {}),
  };
  return imageUrls.length > 0
    ? { ...baseRequest, imageUrls: imageUrls.slice(0, 10) }
    : baseRequest;
};
const extractRunningHubImageUrl = (response: any) => {
  const data = response?.data ?? response;
  const directUrl = data?.url || data?.imageUrl || data?.fileUrl;
  if (directUrl) {
    return directUrl;
  }
  const firstResult = Array.isArray(data?.results)
    ? data.results[0]
    : undefined;
  return firstResult?.url || firstResult?.fileUrl || firstResult?.imageUrl;
};
const waitForRunningHubV2ImageResult = async (taskId: string) => {
  const startedAt = Date.now();
  let lastStatus = "";
  let lastMessage = "";
  while (Date.now() - startedAt < IMAGE_TIMEOUT) {
    const response = await queryRunningHubV2Task({ taskId });
    const data = response?.data ?? response;
    const status = String(data?.status || "").toUpperCase();
    lastStatus = status || lastStatus;
    lastMessage = data?.errorMessage || data?.message || lastMessage;
    const resultUrl = extractRunningHubImageUrl(data);
    if (resultUrl && (status === "SUCCESS" || !status)) {
      return resultUrl;
    }
    if (status === "FAILED") {
      throw new Error(lastMessage || "RunningHub 生图失败");
    }
    await wait(5000);
  }
  throw new Error(
    lastStatus
      ? `RunningHub 生图超时，请稍后重试（最后状态：${lastStatus}${lastMessage ? `，${lastMessage}` : ""}）`
      : "RunningHub 生图超时，请稍后重试",
  );
};
const submitRunningHubImageTask = async ({
  route,
  prompt,
  imageUrls,
  size,
  resolution,
  scoreCost,
}: {
  route: RunningHubImageRoute;
  prompt?: string;
  imageUrls: string[];
  size?: string;
  resolution?: string;
  scoreCost?: number;
}) => {
  const request = buildRunningHubImageRequest({
    route,
    prompt,
    imageUrls,
    size,
    resolution,
    scoreCost,
  });
  const response =
    imageUrls.length > 0
      ? await route.imageToImage(request as any)
      : await route.textToImage(request);
  const data = response?.data ?? response;
  const immediateUrl = extractRunningHubImageUrl(data);
  const ledgerBizId: string | undefined =
    data?.ledger_biz_id ?? data?.ledgerBizId;
  if (immediateUrl) {
    if (ledgerBizId) {
      confirmDesktopProxyScore(ledgerBizId, "runninghub_v2").catch(() => { });
    }
    return immediateUrl;
  }
  if (!data?.taskId) {
    if (ledgerBizId) {
      refundDesktopProxyScore(
        ledgerBizId,
        "RunningHub 未返回任务 ID",
        "runninghub_v2",
      ).catch(() => { });
    }
    throw new Error("RunningHub 未返回任务 ID");
  }
  try {
    const url = await waitForRunningHubV2ImageResult(data.taskId);
    if (ledgerBizId) {
      confirmDesktopProxyScore(ledgerBizId, "runninghub_v2").catch(() => { });
    }
    return url;
  } catch (pollError) {
    if (ledgerBizId) {
      const message =
        pollError instanceof Error
          ? pollError.message
          : "RunningHub 生图失败";
      refundDesktopProxyScore(ledgerBizId, message, "runninghub_v2").catch(() => { });
    }
    throw pollError;
  }
};
const generateRunningHubImageWithFallback = async ({
  model,
  prompt,
  imageUrls,
  size,
  resolution,
  scoreCost,
}: {
  model?: string;
  prompt?: string;
  imageUrls: string[];
  size?: string;
  resolution?: string;
  scoreCost?: number;
}) => {
  const routes = resolveRunningHubImageRoutes(model);
  if (!routes) {
    throw new Error("未知 RunningHub 图片模型");
  }
  try {
    return await submitRunningHubImageTask({
      route: routes.lowCost,
      prompt,
      imageUrls,
      size,
      resolution,
      scoreCost,
    });
  } catch (lowCostError) {
    console.warn("RunningHub 低价渠道生成失败，切换官方稳定版:", lowCostError);
    return submitRunningHubImageTask({
      route: routes.official,
      prompt,
      imageUrls,
      size,
      resolution,
      scoreCost,
    });
  }
};

const extractMarkdownMediaUrl = (content: unknown, kind: "image" | "video") => {
  const text = Array.isArray(content)
    ? content
      .map((part) =>
        typeof part === "string"
          ? part
          : typeof part?.text === "string"
            ? part.text
            : "",
      )
      .join("\n")
    : String(content || "");
  const urlPattern =
    kind === "video"
      ? "(?:https?:\\/\\/[^)\\s\"'<>]+\\/v1\\/files\\/video\\?id=[^)\\s\"'<>]+|https?:\\/\\/[^)\\s]+?\\.(?:mp4|webm|mov)(?:\\?[^)]*)?|\\/v1\\/files\\/video\\?id=[^)\\s\"'<>]+)"
      : "https?:\\/\\/[^)\\s]+";
  const htmlPattern =
    kind === "video"
      ? /<video[^>]+src=["']([^"']+)["']/i
      : /<img[^>]+src=["']([^"']+)["']/i;
  const htmlMatch = text.match(htmlPattern);
  if (htmlMatch?.[1]) {
    return htmlMatch[1];
  }

  const markdownPattern = new RegExp(
    kind === "video"
      ? `\\[.*?\\]\\((${urlPattern})\\)`
      : `!\\[.*?\\]\\((${urlPattern})\\)`,
    "i",
  );
  const markdownUrl = text.match(markdownPattern)?.[1];
  if (markdownUrl) {
    return markdownUrl;
  }

  const bareUrlPattern = new RegExp(
    kind === "video" ? `(${urlPattern})` : "(https?:\\/\\/[^\\s\"'<>)]*)",
    "i",
  );
  return text.match(bareUrlPattern)?.[1];
};

const extractExtensionFromUrl = (url: string, fallback: string) => {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split(".").pop()?.toLowerCase() || fallback;
  } catch {
    return fallback;
  }
};

/**
 * 统一刷新入口：将单张图片 URL 转存 OSS 并写回节点数据。
 * 等价于模拟点击左上角刷新按钮。
 */
export const refreshImageToOss = async (
  nodeId: string,
  images: { url: string; remoteUrl?: string }[],
  index: number,
  updateImageNodeData: (nodeId: string, patch: unknown) => void,
) => {
  const item = images[index];
  if (!item?.url) return;

  try {
    const ossUrl = await copyMediaUrlToOss(item.url);
    if (!ossUrl) return;

    const newImages = [...images];
    newImages[index] = { ...newImages[index], url: ossUrl, remoteUrl: ossUrl };
    updateImageNodeData(nodeId, { result: { type: "image", data: newImages } });
  } catch (error) {
    console.warn("[refreshImageToOss] OSS 转存失败，保留原始 URL:", error);
  }
};

const inferImageMimeTypeFromUri = (uri: string): string | undefined => {
  const dataUriMatch = uri.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  if (dataUriMatch) {
    return dataUriMatch[1];
  }

  const normalizedUri = uri.split("?")[0].toLowerCase();
  if (normalizedUri.endsWith(".jpg") || normalizedUri.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (normalizedUri.endsWith(".png")) {
    return "image/png";
  }
  if (normalizedUri.endsWith(".webp")) {
    return "image/webp";
  }
  if (normalizedUri.endsWith(".gif")) {
    return "image/gif";
  }

  return undefined;
};

export const hydrateCanvasNodesForRuntime = async (
  nodes: AllNodeType[],
): Promise<AllNodeType[]> => {
  return Promise.all(
    nodes.map(async (node): Promise<AllNodeType> => {
      if (node.type === "imageNode" && node.data?.result?.data) {
        const processedData = node.data.result.data.map((item: any) =>
          hydrateMediaForRuntime(item),
        );
        return {
          ...node,
          data: {
            ...node.data,
            result: {
              ...node.data.result,
              data: assignMissingMediaSequences(processedData),
            },
          },
        };
      }

      if (node.type === "newVideoNode" && node.data?.result?.data) {
        const processedData = node.data.result.data.map((item: any) =>
          hydrateMediaForRuntime(item),
        );
        return {
          ...node,
          data: {
            ...node.data,
            result: {
              ...node.data.result,
              data: assignMissingMediaSequences(processedData),
            },
          },
        };
      }

      if (node.type === "audioNode" && node.data?.result?.data) {
        const processedData = node.data.result.data.map((item: any) =>
          hydrateMediaForRuntime(item),
        );
        return {
          ...node,
          data: {
            ...node.data,
            result: {
              ...node.data.result,
              data: processedData,
            },
          },
        };
      }

      return node;
    }),
  );
};

/**
 * 标准图片生成轮询逻辑（非 Midjourney 模型）
 */
const pollImageGeneration = async (
  taskId: string,
  nodeId: string,
  signal: AbortSignal,
  setState: (
    updater: (state: CanvasFlowStoreType) => Partial<CanvasFlowStoreType>,
  ) => void,
  getState: () => CanvasFlowStoreType,
  totalTaskCount: number,
  ledgerBizId?: string,
) => {
  const startTime = Date.now();

  try {
    while (true) {
      await wait(IMAGE_POLL_INTERVAL, signal);
      if (signal.aborted) {
        return;
      }

      // 检查是否超时
      if (Date.now() - startTime > IMAGE_TIMEOUT) {
        console.error("[pollImageGeneration] 图片生成超时");
        stopImagePollingInternal(taskId);
        const currentData = getState().nodes.find((n) => n.id === nodeId)
          ?.data as ImageGenerationNode;
        if ((currentData?.completedCount ?? 0) >= totalTaskCount) {
          pendingTaskCounts.delete(nodeId);
        }
        let shouldWarnPartialFailure = false;
        let partialSuccessCount = 0;
        let partialFailedCount = 0;
        setState((state) => ({
          nodes: updateImageNodeInList(state.nodes, nodeId, (data) => {
            const completedCount = (data.completedCount ?? 0) + 1;
            const allCompleted = completedCount >= totalTaskCount;
            const successCount =
              data.result?.data?.filter((item) => item?.url).length ?? 0;
            const hasSuccessfulImages = successCount > 0;

            if (allCompleted && hasSuccessfulImages) {
              shouldWarnPartialFailure = true;
              partialSuccessCount = successCount;
              partialFailedCount = Math.max(totalTaskCount - successCount, 1);
            }

            return {
              ...data,
              status:
                allCompleted && hasSuccessfulImages
                  ? GenerationStatus.COMPLETED
                  : allCompleted
                    ? GenerationStatus.FAILED
                    : GenerationStatus.IN_PROGRESS,
              progress:
                allCompleted && hasSuccessfulImages ? 100 : data.progress,
              error: {
                code: "TIMEOUT",
                message: "图片生成超时，请稍后再试",
              },
              completedCount,
            };
          }),
        }));
        if (shouldWarnPartialFailure) {
          toast.warning(
            `已生成 ${partialSuccessCount} 张图片，${partialFailedCount} 张失败`,
          );
        }
        if (ledgerBizId) {
          refundDesktopProxyScore(
            ledgerBizId,
            "image generation timeout",
            "image",
          ).catch(() => { });
        }
        return;
      }

      // 调用轮询接口获取任务状态
      const response: any = await getImageTaskStatus(taskId);
      const responseData = response?.data ?? response;

      const currentNode = getState().nodes.find((node) => node.id === nodeId);
      if (!currentNode || currentNode.type !== "imageNode") {
        stopImagePollingInternal(taskId);
        return;
      }

      // 解析任务状态（兼容大小写）
      const taskStatus =
        responseData?.status ??
        responseData?.result?.status ??
        response?.data?.status ??
        response?.result?.status ??
        response?.status;

      // 解析图片 URL：优先从 result.data[] 提取（Gemini/Seedream 格式）
      // 兼容结构：response.result.data = [{ url: string }]
      const resultData =
        responseData?.result?.data ??
        responseData?.data ??
        response?.data?.result?.data ??
        response?.result?.data ??
        response?.data?.data ??
        [];
      const images: string[] = (Array.isArray(resultData) ? resultData : [])
        .map((item: any) => {
          if (typeof item === "string") {
            return item;
          }
          return item?.url || item?.image_url || "";
        })
        .filter(Boolean);

      const progressValue = Number(
        responseData?.progress ??
        responseData?.result?.progress ??
        response?.data?.progress ??
        response?.result?.progress ??
        response?.progress ??
        50,
      );

      // 成功状态：小写 completed 或大写 SUCCESS/SUCCEEDED/COMPLETED
      if (
        taskStatus === "completed" ||
        taskStatus === "SUCCESS" ||
        taskStatus === "SUCCEEDED" ||
        taskStatus === "COMPLETED"
      ) {
        // 处理每张生成的图片（先写入原始 URL，再统一刷新转存 OSS）
        const processedResultData = images.map((url: string) => ({
          url,
        }));

        setState((state) => ({
          nodes: updateImageNodeInList(state.nodes, nodeId, (data) => {
            // 追加新结果到 result.data，而不是覆盖
            const existingData = data.result?.data ?? [];
            const mergedData = appendMediaSequences(
              existingData,
              processedResultData,
            );

            // 更新已完成数量
            const completedCount = (data.completedCount ?? 0) + 1;
            // 判断是否所有任务都已完成
            const allCompleted = completedCount >= totalTaskCount;

            return {
              ...data,
              status: allCompleted
                ? GenerationStatus.COMPLETED
                : GenerationStatus.IN_PROGRESS,
              progress: allCompleted ? 100 : progressValue,
              result: {
                type: "image",
                data: mergedData,
              },
              completedCount,
              error: allCompleted ? undefined : data.error,
            };
          }),
        }));
        saveCurrentCanvasToHistory();
        if (useChatSettingsStore.getState().autoSaveEnabled) {
          getState().saveGraph();
        }

        // 刷新 OSS 转存
        const pollingCurrentImages =
          (
            getState().nodes.find((n) => n.id === nodeId)
              ?.data as ImageGenerationNode
          )?.result?.data ?? [];
        const pollingStartIndex =
          pollingCurrentImages.length - processedResultData.length;
        for (let i = 0; i < processedResultData.length; i++) {
          void refreshImageToOss(
            nodeId,
            pollingCurrentImages,
            pollingStartIndex + i,
            getState().updateImageNodeData,
          );
        }

        stopImagePollingInternal(taskId);
        // 如果所有任务都完成了，清理计数
        const currentData = getState().nodes.find((n) => n.id === nodeId)
          ?.data as ImageGenerationNode;
        if ((currentData?.completedCount ?? 0) >= totalTaskCount) {
          pendingTaskCounts.delete(nodeId);
        }

        if (ledgerBizId) {
          confirmDesktopProxyScore(ledgerBizId, "image").catch(() => { });
        }

        await refreshBalanceAfterGeneration({
          scene: "image",
          nodeId,
          taskId,
          model: currentData?.model,
          requiredPoints: currentData?.requiredPoints,
        });
        return;
      }

      // 失败状态：小写 failed 或大写 FAILED/FAILURE/ERROR/CANCEL/CANCELED
      if (
        taskStatus === "failed" ||
        taskStatus === "FAILED" ||
        taskStatus === "FAILURE" ||
        taskStatus === "ERROR" ||
        taskStatus === "CANCEL" ||
        taskStatus === "CANCELED"
      ) {
        let shouldWarnPartialFailure = false;
        let partialSuccessCount = 0;
        let partialFailedCount = 0;

        setState((state) => ({
          nodes: updateImageNodeInList(state.nodes, nodeId, (data) => {
            const completedCount = (data.completedCount ?? 0) + 1;
            const allCompleted = completedCount >= totalTaskCount;
            const successCount =
              data.result?.data?.filter((item) => item?.url).length ?? 0;
            const hasSuccessfulImages = successCount > 0;
            const message =
              response?.message ||
              response?.data?.message ||
              "生成失败，请稍后再试";

            if (allCompleted && hasSuccessfulImages) {
              shouldWarnPartialFailure = true;
              partialSuccessCount = successCount;
              partialFailedCount = Math.max(totalTaskCount - successCount, 1);
            }

            return {
              ...data,
              status:
                allCompleted && hasSuccessfulImages
                  ? GenerationStatus.COMPLETED
                  : allCompleted
                    ? GenerationStatus.FAILED
                    : GenerationStatus.IN_PROGRESS,
              progress: allCompleted && hasSuccessfulImages ? 100 : 0,
              error: {
                code: "IMAGE_GENERATION_FAILED",
                message,
              },
              completedCount,
            };
          }),
        }));

        if (shouldWarnPartialFailure) {
          toast.warning(
            `已生成 ${partialSuccessCount} 张图片，${partialFailedCount} 张失败`,
          );
        }

        saveCurrentCanvasToHistory();
        if (useChatSettingsStore.getState().autoSaveEnabled) {
          getState().saveGraph();
        }

        stopImagePollingInternal(taskId);
        const currentData = getState().nodes.find((n) => n.id === nodeId)
          ?.data as ImageGenerationNode;
        if ((currentData?.completedCount ?? 0) >= totalTaskCount) {
          pendingTaskCounts.delete(nodeId);
        }
        if (ledgerBizId) {
          refundDesktopProxyScore(
            ledgerBizId,
            "image generation failed",
            "image",
          ).catch(() => { });
        }
        return;
      }

      // 进行中状态：小写 queued/in_progress 或大写 PENDING/QUEUED/NOT_START/SUBMITTED
      const isQueued =
        taskStatus === "queued" ||
        taskStatus === "in_progress" ||
        taskStatus === "PENDING" ||
        taskStatus === "QUEUED" ||
        taskStatus === "NOT_START" ||
        taskStatus === "SUBMITTED";

      setState((state) => ({
        nodes: updateImageNodeInList(state.nodes, nodeId, (data) => ({
          ...data,
          status: isQueued
            ? GenerationStatus.QUEUED
            : GenerationStatus.IN_PROGRESS,
          progress: Number.isFinite(progressValue) ? progressValue : 50,
        })),
      }));
    }
  } catch (pollError) {
    console.error("图片生成轮询失败:", pollError);
    stopImagePollingInternal(taskId);
    setState((state) => ({
      nodes: updateImageNodeInList(state.nodes, nodeId, (data) => ({
        ...data,
        status: GenerationStatus.FAILED,
        error: {
          code: "POLL_ERROR",
          message: "轮询失败，请稍后再试",
        },
      })),
    }));
    saveCurrentCanvasToHistory();
    if (useChatSettingsStore.getState().autoSaveEnabled) {
      getState().saveGraph();
    }
    if (ledgerBizId) {
      refundDesktopProxyScore(ledgerBizId, "image poll error", "image").catch(
        () => { },
      );
    }
  }
};

/**
 * Midjourney 图片生成轮询逻辑
 */
const pollMjImageGeneration = async (
  taskId: string,
  nodeId: string,
  signal: AbortSignal,
  setState: (
    updater: (state: CanvasFlowStoreType) => Partial<CanvasFlowStoreType>,
  ) => void,
  getState: () => CanvasFlowStoreType,
  totalTaskCount: number,
  ledgerBizId?: string,
) => {
  const startTime = Date.now();
  try {
    while (true) {
      await wait(IMAGE_POLL_INTERVAL, signal);
      if (signal.aborted) {
        return;
      }

      // 检查是否超时
      if (Date.now() - startTime > IMAGE_TIMEOUT) {
        console.error("[pollMjImageGeneration] 图片生成超时");
        stopImagePollingInternal(taskId);
        const currentData = getState().nodes.find((n) => n.id === nodeId)
          ?.data as ImageGenerationNode;
        if ((currentData?.completedCount ?? 0) >= totalTaskCount) {
          pendingTaskCounts.delete(nodeId);
        }
        let shouldWarnPartialFailure = false;
        let partialSuccessCount = 0;
        let partialFailedCount = 0;
        setState((state) => ({
          nodes: updateImageNodeInList(state.nodes, nodeId, (data) => {
            const completedCount = (data.completedCount ?? 0) + 1;
            const allCompleted = completedCount >= totalTaskCount;
            const successCount =
              data.result?.data?.filter((item) => item?.url).length ?? 0;
            const hasSuccessfulImages = successCount > 0;

            if (allCompleted && hasSuccessfulImages) {
              shouldWarnPartialFailure = true;
              partialSuccessCount = successCount;
              partialFailedCount = Math.max(totalTaskCount - successCount, 1);
            }

            return {
              ...data,
              status:
                allCompleted && hasSuccessfulImages
                  ? GenerationStatus.COMPLETED
                  : allCompleted
                    ? GenerationStatus.FAILED
                    : GenerationStatus.IN_PROGRESS,
              progress:
                allCompleted && hasSuccessfulImages ? 100 : data.progress,
              error: {
                code: "TIMEOUT",
                message: "图片生成超时，请稍后再试",
              },
              completedCount,
            };
          }),
        }));
        if (shouldWarnPartialFailure) {
          toast.warning(
            `已生成 ${partialSuccessCount} 张图片，${partialFailedCount} 张失败`,
          );
        }
        if (ledgerBizId) {
          refundDesktopProxyScore(
            ledgerBizId,
            "midjourney image generation timeout",
            "image",
          ).catch(() => { });
        }
        return;
      }

      const response: any = await fetchMjTask(taskId);

      const currentNode = getState().nodes.find((node) => node.id === nodeId);
      if (!currentNode || currentNode.type !== "imageNode") {
        stopImagePollingInternal(taskId);
        return;
      }

      // 从 progress 字符串（如 "50%"）提取数值
      const progressValue = parseInt(
        response.progress?.replace("%", "") || "0",
        10,
      );

      // SUCCESS 状态表示完成
      if (response.status === "SUCCESS") {
        // imageUrls 可能是字符串数组或对象数组 { url: string }[]
        const rawImageUrls = response.imageUrls ?? [];
        const newImageUrls: string[] = rawImageUrls
          .map((item: any) => (typeof item === "string" ? item : item?.url))
          .filter(Boolean)
          .map((url: string) => url.trim().replace(/^`|`$/g, ""));

        // 先写入原始 URL，再统一刷新转存 OSS
        const processedResultData = newImageUrls.map((url: string) => ({
          url,
        }));

        setState((state) => ({
          nodes: updateImageNodeInList(state.nodes, nodeId, (data) => {
            // 追加新结果到 result.data，而不是覆盖
            const existingData = data.result?.data ?? [];
            const mergedData = appendMediaSequences(
              existingData,
              processedResultData,
            );

            // 更新已完成数量
            const completedCount = (data.completedCount ?? 0) + 1;
            // 判断是否所有任务都已完成
            const allCompleted = completedCount >= totalTaskCount;

            return {
              ...data,
              status: allCompleted
                ? GenerationStatus.COMPLETED
                : GenerationStatus.IN_PROGRESS,
              progress: allCompleted ? 100 : progressValue,
              result: {
                type: "image",
                data: mergedData,
              },
              completedCount,
              error: allCompleted ? undefined : data.error,
            };
          }),
        }));
        saveCurrentCanvasToHistory();
        if (useChatSettingsStore.getState().autoSaveEnabled) {
          getState().saveGraph();
        }

        // 刷新 OSS 转存
        const mjCurrentImages =
          (
            getState().nodes.find((n) => n.id === nodeId)
              ?.data as ImageGenerationNode
          )?.result?.data ?? [];
        const mjStartIndex =
          mjCurrentImages.length - processedResultData.length;
        for (let i = 0; i < processedResultData.length; i++) {
          void refreshImageToOss(
            nodeId,
            mjCurrentImages,
            mjStartIndex + i,
            getState().updateImageNodeData,
          );
        }

        stopImagePollingInternal(taskId);
        // 如果所有任务都完成了，清理计数
        const currentData = getState().nodes.find((n) => n.id === nodeId)
          ?.data as ImageGenerationNode;
        if ((currentData?.completedCount ?? 0) >= totalTaskCount) {
          pendingTaskCounts.delete(nodeId);
        }

        if (ledgerBizId) {
          confirmDesktopProxyScore(ledgerBizId, "image").catch(() => { });
        }

        await refreshBalanceAfterGeneration({
          scene: "image",
          nodeId,
          taskId,
          model: currentData?.model,
          requiredPoints: currentData?.requiredPoints,
        });
        return;
      }

      // FAILURE 或 CANCEL 状态表示失败
      if (response.status === "FAILURE" || response.status === "CANCEL") {
        let shouldWarnPartialFailure = false;
        let partialSuccessCount = 0;
        let partialFailedCount = 0;

        setState((state) => ({
          nodes: updateImageNodeInList(state.nodes, nodeId, (data) => {
            const completedCount = (data.completedCount ?? 0) + 1;
            const allCompleted = completedCount >= totalTaskCount;
            const successCount =
              data.result?.data?.filter((item) => item?.url).length ?? 0;
            const hasSuccessfulImages = successCount > 0;
            const message =
              response.failReason ||
              response.description ||
              "生成失败，请稍后再试";

            if (allCompleted && hasSuccessfulImages) {
              shouldWarnPartialFailure = true;
              partialSuccessCount = successCount;
              partialFailedCount = Math.max(totalTaskCount - successCount, 1);
            }

            return {
              ...data,
              status:
                allCompleted && hasSuccessfulImages
                  ? GenerationStatus.COMPLETED
                  : allCompleted
                    ? GenerationStatus.FAILED
                    : GenerationStatus.IN_PROGRESS,
              progress:
                allCompleted && hasSuccessfulImages ? 100 : progressValue,
              error: {
                code: "MJ_ERROR",
                message,
              },
              completedCount,
            };
          }),
        }));

        if (shouldWarnPartialFailure) {
          toast.warning(
            `已生成 ${partialSuccessCount} 张图片，${partialFailedCount} 张失败`,
          );
        }

        saveCurrentCanvasToHistory();
        if (useChatSettingsStore.getState().autoSaveEnabled) {
          getState().saveGraph();
        }

        stopImagePollingInternal(taskId);
        const currentData = getState().nodes.find((n) => n.id === nodeId)
          ?.data as ImageGenerationNode;
        if ((currentData?.completedCount ?? 0) >= totalTaskCount) {
          pendingTaskCounts.delete(nodeId);
        }
        if (ledgerBizId) {
          refundDesktopProxyScore(
            ledgerBizId,
            "midjourney image generation failed",
            "image",
          ).catch(() => { });
        }
        return;
      }

      // 更新进度
      // NOT_START、SUBMITTED、MODAL 状态为排队中
      const isQueued = ["NOT_START", "SUBMITTED", "MODAL"].includes(
        response.status,
      );

      setState((state) => ({
        nodes: updateImageNodeInList(state.nodes, nodeId, (data) => ({
          ...data,
          status: isQueued
            ? GenerationStatus.QUEUED
            : GenerationStatus.IN_PROGRESS,
          progress: progressValue,
        })),
      }));
    }
  } catch (pollError) {
    console.error("Midjourney 图片生成轮询失败:", pollError);
    stopImagePollingInternal(taskId);
    setState((state) => ({
      nodes: updateImageNodeInList(state.nodes, nodeId, (data) => ({
        ...data,
        status: GenerationStatus.FAILED,
        error: {
          code: "POLL_ERROR",
          message: "轮询失败，请稍后再试",
        },
      })),
    }));
    saveCurrentCanvasToHistory();
    if (useChatSettingsStore.getState().autoSaveEnabled) {
      getState().saveGraph();
    }
    if (ledgerBizId) {
      refundDesktopProxyScore(
        ledgerBizId,
        "midjourney image poll error",
        "image",
      ).catch(() => { });
    }
  }
};

/**
 * 视频生成轮询逻辑
 * @param isSeedance20 是否为豆包 Seedance 2.0（使用快手 API 轮询）
 */
const pollVideoTaskGeneration = async (
  taskId: string,
  nodeId: string,
  signal: AbortSignal,
  setState: (
    updater: (state: CanvasFlowStoreType) => Partial<CanvasFlowStoreType>,
  ) => void,
  getState: () => CanvasFlowStoreType,
  isSeedance20 = false,
) => {
  const startTime = Date.now();
  let missingResultUrlStartTime: number | null = null;
  try {
    while (true) {
      await wait(VIDEO_POLL_INTERVAL, signal);
      if (signal.aborted) {
        return;
      }

      // 检查是否超时
      if (Date.now() - startTime > VIDEO_TIMEOUT) {
        console.error("[pollVideoTaskGeneration] 视频生成超时");
        stopVideoPollingInternal(nodeId);
        setState((state) => ({
          nodes: updateNewVideoNodeInList(state.nodes, nodeId, (data) => ({
            ...data,
            status: GenerationStatus.FAILED,
            error: {
              code: "TIMEOUT",
              message: "视频生成超时，请稍后再试",
            },
          })),
        }));
        await updateVideoTrackFinalStatus(
          taskId,
          "FAIL",
          "视频生成超时，请稍后再试",
        );
        return;
      }

      // 根据模型类型选择不同的轮询接口
      const response: any = isSeedance20
        ? await getLzVideoTaskStatus(taskId)
        : await getDashscopeVideoTaskStatus(taskId);

      const currentNode = getState().nodes.find((node) => node.id === nodeId);
      if (!currentNode || currentNode.type !== "newVideoNode") {
        stopVideoPollingInternal(nodeId);
        return;
      }

      const normalized = normalizeVideoTaskResponse(response);
      const normalizedTaskId = normalized.taskId ?? taskId;

      if (normalized.status === GenerationStatus.COMPLETED) {
        if (normalized.missingResultUrl) {
          if (!missingResultUrlStartTime) {
            missingResultUrlStartTime = Date.now();
          }

          if (
            Date.now() - missingResultUrlStartTime <=
            VIDEO_RESULT_WAIT_TIMEOUT
          ) {
            setState((state) => ({
              nodes: updateNewVideoNodeInList(state.nodes, nodeId, (data) => ({
                ...data,
                status: GenerationStatus.IN_PROGRESS,
                progress: normalized.progress,
                task_id: normalizedTaskId,
              })),
            }));
            continue;
          }

          setState((state) => ({
            nodes: updateNewVideoNodeInList(state.nodes, nodeId, (data) => ({
              ...data,
              status: GenerationStatus.FAILED,
              progress: normalized.progress,
              task_id: normalizedTaskId,
              error: {
                code: "VIDEO_MISSING_URL",
                message: "任务已完成但未返回视频地址，请稍后重试",
              },
            })),
          }));

          stopVideoPollingInternal(nodeId);
          await updateVideoTrackFinalStatus(
            normalizedTaskId,
            "FAIL",
            "任务已完成但未返回视频地址，请稍后重试",
          );
          return;
        }

        missingResultUrlStartTime = null;

        const processedResultData = await Promise.all(
          normalized.videoItems.map(async (item: any) => {
            let ossUrl = item.url;
            if (item.url) {
              try {
                const copiedUrl = await copyVideoUrlToOss(item.url);
                if (copiedUrl) {
                  ossUrl = copiedUrl;
                }
              } catch (copyError) {
                console.error(
                  "[pollVideoTaskGeneration] 转存视频到 OSS 失败:",
                  copyError,
                );
              }
            }

            return withVideoPosterFields({
              ...item,
              url: ossUrl,
              remoteUrl: ossUrl,
            });
          }),
        );

        setState((state) => ({
          nodes: updateNewVideoNodeInList(state.nodes, nodeId, (data) => {
            const existingData = data.result?.data ?? [];
            const mergedData = appendMediaSequences(
              existingData,
              processedResultData,
            );
            const failedCount = (
              (data.metadata?.failedTasks as unknown[]) ?? []
            ).length;
            const completedCount = mergedData.length + failedCount;
            const totalTaskCount = Math.max(
              1,
              ((data.metadata?.tasks as unknown[]) ?? [normalizedTaskId])
                .length,
            );
            const completed = completedCount >= totalTaskCount;

            return {
              ...data,
              status: completed
                ? GenerationStatus.COMPLETED
                : GenerationStatus.IN_PROGRESS,
              progress: completed
                ? 100
                : Math.min(
                  99,
                  Math.round((completedCount / totalTaskCount) * 100),
                ),
              task_id: normalizedTaskId,
              result: {
                type: "video",
                data: mergedData,
              },
              error: undefined,
            };
          }),
        }));
        saveCurrentCanvasToHistory();
        if (useChatSettingsStore.getState().autoSaveEnabled) {
          getState().saveGraph();
        }

        stopVideoPollingInternal(nodeId);
        await updateVideoTrackFinalStatus(
          normalizedTaskId,
          "SUCCESS",
          undefined,
          processedResultData[0]?.url,
        );

        await refreshBalanceAfterGeneration({
          scene: "video",
          nodeId,
          taskId: normalizedTaskId,
          model: (currentNode.data as NewVideoGenerationNode)?.model,
          requiredPoints: (currentNode.data as NewVideoGenerationNode)
            ?.requiredPoints,
        });
        return;
      }

      if (normalized.status === GenerationStatus.FAILED) {
        setState((state) => ({
          nodes: updateNewVideoNodeInList(state.nodes, nodeId, (data) => ({
            ...data,
            status: GenerationStatus.FAILED,
            progress: normalized.progress,
            task_id: normalizedTaskId,
            error: {
              code: "VIDEO_FAILED",
              message: normalized.errorMessage || "生成失败，请稍后再试",
            },
          })),
        }));
        saveCurrentCanvasToHistory();
        if (useChatSettingsStore.getState().autoSaveEnabled) {
          getState().saveGraph();
        }

        stopVideoPollingInternal(nodeId);
        await updateVideoTrackFinalStatus(
          normalizedTaskId,
          "FAIL",
          normalized.errorMessage || "生成失败，请稍后再试",
        );
        return;
      }

      missingResultUrlStartTime = null;

      setState((state) => ({
        nodes: updateNewVideoNodeInList(state.nodes, nodeId, (data) => ({
          ...data,
          status: normalized.status,
          progress: normalized.progress,
          task_id: normalizedTaskId,
        })),
      }));
    }
  } catch (pollError) {
    console.error("视频生成轮询失败:", pollError);
    stopVideoPollingInternal(nodeId);
    // 从 error 对象中提取后端返回的详细信息
    const serverMessage = getRequestErrorMessage(pollError);
    setState((state) => ({
      nodes: updateNewVideoNodeInList(state.nodes, nodeId, (data) => ({
        ...data,
        status: GenerationStatus.FAILED,
        error: {
          code: "POLL_ERROR",
          message: "轮询失败，请稍后再试",
          detail: serverMessage,
          serverMessage,
        },
      })),
    }));
    saveCurrentCanvasToHistory();
    if (useChatSettingsStore.getState().autoSaveEnabled) {
      getState().saveGraph();
    }
    await updateVideoTrackFinalStatus(
      taskId,
      "FAIL",
      serverMessage || "轮询失败，请稍后再试",
    );
  }
};

const pollNewVideoGeneration = async ({
  taskId,
  nodeId,
  signal,
  setState,
  getState,
  isSeedance20,
  taskIndex,
  totalTasks,
  ledgerBizId,
  videoProvider,
}: {
  taskId: string;
  nodeId: string;
  signal: AbortSignal;
  setState: (
    updater: (state: CanvasFlowStoreType) => Partial<CanvasFlowStoreType>,
  ) => void;
  getState: () => CanvasFlowStoreType;
  isSeedance20: boolean;
  taskIndex: number;
  totalTasks: number;
  ledgerBizId?: string;
  videoProvider?: "seedance" | "seedance_global" | "dashscope" | "agnes";
}) => {
  const startTime = Date.now();
  let missingResultUrlStartTime: number | null = null;

  try {
    while (true) {
      await wait(VIDEO_POLL_INTERVAL, signal);
      if (signal.aborted) return;

      if (Date.now() - startTime > VIDEO_TIMEOUT) {
        setState((state) => ({
          nodes: updateNewVideoNodeInList(state.nodes, nodeId, (data) => ({
            ...data,
            status: GenerationStatus.FAILED,
            error: {
              code: "TIMEOUT",
              message: "视频生成超时，请稍后再试",
            },
          })),
        }));
        if (ledgerBizId) {
          const bizType =
            videoProvider === "agnes" ? "agnes" : "video";
          refundDesktopProxyScore(
            ledgerBizId,
            "video generation timeout",
            bizType,
          ).catch(() => { });
        }
        await updateVideoTrackFinalStatus(
          taskId,
          "FAIL",
          "视频生成超时，请稍后再试",
        );
        return;
      }

      const currentNode = getState().nodes.find((node) => node.id === nodeId);
      if (!currentNode || currentNode.type !== "newVideoNode") {
        return;
      }

      const response: any =
        videoProvider === "seedance"
          ? await getLzVideoTaskStatus(taskId)
          : videoProvider === "seedance_global"
            ? await getOverseasSeedanceVideoTaskStatus(taskId)
            : videoProvider === "agnes"
              ? await getAgnesVideoTaskStatus(taskId)
              : isSeedance20
                ? await getLzVideoTaskStatus(taskId)
                : await getDashscopeVideoTaskStatus(taskId);

      const normalized = normalizeVideoTaskResponse(response);
      const normalizedTaskId = normalized.taskId ?? taskId;

      if (normalized.status === GenerationStatus.COMPLETED) {
        if (normalized.missingResultUrl) {
          if (!missingResultUrlStartTime) {
            missingResultUrlStartTime = Date.now();
          }

          if (
            Date.now() - missingResultUrlStartTime <=
            VIDEO_RESULT_WAIT_TIMEOUT
          ) {
            continue;
          }

          setState((state) => ({
            nodes: updateNewVideoNodeInList(state.nodes, nodeId, (data) => ({
              ...data,
              status: GenerationStatus.FAILED,
              progress: normalized.progress,
              task_id: normalizedTaskId,
              error: {
                code: "VIDEO_MISSING_URL",
                message: "任务已完成但未返回视频地址，请稍后重试",
              },
            })),
          }));

          stopVideoPollingInternal(nodeId);
          if (ledgerBizId) {
            const bizType =
              videoProvider === "agnes" ? "agnes" : "video";
            refundDesktopProxyScore(
              ledgerBizId,
              "任务已完成但未返回视频地址",
              bizType,
            ).catch(() => { });
          }
          await updateVideoTrackFinalStatus(
            normalizedTaskId,
            "FAIL",
            "任务已完成但未返回视频地址，请稍后重试",
          );
          return;
        }

        const processedResultData = await Promise.all(
          normalized.videoItems.map(async (item: any) => {
            let ossUrl = item.url;
            if (item.url) {
              try {
                const copiedUrl = await copyVideoUrlToOss(item.url);
                if (copiedUrl) {
                  ossUrl = copiedUrl;
                }
              } catch (copyError) {
                console.error(
                  "[pollNewVideoGeneration] 转存视频到 OSS 失败:",
                  copyError,
                );
              }
            }

            return withVideoPosterFields({
              ...item,
              url: ossUrl,
              remoteUrl: ossUrl,
            });
          }),
        );

        setState((state) => ({
          nodes: updateNewVideoNodeInList(state.nodes, nodeId, (data) => {
            const existingData = data.result?.data ?? [];
            const mergedData = appendMediaSequences(
              existingData,
              processedResultData,
            );
            const failedCount = (
              (data.metadata?.failedTasks as unknown[]) ?? []
            ).length;
            const completedCount = mergedData.length + failedCount;
            const completed = completedCount >= totalTasks;

            return {
              ...data,
              status: completed
                ? GenerationStatus.COMPLETED
                : GenerationStatus.IN_PROGRESS,
              progress: completed
                ? 100
                : Math.min(99, Math.round((completedCount / totalTasks) * 100)),
              task_id: normalizedTaskId,
              result: {
                type: "video",
                data: mergedData,
              },
              error: undefined,
            };
          }),
        }));
        saveCurrentCanvasToHistory();
        if (useChatSettingsStore.getState().autoSaveEnabled) {
          getState().saveGraph();
        }

        stopVideoPollingInternal(nodeId);
        if (ledgerBizId) {
          // Agnes 走独立的积分业务类型；其他视频模型沿用 video 流水。
          const bizType =
            videoProvider === "agnes" ? "agnes" : "video";
          confirmDesktopProxyScore(ledgerBizId, bizType).catch(() => { });
        }
        await updateVideoTrackFinalStatus(
          normalizedTaskId,
          "SUCCESS",
          undefined,
          processedResultData[0]?.url,
        );

        await refreshBalanceAfterGeneration({
          scene: "video",
          nodeId,
          taskId: normalizedTaskId,
          model: (currentNode.data as NewVideoGenerationNode)?.model,
          requiredPoints: (currentNode.data as NewVideoGenerationNode)
            ?.requiredPoints,
        });
        return;
      }

      if (normalized.status === GenerationStatus.FAILED) {
        setState((state) => ({
          nodes: updateNewVideoNodeInList(state.nodes, nodeId, (data) => ({
            ...data,
            status: GenerationStatus.FAILED,
            progress: normalized.progress,
            task_id: normalizedTaskId,
            error: {
              code: "VIDEO_FAILED",
              message: normalized.errorMessage || "生成失败，请稍后再试",
            },
          })),
        }));
        const failedNode = getState().nodes.find((node) => node.id === nodeId);
        const failedStatus = (failedNode?.data as any)?.status;
        if (
          failedStatus === GenerationStatus.FAILED ||
          failedStatus === GenerationStatus.COMPLETED
        ) {
          stopVideoPollingInternal(nodeId);
          // 退还积分
          if (ledgerBizId) {
            refundDesktopProxyScore(
              ledgerBizId,
              normalized.errorMessage || "video generation failed",
            ).catch(() => { });
          }
        }
        await updateVideoTrackFinalStatus(
          normalizedTaskId,
          "FAIL",
          normalized.errorMessage || "生成失败，请稍后再试",
        );
        return;
      }

      missingResultUrlStartTime = null;
      setState((state) => ({
        nodes: updateNewVideoNodeInList(state.nodes, nodeId, (data) => ({
          ...data,
          status: normalized.status,
          progress: Math.max(
            data.progress ?? 0,
            Math.round(
              ((taskIndex + normalized.progress / 100) / totalTasks) * 100,
            ),
          ),
          task_id: normalizedTaskId,
        })),
      }));
    }
  } catch (pollError) {
    const serverMessage = getRequestErrorMessage(pollError);
    setState((state) => ({
      nodes: updateNewVideoNodeInList(state.nodes, nodeId, (data) => ({
        ...data,
        status: GenerationStatus.FAILED,
        error: {
          code: "POLL_ERROR",
          message: "轮询失败，请稍后再试",
          detail: serverMessage,
          serverMessage,
        },
      })),
    }));
    if (ledgerBizId) {
      refundDesktopProxyScore(ledgerBizId, serverMessage || "poll error").catch(
        () => { },
      );
    }
    await updateVideoTrackFinalStatus(
      taskId,
      "FAIL",
      serverMessage || "轮询失败，请稍后再试",
    );
  }
};

const refreshBalanceAfterGeneration = async (_?: any) => {
  await useUserStore.getState().fetchBalanceInfo();
};

export const useCanvasFlowStore = create<CanvasFlowStoreType>((set, get) => {
  /**
   * 根据节点 ID 推导音频节点昵称（音频一、音频二...）。
   * 例如：audio-1 => 音频一。
   */
  const getAudioNicknameByNodeId = (nodeId: string) => {
    const suffix = Number(nodeId.split("-").pop() || "0");
    const sequence = Number.isFinite(suffix) && suffix > 0 ? suffix : 1;
    return `音频${toChineseNumber(sequence)}`;
  };

  const getNodeResultUrls = (node: AllNodeType | undefined): string[] => {
    const nodeData = node?.data as any;

    return (nodeData?.result?.data ?? [])
      .map((item: any) => getRemoteMediaUrl(item) ?? item?.url)
      .filter(Boolean);
  };

  const updateUrlListByMode = (
    currentUrls: string[],
    sourceUrls: string[],
    mode: "add" | "remove",
  ) => {
    if (mode === "add") {
      // 相同远程 URL 可能来自复制后的多个图片节点，必须按引用次数保留。
      return [...currentUrls, ...sourceUrls];
    }

    // 删除连接时只移除当前边贡献的引用次数，避免同 URL 的其他连接一起失效。
    const nextUrls = [...currentUrls];
    sourceUrls.forEach((sourceUrl) => {
      const removeIndex = nextUrls.findIndex((url) => url === sourceUrl);
      if (removeIndex >= 0) {
        nextUrls.splice(removeIndex, 1);
      }
    });
    return nextUrls;
  };

  /**
   * 同步由连接线带来的媒体参数依赖。
   */
  const syncMediaUrlsByEdge = (
    nodes: any[],
    edge: any,
    mode: "add" | "remove",
  ): any[] => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);

    if (!sourceNode || !targetNode) {
      return nodes;
    }

    const sourceUrls = getNodeResultUrls(sourceNode);
    if (sourceUrls.length === 0) {
      return nodes;
    }

    const targetField = (() => {
      if (sourceNode.type === "imageNode") {
        if (
          targetNode.type === "imageNode" ||
          targetNode.type === "newVideoNode"
        ) {
          return "image_urls";
        }

        if (targetNode.type === "panoramaNode") {
          return "image_url";
        }
      }

      if (
        targetNode.type === "newVideoNode" &&
        sourceNode.type === "newVideoNode"
      ) {
        return "video_urls";
      }

      if (
        targetNode.type === "newVideoNode" &&
        sourceNode.type === "audioNode"
      ) {
        return "audio_urls";
      }

      return null;
    })();

    if (!targetField) return nodes;

    return nodes.map((node) => {
      if (node.id !== targetNode.id) {
        return node;
      }

      const nodeData = node.data as any;

      if (targetField === "image_url") {
        if (mode === "add") {
          return {
            ...node,
            data: {
              ...nodeData,
              image_url: sourceUrls[0], // 使用第一张图片
            },
          };
        } else {
          return {
            ...node,
            data: {
              ...nodeData,
              image_url: undefined,
            },
          };
        }
      }

      const currentUrls = nodeData?.[targetField] ?? [];
      const nextUrls = updateUrlListByMode(currentUrls, sourceUrls, mode);

      // 对于 imageNode，mode === "remove" 时也需要清理 midjourneyAdvanced 中的 URL
      let nextMidjourneyAdvanced = nodeData?.midjourneyAdvanced;
      if (
        mode === "remove" &&
        node.type === "imageNode" &&
        nextMidjourneyAdvanced
      ) {
        const sourceUrlSet = new Set(sourceUrls);
        const newReferenceUrls = (
          nextMidjourneyAdvanced.referenceUrls ?? []
        ).filter((url: string) => !sourceUrlSet.has(url));
        const newStyleUrls = (nextMidjourneyAdvanced.styleUrls ?? []).filter(
          (url: string) => !sourceUrlSet.has(url),
        );
        nextMidjourneyAdvanced = {
          ...nextMidjourneyAdvanced,
          referenceUrls: newReferenceUrls,
          styleUrls: newStyleUrls,
        };
      }

      return {
        ...node,
        data: {
          ...nodeData,
          [targetField]: nextUrls,
          ...(nextMidjourneyAdvanced && {
            midjourneyAdvanced: nextMidjourneyAdvanced,
          }),
        },
      };
    });
  };

  return {
    nodes: [],
    edges: [],
    highlightedEdgeIds: [],
    highlightedSourceNodeIds: [],
    referenceHoverRefCounts: {},
    nodeIdCounters: normalizeNodeIdCounters(),
    hydrated: false,
    projectId: null,
    // 全景图查看器初始化
    panoramaViewer: {
      open: false,
      imageUrl: null,
      sourceNodeId: null,
    },
    annotationWorkspace: {
      open: false,
      imageUrl: null,
      sourceNodeId: null,
      mode: "annotate",
    },

    // 历史版本计数器（用于通知 useUndoRedo hook 保存快照）
    historyVersion: 0,
    // 历史重置触发器（每次递增通知 useUndoRedo hook 重置历史）
    historyResetTrigger: 0,
    // 选中节点数量初始化（用于避免 O(n²) 遍历）
    selectedNodesCount: 0,
    activeNodeId: null,
    activeVideoTool: null,
    isSelectionBoxActive: false,
    groups: [],
    selectedGroupId: null,

    // ── 配对 setter ───────────────────────────────
    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),
    setHighlightedEdgeIds: (highlightedEdgeIds) => set({ highlightedEdgeIds }),
    setHighlightedSourceNodeIds: (highlightedSourceNodeIds) =>
      set({ highlightedSourceNodeIds }),
    setNodeIdCounters: (nodeIdCounters) =>
      set((state) => ({
        nodeIdCounters: normalizeNodeIdCounters(nodeIdCounters, state.nodes),
      })),
    setProjectId: (projectId) => set({ projectId }),
    setPanoramaViewer: (panoramaViewer) => set({ panoramaViewer }),
    setAnnotationWorkspace: (annotationWorkspace) =>
      set({ annotationWorkspace }),
    setActiveNodeId: (activeNodeId) => set({ activeNodeId }),
    setActiveVideoTool: (activeVideoTool) => set({ activeVideoTool }),
    setSelectionBoxActive: (isSelectionBoxActive) => {
      if (get().isSelectionBoxActive !== isSelectionBoxActive) {
        set({ isSelectionBoxActive });
      }
    },
    setGroups: (groups) => set({ groups }),
    setSelectedGroupId: (selectedGroupId) => set({ selectedGroupId }),
    setHydrated: (hydrated) => set({ hydrated }),

    // ==================== 持久化方法实现 ====================

    /**
     * 切换项目（加载项目数据）
     */
    switchProject: async (projectId: string) => {
      const currentProjectId = get().projectId;
      // 如果是同一个项目，不需要重新加载
      if (currentProjectId === projectId && get().hydrated) {
        return;
      }

      // 停止所有轮询
      imagePollingControllers.forEach((_, nodeId) => {
        stopImagePollingInternal(nodeId);
      });
      videoPollingControllers.forEach((_, nodeId) => {
        stopVideoPollingInternal(nodeId);
      });

      let data: CanvasPersistedState | null = null;
      try {
        const response = await getCanvas(projectId);
        data = toCanvasPersistedState(unwrapApiData(response));
      } catch (err) {
        console.warn("Failed to load canvas data from API:", err);
      }

      if (
        !data ||
        (data.version !== CANVAS_STORAGE_VERSION &&
          data.version !== LEGACY_CANVAS_STORAGE_VERSION)
      ) {
        set({
          projectId,
          nodes: [],
          edges: [],
          highlightedEdgeIds: [],
          highlightedSourceNodeIds: [],
          referenceHoverRefCounts: {},
          nodeIdCounters: normalizeNodeIdCounters(),
          hydrated: true,
          historyResetTrigger: get().historyResetTrigger + 1,
          groups: [],
          activeNodeId: null,
          activeVideoTool: null,
          selectedGroupId: null,
        });
        get().requestHistorySave();
        return;
      }

      // 恢复节点运行时状态时仅使用远程媒体 URL，避免本地文件生成 blob URL.
      const hydratedNodes = await hydrateCanvasNodesForRuntime(data.nodes);
      const processedNodes: AllNodeType[] = hydratedNodes.map((node) => {
        const runtimeSafeData = resetNodeDataRuntimeState(node.type, node.data);

        if (runtimeSafeData !== node.data) {
          return {
            ...node,
            data: runtimeSafeData as AllNodeType["data"],
          };
        }

        return node;
      });
      const persistedReadyNodes =
        normalizeCanvasNodesForPersistence(processedNodes);

      set({
        projectId,
        nodes: persistedReadyNodes,
        edges: data.edges,
        highlightedEdgeIds: [],
        highlightedSourceNodeIds: [],
        referenceHoverRefCounts: {},
        nodeIdCounters: normalizeNodeIdCounters(
          data.nodeIdCounters,
          persistedReadyNodes,
        ),
        hydrated: true,
        historyResetTrigger: get().historyResetTrigger + 1,
        groups: normalizeCanvasGroups(data.groups, persistedReadyNodes),
        activeNodeId: null,
        activeVideoTool: null,
        selectedGroupId: null,
      });
      get().requestHistorySave();
    },

    /**
     * 保存当前图状态到后端画布 API
     */
    saveGraph: () => {
      const state = get();
      if (!state.projectId) return;

      const data = buildCanvasPersistedState(state);
      saveCanvas(state.projectId, toCanvasSaveRequest(data)).catch((err) => {
        console.warn("Failed to save canvas data to API:", err);
      });
    },

    /**
     * 从后端画布 API 恢复图状态
     */
    hydrateGraph: (projectId: string) => {
      if (get().hydrated) return;

      get().switchProject(projectId);
    },

    /**
     * 重置到上次保存的状态
     */
    resetToSavedGraph: () => {
      const state = get();
      if (!state.projectId) return;

      getCanvas(state.projectId)
        .then(async (response) => {
          const data = toCanvasPersistedState(unwrapApiData(response));
          if (
            data.version !== CANVAS_STORAGE_VERSION &&
            data.version !== LEGACY_CANVAS_STORAGE_VERSION
          ) {
            set({
              nodes: [],
              edges: [],
              groups: [],
              activeNodeId: null,
              activeVideoTool: null,
              selectedGroupId: null,
            });
            return;
          }

          const hydratedNodes = await hydrateCanvasNodesForRuntime(data.nodes);
          const persistedReadyNodes = normalizeCanvasNodesForPersistence(
            hydratedNodes,
          );

          set({
            nodes: persistedReadyNodes,
            edges: data.edges,
            nodeIdCounters: normalizeNodeIdCounters(
              data.nodeIdCounters,
              persistedReadyNodes,
            ),
            groups: normalizeCanvasGroups(data.groups, persistedReadyNodes),
            activeNodeId: null,
            activeVideoTool: null,
            selectedGroupId: null,
          });
        })
        .catch(() => {
          set({
            nodes: [],
            edges: [],
            groups: [],
            activeNodeId: null,
            activeVideoTool: null,
            selectedGroupId: null,
          });
        });
    },

    /**
     * 清空当前画布状态（用于切换项目前）
     */
    clearCanvas: () => {
      // 停止所有轮询
      imagePollingControllers.forEach((_, nodeId) => {
        stopImagePollingInternal(nodeId);
      });
      videoPollingControllers.forEach((_, nodeId) => {
        stopVideoPollingInternal(nodeId);
      });

      set({
        nodes: [],
        edges: [],
        highlightedEdgeIds: [],
        highlightedSourceNodeIds: [],
        referenceHoverRefCounts: {},
        groups: [],
        activeNodeId: null,
        activeVideoTool: null,
        selectedGroupId: null,
        nodeIdCounters: normalizeNodeIdCounters(),
        hydrated: false,
        projectId: null,
      });
    },

    // ==================== 通用方法实现 ====================

    /**
     * 获取下一个指定类型的节点 ID
     * @param nodeType 节点类型：'note' | 'image' | 'video' | 'agent' | 'panorama' | 'audio' | 'table'
     * @returns 新的节点 ID，如 'note-3', 'image-1' 等
     */
    getNextNodeId: (nodeType: NodeType) => {
      // 确保 nodeType 是有效的字符串
      const typeKey = nodeType || "default";
      const existingNodeIds = new Set(get().nodes.map((node) => node.id));
      let current = get().nodeIdCounters[typeKey] ?? 1;
      let nextId = `${typeKey}-${current}`;

      while (existingNodeIds.has(nextId)) {
        current += 1;
        nextId = `${typeKey}-${current}`;
      }

      set((state) => ({
        nodeIdCounters: {
          ...state.nodeIdCounters,
          [typeKey]: current + 1,
        },
      }));
      return nextId;
    },

    /**
     * 创建新节点（统一入口）
     */
    addNode: (
      nodeType: NodeType,
      position?: NodePosition,
      options?: AddNodeOptions,
    ) => {
      const factory = nodeFactoryMap[nodeType];
      if (!factory) {
        console.warn(`[addNode] 未知节点类型: ${nodeType}`);
        return "";
      }

      const nextId = get().getNextNodeId(nodeType);
      const currentNodes = get().nodes;
      const nextPosition = position ?? getNextNodePosition(currentNodes);

      const newNode = factory(nextId, nextPosition, options);
      const {
        defaultImageModel,
        defaultImagePlatform,
        defaultImageSize,
        defaultImageResolution,
        defaultNewVideoModel,
        defaultNewVideoAspectRatio,
        defaultNewVideoDuration,
        defaultNewVideoResolution,
        defaultNewVideoMode,
        defaultNewVideoGenerateAudio,
        defaultNewVideoPromptExtend,
      } = useChatSettingsStore.getState();
      const visibleNewVideoModelIds = new Set(
        getVisibleVideoModels().map((model) => model.id),
      );
      const visibleImageModel = getVisibleImageModels().find(
        (item) =>
          item.model === defaultImageModel &&
          item.platform === defaultImagePlatform,
      );
      const finalNode =
        newNode.type === "audioNode"
          ? {
            ...newNode,
            data: {
              ...newNode.data,
              nickname: getAudioNicknameByNodeId(nextId),
            },
          }
          : newNode.type === "imageNode"
            ? {
              ...newNode,
              data: {
                ...newNode.data,
                model: defaultImageModel || newNode.data.model,
                platform: defaultImagePlatform || newNode.data.platform,
                size: defaultImageSize || newNode.data.size,
                resolution: defaultImageResolution || newNode.data.resolution,
              },
            }
            : newNode.type === "newVideoNode"
              ? {
                ...newNode,
                data: {
                  ...newNode.data,
                  // 新版视频只沿用新版模型的记忆，避免老版默认模型把新版下拉框顶成空值。
                  model:
                    [
                      "seedance-2.0-fast",
                      "seedance-2.0-pro",
                      "wanxiang",
                      "vidu-q3-pro",
                      "vidu",
                      "pixverse",
                      "happyhorse",
                      "keling",
                    ].includes(defaultNewVideoModel ?? "") &&
                      visibleNewVideoModelIds.has(defaultNewVideoModel ?? "")
                      ? defaultNewVideoModel
                      : newNode.data.model,
                  aspect_ratio:
                    defaultNewVideoAspectRatio || newNode.data.aspect_ratio,
                  duration: defaultNewVideoDuration || newNode.data.duration,
                  metadata: {
                    ...(newNode.data.metadata ?? {}),
                    params: {
                      ...(newNode.data.metadata?.params as
                        | Record<string, unknown>
                        | undefined),
                      aspectRatio:
                        defaultNewVideoAspectRatio ||
                        newNode.data.aspect_ratio,
                      duration:
                        defaultNewVideoDuration || newNode.data.duration,
                      resolution: defaultNewVideoResolution,
                      generateAudio: defaultNewVideoGenerateAudio,
                      promptExtend: defaultNewVideoPromptExtend,
                    },
                    ...(defaultNewVideoMode !== undefined
                      ? { mode: defaultNewVideoMode }
                      : {}),
                  },
                },
              }
              : newNode;

      set((state) => ({
        nodes: [...state.nodes, finalNode],
      }));

      // 保存历史记录
      get().requestHistorySave();

      // 新建节点属于结构性变更，始终立即落盘，避免 canvas.json 丢节点。
      get().saveGraph();

      return nextId;
    },

    /**
     * 更新便签节点编辑态
     */
    setNoteNodeEditing: (nodeId: string, isEditing: boolean) => {
      set((state) => ({
        nodes: state.nodes.map((node) => {
          if (node.id !== nodeId || node.type !== "noteNode") {
            return node;
          }

          return {
            ...node,
            data: {
              ...node.data,
              isEditing,
            },
          };
        }),
      }));
    },

    /**
     * 一次清空所有便签节点编辑态
     */
    clearAllNoteNodeEditing: () => {
      set((state) => ({
        nodes: state.nodes.map((node) => {
          if (node.type !== "noteNode" || !node.data.isEditing) {
            return node;
          }
          return {
            ...node,
            data: {
              ...node.data,
              isEditing: false,
            },
          };
        }),
      }));
    },

    /**
     * 更新便签节点内容
     */
    updateNoteNodeContent: (nodeId: string, content: string) => {
      set((state) => ({
        nodes: state.nodes.map((node) => {
          if (node.id !== nodeId || node.type !== "noteNode") {
            return node;
          }

          return {
            ...node,
            data: {
              ...node.data,
              content,
            },
          };
        }),
      }));
    },

    /**
     * 更新便签节点富文本 HTML
     */
    updateNoteNodeHtml: (nodeId: string, html: string) => {
      set((state) => ({
        nodes: state.nodes.map((node) => {
          if (node.id !== nodeId || node.type !== "noteNode") {
            return node;
          }

          return {
            ...node,
            data: {
              ...node.data,
              contentHtml: html,
            },
          };
        }),
      }));
    },

    /**
     * 调整便签节点尺寸
     * @param nodeId 便签节点 ID
     * @param width 新宽度
     * @param height 新高度
     */
    resizeNoteNode: (nodeId: string, width: number, height: number) => {
      set((state) => ({
        nodes: state.nodes.map((node) => {
          if (node.id !== nodeId || node.type !== "noteNode") {
            return node;
          }
          return { ...node, width, height };
        }),
      }));
    },

    /**
     * 复制节点
     * @param nodeId 要复制的节点 ID
     */
    /**
     * 复制节点
     * @param nodeId 要复制的节点 ID
     */
    duplicateNode: (nodeId: string) => {
      const currentState = get();
      const node = currentState.nodes.find((n) => n.id === nodeId);
      if (!node) {
        console.warn(`[duplicateNode] 未找到节点: ${nodeId}`);
        return;
      }

      const copiedNodes = createCopiedNodeTemplates([node]);
      const copiedEdges = createCopiedEdgeTemplates([node], currentState.edges);
      const { newNodes, newEdges } = buildPastedNodesAndEdges({
        copiedNodes,
        copiedEdges,
        existingNodes: currentState.nodes,
        getNextNodeId: currentState.getNextNodeId,
        pasteCount: 1,
      });

      set((state) => {
        const updatedNodes = state.nodes.map((n) => ({
          ...n,
          selected: false,
        }));

        const nextNodes = syncMediaUrlsForPastedEdges(
          [...updatedNodes, ...newNodes],
          newEdges,
        );
        const nextEdges = [...state.edges, ...newEdges];

        return {
          nodes: nextNodes,
          edges: nextEdges,
          ...buildReferenceHighlightState(
            state.referenceHoverRefCounts,
            nextEdges,
          ),
        };
      });

      get().requestHistorySave();
      get().saveGraph();
    },

    requestHistorySave: () => {
      set((state) => ({
        historyVersion: state.historyVersion + 1,
      }));
    },

    /**
     * 删除边
     * @param edgeId 要删除的边 ID
     */
    deleteEdge: (edgeId: string, skipHistory = false) => {
      // 删除前同步保存当前完整状态快照，确保撤销时能恢复边及关联数据
      if (!skipHistory) {
        saveCurrentCanvasToHistory();
      }

      set((state) => ({
        nodes: (() => {
          const edgeToDelete = state.edges.find((edge) => edge.id === edgeId);
          if (!edgeToDelete) {
            return state.nodes;
          }

          return syncMediaUrlsByEdge(state.nodes, edgeToDelete, "remove");
        })(),
        ...(() => {
          const nextEdges = state.edges.filter((edge) => edge.id !== edgeId);
          return {
            edges: nextEdges,
            ...buildReferenceHighlightState(
              state.referenceHoverRefCounts,
              nextEdges,
            ),
          };
        })(),
      }));

      // 删除后同步保存快照（确保 redo 能正确重放删除后的状态）
      if (!skipHistory) {
        saveCurrentCanvasToHistory();

        // 自动保存
        if (useChatSettingsStore.getState().autoSaveEnabled) {
          get().saveGraph();
        }
      }
    },

    /**
     * 删除节点及其关联的所有边
     * 自动清理依赖该节点的下游节点（图片/视频）的 image_urls
     * @param nodeId 要删除的节点 ID
     * @param skipHistory 跳过历史保存（批量删除时由调用方统一保存）
     */
    deleteNode: (nodeId: string, skipHistory = false) => {
      const targetNode = get().nodes.find((node) => node.id === nodeId);
      if (targetNode?.type === "imageNode") {
        stopImagePollingInternal(nodeId);
      }
      if (targetNode?.type === "newVideoNode") {
        stopVideoPollingInternal(nodeId);
      }

      // 删除前同步保存当前完整状态快照，确保撤销时能恢复节点的全部数据
      if (!skipHistory) {
        saveCurrentCanvasToHistory();
      }

      set((state) => {
        const removedEdges = state.edges.filter(
          (edge) => edge.source === nodeId || edge.target === nodeId,
        );
        let nextNodes = state.nodes;

        removedEdges.forEach((edge) => {
          nextNodes = syncMediaUrlsByEdge(nextNodes, edge, "remove");
        });

        return {
          nodes: nextNodes.filter((node) => node.id !== nodeId),
          ...(() => {
            const nextEdges = state.edges.filter(
              (edge) => edge.source !== nodeId && edge.target !== nodeId,
            );
            const nextGroups = removeNodeIdsFromGroups(state.groups, [nodeId]);
            return {
              edges: nextEdges,
              groups: nextGroups,
              selectedGroupId:
                nextGroups.find((group) => group.id === state.selectedGroupId)
                  ?.id ?? null,
              ...buildReferenceHighlightState(
                state.referenceHoverRefCounts,
                nextEdges,
              ),
            };
          })(),
        };
      });

      // 删除后同步保存快照（确保 redo 能正确重放删除后的状态）
      if (!skipHistory) {
        saveCurrentCanvasToHistory();

        // 自动保存
        if (useChatSettingsStore.getState().autoSaveEnabled) {
          get().saveGraph();
        }
      }
    },

    /**
     * 批量删除节点和边，只保存一次前/后历史快照
     * 用于 Delete/Backspace 键批量删除选中元素的场景
     */
    deleteMultipleElements: (nodeIds: string[], edgeIds: string[]) => {
      if (nodeIds.length === 0 && edgeIds.length === 0) return;

      // 删除前同步保存当前完整状态快照
      saveCurrentCanvasToHistory();

      // 逐个删除，跳过内部历史保存
      edgeIds.forEach((edgeId) => get().deleteEdge(edgeId, true));
      nodeIds.forEach((nodeId) => get().deleteNode(nodeId, true));

      // 删除后同步保存快照（确保 redo 正确）
      saveCurrentCanvasToHistory();

      // 自动保存
      if (useChatSettingsStore.getState().autoSaveEnabled) {
        get().saveGraph();
      }
    },

    createGroup: (nodeIds: string[]) => {
      const state = get();
      const existingNodeIds = new Set(state.nodes.map((node) => node.id));
      const normalizedNodeIds = normalizeGroupNodeIds(nodeIds, existingNodeIds);

      const ungroupedNodeIds = normalizedNodeIds.filter((nodeId) => {
        return !state.groups.some((group) => group.nodeIds.includes(nodeId));
      });

      if (ungroupedNodeIds.length < 2) {
        return "";
      }

      const layoutBounds = getGroupBounds(state.nodes, ungroupedNodeIds, 24);

      const group: CanvasGroup = {
        id: makeGroupId(),
        nodeIds: ungroupedNodeIds,
        name: "分组",
        createdAt: Date.now(),
        layoutOrigin: layoutBounds
          ? {
            x: layoutBounds.x,
            y: layoutBounds.y,
          }
          : undefined,
        frame: layoutBounds ?? undefined,
      };

      set((current) => ({
        nodes: current.nodes.map((node) => {
          if (!ungroupedNodeIds.includes(node.id)) {
            return node;
          }

          return {
            ...node,
            selected: false,
          };
        }),
        groups: [...current.groups, group],
        selectedGroupId: group.id,
        selectedNodesCount: 0,
      }));

      get().requestHistorySave();
      get().saveGraph();
      return group.id;
    },

    updateGroupName: (groupId: string, name: string) => {
      const nextName = name.trim();
      if (!nextName) {
        return;
      }

      set((state) => ({
        groups: state.groups.map((group) =>
          group.id === groupId
            ? {
              ...group,
              name: nextName,
            }
            : group,
        ),
      }));

      get().requestHistorySave();
      if (useChatSettingsStore.getState().autoSaveEnabled) {
        get().saveGraph();
      }
    },

    updateGroupFrame: (groupId, frame, options) => {
      set((state) => ({
        groups: state.groups.map((group) =>
          group.id === groupId
            ? {
              ...group,
              frame,
              layoutOrigin: {
                x: frame.x,
                y: frame.y,
              },
            }
            : group,
        ),
      }));

      get().requestHistorySave();
      if (useChatSettingsStore.getState().autoSaveEnabled) {
        get().saveGraph();
      }
      if (options?.syncMembers) {
        get().syncGroupsByFrame([groupId]);
      }
    },

    ungroup: (groupId: string) => {
      set((state) => ({
        groups: state.groups.filter((group) => group.id !== groupId),
        selectedGroupId:
          state.selectedGroupId === groupId ? null : state.selectedGroupId,
      }));

      get().requestHistorySave();
      get().saveGraph();
    },

    syncDraggedNodesWithGroups: (nodeIds: string[]) => {
      const draggedNodeIds = Array.from(new Set(nodeIds)).filter(Boolean);
      if (draggedNodeIds.length === 0) {
        return;
      }

      const state = get();
      const nodeById = new Map(state.nodes.map((node) => [node.id, node]));
      const affectedGroupIds = state.groups
        .filter((group) => {
          if (group.nodeIds.some((nodeId) => draggedNodeIds.includes(nodeId))) {
            return true;
          }

          const frame =
            group.frame ?? getGroupBounds(state.nodes, group.nodeIds, 18);
          if (!frame) {
            return false;
          }

          return draggedNodeIds.some((nodeId) => {
            const node = nodeById.get(nodeId);
            if (!node) {
              return false;
            }

            const { width, height } = getNodeSize(node);
            const centerX = node.position.x + width / 2;
            const centerY = node.position.y + height / 2;
            return (
              centerX >= frame.x &&
              centerX <= frame.x + frame.width &&
              centerY >= frame.y &&
              centerY <= frame.y + frame.height
            );
          });
        })
        .map((group) => group.id);

      get().syncGroupsByFrame(affectedGroupIds);
    },

    syncGroupsByFrame: (groupIds) => {
      const targetGroupIdSet =
        groupIds && groupIds.length > 0 ? new Set(groupIds) : null;
      let changed = false;

      set((state) => {
        const nextGroups = state.groups.map((group) => {
          if (targetGroupIdSet && !targetGroupIdSet.has(group.id)) {
            return group;
          }

          const frame =
            group.frame ?? getGroupBounds(state.nodes, group.nodeIds, 18);
          if (!frame) {
            return group;
          }

          const nextNodeIds = state.nodes
            .filter((node) => {
              const { width, height } = getNodeSize(node);
              const centerX = node.position.x + width / 2;
              const centerY = node.position.y + height / 2;
              return (
                centerX >= frame.x &&
                centerX <= frame.x + frame.width &&
                centerY >= frame.y &&
                centerY <= frame.y + frame.height
              );
            })
            .map((node) => node.id);

          const currentNodeIds = group.nodeIds.filter((nodeId) =>
            state.nodes.some((node) => node.id === nodeId),
          );
          const isSame =
            currentNodeIds.length === nextNodeIds.length &&
            currentNodeIds.every(
              (nodeId, index) => nodeId === nextNodeIds[index],
            );

          if (isSame) {
            return {
              ...group,
              nodeIds: currentNodeIds,
            };
          }

          changed = true;
          return {
            ...group,
            nodeIds: nextNodeIds,
            frame,
            gridLayoutOrder: group.gridLayoutOrder?.filter((nodeId) =>
              nextNodeIds.includes(nodeId),
            ),
          };
        });

        if (!changed) {
          return state;
        }

        return {
          groups: normalizeCanvasGroups(nextGroups, state.nodes),
        };
      });

      if (changed) {
        get().requestHistorySave();
        if (useChatSettingsStore.getState().autoSaveEnabled) {
          get().saveGraph();
        }
      }
    },

    layoutGroupHorizontal: (groupId: string) => {
      const state = get();
      const group = state.groups.find((item) => item.id === groupId);
      if (!group) {
        return;
      }

      const currentBounds = getGroupBounds(state.nodes, group.nodeIds, 24);

      const layoutResult = layoutGroupHorizontally(
        state.nodes,
        state.edges,
        group.nodeIds,
        {
          anchor: currentBounds
            ? {
              x: currentBounds.x,
              y: currentBounds.y,
            }
            : group.layoutOrigin,
        },
      );

      if (!layoutResult.nextNodes || layoutResult.nextNodes === state.nodes) {
        return;
      }

      set((current) => ({
        nodes: layoutResult.nextNodes,
        groups: normalizeCanvasGroups(
          current.groups,
          layoutResult.nextNodes,
        ).map((item) =>
          item.id === groupId
            ? {
              ...item,
              layoutOrigin: layoutResult.bounds
                ? {
                  x: layoutResult.bounds.x,
                  y: layoutResult.bounds.y,
                }
                : item.layoutOrigin,
              frame: layoutResult.bounds
                ? {
                  x: layoutResult.bounds.x,
                  y: layoutResult.bounds.y,
                  width: layoutResult.bounds.width,
                  height: layoutResult.bounds.height,
                }
                : item.frame,
            }
            : item,
        ),
      }));

      get().requestHistorySave();
      get().saveGraph();
    },

    layoutGroupGrid: (groupId: string) => {
      const state = get();
      const group = state.groups.find((item) => item.id === groupId);
      if (!group) {
        return;
      }

      const currentBounds = getGroupBounds(state.nodes, group.nodeIds, 24);

      const layoutResult = layoutGroupGrid(
        state.nodes,
        state.edges,
        group.nodeIds,
        {
          preferredOrderNodeIds: group.gridLayoutOrder,
          anchor: currentBounds
            ? {
              x: currentBounds.x,
              y: currentBounds.y,
            }
            : group.layoutOrigin,
        },
      );

      if (
        !layoutResult.nextNodes ||
        !hasNodePositionChanges(state.nodes, layoutResult.nextNodes)
      ) {
        return;
      }

      set((current) => ({
        nodes: layoutResult.nextNodes,
        groups: normalizeCanvasGroups(
          current.groups,
          layoutResult.nextNodes,
        ).map((item) =>
          item.id === groupId
            ? {
              ...item,
              gridLayoutOrder: layoutResult.orderedNodeIds,
              layoutOrigin: layoutResult.bounds
                ? {
                  x: layoutResult.bounds.x,
                  y: layoutResult.bounds.y,
                }
                : item.layoutOrigin,
              frame: layoutResult.bounds
                ? {
                  x: layoutResult.bounds.x,
                  y: layoutResult.bounds.y,
                  width: layoutResult.bounds.width,
                  height: layoutResult.bounds.height,
                }
                : item.frame,
            }
            : item,
        ),
      }));

      get().requestHistorySave();
      get().saveGraph();
    },

    moveGroupNodes: (groupId: string, offset: { x: number; y: number }) => {
      const state = get();
      const group = state.groups.find((item) => item.id === groupId);
      if (!group) {
        return;
      }

      set((current) => ({
        nodes: translateNodesByIds(current.nodes, group.nodeIds, offset),
        groups: current.groups.map((item) =>
          item.id !== groupId
            ? item
            : {
              ...item,
              layoutOrigin: {
                x:
                  (item.layoutOrigin?.x ??
                    getGroupBounds(current.nodes, item.nodeIds, 24)?.x ??
                    0) + offset.x,
                y:
                  (item.layoutOrigin?.y ??
                    getGroupBounds(current.nodes, item.nodeIds, 24)?.y ??
                    0) + offset.y,
              },
              frame: item.frame
                ? {
                  ...item.frame,
                  x: item.frame.x + offset.x,
                  y: item.frame.y + offset.y,
                }
                : undefined,
            },
        ),
      }));
    },

    /**
     * 更新图片节点数据（局部 patch）
     */
    updateImageNodeData: (nodeId, patch) => {
      set((state) => ({
        nodes: updateImageNodeInList(state.nodes, nodeId, (data) => ({
          ...data,
          ...patch,
        })),
      }));
    },

    /** 更新导演台节点的可序列化场景快照。 */
    updateDirectorDeskNodeData: (nodeId, patch) => {
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === nodeId && node.type === "directorDeskNode"
            ? { ...node, data: { ...node.data, ...patch } }
            : node,
        ),
      }));
    },

    /**
     * 创建图片生成任务并启动轮询
     */
    startImageGeneration: async (nodeId, payload) => {
      // 先中止旧轮询，避免并发任务冲突
      stopImagePollingInternal(nodeId);

      // 记录待完成的 task 数量（用于多图生成场景）
      // 每次调用递增，这样最后一个任务完成时可以判断是否全部结束
      const currentCount = pendingTaskCounts.get(nodeId) ?? 0;
      pendingTaskCounts.set(nodeId, currentCount + 1);
      const totalTaskCount = currentCount + 1;

      // 使用 originalModel 恢复原始模型状态（避免 payload 中的 backendModel 覆盖 UI 状态）
      // 例如：midjourney-niji7 在发送给后端时会转为 midjourney，但需要保留原始值用于 UI 显示
      const restoredModel = payload.originalModel ?? payload.model;

      // 更新节点输入参数与状态
      // 保留已有的 result.data，实现图片叠加效果（方案一）
      set((state) => ({
        nodes: updateImageNodeInList(state.nodes, nodeId, (data) => ({
          ...data,
          ...payload,
          // 强制恢复原始模型，确保 UI 显示正确的模型名称
          model: restoredModel,
          status: GenerationStatus.QUEUED,
          progress: 0,
          error: undefined,
          // 保留之前的图片数据，新生成的图片会追加到 result.data 中
          result: {
            type: "image",
            data: data.result?.data ?? [],
          },
        })),
      }));

      // 判断是否为 Midjourney 模型
      const isMidjourney = payload.model === "midjourney";
      const scoreCost = Number(payload.requiredPoints ?? 0) || undefined;

      try {
        let taskId: string;
        let ledgerBizId: string | undefined;

        if (isMidjourney) {
          const finalPrompt = buildMidjourneyPrompt({
            prompt: payload.prompt,
            referenceUrls: payload?.midjourneyAdvanced?.referenceUrls,
            styleUrls: payload?.midjourneyAdvanced?.styleUrls,
            iw: payload?.midjourneyAdvanced?.iw,
            sw: payload?.midjourneyAdvanced?.sw,
          });

          // Midjourney 模型使用 zeakai API
          const response = await submitMjImagine(
            { prompt: finalPrompt },
            scoreCost,
          );
          ledgerBizId = response?.ledgerBizId;

          // code === 1 表示提交成功
          if (response.code !== 1) {
            if (ledgerBizId) {
              refundDesktopProxyScore(
                ledgerBizId,
                response.description || "midjourney task creation failed",
                "image",
              ).catch(() => { });
            }
            throw new Error(response.description || "Midjourney 任务提交失败");
          }

          taskId = response.result;
        } else {
          // 非 Midjourney 模型：RunningHub 专属模型走低价->官方回退，其它模型直接走 ToAPI。
          const payloadOriginalModel = payload.originalModel ?? payload.model;
          if (payloadOriginalModel === AGNES_IMAGE_2_FLASH_MODEL) {
            set((state) => ({
              nodes: updateImageNodeInList(state.nodes, nodeId, (data) => ({
                ...data,
                status: GenerationStatus.IN_PROGRESS,
                progress: 0,
              })),
            }));

            try {
              const response = await createAgnesImageGeneration(
                payload,
                scoreCost,
              );
              ledgerBizId = response?.ledgerBizId;

              const resultUrls = extractAgnesImageUrls(response);
              if (resultUrls.length === 0) {
                throw new Error("Agnes 图片生成完成，但未返回图片地址");
              }

              const projectId = get().projectId;
              const rawResultData = resultUrls.map((resultUrl) => ({
                url: resultUrl,
              }));

              // 先写入原始 URL，再统一刷新转存 OSS（等价于模拟点击刷新按钮）
              set((state) => ({
                nodes: updateImageNodeInList(state.nodes, nodeId, (data) => {
                  const existingData = data.result?.data ?? [];
                  const mergedData = appendMediaSequences(
                    existingData,
                    rawResultData,
                  );
                  return {
                    ...data,
                    status: GenerationStatus.COMPLETED,
                    progress: 100,
                    result: { type: "image", data: mergedData },
                    error: undefined,
                  };
                }),
              }));
              saveCurrentCanvasToHistory();
              if (useChatSettingsStore.getState().autoSaveEnabled) {
                get().saveGraph();
              }

              // 刷新 OSS 转存
              const currentImages =
                (
                  get().nodes.find((n) => n.id === nodeId)
                    ?.data as ImageGenerationNode
                )?.result?.data ?? [];
              const startIndex = currentImages.length - rawResultData.length;
              for (let i = 0; i < rawResultData.length; i++) {
                void refreshImageToOss(
                  nodeId,
                  currentImages,
                  startIndex + i,
                  get().updateImageNodeData,
                );
              }
              if (ledgerBizId) {
                confirmDesktopProxyScore(ledgerBizId, "agnes").catch(() => { });
              }
              await refreshBalanceAfterGeneration({
                scene: "image",
                nodeId,
                model: payloadOriginalModel,
                requiredPoints: payload.requiredPoints,
              });

              const remaining = (pendingTaskCounts.get(nodeId) ?? 1) - 1;
              if (remaining <= 0) pendingTaskCounts.delete(nodeId);
              else pendingTaskCounts.set(nodeId, remaining);

              return;
            } catch (agnesError) {
              if (ledgerBizId) {
                refundDesktopProxyScore(
                  ledgerBizId,
                  getRequestErrorMessage(agnesError) || "Agnes image failed",
                  "agnes",
                ).catch(() => { });
              }
              throw agnesError;
            }
          }

          if (RUNNINGHUB_IMAGE_MODEL_IDS.has(payloadOriginalModel)) {
            // RunningHub 直接生成（可能返回立即地址或 taskId）
            set((state) => ({
              nodes: updateImageNodeInList(state.nodes, nodeId, (data) => ({
                ...data,
                status: GenerationStatus.IN_PROGRESS,
                progress: 0,
              })),
            }));

            try {
              const resultUrl = await generateRunningHubImageWithFallback({
                model: payloadOriginalModel,
                prompt: payload.prompt,
                imageUrls: Array.isArray(payload.image_urls)
                  ? payload.image_urls
                  : [],
                size: payload.size,
                resolution: payload.resolution,
                scoreCost,
              });

              const rawResultItem = { url: resultUrl };

              // 先写入原始 URL，再统一刷新转存 OSS
              set((state) => ({
                nodes: updateImageNodeInList(state.nodes, nodeId, (data) => {
                  const existingData = data.result?.data ?? [];
                  const mergedData = appendMediaSequences(existingData, [
                    rawResultItem,
                  ]);
                  return {
                    ...data,
                    status: GenerationStatus.COMPLETED,
                    progress: 100,
                    result: { type: "image", data: mergedData },
                    error: undefined,
                  };
                }),
              }));
              saveCurrentCanvasToHistory();
              if (useChatSettingsStore.getState().autoSaveEnabled) {
                get().saveGraph();
              }

              // 刷新 OSS 转存
              const currentImages =
                (
                  get().nodes.find((n) => n.id === nodeId)
                    ?.data as ImageGenerationNode
                )?.result?.data ?? [];
              const lastIndex = currentImages.length - 1;
              void refreshImageToOss(
                nodeId,
                currentImages,
                lastIndex,
                get().updateImageNodeData,
              );

              await refreshBalanceAfterGeneration({
                scene: "image",
                nodeId,
                model: payloadOriginalModel,
                requiredPoints: payload.requiredPoints,
              });

              // 调整 pending count
              const remaining = (pendingTaskCounts.get(nodeId) ?? 1) - 1;
              if (remaining <= 0) pendingTaskCounts.delete(nodeId);
              else pendingTaskCounts.set(nodeId, remaining);

              return;
            } catch (rhError) {
              console.error(
                "[startImageGeneration] RunningHub 生图失败:",
                rhError,
              );
              const remaining = (pendingTaskCounts.get(nodeId) ?? 1) - 1;
              if (remaining <= 0) pendingTaskCounts.delete(nodeId);
              else pendingTaskCounts.set(nodeId, remaining);
              throw rhError;
            }
          }

          // 非 RunningHub：创建图片生成任务，获取 task_id 后启动轮询
          const response: any = await createImageGeneration(payload, scoreCost);
          ledgerBizId = response?.ledgerBizId;

          // 从响应中提取 task_id（兼容多种返回结构）
          taskId =
            response?.data?.task_id ??
            response?.result?.task_id ??
            response?.task_id ??
            response?.data?.taskId ??
            response?.result?.taskId ??
            response?.taskId ??
            response?.data?.id ??
            response?.result?.id ??
            response?.id;

          if (!taskId) {
            if (ledgerBizId) {
              refundDesktopProxyScore(
                ledgerBizId,
                "image task creation failed: no task_id",
                "image",
              ).catch(() => { });
            }
            throw new Error("未返回任务 ID，请稍后再试");
          }
        }

        if (!taskId) {
          if (ledgerBizId) {
            refundDesktopProxyScore(
              ledgerBizId,
              "image task creation failed: empty task_id",
              "image",
            ).catch(() => { });
          }
          throw new Error("任务 ID 为空");
        }

        // 标记为生成中
        set((state) => ({
          nodes: updateImageNodeInList(state.nodes, nodeId, (data) => ({
            ...data,
            status: GenerationStatus.IN_PROGRESS,
            progress: 0,
          })),
        }));

        // 为每个 task 创建独立的 controller，以 taskId 为 key 存储
        const controller = new AbortController();
        imagePollingControllers.set(taskId, controller);

        // 根据模型类型选择不同的轮询函数，传入 totalTaskCount 用于判断所有任务是否完成
        if (isMidjourney) {
          pollMjImageGeneration(
            taskId,
            nodeId,
            controller.signal,
            set,
            get,
            totalTaskCount,
            ledgerBizId,
          );
        } else {
          // 非 Midjourney 模型使用标准轮询
          pollImageGeneration(
            taskId,
            nodeId,
            controller.signal,
            set,
            get,
            totalTaskCount,
            ledgerBizId,
          );
        }
      } catch (startError) {
        console.error("创建图片生成任务失败:", startError);
        // 调用失败时减少待完成数量
        const remaining = (pendingTaskCounts.get(nodeId) ?? 1) - 1;
        if (remaining <= 0) {
          pendingTaskCounts.delete(nodeId);
        } else {
          pendingTaskCounts.set(nodeId, remaining);
        }
        // 从 error 对象中提取后端返回的详细信息
        const serverMessage = getRequestErrorMessage(startError);
        set((state) => ({
          nodes: updateImageNodeInList(state.nodes, nodeId, (data) => ({
            ...data,
            status: GenerationStatus.FAILED,
            error: {
              code: "CREATE_TASK_FAILED",
              message:
                startError instanceof Error
                  ? startError.message
                  : "创建任务失败，请稍后再试",
              detail: serverMessage,
              serverMessage,
            },
          })),
        }));
        throw startError;
      }
    },

    /**
     * 手动停止图片轮询（停止该节点下所有任务的轮询）
     */
    stopImagePolling: (nodeId) => {
      // 停止所有与该节点相关的 task 轮询
      imagePollingControllers.forEach((controller, taskId) => {
        controller.abort();
        imagePollingControllers.delete(taskId);
      });
      pendingTaskCounts.delete(nodeId);
    },

    /**
     * 本地 Gemini 图片直连：直接调用 API 并上传 OSS（无需轮询）
     * @param nodeId 节点 ID
     * @param payload 包含 prompt, image_urls, size, resolution 等字段
     */
    startGeminiPro2Generation: async (nodeId, payload) => {
      // 先中止旧轮询（清除该节点所有相关的 polling controller）
      imagePollingControllers.forEach((controller, taskId) => {
        controller.abort();
        imagePollingControllers.delete(taskId);
      });
      pendingTaskCounts.delete(nodeId);

      const {
        model,
        platform,
        prompt,
        image_urls: rawImageUrls = [],
        size,
        resolution,
        promptDraft,
        promptDraftHtml,
        requiredPoints,
      } = payload;
      const directGeminiModel = resolveLocalGeminiImageModel({
        model,
        platform,
        size,
        resolution,
      });
      const imageUrls = Array.isArray(rawImageUrls) ? rawImageUrls : [];
      const originalModel = payload.originalModel ?? payload.model;
      const scoreCost = Number(requiredPoints ?? 0) || undefined;
      let ledgerBizId: string | undefined;

      // 更新节点状态为排队中
      set((state) => ({
        nodes: updateImageNodeInList(state.nodes, nodeId, (data) => ({
          ...data,
          model: originalModel,
          originalModel,
          platform: platform ?? data.platform,
          prompt,
          promptDraft: promptDraft ?? "",
          promptDraftHtml: promptDraftHtml ?? "<p></p>",
          requiredPoints,
          size,
          resolution,
          status: GenerationStatus.QUEUED,
          progress: 0,
          error: undefined,
          result: {
            type: "image",
            data: data.result?.data ?? [],
          },
        })),
      }));

      try {

        // 1. 构造请求体
        // 注意：text 和 fileData 不能同时存在于同一个 part，必须拆成独立的 part。
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parts: any[] = [];

        // 先添加文本 part
        if (prompt) {
          parts.push({ text: prompt });
        }

        // 再添加图片 parts（每个图片一个独立的 fileData part）
        for (const url of imageUrls) {
          parts.push({
            fileData: {
              fileUri: url,
              mimeType: inferImageMimeTypeFromUri(url),
            },
          });
        }

        // 如果既没有文本也没有图片，则添加空文本
        if (parts.length === 0) {
          parts.push({ text: "" });
        }

        const requestBody = {
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ["IMAGE"],
          },
        };

        // 2. 更新状态为生成中
        set((state) => ({
          nodes: updateImageNodeInList(state.nodes, nodeId, (data) => ({
            ...data,
            status: GenerationStatus.IN_PROGRESS,
            progress: 0,
          })),
        }));

        // 3. 调用 API
        const response: GeminiYwResponseBody = await generateGeminiContent(
          directGeminiModel,
          requestBody,
          undefined,
          scoreCost,
        );
        ledgerBizId = (response as any)?.ledgerBizId;

        // 4. 解析响应，提取图片 Base64
        const candidates = response.candidates ?? [];
        if (candidates.length === 0) {
          throw new Error("API 返回为空");
        }

        const imageParts = candidates[0].content.parts.filter(
          (p) => p.inlineData?.data,
        );

        // 5. 将每张图片上传到 OSS
        const processedResultData = await Promise.all(
          imageParts.map(async (part, index) => {
            const base64Data = part.inlineData!.data;
            try {
              const ossResult = await uploadBase64ToOSS(
                base64Data,
                `gemini-${Date.now()}-${index}`,
              );
              return {
                url: ossResult.url,
                remoteUrl: ossResult.url,
              };
            } catch (ossError) {
              console.error(
                "[startGeminiPro2Generation] 上传图片到 OSS 失败:",
                ossError,
              );
              throw new Error("图片已生成，但转存 OSS 失败，请重试");
            }
          }),
        );

        // 6. 更新节点状态为完成
        set((state) => ({
          nodes: updateImageNodeInList(state.nodes, nodeId, (data) => {
            const existingData = data.result?.data ?? [];
            const mergedData = appendMediaSequences(
              existingData,
              processedResultData,
            );
            return {
              ...data,
              status: GenerationStatus.COMPLETED,
              progress: 100,
              result: {
                type: "image",
                data: mergedData,
              },
              error: undefined,
            };
          }),
        }));
        saveCurrentCanvasToHistory();
        if (useChatSettingsStore.getState().autoSaveEnabled) {
          get().saveGraph();
        }

        if (ledgerBizId) {
          confirmDesktopProxyScore(ledgerBizId, "image").catch(() => { });
        }

        await refreshBalanceAfterGeneration({
          scene: "image",
          nodeId,
          model: payload.originalModel ?? payload.model,
          requiredPoints: payload.requiredPoints,
        });
      } catch (startError) {
        console.error(
          "[startGeminiPro2Generation] Gemini 3 Pro 渠道二生成失败:",
          startError,
        );
        const rawServerMessage = getRequestErrorMessage(startError);
        set((state) => ({
          nodes: updateImageNodeInList(state.nodes, nodeId, (data) => ({
            ...data,
            status: GenerationStatus.FAILED,
            error: {
              code: "GEMINI_PRO2_FAILED",
              message:
                startError instanceof Error
                  ? startError.message
                  : "生成失败，请稍后再试",
              detail: rawServerMessage,
              serverMessage: rawServerMessage,
            },
          })),
        }));
        saveCurrentCanvasToHistory();
        if (useChatSettingsStore.getState().autoSaveEnabled) {
          get().saveGraph();
        }
        if (ledgerBizId) {
          refundDesktopProxyScore(
            ledgerBizId,
            rawServerMessage || "gemini image generation failed",
            "image",
          ).catch(() => { });
        }
        throw startError;
      }
    },

    /**
     * 拆图：将图片节点拆分为宫格子图
     * @param nodeId 源图片节点 ID
     * @param gridSize 网格大小 (2=2x2, 3=3x3, 4=4x4)
     */
    splitImage: (nodeId: string, gridSize: number) => {
      const sourceNode = get().nodes.find((node) => node.id === nodeId);
      if (!sourceNode || sourceNode.type !== "imageNode") return;

      const sourceData = sourceNode.data as ImageGenerationNode;
      const sourceModel = sourceData.model || "doubao-seedream-5-0";
      const sourcePlatform = sourceData.platform;
      const isLocalDirectImageModel =
        sourcePlatform === "google_pro2" ||
        (sourceModel === NANO_BANANA_LOCAL_MODEL &&
          sourcePlatform === NANO_BANANA_LOCAL_PLATFORM);
      const sourceImageUrl = sourceData.result?.data?.[0]?.url;

      const totalCells = gridSize * gridSize;
      const sourceAspectRatio =
        sourceData.size?.includes(":") || sourceData.aspectRatio?.includes(":")
          ? (sourceData.size ?? sourceData.aspectRatio)
          : undefined;
      const childNodeSize = sourceAspectRatio
        ? getNodeSizeByAspectRatio(sourceAspectRatio, 250)
        : { width: 350, height: 250 };
      const columnGap = Math.max(48, Math.round(childNodeSize.width * 0.1));
      const rowGap = Math.max(48, Math.round(childNodeSize.height * 0.16));

      const startX =
        sourceNode.position.x +
        (sourceNode.width ?? childNodeSize.width) +
        columnGap * 2;
      const startY = sourceNode.position.y;
      const createdNodeIds: string[] = [];

      const gridNameMap: Record<number, string> = {
        2: "四",
        3: "九",
        4: "十六",
      };
      const gridName = gridNameMap[gridSize];

      const newEdges: EdgeType[] = [];

      for (let i = 0; i < totalCells; i++) {
        const row = Math.floor(i / gridSize) + 1;
        const col = (i % gridSize) + 1;

        const position = {
          x: startX + (col - 1) * (childNodeSize.width + columnGap),
          y: startY + (row - 1) * (childNodeSize.height + rowGap),
        };
        const splitPrompt = `这是${gridName}宫格图片，请提取第${row}行第${col}列，保持原构图和色调，去除边角文字、字幕和标注，高清优化。`;

        const newId = get().addNode("image", position);
        if (newId) {
          createdNodeIds.push(newId);
        }

        newEdges.push({
          id: `edge-${nodeId}-${newId}`,
          source: nodeId,
          target: newId,
          sourceHandle: "output",
          targetHandle: "input",
        });

        // 先将提示词回填到子图的文本输入区域
        get().updateImageNodeData(newId, {
          model: sourceData.model,
          originalModel: sourceData.originalModel ?? sourceData.model,
          platform: sourceData.platform,
          size: sourceData.size,
          resolution: sourceData.resolution,
          midjourneyAdvanced: sourceData.midjourneyAdvanced,
          promptDraft: splitPrompt,
          promptDraftHtml: `<p>${splitPrompt}</p>`,
        });

        const payload: any = {
          model: sourceModel,
          originalModel: sourceData.originalModel ?? sourceData.model,
          platform: sourceData.platform,
          prompt: splitPrompt,
          n: 1,
          promptDraft: splitPrompt,
          promptDraftHtml: `<p>${splitPrompt}</p>`,
          metadata: {},
        };

        if (sourceData.size) {
          payload.size = sourceData.size;
          payload.metadata.resolution = sourceData.resolution;
        }
        if (sourceData.resolution) {
          payload.resolution = sourceData.resolution;
        }

        if (sourceImageUrl) {
          payload.image_urls = [sourceImageUrl];
        }

        if (isLocalDirectImageModel) {
          void get().startGeminiPro2Generation(newId, payload);
        } else {
          void get().startImageGeneration(newId, payload);
        }
      }

      // 将新边添加到画布
      set((state) => ({
        edges: [...state.edges, ...newEdges],
      }));

      // 自动保存

      if (createdNodeIds.length > 1) {
        get().createGroup(createdNodeIds);
      }

      if (useChatSettingsStore.getState().autoSaveEnabled) {
        get().saveGraph();
      }
    },

    /**
     * 独立为图片：将节点中的多张图片/视频拆分为独立节点
     * @param nodeId 源节点 ID
     */
    separateToNodes: (nodeId: string) => {
      void (async () => {
        const sourceNode = get().nodes.find((node) => node.id === nodeId);
        if (!sourceNode) return;

        const nodeType = sourceNode.type;
        const sourceData = sourceNode.data as
          | ImageGenerationNode
          | NewVideoGenerationNode;
        const resultData = sourceData.result?.data;
        const isNewVideoGenerating =
          nodeType === "newVideoNode" &&
          (sourceData.status === GenerationStatus.IN_PROGRESS ||
            sourceData.status === GenerationStatus.QUEUED);
        const shouldSeparateGeneratingNewVideo =
          isNewVideoGenerating && resultData?.length === 1;

        if (
          !resultData ||
          (resultData.length <= 1 && !shouldSeparateGeneratingNewVideo)
        ) {
          return;
        }

        saveCurrentCanvasToHistory();

        const targetNodeType =
          nodeType === "newVideoNode" ? "newVideo" : "image";
        const validItems = (
          shouldSeparateGeneratingNewVideo
            ? resultData.slice(0, 1)
            : resultData.slice(1)
        ).filter((item) => item?.url || item?.remoteUrl);

        if (validItems.length === 0) return;

        const sourceVisualSize =
          nodeType === "imageNode"
            ? getNodeSizeByAspectRatio(
              (sourceData as ImageGenerationNode).size ?? "4:3",
              250,
            )
            : getNodeSizeByAspectRatio(
              (sourceData as NewVideoGenerationNode).aspect_ratio ?? "16:9",
              250,
            );
        const verticalGap = 32;
        const baseY =
          sourceNode.position.y + sourceVisualSize.height + verticalGap;
        const minGap = 18;
        const maxGap = 30;

        const resolvedItems =
          targetNodeType === "image"
            ? await Promise.all(
              validItems.map(async (item) => {
                const imageUrl = item.remoteUrl || item.url;
                let aspectRatio = sourceData.size ?? "4:3";

                if (imageUrl) {
                  try {
                    const { width, height } =
                      await getImageDimensions(imageUrl);
                    aspectRatio = getClosestAspectRatio(width, height);
                  } catch (error) {
                    console.warn(
                      "[separateToNodes] 获取图片比例失败，使用回退比例:",
                      error,
                    );
                  }
                }

                const nodeSize = getNodeSizeByAspectRatio(aspectRatio, 250);

                return {
                  item,
                  aspectRatio,
                  nodeSize,
                };
              }),
            )
            : await Promise.all(
              validItems.map(async (item) => {
                const videoUrl = item.remoteUrl || item.url;
                let aspectRatio =
                  (sourceData as NewVideoGenerationNode).aspect_ratio ??
                  "16:9";

                if (videoUrl) {
                  try {
                    const { width, height } =
                      await getVideoDimensions(videoUrl);
                    aspectRatio = getClosestAspectRatio(width, height);
                  } catch (error) {
                    console.warn(
                      "[separateToNodes] 获取视频比例失败，使用回退比例:",
                      error,
                    );
                  }
                }

                return {
                  item,
                  aspectRatio,
                  nodeSize: getNodeSizeByAspectRatio(aspectRatio, 250),
                };
              }),
            );

        const latestState = get();
        const latestSourceNode = latestState.nodes.find(
          (node) => node.id === nodeId,
        );
        if (!latestSourceNode) return;

        let currentX = latestSourceNode.position.x;
        const newNodes = resolvedItems.map(
          ({ item, aspectRatio, nodeSize }) => {
            const gap = Math.max(
              minGap,
              Math.min(maxGap, Math.round(nodeSize.width * 0.06)),
            );
            const newNodeId = get().getNextNodeId(targetNodeType);
            const factory = nodeFactoryMap[targetNodeType];
            const baseNode = factory(newNodeId, { x: currentX, y: baseY });

            const finalNode =
              targetNodeType === "newVideo"
                ? {
                  ...baseNode,
                  width: nodeSize.width,
                  height: nodeSize.height,
                  data: {
                    ...baseNode.data,
                    aspect_ratio: aspectRatio,
                    status: GenerationStatus.COMPLETED,
                    progress: 100,
                    result: {
                      type: "video",
                      data: [
                        {
                          ...item,
                          format: item.format ?? "mp4",
                        },
                      ],
                    },
                  },
                }
                : {
                  ...baseNode,
                  width: nodeSize.width,
                  height: nodeSize.height,
                  data: {
                    ...baseNode.data,
                    status: GenerationStatus.COMPLETED,
                    progress: 100,
                    size: aspectRatio,
                    result: {
                      type: "image",
                      data: [{ ...item }],
                    },
                  },
                };

            currentX += nodeSize.width + gap;
            return finalNode as AllNodeType;
          },
        );

        const nextNodes = latestState.nodes
          .map((node) => {
            if (node.id !== nodeId) {
              return node;
            }

            if (targetNodeType === "newVideo") {
              return {
                ...node,
                data: {
                  ...node.data,
                  result: {
                    type: sourceData.result?.type ?? "video",
                    // 新版视频节点生成中有一个 UI 占位卡；当只有一个真实视频时，独立后源节点继续保留生成状态。
                    data: shouldSeparateGeneratingNewVideo
                      ? []
                      : [
                        {
                          ...(resultData[0] as any),
                          format: (resultData[0] as any)?.format ?? "mp4",
                        },
                      ],
                  },
                },
              } as AllNodeType;
            }

            return {
              ...node,
              data: {
                ...node.data,
                result: {
                  type: sourceData.result?.type ?? "image",
                  data: [resultData[0]],
                },
              },
            } as AllNodeType;
          })
          .concat(newNodes);

        set(() => ({
          nodes: nextNodes,
          selectedNodesCount: nextNodes.filter((node) => node.selected).length,
        }));

        get().requestHistorySave();

        if (useChatSettingsStore.getState().autoSaveEnabled) {
          get().saveGraph();
        }
      })();
    },

    /**
     * 更新视频节点数据（局部 patch）
     */
    updateNewVideoNodeData: (nodeId, patch) => {
      set((state) => ({
        nodes: updateNewVideoNodeInList(state.nodes, nodeId, (data) => ({
          ...data,
          ...patch,
        })),
      }));
    },

    updateNodeDimensions: (nodeId, width, height) => {
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === nodeId ? { ...node, width, height } : node,
        ),
      }));
    },

    /**
     * 更新音频节点数据（局部 patch）
     */
    updateAudioNodeData: (nodeId, patch) => {
      set((state) => ({
        nodes: updateAudioNodeInList(state.nodes, nodeId, (data) => ({
          ...data,
          ...patch,
        })),
      }));
    },

    /**
     * 更新节点的 nickname（通用方法）
     */
    updateNodeNickname: (nodeId, nickname) => {
      set((state) => ({
        nodes: state.nodes.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                nickname,
              },
            };
          }
          return node;
        }),
      }));

      get().requestHistorySave();

      if (useChatSettingsStore.getState().autoSaveEnabled) {
        get().saveGraph();
      }
    },

    updateTextAgentNodeData: (nodeId, patch) => {
      set((state) => ({
        nodes: updateTextAgentNodeInList(state.nodes, nodeId, (data) => ({
          ...data,
          ...patch,
        })),
      }));
    },

    updateImageAgentNodeData: (nodeId, patch) => {
      set((state) => ({
        nodes: updateImageAgentNodeInList(state.nodes, nodeId, (data) => ({
          ...data,
          ...patch,
        })),
      }));
    },

    updateVideoAgentNodeData: (nodeId, patch) => {
      set((state) => ({
        nodes: updateVideoAgentNodeInList(state.nodes, nodeId, (data) => ({
          ...data,
          ...patch,
        })),
      }));
    },

    updateTableNodeData: (nodeId, patchOrUpdater) => {
      set((state) => ({
        nodes: updateTableNodeInList(
          state.nodes,
          nodeId,
          typeof patchOrUpdater === "function"
            ? patchOrUpdater
            : (data) => ({ ...data, ...patchOrUpdater }),
        ),
      }));
    },

    /**
     * 创建视频生成任务并启动轮询
     */
    startNewVideoGeneration: async (nodeId, payload, count = 1) => {
      stopVideoPollingInternal(nodeId);

      const input = payload.__newVideoInput;
      const requestPayload = { ...payload };
      delete requestPayload.__newVideoInput;
      const requiredPoints = requestPayload.requiredPoints;
      delete requestPayload.requiredPoints;
      // 新版视频节点固定一次只创建一个视频任务，避免一个节点同时产出多条结果影响体验。
      const totalTasks = 1;
      const model = input?.model ?? requestPayload.model ?? "";
      const isSeedance20 =
        model === "seedance-2.0-fast" || model === "seedance-2.0-pro";
      const isOverseasSeedance20 =
        model === "dreamina-seedance-2-0-260128";

      set((state) => ({
        nodes: updateNewVideoNodeInList(state.nodes, nodeId, (data) => ({
          ...data,
          model,
          prompt: input?.prompt ?? data.prompt,
          promptDraft: input?.prompt ?? data.promptDraft,
          duration: input?.params?.duration ?? data.duration,
          aspect_ratio: input?.params?.aspectRatio ?? data.aspect_ratio,
          requiredPoints,
          status: GenerationStatus.QUEUED,
          progress: 0,
          // 新版视频节点和老版保持一致：开始生成时保留已有视频结果，
          // 新结果完成后追加进画廊，这样上传视频/生成视频可以一起展开和显示序号标记。
          result: {
            type: "video",
            data: data.result?.data ?? [],
          },
          error: undefined,
          metadata: {
            ...data.metadata,
            params: input?.params,
            mode: input?.mode,
            count: totalTasks,
            tasks: [],
            failedTasks: [],
          },
        })),
      }));

      try {

        const createTask = async () => {
          let response: any;
          if (isOverseasSeedance20) {
            response = await createOverseasSeedanceVideoTask(
              requestPayload,
              requiredPoints,
            );
          } else if (isSeedance20) {
            response = await createLzVideoTask(requestPayload, requiredPoints);
          } else if (model === "agnes-video-v2.0") {
            // Agnes 走独立桌面代理通道，避免被误归类为 dashscope / kuaizi。
            response = await createAgnesVideoTask(
              requestPayload,
              requiredPoints,
            );
          } else {
            response = await createDashscopeVideoSynthesis(
              requestPayload,
              requiredPoints,
            );
          }
          // 通用 taskId 提取：兼容 dashscope/kuaizi 的 data/output 嵌套，
          // 以及 agnes-video-v2.0 的顶层 video_id / id / task_id 字段。
          const taskId =
            response?.data?.id ??
            response?.data?.task_id ??
            response?.output?.task_id ??
            response?.video_id ??
            response?.id ??
            response?.task_id ??
            response?.data?.taskId ??
            response?.taskId ??
            "";

          if (!taskId) {
            // 创建失败时，如果有 ledgerBizId 需要退款
            if (response?.ledgerBizId) {
              refundDesktopProxyScore(
                response.ledgerBizId,
                "task creation failed: no task_id",
              ).catch(() => { });
            }
            throw new Error("任务 ID 为空");
          }

          return {
            taskId: taskId as string,
            ledgerBizId: response?.ledgerBizId as string | undefined,
          };
        };

        const taskResults = await Promise.all(
          Array.from({ length: totalTasks }, () => createTask()),
        );
        const taskIds = taskResults.map((r) => r.taskId);
        const ledgerBizId = taskResults[0]?.ledgerBizId;

        set((state) => ({
          nodes: updateNewVideoNodeInList(state.nodes, nodeId, (data) => ({
            ...data,
            task_id: taskIds[0],
            status: GenerationStatus.IN_PROGRESS,
            progress: 0,
            metadata: {
              ...data.metadata,
              tasks: taskIds,
              failedTasks: [],
              ledgerBizId,
            },
          })),
        }));

        const controller = new AbortController();
        videoPollingControllers.set(nodeId, controller);
        taskIds.forEach((taskId, index) => {
          void pollNewVideoGeneration({
            taskId,
            nodeId,
            signal: controller.signal,
            setState: set,
            getState: get,
            isSeedance20,
            taskIndex: index,
            totalTasks,
            ledgerBizId,
            videoProvider:
              model === "agnes-video-v2.0"
                ? "agnes"
                : isOverseasSeedance20
                  ? "seedance_global"
                  : isSeedance20
                    ? "seedance"
                    : "dashscope",
          });
        });
      } catch (startError) {
        const serverMessage = getRequestErrorMessage(startError);
        set((state) => ({
          nodes: updateNewVideoNodeInList(state.nodes, nodeId, (data) => ({
            ...data,
            status: GenerationStatus.FAILED,
            error: {
              code: "CREATE_TASK_FAILED",
              message: "创建任务失败，请稍后再试",
              detail: serverMessage,
              serverMessage,
            },
          })),
        }));
        throw startError;
      }
    },

    /**
     * 手动停止视频轮询
     */
    stopVideoPolling: (nodeId) => {
      stopVideoPollingInternal(nodeId);
    },

    // ==================== 任务管理 ====================

    /**
     * 获取正在生成的任务数量
     */
    getGeneratingTasksCount: () => {
      const { nodes } = get();
      let count = 0;

      nodes.forEach((node) => {
        const status = node.data?.status;
        // 图片/视频节点使用 GenerationStatus 枚举
        if (
          status === GenerationStatus.IN_PROGRESS ||
          status === GenerationStatus.QUEUED
        ) {
          count++;
        }
        // 文本智能体节点使用字符串状态
        if (node.type === "textAgentNode" && status === "generating") {
          count++;
        }
      });

      return count;
    },

    /**
     * 取消所有正在生成的任务
     */
    cancelAllGeneratingTasks: () => {
      const { nodes } = get();

      // 收集需要停止轮询的节点
      const imageNodesToStop: string[] = [];
      const videoNodesToStop: string[] = [];

      nodes.forEach((node) => {
        const status = node.data?.status;
        if (
          status === GenerationStatus.IN_PROGRESS ||
          status === GenerationStatus.QUEUED
        ) {
          if (node.type === "imageNode") {
            imageNodesToStop.push(node.id);
          } else if (node.type === "newVideoNode") {
            videoNodesToStop.push(node.id);
          }
        }
      });

      // 停止所有轮询
      imageNodesToStop.forEach((nodeId) => stopImagePollingInternal(nodeId));
      videoNodesToStop.forEach((nodeId) => stopVideoPollingInternal(nodeId));

      // 一次性更新所有节点状态
      set((state) => ({
        nodes: state.nodes.map((node) => {
          const status = node.data?.status;
          if (
            status === GenerationStatus.IN_PROGRESS ||
            status === GenerationStatus.QUEUED
          ) {
            if (node.type === "imageNode") {
              return {
                ...node,
                data: {
                  ...node.data,
                  status: GenerationStatus.FAILED,
                  error: { message: "任务已取消" },
                },
              };
            } else if (node.type === "newVideoNode") {
              return {
                ...node,
                data: {
                  ...node.data,
                  status: GenerationStatus.FAILED,
                  error: { message: "任务已取消" },
                },
              };
            }
          }
          // 文本智能体节点
          if (node.type === "textAgentNode" && status === "generating") {
            return {
              ...node,
              data: {
                ...node.data,
                status: "error",
                error: "任务已取消",
              },
            };
          }
          return node;
        }),
      }));
    },

    // ==================== 导入导出方法实现 ====================

    /**
     * 导出画布数据
     */
    exportCanvasData: () => {
      const state = get();
      return buildCanvasPersistedState(state);
    },

    /**
     * 导入画布数据（覆盖模式）
     */
    importCanvasData: (data) => {
      const normalizedData = buildCanvasPersistedState(data);

      set({
        nodes: normalizedData.nodes,
        edges: normalizedData.edges,
        nodeIdCounters: normalizedData.nodeIdCounters,
        groups: normalizedData.groups,
        activeNodeId: null,
        activeVideoTool: null,
        selectedGroupId: null,
      });
    },

    // ==================== 流程事件处理 ====================

    /**
     * 处理节点变化事件（位置、尺寸、删除等）
     *
     * 注意：CanvasFlow 组件内部已做拖动优化（本地状态隔离），
     * 拖动过程中不会调用此方法，只有拖动结束或其他变更时才调用。
     */
    onNodesChange: (changes) => {
      const hasSelectChange = changes.some(
        (change) => change.type === "select",
      );
      const hasFinalPositionChange = changes.some(
        (change) => change.type === "position" && !change.dragging,
      );
      const hasAddOrRemove = changes.some(
        (change) => change.type === "add" || change.type === "remove",
      );
      set((state) => {
        const nextNodes = applyNodeChanges(changes, state.nodes);
        const nextGroups =
          hasFinalPositionChange || hasAddOrRemove
            ? normalizeCanvasGroups(state.groups, nextNodes).map((group) => {
              const bounds = getGroupBounds(nextNodes, group.nodeIds, 24);
              return {
                ...group,
                layoutOrigin: bounds
                  ? {
                    x: bounds.x,
                    y: bounds.y,
                  }
                  : group.layoutOrigin,
              };
            })
            : state.groups;
        // 计算选中节点数量，避免在 ImageNode 等组件中 O(n²) 遍历
        const selectedCount = nextNodes.filter((n) => n.selected).length;
        return {
          nodes: nextNodes,
          selectedNodesCount: selectedCount,
          selectedGroupId: hasSelectChange ? null : state.selectedGroupId,
          groups: nextGroups,
        };
      });

      // 在节点变化后保存历史记录（排除拖动中的变化）
      if (hasFinalPositionChange || hasAddOrRemove) {
        get().requestHistorySave();
      }
    },

    /**
     * 处理边变化事件
     * 当删除连接到视频/图片节点的边时，同步清理 image_urls 中对应的 URL
     */
    onEdgesChange: (changes) => {
      set((state) => {
        const nextEdges = applyEdgeChanges(changes, state.edges);
        const removedEdgeIds = changes
          .filter((change) => change.type === "remove")
          .map((change) => change.id);

        if (removedEdgeIds.length === 0) {
          return {
            edges: nextEdges,
            ...buildReferenceHighlightState(
              state.referenceHoverRefCounts,
              nextEdges,
            ),
          };
        }

        const removedEdges = state.edges.filter((edge) =>
          removedEdgeIds.includes(edge.id),
        );
        let nextNodes = state.nodes;

        removedEdges.forEach((edge) => {
          nextNodes = syncMediaUrlsByEdge(nextNodes, edge, "remove");
        });

        return {
          edges: nextEdges,
          nodes: nextNodes,
          ...buildReferenceHighlightState(
            state.referenceHoverRefCounts,
            nextEdges,
          ),
        };
      });
    },

    /**
     * 处理新连接创建事件
     * 当连接到视频节点时，自动同步上游图片节点的 URL 到 image_urls
     */
    onConnect: (connection) => {
      const { nodes } = get();

      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);

      if (targetNode?.type === "newVideoNode") {
        const allowedSourceTypes = [
          "noteNode",
          "imageNode",
          "newVideoNode",
          "audioNode",
        ];
        if (sourceNode && !allowedSourceTypes.includes(sourceNode.type || "")) {
          console.warn("视频节点只能接受图片、视频、音频节点的输入");
          return;
        }

        if (sourceNode?.type === "audioNode") {
          const audioData = sourceNode.data as AudioGenerationNode;
          const audioDuration =
            audioData.result?.data?.[0]?.duration || audioData.duration || 0;

          if (audioDuration > 15) {
            console.warn("音频时长超过15秒，无法连接到视频节点");
            return;
          }
        }
      }

      set((state) => {
        const nextEdges = addEdge(connection, state.edges);
        const currentEdgeIds = new Set(state.edges.map((edge) => edge.id));
        const createdEdge = nextEdges.find(
          (edge) => !currentEdgeIds.has(edge.id),
        );

        return {
          nodes: createdEdge
            ? syncMediaUrlsByEdge(state.nodes, createdEdge as EdgeType, "add")
            : state.nodes,
          edges: nextEdges,
          ...buildReferenceHighlightState(
            state.referenceHoverRefCounts,
            nextEdges,
          ),
        };
      });

      get().requestHistorySave();
    },

    /**
     * 设置参考资源悬浮高亮（支持多项并发高亮）。
     */
    setReferenceHoverHighlight: (sourceNodeId, targetNodeId, isHovering) => {
      if (!sourceNodeId || !targetNodeId) {
        return;
      }

      set((state) => {
        const key = buildReferenceHoverKey(sourceNodeId, targetNodeId);
        const currentCount = state.referenceHoverRefCounts[key] ?? 0;
        const nextCount = isHovering
          ? currentCount + 1
          : Math.max(0, currentCount - 1);
        const nextRefCounts = {
          ...state.referenceHoverRefCounts,
        };

        if (nextCount <= 0) {
          delete nextRefCounts[key];
        } else {
          nextRefCounts[key] = nextCount;
        }

        return {
          ...buildReferenceHighlightState(nextRefCounts, state.edges),
        };
      });
    },

    /**
     * 清空参考资源悬浮高亮。
     */
    clearReferenceHoverHighlights: () => {
      set({
        highlightedEdgeIds: [],
        highlightedSourceNodeIds: [],
        referenceHoverRefCounts: {},
      });
    },

    // ==================== 全景图查看器 ====================

    /**
     * 打开全景图查看器
     * @param imageUrl 要查看的图片 URL
     */
    openPanoramaViewer: (imageUrl: string, sourceNodeId?: string) => {
      set({
        panoramaViewer: {
          open: true,
          imageUrl,
          sourceNodeId: sourceNodeId ?? null,
        },
      });
    },

    /**
     * 关闭全景图查看器
     */
    closePanoramaViewer: () => {
      set({
        panoramaViewer: {
          open: false,
          imageUrl: null,
          sourceNodeId: null,
        },
        historyResetTrigger: get().historyResetTrigger + 1,
        // 选中节点数量初始化（用于避免 O(n²) 遍历）
        selectedNodesCount: 0,
      });
    },

    openImageAnnotation: (
      imageUrl: string,
      sourceNodeId: string,
      mode: "annotate" | "erase" = "annotate",
    ) => {
      set({
        annotationWorkspace: {
          open: true,
          imageUrl,
          sourceNodeId,
          mode,
        },
      });
    },

    closeImageAnnotation: () => {
      set({
        annotationWorkspace: {
          open: false,
          imageUrl: null,
          sourceNodeId: null,
          mode: "annotate",
        },
      });
    },

    // ==================== 撤销/重做 ====================
  };
});
