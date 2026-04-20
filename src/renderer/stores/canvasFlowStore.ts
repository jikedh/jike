import { addEdge, applyEdgeChanges, applyNodeChanges } from "@xyflow/react";
import { uploadFileToOSS } from "service/oss";
import {
  getCanvasDataKey,
  getLocalFilePath,
  loadCanvasData,
  readMediaFromLocal,
  saveCanvasData,
  saveGeneratedImageToLocal,
  saveGeneratedVideoToLocal,
} from "service/projectStorage";
import { getGenerationScoreCost } from "shared/constants/ai-models";
import { GenerationStatus } from "shared/constants/enum";
import type { GeminiYwResponseBody } from "shared/types/detail/gemini-yw";
import type {
  AllNodeType,
  AudioGenerationNode,
  EdgeType,
  ImageGenerationNode,
  VideoGenerationNode,
} from "shared/types/flow";
import type {
  AddNodeOptions,
  CanvasFlowStoreType,
  CanvasPersistedState,
  NodePosition,
  NodeType,
} from "shared/types/zustand/canvas-flow";
import { uploadBase64ToOSS } from "shared/utils/base64ToImage";
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
import { buildMidjourneyPrompt } from "@/pages/Canvas/CustomNodes/ImageNode/utils/buildMidjourneyPrompt";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";

// ==================== 持久化配置 ====================

const CANVAS_STORAGE_VERSION = 1;

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
        response?.data?.status ??
        response?.result?.status ??
        response?.status;

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
        response?.data?.progress ?? response?.result?.progress ?? response?.progress ?? 50,
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
                // 从 URL 中提取扩展名
                const urlPath = new URL(url).pathname;
                const ext = urlPath.split(".").pop()?.toLowerCase() || "png";

                // 下载并保存到本地
                const fileName = await saveGeneratedImageToLocal(
                  projectId,
                  url,
                  ext,
                );

                if (fileName) {
                  // 获取相对路径
                  const relativePath = getLocalFilePath(
                    projectId,
                    "generate_image",
                    fileName,
                  );

                  // 上传到 OSS
                  let ossUrl: string | undefined;
                  try {
                    const fileBytes = relativePath
                      ? await readMediaFromLocal(relativePath)
                      : null;
                    if (fileBytes) {
                      const file = new File([fileBytes], fileName, {
                        type: `image/${ext}`,
                      });
                      const ossResult = await uploadFileToOSS(file);
                      if (ossResult.url) {
                        ossUrl = ossResult.url;
                      }
                    }
                  } catch (ossError) {
                    console.error(
                      "[pollImageGeneration] 上传图片到 OSS 失败:",
                      ossError,
                    );
                  }

                  return {
                    url: ossUrl || url,
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
            const mergedData = [...existingData, ...processedResultData];

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
                // 从 URL 中提取扩展名
                const urlPath = new URL(url).pathname;
                const ext = urlPath.split(".").pop()?.toLowerCase() || "png";

                // 下载并保存到本地
                const fileName = await saveGeneratedImageToLocal(
                  projectId,
                  url,
                  ext,
                );

                if (fileName) {
                  // 获取相对路径
                  const relativePath = getLocalFilePath(
                    projectId,
                    "generate_image",
                    fileName,
                  );

                  // 上传到 OSS
                  let ossUrl: string | undefined;
                  try {
                    const fileBytes = relativePath
                      ? await readMediaFromLocal(relativePath)
                      : null;
                    if (fileBytes) {
                      const file = new File([fileBytes], fileName, {
                        type: `image/${ext}`,
                      });
                      const ossResult = await uploadFileToOSS(file);
                      if (ossResult.url) {
                        ossUrl = ossResult.url;
                      }
                    }
                  } catch (ossError) {
                    console.error(
                      "[pollMjImageGeneration] 上传图片到 OSS 失败:",
                      ossError,
                    );
                  }

                  return {
                    url: ossUrl || url, // 使用 OSS URL，如果上传失败则使用原始 URL
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
            const mergedData = [...existingData, ...processedResultData];

            // 更新已完成数量
            const completedCount = (data.completedCount ?? 0) + 1;
            // 判断是否所有任务都已完成
            const allCompleted = completedCount >= totalTaskCount;

            // 更新 ossUrlMap 缓存
            const newOssUrlMap: Record<string, string> = { ...data.ossUrlMap };
            processedResultData.forEach((item: any, index: number) => {
              if (item.url && item.url.includes("aliyuncs.com")) {
                // 使用原始 URL 作为 key
                const originalUrl = newImageUrls[index];
                if (originalUrl) {
                  newOssUrlMap[originalUrl] = item.url;
                }
              }
            });

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
              ossUrlMap: newOssUrlMap,
              error: allCompleted ? undefined : data.error,
            };
          }),
        }));

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
  }
};

