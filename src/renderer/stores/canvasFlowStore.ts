import { addEdge, applyEdgeChanges, applyNodeChanges } from "@xyflow/react";
import { copyVideoUrlToOss } from "service/oss";
import {
  getCanvasDataKey,
  getLocalFilePath,
  loadCanvasData,
  saveCanvasData,
  saveGeneratedImageToLocal,
  saveGeneratedVideoToLocal,
} from "service/projectStorage";
import {
  ADOBE_GPT_IMAGE2_MODEL,
  ADOBE_NANO_BANANA_PRO_MODEL,
  NANO_BANANA_LOCAL_MODEL,
  NANO_BANANA_LOCAL_PLATFORM,
} from "shared/constants/ai-models";
import { GenerationStatus } from "shared/constants/enum";
import { getGenerationPointsByScene } from "shared/constants/model-points";
import {
  normalizeRequiredPoints,
  POINTS_FEATURE_ENABLED,
} from "shared/constants/points";
import type { GeminiYwResponseBody } from "shared/types/detail/Yunwu/gemini-yw";
import {
  buildFireflyGptImageToImageRequest,
  buildFireflyGptText2ImageRequest,
  normalizeFireflyGptImageInputUrls,
} from "shared/types/detail/Adobe2API/images/gpt-image";
import type {
  AllNodeType,
  AudioGenerationNode,
  EdgeType,
  ImageGenerationNode,
  NewVideoGenerationNode,
  VideoGenerationNode,
} from "shared/types/flow";
import type {
  AddNodeOptions,
  CanvasFlowStoreType,
  CanvasGroup,
  CanvasPersistedState,
  NodePosition,
  NodeType,
} from "shared/types/zustand/canvas-flow";
import {
  getGroupBounds,
  layoutGroupHorizontally,
  normalizeGroupNodeIds,
  translateNodesByIds,
} from "shared/utils/canvasGroups";
import { uploadBase64ToOSS } from "shared/utils/base64ToImage";
import { normalizeLocalGeminiErrorDetail } from "shared/utils/localGeminiErrors";
import {
  getRemoteMediaUrl,
  hydrateMediaForRuntime,
} from "shared/utils/mediaPersistence";
import {
  appendMediaSequences,
  assignMissingMediaSequences,
} from "shared/utils/mediaSequence";
import {
  cloneNodeDataForCopy,
  resetNodeDataRuntimeState,
} from "shared/utils/nodeCopy";
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
  updateVideoNodeInList,
  VIDEO_POLL_INTERVAL,
  VIDEO_RESULT_WAIT_TIMEOUT,
  VIDEO_TIMEOUT,
  videoPollingControllers,
  wait,
} from "shared/utils/reactflowUtils";
import { getRequestErrorMessage } from "shared/utils/requestErrorHandler";
import { getJikeingUserId, toChineseNumber } from "shared/utils/utils";
import { normalizeVideoTaskResponse } from "shared/utils/video-response-normalizer";
import { create } from "zustand";
import {
  createAdobe2ApiChatImageGeneration,
  createAdobe2ApiGptImageToImageGeneration,
  createAdobe2ApiImageGeneration,
  createAdobe2ApiVideoGeneration,
  createDashscopeVideoSynthesis,
  createImageGeneration,
  createLzVideoTask,
  fetchMjTask,
  generateGeminiContent,
  getDashscopeVideoTaskStatus,
  getImageTaskStatus,
  getLzVideoTaskStatus,
  submitMjImagine,
} from "@/api/ai";
import { updateVipScore } from "@/api/jikeing";
import {
  getClosestAspectRatio,
  getImageDimensions,
  getNodeSizeByAspectRatio,
  getVideoDimensions,
} from "@/pages/Canvas/CustomNodes/ImageNode/utils/aspectRatioUtils";
import { buildMidjourneyPrompt } from "@/pages/Canvas/CustomNodes/ImageNode/utils/buildMidjourneyPrompt";
import { aiVideoTrackingService } from "@/services/aiVideoTracking";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";
import { saveCurrentCanvasToHistory } from "@/utils/canvasHistoryBridge";

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
    .map((group) => ({
      ...group,
      nodeIds: normalizeGroupNodeIds(group.nodeIds, existingNodeIds),
    }))
    .filter((group) => group.nodeIds.length >= 2);
};

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
    }))
    .filter((group) => group.nodeIds.length >= 2);
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

const ADOBE_IMAGE_RATIO_VALUES = new Set([
  "1:1",
  "5:4",
  "9:16",
  "21:9",
  "16:9",
  "3:2",
  "4:3",
  "4:5",
  "3:4",
  "2:3",
]);

const ADOBE_NANO_BANANA_PRO_RATIO_VALUES = new Set([
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
]);

const toAdobeRatioSuffix = (ratio?: string) =>
  (ratio || "1:1").replace(":", "x");

const toAdobeResolutionSuffix = (resolution?: string) =>
  (resolution || "2K").toLowerCase();

const resolveAdobeImageModel = ({
  model,
  size,
  resolution,
}: {
  model?: string;
  size?: string;
  resolution?: string;
}) => {
  const ratio = size || "1:1";
  const resolutionSuffix = toAdobeResolutionSuffix(resolution);
  const ratioSuffix = toAdobeRatioSuffix(ratio);

  if (model === ADOBE_GPT_IMAGE2_MODEL) {
    if (!ADOBE_IMAGE_RATIO_VALUES.has(ratio)) {
      throw new Error(`GPT-Image-2 Adobe 暂不支持 ${ratio} 比例`);
    }
    return `firefly-gpt-image-${resolutionSuffix}-${ratioSuffix}`;
  }

  if (model === ADOBE_NANO_BANANA_PRO_MODEL) {
    if (!ADOBE_NANO_BANANA_PRO_RATIO_VALUES.has(ratio)) {
      throw new Error(`Nano Banana Pro Adobe 暂不支持 ${ratio} 比例`);
    }
    return `firefly-nano-banana-pro-${resolutionSuffix}-${ratioSuffix}`;
  }

  return undefined;
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
  const htmlPattern =
    kind === "video"
      ? /<video[^>]+src=["']([^"']+)["']/i
      : /<img[^>]+src=["']([^"']+)["']/i;
  const htmlMatch = text.match(htmlPattern);
  if (htmlMatch?.[1]) {
    return htmlMatch[1];
  }

  const markdownPattern =
    kind === "video"
      ? /\[.*?\]\((https?:\/\/[^)\s]+?\.(?:mp4|webm|mov)(?:\?[^)]*)?)\)/i
      : /!\[.*?\]\((https?:\/\/[^)\s]+)\)/i;
  return text.match(markdownPattern)?.[1];
};