/**
 * 视频生成轮询逻辑
 */
const pollVideoGeneration = async (
  taskId: string,
  nodeId: string,
  signal: AbortSignal,
  setState: (
    updater: (state: CanvasFlowStoreType) => Partial<CanvasFlowStoreType>,
  ) => void,
  getState: () => CanvasFlowStoreType,
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
        return;
      }

      const response: any = await getLzVideoTaskStatus(taskId);

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
                code: "LZ_VIDEO_MISSING_URL",
                message: "任务已完成但未返回视频地址，请稍后重试",
              },
            })),
          }));

          stopVideoPollingInternal(nodeId);
          return;
        }

        missingResultUrlStartTime = null;

        const projectId = getState().projectId;
        const processedResultData = await Promise.all(
          normalized.videoItems.map(async (item: any) => {
            if (item.url && projectId) {
              try {
                const ext = item.format || "mp4";
                const fileName = await saveGeneratedVideoToLocal(
                  projectId,
                  item.url,
                  ext,
                );

                if (fileName) {
                  const relativePath = getLocalFilePath(
                    projectId,
                    "generate_video",
                    fileName,
                  );
                  return {
                    ...item,
                    localName: fileName,
                    localPath: relativePath,
                  };
                }
              } catch (saveError) {
                console.error(
                  "[pollVideoGeneration] 保存视频到本地失败:",
                  saveError,
                );
              }
            }
            return item;
          }),
        );

        setState((state) => ({
          nodes: updateVideoNodeInList(state.nodes, nodeId, (data) => ({
            ...data,
            status: GenerationStatus.COMPLETED,
            progress: 100,
            task_id: normalizedTaskId,
            result: {
              type: "video",
              data: processedResultData,
            },
            error: undefined,
          })),
        }));

        stopVideoPollingInternal(nodeId);

        await deductVipScoreAfterGeneration({
          scene: "video",
          nodeId,
          taskId: normalizedTaskId,
          model: (currentNode.data as VideoGenerationNode)?.model,
          requiredPoints: (currentNode.data as VideoGenerationNode)?.requiredPoints,
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
              code: "LZ_VIDEO_FAILED",
              message: normalized.errorMessage || "生成失败，请稍后再试",
            },
          })),
        }));

        stopVideoPollingInternal(nodeId);
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
  }
};

/**
 * Wan 2.7 I2V 视频生成轮询逻辑
 */