const isAdobeVideoRequest = (payload: Record<string, unknown>) =>
  typeof payload.model === "string" &&
  (payload.model.startsWith("firefly-sora2-pro-") ||
    payload.model.startsWith("firefly-veo31-") ||
    payload.model.startsWith("firefly-veo31-fast-")) &&
  Array.isArray(payload.messages);

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

      if (
        (node.type === "videoNode" || node.type === "newVideoNode") &&
        node.data?.result?.data
      ) {
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
        setState((state) => ({
          nodes: updateImageNodeInList(state.nodes, nodeId, (data) => {
            const completedCount = (data.completedCount ?? 0) + 1;
            const allCompleted = completedCount >= totalTaskCount;
            return {
              ...data,
              status: allCompleted
                ? GenerationStatus.FAILED
                : GenerationStatus.IN_PROGRESS,
              error: {
                code: "TIMEOUT",
                message: "图片生成超时，请稍后再试",
              },
              completedCount,
            };
          }),
        }));
        return;
      }

      // 调用轮询接口获取任务状态
      const response: any = await getImageTaskStatus(taskId);

      const currentNode = getState().nodes.find((node) => node.id === nodeId);
      if (!currentNode || currentNode.type !== "imageNode") {
        stopImagePollingInternal(taskId);
        return;
      }

      // 解析任务状态（兼容大小写）
      const taskStatus =
        response?.data?.status ?? response?.result?.status ?? response?.status;

      // 解析图片 URL：优先从 result.data[] 提取（Gemini/Seedream 格式）
      // 兼容结构：response.result.data = [{ url: string }]
      const resultData = response?.result?.data ?? response?.data?.data ?? [];
      const images: string[] = (Array.isArray(resultData) ? resultData : [])
        .map((item: any) => {
          if (typeof item === "string") {
            return item;
          }
          return item?.url || item?.image_url || "";
        })
        .filter(Boolean);

      const progressValue = Number(
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
        const projectId = getState().projectId;

        // 处理每张生成的图片
        const processedResultData = await Promise.all(
          images.map(async (url: string) => {
            if (url && projectId) {
              try {
                const urlPath = new URL(url).pathname;
                const ext = urlPath.split(".").pop()?.toLowerCase() || "png";

                const fileName = await saveGeneratedImageToLocal(
                  projectId,
                  url,
                  ext,
                );

                if (fileName) {
                  const relativePath = getLocalFilePath(
                    projectId,
                    "generate_image",
                    fileName,
                  );

                  return {
                    url,
                    localName: fileName,
                    localPath: relativePath,
                  };
                }
              } catch (saveError) {
                console.error(
                  "[pollImageGeneration] 保存图片到本地失败:",
                  saveError,
                );
              }
            }
            return { url };
          }),
        );

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

        stopImagePollingInternal(taskId);
        // 如果所有任务都完成了，清理计数
        const currentData = getState().nodes.find((n) => n.id === nodeId)
          ?.data as ImageGenerationNode;
        if ((currentData?.completedCount ?? 0) >= totalTaskCount) {
          pendingTaskCounts.delete(nodeId);
        }

        await deductVipScoreAfterGeneration({
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
        setState((state) => ({
          nodes: updateImageNodeInList(state.nodes, nodeId, (data) => {
            const completedCount = (data.completedCount ?? 0) + 1;
            const allCompleted = completedCount >= totalTaskCount;

            return {
              ...data,
              status: allCompleted
                ? GenerationStatus.FAILED
                : GenerationStatus.IN_PROGRESS,
              progress: 0,
              error: {
                code: "IMAGE_GENERATION_FAILED",
                message:
                  response?.message ||
                  response?.data?.message ||
                  "生成失败，请稍后再试",
              },
              completedCount,
            };
          }),
        }));
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
        setState((state) => ({
          nodes: updateImageNodeInList(state.nodes, nodeId, (data) => {
            const completedCount = (data.completedCount ?? 0) + 1;
            const allCompleted = completedCount >= totalTaskCount;
            return {
              ...data,
              status: allCompleted
                ? GenerationStatus.FAILED
                : GenerationStatus.IN_PROGRESS,
              error: {
                code: "TIMEOUT",
                message: "图片生成超时，请稍后再试",
              },
              completedCount,
            };
          }),
        }));
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
        const projectId = getState().projectId;
        // imageUrls 可能是字符串数组或对象数组 { url: string }[]
        const rawImageUrls = response.imageUrls ?? [];
        const newImageUrls: string[] = rawImageUrls
          .map((item: any) => (typeof item === "string" ? item : item?.url))
          .filter(Boolean)
          .map((url: string) => url.trim().replace(/^`|`$/g, ""));

        // 处理每张生成的图片
        const processedResultData = await Promise.all(
          newImageUrls.map(async (url: string) => {
            if (url && projectId) {
              try {
                const urlPath = new URL(url).pathname;
                const ext = urlPath.split(".").pop()?.toLowerCase() || "png";

                const fileName = await saveGeneratedImageToLocal(
                  projectId,
                  url,
                  ext,
                );

                if (fileName) {
                  const relativePath = getLocalFilePath(
                    projectId,
                    "generate_image",
                    fileName,
                  );

                  return {
                    url,
                    localName: fileName,
                    localPath: relativePath,
                  };
                }
              } catch (saveError) {
                console.error(
                  "[pollMjImageGeneration] 保存图片到本地失败:",
                  saveError,
                );
              }
            }
            return { url };
          }),
        );

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

        stopImagePollingInternal(taskId);
        // 如果所有任务都完成了，清理计数
        const currentData = getState().nodes.find((n) => n.id === nodeId)
          ?.data as ImageGenerationNode;
        if ((currentData?.completedCount ?? 0) >= totalTaskCount) {
          pendingTaskCounts.delete(nodeId);
        }

        await deductVipScoreAfterGeneration({
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
        setState((state) => ({
          nodes: updateImageNodeInList(state.nodes, nodeId, (data) => {
            const completedCount = (data.completedCount ?? 0) + 1;
            const allCompleted = completedCount >= totalTaskCount;

            return {
              ...data,
              status: allCompleted
                ? GenerationStatus.FAILED
                : GenerationStatus.IN_PROGRESS,
              progress: progressValue,
              error: {
                code: "MJ_ERROR",
                message:
                  response.failReason ||
                  response.description ||
                  "生成失败，请稍后再试",
              },
              completedCount,
            };
          }),
        }));
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
  }
};

/**
 * 视频生成轮询逻辑
 * @param isSeedance20 是否为豆包 Seedance 2.0（使用快手 API 轮询）
 */
const pollVideoGeneration = async (
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
        console.error("[pollVideoGeneration] 视频生成超时");
        stopVideoPollingInternal(nodeId);
        setState((state) => ({
          nodes: updateVideoNodeInList(state.nodes, nodeId, (data) => ({
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
      if (!currentNode || currentNode.type !== "videoNode") {
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
              nodes: updateVideoNodeInList(state.nodes, nodeId, (data) => ({
                ...data,
                status: GenerationStatus.IN_PROGRESS,
                progress: normalized.progress,
                task_id: normalizedTaskId,
              })),
            }));
            continue;
          }

          setState((state) => ({
            nodes: updateVideoNodeInList(state.nodes, nodeId, (data) => ({
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

        const projectId = getState().projectId;
        const processedResultData = await Promise.all(
          normalized.videoItems.map(async (item: any) => {
            let localName = item.localName;
            let localPath = item.localPath;

            // 1. 保存到本地
            if (item.url && projectId) {
              try {
                const ext = item.format || "mp4";
                const fileName = await saveGeneratedVideoToLocal(
                  projectId,
                  item.url,
                  ext,
                );

                if (fileName) {
                  localName = fileName;
                  localPath = getLocalFilePath(
                    projectId,
                    "generate_video",
                    fileName,
                  );
                }
              } catch (saveError) {
                console.error(
                  "[pollVideoGeneration] 保存视频到本地失败:",
                  saveError,
                );
              }
            }

            // 2. 转存到用户 OSS
            let ossUrl = item.url;
            if (item.url) {
              try {
                const copiedUrl = await copyVideoUrlToOss(item.url);
                if (copiedUrl) {
                  ossUrl = copiedUrl;
                }
              } catch (copyError) {
                console.error(
                  "[pollVideoGeneration] 转存视频到 OSS 失败:",
                  copyError,
                );
              }
            }

            return {
              ...item,
              url: ossUrl,
              localName,
              localPath,
            };
          }),
        );

        setState((state) => ({
          nodes: updateVideoNodeInList(state.nodes, nodeId, (data) => {
            const existingData = data.result?.data ?? [];
            const mergedData = appendMediaSequences(
              existingData,
              processedResultData,
            );

            return {
              ...data,
              status: GenerationStatus.COMPLETED,
              progress: 100,
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

        await deductVipScoreAfterGeneration({
          scene: "video",
          nodeId,
          taskId: normalizedTaskId,
          model: (currentNode.data as VideoGenerationNode)?.model,
          requiredPoints: (currentNode.data as VideoGenerationNode)
            ?.requiredPoints,
        });
        return;
      }

      if (normalized.status === GenerationStatus.FAILED) {
        setState((state) => ({
          nodes: updateVideoNodeInList(state.nodes, nodeId, (data) => ({
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
        nodes: updateVideoNodeInList(state.nodes, nodeId, (data) => ({
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
      nodes: updateVideoNodeInList(state.nodes, nodeId, (data) => ({
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
        await updateVideoTrackFinalStatus(
          taskId,
          "FAIL",
          "视频生成超时，请稍后再试",
        );
        return;
      }

      const response: any = isSeedance20
        ? await getLzVideoTaskStatus(taskId)
        : await getDashscopeVideoTaskStatus(taskId);

      const currentNode = getState().nodes.find((node) => node.id === nodeId);
      if (!currentNode || currentNode.type !== "newVideoNode") {
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
            continue;
          }

          setState((state) => ({
            nodes: updateNewVideoNodeInList(state.nodes, nodeId, (data) => {
              const failedTasks = [
                ...((data.metadata?.failedTasks as unknown[]) ?? []),
                normalizedTaskId,
              ];
              const completedCount =
                (data.result?.data?.length ?? 0) + failedTasks.length;
              return {
                ...data,
                status:
                  completedCount >= totalTasks && !data.result?.data?.length
                    ? GenerationStatus.FAILED
                    : data.status,
                metadata: {
                  ...data.metadata,
                  failedTasks,
                },
                error: {
                  code: "VIDEO_MISSING_URL",
                  message: "任务已完成但未返回视频地址，请稍后重试",
                },
              };
            }),
          }));
          await updateVideoTrackFinalStatus(
            normalizedTaskId,
            "FAIL",
            "任务已完成但未返回视频地址，请稍后重试",
          );
          return;
        }

        const projectId = getState().projectId;
        const processedResultData = await Promise.all(
          normalized.videoItems.map(async (item: any) => {
            let localName = item.localName;
            let localPath = item.localPath;

            // 1. 保存到本地
            if (item.url && projectId) {
              try {
                const ext = item.format || "mp4";
                const fileName = await saveGeneratedVideoToLocal(
                  projectId,
                  item.url,
                  ext,
                );

                if (fileName) {
                  localName = fileName;
                  localPath = getLocalFilePath(
                    projectId,
                    "generate_video",
                    fileName,
                  );
                }
              } catch (saveError) {
                console.error(
                  "[pollNewVideoGeneration] 保存视频到本地失败:",
                  saveError,
                );
              }
            }

            // 2. 转存到用户 OSS
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

            return {
              ...item,
              url: ossUrl,
              localName,
              localPath,
            };
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

        const updatedNode = getState().nodes.find((node) => node.id === nodeId);
        if ((updatedNode?.data as any)?.status === GenerationStatus.COMPLETED) {
          saveCurrentCanvasToHistory();
          if (useChatSettingsStore.getState().autoSaveEnabled) {
            getState().saveGraph();
          }
          // 多任务都收敛后清理轮询控制器，避免后续停止/重新生成时拿到旧控制器。
          stopVideoPollingInternal(nodeId);
          await deductVipScoreAfterGeneration({
            scene: "video",
            nodeId,
            taskId: normalizedTaskId,
            model: (updatedNode?.data as NewVideoGenerationNode)?.model,
            requiredPoints: (updatedNode?.data as NewVideoGenerationNode)
              ?.requiredPoints,
          });
        }
        await updateVideoTrackFinalStatus(
          normalizedTaskId,
          "SUCCESS",
          undefined,
          processedResultData[0]?.url,
        );
        return;
      }

      if (normalized.status === GenerationStatus.FAILED) {
        setState((state) => ({
          nodes: updateNewVideoNodeInList(state.nodes, nodeId, (data) => {
            const failedTasks = [
              ...((data.metadata?.failedTasks as unknown[]) ?? []),
              normalizedTaskId,
            ];
            const successCount = data.result?.data?.length ?? 0;
            const completedCount = successCount + failedTasks.length;
            const allDone = completedCount >= totalTasks;

            return {
              ...data,
              status:
                allDone && successCount === 0
                  ? GenerationStatus.FAILED
                  : allDone
                    ? GenerationStatus.COMPLETED
                    : GenerationStatus.IN_PROGRESS,
              progress: allDone
                ? 100
                : Math.round((completedCount / totalTasks) * 100),
              metadata: {
                ...data.metadata,
                failedTasks,
              },
              error:
                allDone && successCount === 0
                  ? {
                    code: "VIDEO_FAILED",
                    message:
                      normalized.errorMessage || "生成失败，请稍后再试",
                  }
                  : data.error,
            };
          }),
        }));
        const failedNode = getState().nodes.find((node) => node.id === nodeId);
        const failedStatus = (failedNode?.data as any)?.status;
        if (
          failedStatus === GenerationStatus.FAILED ||
          failedStatus === GenerationStatus.COMPLETED
        ) {
          stopVideoPollingInternal(nodeId);
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
    await updateVideoTrackFinalStatus(
      taskId,
      "FAIL",
      serverMessage || "轮询失败，请稍后再试",
    );
  }
};

/**
 * 生成任务成功后的积分扣减。
 * 说明：扣费失败不会影响已完成结果，仅记录日志用于后续补偿处理。
 */
const deductVipScoreAfterGeneration = async ({
  model,
  scene,
  nodeId,
  taskId,
  requiredPoints,
}: {
  model?: string;
  scene: "image" | "video";
  nodeId: string;
  taskId?: string;
  requiredPoints?: number;
}) => {
  if (!POINTS_FEATURE_ENABLED) {
    return;
  }

  const loginUserId = getJikeingUserId();
  if (!loginUserId) {
    console.warn("[score] 扣费跳过：未获取到登录用户", {
      scene,
      nodeId,
      taskId,
      model,
    });
    return;
  }

  const scoreCost = normalizeRequiredPoints(requiredPoints);
  const finalScoreCost =
    Number.isFinite(scoreCost) && scoreCost > 0
      ? scoreCost
      : getGenerationPointsByScene({ scene, model });
  if (!(finalScoreCost > 0)) {
    return;
  }
  try {
    await updateVipScore({
      userId: loginUserId,
      vipScoreDelta: -finalScoreCost,
    });
  } catch (deductError: any) {
    console.error("[score] 扣费失败", {
      scene,
      nodeId,
      taskId,
      model,
      scoreCost: finalScoreCost,
      message:
        deductError?.message ||
        getRequestErrorMessage(deductError) ||
        "扣费接口调用失败",
    });
  }
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

  /**
   * 将 ReactFlow 节点 type 映射为 store 的 NodeType 计数键。
   */
  const resolveNodeTypeForCounter = (node: AllNodeType): NodeType => {
    const nodeTypeMap: Record<string, NodeType> = {
      noteNode: "note",
      imageNode: "image",
      videoNode: "video",
      newVideoNode: "newVideo",
      agentNode: "agent",
      panoramaNode: "panorama",
      audioNode: "audio",
      textAgentNode: "textAgent",
      imageAgentNode: "imageAgent",
      videoAgentNode: "videoAgent",
      tableNode: "table",
    };

    return nodeTypeMap[node.type] ?? "default";
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
          targetNode.type === "videoNode" ||
          targetNode.type === "newVideoNode"
        ) {
          return "image_urls";
        }

        if (targetNode.type === "panoramaNode") {
          return "image_url";
        }
      }

      if (
        (targetNode.type === "videoNode" ||
          targetNode.type === "newVideoNode") &&
        (sourceNode.type === "videoNode" || sourceNode.type === "newVideoNode")
      ) {
        return "video_urls";
      }

      if (
        (targetNode.type === "videoNode" ||
          targetNode.type === "newVideoNode") &&
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
    nodeIdCounters: {
      note: 1,
      image: 1,
      video: 1,
      agent: 1,
      panorama: 1,
      audio: 1,
      table: 1,
    },
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
    isSelectionBoxActive: false,
    groups: [],
    selectedGroupId: null,

    // ── 配对 setter ───────────────────────────────
    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),
    setHighlightedEdgeIds: (highlightedEdgeIds) => set({ highlightedEdgeIds }),
    setHighlightedSourceNodeIds: (highlightedSourceNodeIds) =>
      set({ highlightedSourceNodeIds }),
    setNodeIdCounters: (nodeIdCounters) => set({ nodeIdCounters }),
    setHydrated: (hydrated) => set({ hydrated }),
    setProjectId: (projectId) => set({ projectId }),
    setPanoramaViewer: (panoramaViewer) => set({ panoramaViewer }),
    setAnnotationWorkspace: (annotationWorkspace) =>
      set({ annotationWorkspace }),
    setSelectionBoxActive: (isSelectionBoxActive) => {
      if (get().isSelectionBoxActive !== isSelectionBoxActive) {
        set({ isSelectionBoxActive });
      }
    },
    setGroups: (groups) => set({ groups }),
    setSelectedGroupId: (selectedGroupId) => set({ selectedGroupId }),

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

      // 尝试从本地文件加载
      let data: CanvasPersistedState | null = null;
      try {
        data = (await loadCanvasData(projectId)) as CanvasPersistedState | null;
      } catch (err) {
        console.warn("Failed to load canvas data from local file:", err);
      }

      // 如果本地文件加载失败，尝试从 localStorage 加载
      if (!data) {
        const storageKey = getCanvasDataKey(projectId);
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            data = JSON.parse(raw) as CanvasPersistedState;
          }
        } catch (err) {
          console.warn("Failed to load canvas data from localStorage:", err);
        }
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
          nodeIdCounters: {
            note: 1,
            image: 1,
            video: 1,
            agent: 1,
            panorama: 1,
            audio: 1,
            table: 1,
          },
          hydrated: true,
          historyResetTrigger: get().historyResetTrigger + 1,
          groups: [],
          selectedGroupId: null,
        });
        get().requestHistorySave();
        return;
      }

      // 恢复节点运行时状态时仅使用远程媒体 URL，避免本地文件生成 blob URL。
      const hydratedNodes = await hydrateCanvasNodesForRuntime(data.nodes);
      const processedNodes: AllNodeType[] = hydratedNodes.map((node) => {
        const runtimeSafeData = resetNodeDataRuntimeState(
          node.type,
          node.data,
        );

        if (runtimeSafeData !== node.data) {
          return {
            ...node,
            data: runtimeSafeData as AllNodeType["data"],
          };
        }

        return node;
      });

      set({
        projectId,
        nodes: processedNodes,
        edges: data.edges,
        highlightedEdgeIds: [],
        highlightedSourceNodeIds: [],
        referenceHoverRefCounts: {},
        nodeIdCounters: data.nodeIdCounters,
        hydrated: true,
        historyResetTrigger: get().historyResetTrigger + 1,
        groups: normalizeCanvasGroups(data.groups, processedNodes),
        selectedGroupId: null,
      });
      get().requestHistorySave();
    },

    /**
     * 保存当前图状态到 localStorage 和本地文件
     */
    saveGraph: () => {
      const state = get();
      if (!state.projectId) return;

      const data: CanvasPersistedState = {
        version: CANVAS_STORAGE_VERSION,
        savedAt: Date.now(),
        nodes: state.nodes,
        edges: state.edges,
        groups: normalizeCanvasGroups(state.groups, state.nodes),
        nodeIdCounters: state.nodeIdCounters,
      };
      const storageKey = getCanvasDataKey(state.projectId);
      localStorage.setItem(storageKey, JSON.stringify(data));

      saveCanvasData(state.projectId, data).catch((err) => {
        console.warn("Failed to save canvas data to local file:", err);
      });
    },

    /**
     * 从 localStorage 恢复图状态
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

      try {
        const storageKey = getCanvasDataKey(state.projectId);
        const raw = localStorage.getItem(storageKey);
        if (!raw) {
          set({ nodes: [], edges: [], groups: [], selectedGroupId: null });
          return;
        }

        const data = JSON.parse(raw) as CanvasPersistedState;
        if (
          data.version !== CANVAS_STORAGE_VERSION &&
          data.version !== LEGACY_CANVAS_STORAGE_VERSION
        ) {
          set({ nodes: [], edges: [], groups: [], selectedGroupId: null });
          return;
        }

        set({
          nodes: data.nodes,
          edges: data.edges,
          nodeIdCounters: data.nodeIdCounters,
          groups: normalizeCanvasGroups(data.groups, data.nodes),
          selectedGroupId: null,
        });
      } catch {
        set({ nodes: [], edges: [], groups: [], selectedGroupId: null });
      }
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
        selectedGroupId: null,
        nodeIdCounters: {
          note: 1,
          image: 1,
          video: 1,
          agent: 1,
          panorama: 1,
          audio: 1,
          table: 1,
        },
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
      const current = get().nodeIdCounters[typeKey] ?? 0;

      const nextId = `${typeKey}-${current}`;
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
        defaultVideoModel,
        defaultVideoAspectRatio,
        defaultVideoDuration,
        defaultVideoResolution,
        defaultVideoMode,
        defaultVideoGenerateAudio,
        defaultVideoAudio,
        defaultVideoPromptExtend,
        defaultNewVideoModel,
        defaultNewVideoAspectRatio,
        defaultNewVideoDuration,
        defaultNewVideoResolution,
        defaultNewVideoMode,
        defaultNewVideoGenerateAudio,
        defaultNewVideoPromptExtend,
      } = useChatSettingsStore.getState();
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
                  model: [
                    "seedance-2.0-fast",
                    "seedance-2.0-pro",
                    "wanxiang",
                    "vidu-q3-pro",
                    "vidu",
                    "pixverse",
                    "happyhorse",
                    "keling",
                  ].includes(defaultNewVideoModel ?? "")
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
              : newNode.type === "videoNode"
                ? {
                  ...newNode,
                  data: {
                    ...newNode.data,
                    model: defaultVideoModel || newNode.data.model,
                    aspect_ratio:
                      defaultVideoAspectRatio || newNode.data.aspect_ratio,
                    duration: defaultVideoDuration || newNode.data.duration,
                    metadata: {
                      ...(newNode.data.metadata ?? {}),
                      resolution:
                        defaultVideoResolution ||
                        newNode.data.metadata?.resolution,
                      ...(defaultVideoMode !== undefined
                        ? { mode: defaultVideoMode }
                        : {}),
                      ...(defaultVideoGenerateAudio !== undefined
                        ? { generate_audio: defaultVideoGenerateAudio }
                        : {}),
                      ...(defaultVideoAudio !== undefined
                        ? { audio: defaultVideoAudio }
                        : {}),
                      ...(defaultVideoPromptExtend !== undefined
                        ? { prompt_extend: defaultVideoPromptExtend }
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
      // 从最新的状态中获取节点，确保使用当前位置
      const currentState = get();
      const node = currentState.nodes.find((n) => n.id === nodeId);
      if (!node) {
        console.warn(`[duplicateNode] 未找到节点: ${nodeId}`);
        return;
      }

      // 统一用映射后的 NodeType 参与 ID 计数，避免出现 audioNode-0 这类异常前缀。
      const nodeType = resolveNodeTypeForCounter(node);

      const newId = currentState.getNextNodeId(nodeType);

      // 固定偏移量
      const offsetX = 350;
      const offsetY = 300;

      const cleanData = cloneNodeDataForCopy(node.type, node.data);
      const newNode = {
        id: newId,
        type: node.type,
        position: {
          x: node.position.x + offsetX,
          y: node.position.y + offsetY,
        },
        data: {
          // 这里拷贝了原节点的 data
          ...cleanData,
          createdAt: Date.now(),
        },
        selected: true,
        dragging: false,
        // 保留便签节点的宽高
        ...(node.width !== undefined && { width: node.width }),
        ...(node.height !== undefined && { height: node.height }),
      } as AllNodeType;

      const finalDuplicatedNode =
        newNode.type === "audioNode"
          ? {
            ...newNode,
            data: {
              ...newNode.data,
              nickname: getAudioNicknameByNodeId(newId),
            },
          }
          : newNode;

      set((state) => {
        // 取消所有节点的选中状态，只选中新节点
        const updatedNodes = state.nodes.map((n) => ({
          ...n,
          selected: false,
        }));

        const copiedIncomingEdges =
          node.type === "imageNode" ||
            node.type === "videoNode" ||
            node.type === "newVideoNode"
            ? state.edges
              .filter((edge) => edge.target === node.id)
              .map((edge, edgeIndex) => {
                const { id: _id, target: _target, ...edgePayload } = edge;

                return {
                  ...edgePayload,
                  id: `edge-${edge.source}-${newId}-${Date.now()}-${edgeIndex}`,
                  target: newId,
                } as EdgeType;
              })
            : [];
        const nextEdges = [...state.edges, ...copiedIncomingEdges];
        let nextNodes = [...updatedNodes, finalDuplicatedNode];
        copiedIncomingEdges.forEach((edge) => {
          nextNodes = syncMediaUrlsByEdge(nextNodes, edge, "add");
        });

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
    deleteEdge: (edgeId: string) => {
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

      // 保存历史记录
      get().requestHistorySave();

      // 自动保存
      if (useChatSettingsStore.getState().autoSaveEnabled) {
        get().saveGraph();
      }
    },

    /**
     * 删除节点及其关联的所有边
     * 自动清理依赖该节点的下游节点（图片/视频）的 image_urls
     * @param nodeId 要删除的节点 ID
     */
    deleteNode: (nodeId: string) => {
      const targetNode = get().nodes.find((node) => node.id === nodeId);
      if (targetNode?.type === "imageNode") {
        stopImagePollingInternal(nodeId);
      }
      if (
        targetNode?.type === "videoNode" ||
        targetNode?.type === "newVideoNode"
      ) {
        stopVideoPollingInternal(nodeId);
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
                nextGroups.find(
                  (group) => group.id === state.selectedGroupId,
                )?.id ?? null,
              ...buildReferenceHighlightState(
                state.referenceHoverRefCounts,
                nextEdges,
              ),
            };
          })(),
        };
      });

      // 保存历史记录
      get().requestHistorySave();

      // 自动保存
      if (useChatSettingsStore.getState().autoSaveEnabled) {
        get().saveGraph();
      }
    },

    createGroup: (nodeIds: string[]) => {
      const state = get();
      const existingNodeIds = new Set(state.nodes.map((node) => node.id));
      const normalizedNodeIds = normalizeGroupNodeIds(
        nodeIds,
        existingNodeIds,
      );

      const ungroupedNodeIds = normalizedNodeIds.filter((nodeId) => {
        return !state.groups.some((group) => group.nodeIds.includes(nodeId));
      });

      if (ungroupedNodeIds.length < 2) {
        return "";
      }

      const group: CanvasGroup = {
        id: makeGroupId(),
        nodeIds: ungroupedNodeIds,
        createdAt: Date.now(),
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

    ungroup: (groupId: string) => {
      set((state) => ({
        groups: state.groups.filter((group) => group.id !== groupId),
        selectedGroupId:
          state.selectedGroupId === groupId ? null : state.selectedGroupId,
      }));

      get().requestHistorySave();
      get().saveGraph();
    },

    layoutGroupHorizontal: (groupId: string) => {
      const state = get();
      const group = state.groups.find((item) => item.id === groupId);
      if (!group) {
        return;
      }

      const layoutResult = layoutGroupHorizontally(
        state.nodes,
        state.edges,
        group.nodeIds,
      );

      if (!layoutResult.nextNodes || layoutResult.nextNodes === state.nodes) {
        return;
      }

      set((current) => ({
        nodes: layoutResult.nextNodes,
        groups: normalizeCanvasGroups(current.groups, layoutResult.nextNodes),
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
      }));
    },

    /**
     * 更新图片节点数据（局部 patch）
     */
    updateImageNodeData: (nodeId, patch) => {
      set((state) => {
        return {
          nodes: updateImageNodeInList(state.nodes, nodeId, (data) => ({
            ...data,
            ...patch,
          })),
        };
      });
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

      try {
        let taskId: string;

        if (isMidjourney) {
          const finalPrompt = buildMidjourneyPrompt({
            prompt: payload.prompt,
            referenceUrls: payload?.midjourneyAdvanced?.referenceUrls,
            styleUrls: payload?.midjourneyAdvanced?.styleUrls,
            iw: payload?.midjourneyAdvanced?.iw,
            sw: payload?.midjourneyAdvanced?.sw,
          });

          // Midjourney 模型使用 zeakai API
          const response = await submitMjImagine({ prompt: finalPrompt });

          // code === 1 表示提交成功
          if (response.code !== 1) {
            throw new Error(response.description || "Midjourney 任务提交失败");
          }

          taskId = response.result;
        } else {
          // 非 Midjourney 模型：创建图片生成任务，获取 task_id 后启动轮询
          const response: any = await createImageGeneration(payload);

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
            throw new Error("未返回任务 ID，请稍后再试");
          }
        }

        if (!taskId) {
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
        image_urls: imageUrls,
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
      const originalModel = payload.originalModel ?? payload.model;
      const adobeImageModel = resolveAdobeImageModel({
        model: originalModel,
        size,
        resolution,
      });

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
        if (adobeImageModel) {
          set((state) => ({
            nodes: updateImageNodeInList(state.nodes, nodeId, (data) => ({
              ...data,
              status: GenerationStatus.IN_PROGRESS,
              progress: 0,
            })),
          }));

          const gptImageUrls =
            originalModel === ADOBE_GPT_IMAGE2_MODEL
              ? normalizeFireflyGptImageInputUrls(imageUrls)
              : imageUrls;

          const response =
            gptImageUrls.length > 0
              ? originalModel === ADOBE_GPT_IMAGE2_MODEL
                ? await createAdobe2ApiGptImageToImageGeneration(
                    buildFireflyGptImageToImageRequest({
                      model: adobeImageModel as any,
                      prompt,
                      imageUrls: gptImageUrls,
                    }),
                  )
                : await createAdobe2ApiChatImageGeneration({
                    model: adobeImageModel as any,
                    messages: [
                      {
                        role: "user" as const,
                        content: [
                          { type: "text" as const, text: prompt || "" },
                          ...imageUrls.map((url: string) => ({
                            type: "image_url" as const,
                            image_url: { url },
                          })),
                        ],
                      },
                    ],
                  })
              : await createAdobe2ApiImageGeneration(
                  originalModel === ADOBE_GPT_IMAGE2_MODEL
                    ? buildFireflyGptText2ImageRequest({
                        model: adobeImageModel as any,
                        prompt,
                      })
                    : {
                        model: adobeImageModel as any,
                        prompt: prompt || "",
                        response_format: "url",
                      },
                );

          const responseAny = response as any;
          const responseUrl =
            responseAny?.data?.[0]?.url ??
            extractMarkdownMediaUrl(
              responseAny?.choices?.[0]?.message?.content,
              "image",
            );
          if (!responseUrl) {
            throw new Error("Adobe2API 未返回图片地址");
          }

          set((state) => ({
            nodes: updateImageNodeInList(state.nodes, nodeId, (data) => {
              const existingData = data.result?.data ?? [];
              const mergedData = appendMediaSequences(existingData, [
                { url: responseUrl },
              ]);
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
          await deductVipScoreAfterGeneration({
            scene: "image",
            nodeId,
            model: originalModel,
            requiredPoints: payload.requiredPoints,
          });
          return;
        }

        // 1. 构造请求体
        // 注意：text 和 fileData 不能同时存在于同一个 part，必须拆成独立的 part。
        // 参考图直接把 URL 交给 adobe2api，由服务端自行拉取，避免前端先转 Base64。
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
        );

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
              };
            } catch (ossError) {
              console.error(
                "[startGeminiPro2Generation] 上传图片到 OSS 失败:",
                ossError,
              );
              return {
                url: `data:${part.inlineData!.mimeType};base64,${base64Data}`,
              };
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

        await deductVipScoreAfterGeneration({
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
        const detailMessage = normalizeLocalGeminiErrorDetail(rawServerMessage);
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
              detail: detailMessage,
              serverMessage: rawServerMessage,
            },
          })),
        }));
        saveCurrentCanvasToHistory();
        if (useChatSettingsStore.getState().autoSaveEnabled) {
          get().saveGraph();
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
          sourcePlatform === NANO_BANANA_LOCAL_PLATFORM) ||
        sourceModel === ADOBE_GPT_IMAGE2_MODEL ||
        sourceModel === ADOBE_NANO_BANANA_PRO_MODEL;
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

        const splitPrompt = `这是一张${gridName}宫格的图片，中间是用白色分割线区分的。帮我把${gridName}宫格图中的第${row}行的第${col}列图片单独提取出来，放大为独立图片。与第${row}行的第${col}列图片保持完全相同的构图、色调，去除图片四个角落文字、字幕、标注，序号，高清优化图片所有细节，8K清晰度。`;

        const newId = get().addNode("image", position);

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
          originalModel: sourceData.originalModel,
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
          | VideoGenerationNode
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

        // 新版视频节点拆分后仍创建新版视频节点，避免多结果拆分时退回旧版体验。
        const targetNodeType =
          nodeType === "videoNode"
            ? "video"
            : nodeType === "newVideoNode"
              ? "newVideo"
              : "image";
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
              (sourceData as VideoGenerationNode | NewVideoGenerationNode)
                .aspect_ratio ?? "16:9",
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
                  (sourceData as VideoGenerationNode | NewVideoGenerationNode)
                    .aspect_ratio ?? "16:9";

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
              targetNodeType === "video" || targetNodeType === "newVideo"
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

            if (targetNodeType === "video" || targetNodeType === "newVideo") {
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
    updateVideoNodeData: (nodeId, patch) => {
      set((state) => ({
        nodes: updateVideoNodeInList(state.nodes, nodeId, (data) => ({
          ...data,
          ...patch,
        })),
      }));
    },

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
    startVideoGeneration: async (nodeId, payload) => {
      // 先中止旧轮询，避免并发任务冲突
      stopVideoPollingInternal(nodeId);

      // 更新节点输入参数与状态
      set((state) => ({
        nodes: updateVideoNodeInList(state.nodes, nodeId, (data) => ({
          ...data,
          ...payload,
          status: GenerationStatus.QUEUED,
          progress: 0,
          error: undefined,
        })),
      }));

      try {
        const model = (payload as any).model ?? "";
        // 判断是否为豆包 Seedance 2.0 Fast/Pro（使用快手 API）
        const isSeedance20 =
          model === "doubao-seedance-2.0-fast" ||
          model === "doubao-seedance-2.0-pro";

        let response: any;
        if (isSeedance20) {
          // 豆包 Seedance 2.0 使用快手 AI 视频接口
          response = await createLzVideoTask(payload);
        } else {
          // 万象、PixVerse 等使用阿里云百炼视频接口
          response = await createDashscopeVideoSynthesis(payload);
        }

        const taskId = response?.data?.task_id ?? response?.output?.task_id;

        if (!taskId) {
          throw new Error("任务 ID 为空");
        }

        // 标记为生成中并记录任务 ID
        set((state) => ({
          nodes: updateVideoNodeInList(state.nodes, nodeId, (data) => ({
            ...data,
            task_id: taskId,
            status: GenerationStatus.IN_PROGRESS,
            progress: response?.progress ?? 0,
          })),
        }));

        const controller = new AbortController();
        videoPollingControllers.set(nodeId, controller);
        pollVideoGeneration(
          taskId,
          nodeId,
          controller.signal,
          set,
          get,
          isSeedance20,
        );
      } catch (startError) {
        console.error("[Dashscope] 创建视频生成任务失败:", startError);
        // 从 error 对象中提取后端返回的详细信息
        const serverMessage = getRequestErrorMessage(startError);
        set((state) => ({
          nodes: updateVideoNodeInList(state.nodes, nodeId, (data) => ({
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
      const isAdobeVideo = isAdobeVideoRequest(requestPayload);

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
        if (isAdobeVideo) {
          set((state) => ({
            nodes: updateNewVideoNodeInList(state.nodes, nodeId, (data) => ({
              ...data,
              status: GenerationStatus.IN_PROGRESS,
              progress: 0,
            })),
          }));

          console.info("[Adobe2API Video] request payload", requestPayload);
          const response = await createAdobe2ApiVideoGeneration(
            requestPayload as any,
          );
          const videoUrl = extractMarkdownMediaUrl(
            response?.choices?.[0]?.message?.content,
            "video",
          );
          if (!videoUrl) {
            throw new Error("Adobe2API 未返回视频地址");
          }

          let resultItem: { url: string; format: string; [key: string]: any } = {
            url: videoUrl,
            format: "mp4",
          };
          try {
            const copiedUrl = await copyVideoUrlToOss(videoUrl);
            if (copiedUrl) {
              resultItem.url = copiedUrl;
            }
          } catch (copyError) {
            console.error(
              "[startNewVideoGeneration] 转存 Adobe 视频到 OSS 失败:",
              copyError,
            );
          }

          set((state) => ({
            nodes: updateNewVideoNodeInList(state.nodes, nodeId, (data) => {
              const existingData = data.result?.data ?? [];
              const mergedData = appendMediaSequences(existingData, [
                resultItem,
              ]);
              return {
                ...data,
                task_id: response?.id,
                status: GenerationStatus.COMPLETED,
                progress: 100,
                result: {
                  type: "video",
                  data: mergedData,
                },
                error: undefined,
                metadata: {
                  ...data.metadata,
                  tasks: response?.id ? [response.id] : [],
                  failedTasks: [],
                },
              };
            }),
          }));
          saveCurrentCanvasToHistory();
          if (useChatSettingsStore.getState().autoSaveEnabled) {
            get().saveGraph();
          }
          await deductVipScoreAfterGeneration({
            scene: "video",
            nodeId,
            taskId: response?.id,
            model,
            requiredPoints,
          });
          return;
        }

        const createTask = async () => {
          const response: any = isSeedance20
            ? await createLzVideoTask(requestPayload)
            : await createDashscopeVideoSynthesis(requestPayload);
          const taskId = response?.data?.task_id ?? response?.output?.task_id;

          if (!taskId) {
            throw new Error("任务 ID 为空");
          }

          return taskId as string;
        };

        const taskIds = await Promise.all(
          Array.from({ length: totalTasks }, () => createTask()),
        );

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
          } else if (
            node.type === "videoNode" ||
            node.type === "newVideoNode"
          ) {
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
            } else if (
              node.type === "videoNode" ||
              node.type === "newVideoNode"
            ) {
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
      return {
        version: CANVAS_STORAGE_VERSION,
        savedAt: Date.now(),
        nodes: state.nodes,
        edges: state.edges,
        groups: normalizeCanvasGroups(state.groups, state.nodes),
        nodeIdCounters: state.nodeIdCounters,
      };
    },

    /**
     * 导入画布数据（覆盖模式）
     */
    importCanvasData: (data) => {
      set({
        nodes: data.nodes,
        edges: data.edges,
        nodeIdCounters: data.nodeIdCounters,
        groups: normalizeCanvasGroups(data.groups, data.nodes),
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
      const hasSelectChange = changes.some((change) => change.type === "select");
      set((state) => {
        const nextNodes = applyNodeChanges(changes, state.nodes);
        // 计算选中节点数量，避免在 ImageNode 等组件中 O(n²) 遍历
        const selectedCount = nextNodes.filter((n) => n.selected).length;
        return {
          nodes: nextNodes,
          selectedNodesCount: selectedCount,
          selectedGroupId: hasSelectChange ? null : state.selectedGroupId,
        };
      });

      // 在节点变化后保存历史记录（排除拖动中的变化）
      const hasPositionChange = changes.some(
        (c) => c.type === "position" && !c.dragging,
      );
      const hasAddOrRemove = changes.some(
        (c) => c.type === "add" || c.type === "remove",
      );

      if (hasPositionChange || hasAddOrRemove) {
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

      if (
        targetNode?.type === "videoNode" ||
        targetNode?.type === "newVideoNode"
      ) {
        const allowedSourceTypes = [
          "noteNode",
          "imageNode",
          "videoNode",
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