const pollWanI2vVideoGeneration = async (
  taskId: string,
  nodeId: string,
  signal: AbortSignal,
  setState: (
    updater: (state: CanvasFlowStoreType) => Partial<CanvasFlowStoreType>,
  ) => void,
  getState: () => CanvasFlowStoreType,
) => {
  const startTime = Date.now();
  try {
    while (true) {
      await wait(VIDEO_POLL_INTERVAL, signal);
      if (signal.aborted) {
        return;
      }

      // 检查是否超时
      if (Date.now() - startTime > VIDEO_TIMEOUT) {
        console.error("[Wan I2V] 视频生成超时");
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
        return;
      }

      const response: any = await getDashscopeVideoTaskStatus(taskId);

      const currentNode = getState().nodes.find((node) => node.id === nodeId);
      if (!currentNode || currentNode.type !== "videoNode") {
        stopVideoPollingInternal(nodeId);
        return;
      }

      const normalized = normalizeVideoTaskResponse(response);
      const normalizedTaskId = normalized.taskId ?? taskId;

      if (normalized.status === GenerationStatus.COMPLETED) {
        if (normalized.missingResultUrl) {
          setState((state) => ({
            nodes: updateVideoNodeInList(state.nodes, nodeId, (data) => ({
              ...data,
              status: GenerationStatus.FAILED,
              progress: normalized.progress,
              task_id: normalizedTaskId,
              error: {
                code: "WAN_I2V_MISSING_URL",
                message: "任务已完成但未返回视频地址，请稍后重试",
              },
            })),
          }));
          stopVideoPollingInternal(nodeId);
          return;
        }

        const projectId = getState().projectId;
        const processedResultData = await Promise.all(
          normalized.videoItems.map(async (item: any) => {
            if (item.url && projectId) {
              try {
                const ext = item.format || "mp4";
                const fileName = await saveGeneratedVideoToLocal(
                  projectId,
                  item.url,
                  ext,
                );
                if (fileName) {
                  const relativePath = getLocalFilePath(
                    projectId,
                    "generate_video",
                    fileName,
                  );
                  return {
                    ...item,
                    localName: fileName,
                    localPath: relativePath,
                  };
                }
              } catch (saveError) {
                console.error("[Wan I2V] 保存视频到本地失败:", saveError);
              }
            }
            return item;
          }),
        );

        setState((state) => ({
          nodes: updateVideoNodeInList(state.nodes, nodeId, (data) => ({
            ...data,
            status: GenerationStatus.COMPLETED,
            progress: 100,
            task_id: normalizedTaskId,
            result: {
              type: "video",
              data: processedResultData,
            },
            error: undefined,
          })),
        }));

        stopVideoPollingInternal(nodeId);

        await deductVipScoreAfterGeneration({
          scene: "video",
          nodeId,
          taskId: normalizedTaskId,
          model: (currentNode.data as VideoGenerationNode)?.model,
          requiredPoints: (currentNode.data as VideoGenerationNode)?.requiredPoints,
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
              code: "WAN_I2V_FAILED",
              message: normalized.errorMessage || "生成失败，请稍后再试",
            },
          })),
        }));
        stopVideoPollingInternal(nodeId);
        return;
      }

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
    console.error("[Wan I2V] 视频生成轮询失败:", pollError);
    stopVideoPollingInternal(nodeId);
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

  const scoreCost = Number(requiredPoints);
  const finalScoreCost =
    Number.isFinite(scoreCost) && scoreCost > 0
      ? scoreCost
      : getGenerationScoreCost(model);
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

  /**
   * 同步图片节点的 image_urls 依赖
   * 支持 Image→Image 和 Image→Video 的边操作
   * @param nodes 当前节点数组
   * @param edge 要处理的边
   * @param mode 'add' = 连接时合并, 'remove' = 删除时清理
   */
  const syncImageUrlsByEdge = (
    nodes: any[],
    edge: any,
    mode: "add" | "remove",
  ): any[] => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);

    // 只处理来自 imageNode 的关联，且目标是 imageNode、videoNode 或 panoramaNode
    if (!sourceNode || sourceNode.type !== "imageNode") {
      return nodes;
    }
    if (
      !targetNode ||
      (targetNode.type !== "imageNode" &&
        targetNode.type !== "videoNode" &&
        targetNode.type !== "panoramaNode")
    ) {
      return nodes;
    }

    // 从 source 的 result.data 提取 URL 字符串数组
    const sourceData = sourceNode.data as any;
    const sourceUrls = (sourceData?.result?.data ?? [])
      .map((item: any) => item.url)
      .filter(Boolean);

    if (sourceUrls.length === 0) {
      return nodes;
    }

    // 更新 target 的字段
    return nodes.map((node) => {
      if (node.id !== targetNode.id) {
        return node;
      }

      const nodeData = node.data as any;

      // 对于 panoramaNode，更新 image_url 字段
      if (node.type === "panoramaNode") {
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

      // 对于 imageNode 和 videoNode，更新 image_urls 字段
      const currentUrls = nodeData?.image_urls ?? [];
      let nextUrls: string[];

      if (mode === "add") {
        // 连接时：合并去重
        nextUrls = Array.from(new Set([...currentUrls, ...sourceUrls]));
      } else {
        // 删除时：移除 source URLs
        const sourceUrlSet = new Set(sourceUrls);
        nextUrls = currentUrls.filter((url) => !sourceUrlSet.has(url));
      }

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
          image_urls: nextUrls,
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

    // 历史版本计数器（用于通知 useUndoRedo hook 保存快照）
    historyVersion: 0,
    // 历史重置触发器（每次递增通知 useUndoRedo hook 重置历史）
    historyResetTrigger: 0,
    // 选中节点数量初始化（用于避免 O(n²) 遍历）
    selectedNodesCount: 0,

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

      if (!data || data.version !== CANVAS_STORAGE_VERSION) {
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
        });
        get().requestHistorySave();
        return;
      }

      // 处理节点中的本地文件，将相对路径转换为可显示的 blob URL
      const processedNodes: AllNodeType[] = await Promise.all(
        data.nodes.map(async (node): Promise<AllNodeType> => {
          // 处理文本智能体节点的生成状态
          if (
            node.type === "textAgentNode" &&
            node.data?.status === "generating"
          ) {
            return {
              ...node,
              data: {
                ...node.data,
                status: "idle" as const,
              },
            };
          }

          // 处理图片节点的本地文件
          if (node.type === "imageNode" && node.data?.result?.data) {
            const processedData = await Promise.all(
              node.data.result.data.map(async (item: any) => {
                if (item.relativePath) {
                  try {
                    const fileBytes = await readMediaFromLocal(
                      item.relativePath,
                    );
                    if (fileBytes) {
                      const ext =
                        (item.localFileName || item.fileName)
                          ?.split(".")
                          .pop() || "png";
                      const blob = new Blob([fileBytes], {
                        type: `image/${ext}`,
                      });
                      const blobUrl = URL.createObjectURL(blob);
                      return { ...item, url: blobUrl };
                    }
                  } catch (err) {
                    console.warn("Failed to load local image:", err);
                  }
                }
                return item;
              }),
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

          // 处理视频节点的本地文件
          if (node.type === "videoNode" && node.data?.result?.data) {
            const processedData = await Promise.all(
              node.data.result.data.map(async (item: any) => {
                if (item.relativePath) {
                  try {
                    const fileBytes = await readMediaFromLocal(
                      item.relativePath,
                    );
                    if (fileBytes) {
                      const ext =
                        item.format ||
                        (item.localFileName || item.fileName)
                          ?.split(".")
                          .pop() ||
                        "mp4";
                      const blob = new Blob([fileBytes], {
                        type: `video/${ext}`,
                      });
                      const blobUrl = URL.createObjectURL(blob);
                      return { ...item, url: blobUrl };
                    }
                  } catch (err) {
                    console.warn("Failed to load local video:", err);
                  }
                }
                return item;
              }),
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

          // 处理音频节点的本地文件
          if (node.type === "audioNode" && node.data?.result?.data) {
            const processedData = await Promise.all(
              node.data.result.data.map(async (item: any) => {
                if (item.relativePath) {
                  try {
                    const fileBytes = await readMediaFromLocal(
                      item.relativePath,
                    );
                    if (fileBytes) {
                      const ext =
                        (item.localFileName || item.fileName)
                          ?.split(".")
                          .pop() || "mp3";
                      const blob = new Blob([fileBytes], {
                        type: `audio/${ext}`,
                      });
                      const blobUrl = URL.createObjectURL(blob);
                      return { ...item, url: blobUrl };
                    }
                  } catch (err) {
                    console.warn("Failed to load local audio:", err);
                  }
                }
                return item;
              }),
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
          set({ nodes: [], edges: [] });
          return;
        }

        const data = JSON.parse(raw) as CanvasPersistedState;
        if (data.version !== CANVAS_STORAGE_VERSION) {
          set({ nodes: [], edges: [] });
          return;
        }

        set({
          nodes: data.nodes,
          edges: data.edges,
          nodeIdCounters: data.nodeIdCounters,
        });
      } catch {
        set({ nodes: [], edges: [] });
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
      const finalNode =
        newNode.type === "audioNode"
          ? {
            ...newNode,
            data: {
              ...newNode.data,
              nickname: getAudioNicknameByNodeId(nextId),
            },
          }
          : newNode;

      set((state) => ({
        nodes: [...state.nodes, finalNode],
      }));

      // 保存历史记录
      get().requestHistorySave();

      // 自动保存
      if (useChatSettingsStore.getState().autoSaveEnabled) {
        get().saveGraph();
      }

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

      // 深拷贝 data，避免引用类型共享（如 result.data, image_urls 等）
      const deepCopiedData = JSON.parse(JSON.stringify(node.data));
      // 清除运行时状态，避免 Loading 等状态被复制
      const {
        status: _status,
        isLoading: _isLoading,
        progress: _progress,
        error: _error,
        ...cleanData
      } = deepCopiedData;
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

        return {
          nodes: [...updatedNodes, finalDuplicatedNode],
        };
      });

      get().requestHistorySave();
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

          return syncImageUrlsByEdge(state.nodes, edgeToDelete, "remove");
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
      if (targetNode?.type === "videoNode") {
        stopVideoPollingInternal(nodeId);
      }

      set((state) => {
        const removedEdges = state.edges.filter(
          (edge) => edge.source === nodeId || edge.target === nodeId,
        );
        let nextNodes = state.nodes;

        removedEdges.forEach((edge) => {
          nextNodes = syncImageUrlsByEdge(nextNodes, edge, "remove");
        });

        return {
          nodes: nextNodes.filter((node) => node.id !== nodeId),
          ...(() => {
            const nextEdges = state.edges.filter(
              (edge) => edge.source !== nodeId && edge.target !== nodeId,
            );
            return {
              edges: nextEdges,
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
     * Gemini 3 Pro 渠道二：直接调用 API 并上传 OSS（无需轮询）
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
        prompt,
        image_urls: imageUrls,
        size,
        resolution,
        promptDraft,
        promptDraftHtml,
        requiredPoints,
      } = payload;

      // 更新节点状态为排队中
      set((state) => ({
        nodes: updateImageNodeInList(state.nodes, nodeId, (data) => ({
          ...data,
          model: "gemini-3-pro-image-preview",
          originalModel: payload.originalModel ?? "gemini-3-pro-image-preview",
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
        // 1. 将参考图 URL 转换为 Base64
        const imageBase64s: string[] = [];
        for (const url of imageUrls) {
          try {
            const response = await fetch(url);
            if (response.ok) {
              const contentType =
                response.headers.get("content-type") || "image/jpeg";
              const arrayBuffer = await response.arrayBuffer();
              const binary = btoa(
                new Uint8Array(arrayBuffer).reduce(
                  (data, byte) => data + String.fromCharCode(byte),
                  "",
                ),
              );
              imageBase64s.push(`data:${contentType};base64,${binary}`);
            }
          } catch (err) {
            console.error(
              "[startGeminiPro2Generation] 转换参考图失败:",
              url,
              err,
            );
          }
        }

        // 2. 构造请求体
        // 注意：text 和 inline_data 不能同时存在于同一个 part，必须拆成独立的 part
        // 正确格式：第一个 part 放文本，后续 parts 放图片
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parts: any[] = [];

        // 先添加文本 part
        if (prompt) {
          parts.push({ text: prompt });
        }

        // 再添加图片 parts（每个图片一个独立的 inline_data part）
        for (const base64 of imageBase64s) {
          let mimeType = "image/jpeg";
          let data = base64;
          const dataUriMatch = base64.match(/^data:(image\/\w+);base64,(.+)$/);
          if (dataUriMatch) {
            mimeType = dataUriMatch[1];
            data = dataUriMatch[2];
          }
          parts.push({
            inline_data: {
              mime_type: mimeType,
              data: data,
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

        // 3. 更新状态为生成中
        set((state) => ({
          nodes: updateImageNodeInList(state.nodes, nodeId, (data) => ({
            ...data,
            status: GenerationStatus.IN_PROGRESS,
            progress: 0,
          })),
        }));

        // 4. 调用 API
        const response: GeminiYwResponseBody = await generateGeminiContent(
          "gemini-3-pro-image-preview",
          requestBody,
        );

        // 5. 解析响应，提取图片 Base64
        const candidates = response.candidates ?? [];
        if (candidates.length === 0) {
          throw new Error("API 返回为空");
        }

        const imageParts = candidates[0].content.parts.filter(
          (p) => p.inlineData?.data,
        );

        // 6. 将每张图片上传到 OSS
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

        // 7. 更新节点状态为完成
        set((state) => ({
          nodes: updateImageNodeInList(state.nodes, nodeId, (data) => {
            const existingData = data.result?.data ?? [];
            const mergedData = [...existingData, ...processedResultData];
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
        const serverMessage = getRequestErrorMessage(startError);
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
              detail: serverMessage,
              serverMessage,
            },
          })),
        }));
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
      const sourceImageUrl = sourceData.result?.data?.[0]?.url;

      const totalCells = gridSize * gridSize;
      const nodeWidth = 350;
      const nodeHeight = 280;
      const gap = 20;

      const startX =
        sourceNode.position.x + (sourceNode.width ?? nodeWidth) + gap * 3;
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
          x: startX + (col - 1) * (nodeWidth + gap),
          y: startY + (row - 1) * (nodeHeight + gap),
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
          promptDraft: splitPrompt,
          promptDraftHtml: `<p>${splitPrompt}</p>`,
        });

        const payload: any = {
          model: sourceModel,
          prompt: splitPrompt,
          n: 1,
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

        get().startImageGeneration(newId, payload);
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
      const sourceNode = get().nodes.find((node) => node.id === nodeId);
      if (!sourceNode) return;

      const nodeType = sourceNode.type;
      const sourceData = sourceNode.data as
        | ImageGenerationNode
        | VideoGenerationNode;
      const resultData = sourceData.result?.data;

      if (!resultData || resultData.length <= 1) return;

      const targetNodeType = nodeType === "videoNode" ? "video" : "image";

      const nodeWidth = nodeType === "imageNode" ? 350 : 350;
      const nodeHeight = nodeType === "imageNode" ? 280 : 250;
      const gap = 20;

      for (let i = 1; i < resultData.length; i++) {
        const item = resultData[i];
        if (!item?.url) continue;

        const position = {
          x: sourceNode.position.x + (i - 1) * (nodeWidth + gap),
          y: sourceNode.position.y + nodeHeight + gap,
        };

        const newNodeId = get().addNode(targetNodeType, position);

        if (targetNodeType === "video") {
          get().updateVideoNodeData(newNodeId, {
            status: GenerationStatus.COMPLETED,
            progress: 100,
            result: {
              type: "video",
              data: [{ url: item.url, format: "mp4" }],
            },
          });
        } else {
          get().updateImageNodeData(newNodeId, {
            status: GenerationStatus.COMPLETED,
            progress: 100,
            result: {
              type: "image",
              data: [{ url: item.url }],
            },
          });
        }
      }

      if (targetNodeType === "video") {
        get().updateVideoNodeData(nodeId, {
          result: {
            type: sourceData.result?.type ?? "video",
            data: [
              {
                ...(resultData[0] as any),
                format: (resultData[0] as any)?.format ?? "mp4",
              },
            ],
          },
        });
      } else {
        get().updateImageNodeData(nodeId, {
          result: {
            type: sourceData.result?.type ?? "image",
            data: [resultData[0]],
          },
        });
      }

      if (useChatSettingsStore.getState().autoSaveEnabled) {
        get().saveGraph();
      }
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
          result: {
            type: "video",
            data: [],
          },
        })),
      }));

      try {
        const response: any = await createLzVideoTask(payload);

        const taskId = response?.data?.task_id;

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
        pollVideoGeneration(taskId, nodeId, controller.signal, set, get);
      } catch (startError) {
        console.error("创建视频生成任务失败:", startError);
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

    /**
     * Wan 2.7 I2V 视频生成任务并启动轮询
     */
    startWanI2vVideoGeneration: async (nodeId, payload) => {
      // 先中止旧轮询
      stopVideoPollingInternal(nodeId);

      // 更新节点状态
      set((state) => ({
        nodes: updateVideoNodeInList(state.nodes, nodeId, (data) => ({
          ...data,
          ...payload,
          status: GenerationStatus.QUEUED,
          progress: 0,
          error: undefined,
          result: {
            type: "video",
            data: [],
          },
        })),
      }));

      try {
        const response: any = await createDashscopeVideoSynthesis(payload);

        const taskId = response?.output?.task_id;

        if (!taskId) {
          throw new Error("任务 ID 为空");
        }

        // 标记为生成中
        set((state) => ({
          nodes: updateVideoNodeInList(state.nodes, nodeId, (data) => ({
            ...data,
            task_id: taskId,
            status: GenerationStatus.IN_PROGRESS,
            progress: 0,
          })),
        }));

        const controller = new AbortController();
        videoPollingControllers.set(nodeId, controller);
        pollWanI2vVideoGeneration(taskId, nodeId, controller.signal, set, get);
      } catch (startError) {
        console.error("[Wan I2V] 创建视频生成任务失败:", startError);
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
          } else if (node.type === "videoNode") {
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
            } else if (node.type === "videoNode") {
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
      set((state) => {
        const nextNodes = applyNodeChanges(changes, state.nodes);
        // 计算选中节点数量，避免在 ImageNode 等组件中 O(n²) 遍历
        const selectedCount = nextNodes.filter((n) => n.selected).length;
        return {
          nodes: nextNodes,
          selectedNodesCount: selectedCount,
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
          nextNodes = syncImageUrlsByEdge(nextNodes, edge, "remove");
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

      if (targetNode?.type === "videoNode") {
        const allowedSourceTypes = ["imageNode", "videoNode", "audioNode"];
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
            ? syncImageUrlsByEdge(state.nodes, createdEdge as EdgeType, "add")
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

    // ==================== 撤销/重做 ====================
  };
});
