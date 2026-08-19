import {
  createAgnesImageGeneration,
  createImageGeneration,
  extractAgnesImageUrls,
  getImageTaskStatus,
} from "@/api/ai";
import {
  confirmDesktopProxyScore,
  createRhartImageG2ImageToImage,
  createRhartImageG2OfficialImageToImage,
  createRhartImageG2OfficialTextToImage,
  createRhartImageG2TextToImage,
  createRhartImageNProImageToImage,
  createRhartImageNProOfficialImageToImage,
  createRhartImageNProOfficialTextToImage,
  createRhartImageNProTextToImage,
  queryRunningHubV2Task,
  refundDesktopProxyScore,
} from "@/api/jikeGo";
import {
  RUNNINGHUB_GPT_IMAGE2_MODEL,
  RUNNINGHUB_NANO_BANANA_PRO_MODEL,
  isAgnesImageModel,
} from "shared/constants/ai-models";
import { getRequestErrorMessage } from "shared/utils/requestErrorHandler";

type GenerateStoryboardImageOptions = {
  model: string;
  platform?: string;
  prompt: string;
  size: string;
  resolution?: string;
  referenceImageUrls?: string[];
  requiredPoints?: number;
  signal?: AbortSignal;
};

const IMAGE_TASK_TIMEOUT = 2 * 60 * 60 * 1000;
const IMAGE_TASK_POLL_INTERVAL = 5000;

const createAbortError = () => {
  const error = new Error("已停止生成");
  error.name = "AbortError";
  return error;
};

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw createAbortError();
  }
};

const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    throwIfAborted(signal);
    const timeoutId = window.setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, ms);
    const handleAbort = () => {
      window.clearTimeout(timeoutId);
      reject(createAbortError());
    };
    signal?.addEventListener("abort", handleAbort, { once: true });
  });

const normalizeStatus = (status: unknown) =>
  String(status ?? "")
    .trim()
    .toLowerCase();

const isSuccessStatus = (status: unknown) =>
  ["completed", "success", "succeeded"].includes(normalizeStatus(status));

const isFailureStatus = (status: unknown) =>
  ["failed", "failure", "error", "cancel", "canceled", "cancelled"].includes(
    normalizeStatus(status),
  );

const normalizeImageUrl = (value: unknown) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().replace(/^`|`$/g, "");
  if (!trimmed) return "";
  if (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }
  if (/^[a-z0-9+/]+=*$/i.test(trimmed) && trimmed.length > 120) {
    return `data:image/png;base64,${trimmed}`;
  }
  return trimmed;
};

const extractTaskId = (response: any) => {
  const result = response?.result;
  if (typeof result === "string") return result;

  return (
    response?.data?.task_id ??
    response?.result?.task_id ??
    response?.task_id ??
    response?.data?.taskId ??
    response?.result?.taskId ??
    response?.taskId ??
    response?.data?.id ??
    response?.result?.id ??
    response?.id
  );
};

const extractImageUrls = (response: any): string[] => {
  const rawData =
    response?.result?.data ??
    response?.data?.result?.data ??
    response?.data?.data ??
    response?.data?.images ??
    response?.result?.images ??
    response?.imageUrls ??
    response?.images ??
    [];
  const rawItems = Array.isArray(rawData) ? rawData : [rawData];

  return rawItems
    .map((item: any) =>
      normalizeImageUrl(
        typeof item === "string"
          ? item
          : (item?.url ?? item?.image_url ?? item?.imageUrl ?? item?.b64_json),
      ),
    )
    .filter(Boolean);
};

const pollStandardImageTask = async (taskId: string, signal?: AbortSignal) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < IMAGE_TASK_TIMEOUT) {
    await delay(IMAGE_TASK_POLL_INTERVAL, signal);
    throwIfAborted(signal);
    const response = await getImageTaskStatus(taskId, signal);
    const status =
      response?.data?.status ?? response?.result?.status ?? response?.status;

    if (isSuccessStatus(status)) {
      const urls = extractImageUrls(response);
      if (urls.length === 0) {
        throw new Error("图片生成完成，但未返回图片地址");
      }
      return urls[0];
    }

    if (isFailureStatus(status)) {
      throw new Error(
        response?.message ||
        response?.data?.message ||
        response?.result?.message ||
        "图片生成失败",
      );
    }
  }

  throw new Error("图片生成超时，请稍后再试");
};

const extractRunningHubImageUrl = (response: any) => {
  const data = response?.data ?? response;
  const directUrl = data?.url || data?.imageUrl || data?.fileUrl;
  if (directUrl) return directUrl;

  const firstResult = Array.isArray(data?.results) ? data.results[0] : null;
  if (firstResult?.url || firstResult?.imageUrl || firstResult?.fileUrl) {
    return firstResult.url || firstResult.imageUrl || firstResult.fileUrl;
  }

  const firstOutput = Array.isArray(data?.outputs) ? data.outputs[0] : null;
  return firstOutput?.url || firstOutput?.imageUrl || firstOutput?.fileUrl;
};

const pollRunningHubImageTask = async (
  taskId: string,
  signal?: AbortSignal,
) => {
  const startedAt = Date.now();
  let lastMessage = "";

  while (Date.now() - startedAt < IMAGE_TASK_TIMEOUT) {
    await delay(IMAGE_TASK_POLL_INTERVAL, signal);
    throwIfAborted(signal);
    const response = await queryRunningHubV2Task({ taskId }, signal);
    const data = response?.data ?? response;
    const status = String(data?.status || data?.taskStatus || "").toUpperCase();
    const resultUrl = extractRunningHubImageUrl(data);
    lastMessage = data?.errorMessage || data?.message || lastMessage;

    if (resultUrl && (status === "SUCCESS" || !status)) {
      return resultUrl;
    }

    if (status === "FAILED") {
      throw new Error(lastMessage || "RunningHub 生图失败");
    }
  }

  throw new Error(lastMessage || "RunningHub 生图超时，请稍后重试");
};

const generateRunningHubImage = async ({
  model,
  prompt,
  size,
  resolution,
  referenceImageUrls,
  requiredPoints,
  signal,
}: GenerateStoryboardImageOptions) => {
  const imageUrls = referenceImageUrls?.filter(Boolean) ?? [];
  const request = {
    prompt,
    aspectRatio: size || "1:1",
    resolution: (resolution || "1K").toLowerCase(),
    ...(model === RUNNINGHUB_GPT_IMAGE2_MODEL ? { quality: "medium" } : {}),
    ...(imageUrls.length > 0 ? { imageUrls } : {}),
    ...(requiredPoints != null ? { scoreCost: requiredPoints } : {}),
  };

  const routes: Array<(data: any, signal?: AbortSignal) => any> =
    imageUrls.length > 0
      ? model === RUNNINGHUB_GPT_IMAGE2_MODEL
        ? [
          (data) => createRhartImageG2ImageToImage(data),
          (data) => createRhartImageG2OfficialImageToImage(data),
        ]
        : [
          (data) => createRhartImageNProImageToImage(data),
          (data) => createRhartImageNProOfficialImageToImage(data),
        ]
      : model === RUNNINGHUB_GPT_IMAGE2_MODEL
        ? [createRhartImageG2TextToImage, createRhartImageG2OfficialTextToImage]
        : [
          createRhartImageNProTextToImage,
          createRhartImageNProOfficialTextToImage,
        ];

  let lastError: unknown = null;
  for (const route of routes) {
    try {
      throwIfAborted(signal);
      const response = await route(request, signal);
      const data = response?.data ?? response;
      const immediateUrl = extractRunningHubImageUrl(data);
      const ledgerBizId: string | undefined =
        data?.ledger_biz_id ?? data?.ledgerBizId;

      if (immediateUrl) {
        if (ledgerBizId) {
          confirmDesktopProxyScore(ledgerBizId, "runninghub_v2").catch(
            () => { },
          );
        }
        return immediateUrl;
      }

      if (!data?.taskId) {
        throw new Error("RunningHub 未返回任务 ID");
      }

      try {
        const resultUrl = await pollRunningHubImageTask(data.taskId, signal);
        if (ledgerBizId) {
          confirmDesktopProxyScore(ledgerBizId, "runninghub_v2").catch(
            () => { },
          );
        }
        return resultUrl;
      } catch (error) {
        if (ledgerBizId) {
          refundDesktopProxyScore(
            ledgerBizId,
            getRequestErrorMessage(error) || "RunningHub 生图失败",
            "runninghub_v2",
          ).catch(() => { });
        }
        throw error;
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("RunningHub 生图失败");
};

export const generateTableStoryboardImage = async (
  options: GenerateStoryboardImageOptions,
) => {
  const scoreCost = Number(options.requiredPoints ?? 0) || undefined;
  const referenceImageUrls = options.referenceImageUrls?.filter(Boolean) ?? [];
  throwIfAborted(options.signal);

  if (isAgnesImageModel(options.model)) {
    const response = await createAgnesImageGeneration(
      {
        model: options.model,
        prompt: options.prompt,
        size: options.size,
        resolution: options.resolution,
        n: 1,
        image_urls: referenceImageUrls,
        metadata: { resolution: options.resolution },
      },
      scoreCost,
      options.signal,
    );
    const resultUrl = extractAgnesImageUrls(response)[0];
    if (!resultUrl) {
      throw new Error("Agnes 图片生成完成，但未返回图片地址");
    }
    return resultUrl;
  }

  if (
    options.model === RUNNINGHUB_GPT_IMAGE2_MODEL ||
    options.model === RUNNINGHUB_NANO_BANANA_PRO_MODEL
  ) {
    return generateRunningHubImage(options);
  }

  const response = await createImageGeneration(
    {
      model: options.model,
      prompt: options.prompt,
      size: options.size,
      resolution: options.resolution,
      n: 1,
      image_urls: referenceImageUrls,
      metadata: { resolution: options.resolution },
    } as any,
    scoreCost,
    options.signal,
  );
  const ledgerBizId = response?.ledgerBizId;
  const taskId = extractTaskId(response);

  if (!taskId) {
    if (ledgerBizId) {
      refundDesktopProxyScore(
        ledgerBizId,
        "image task creation failed: no task_id",
        "image",
      ).catch(() => { });
    }
    throw new Error("未返回图片生成任务 ID，请稍后再试");
  }

  try {
    const resultUrl = await pollStandardImageTask(
      String(taskId),
      options.signal,
    );
    if (ledgerBizId) {
      confirmDesktopProxyScore(ledgerBizId, "image").catch(() => { });
    }
    return resultUrl;
  } catch (error) {
    if (ledgerBizId) {
      refundDesktopProxyScore(
        ledgerBizId,
        getRequestErrorMessage(error) || "图片生成失败",
        "image",
      ).catch(() => { });
    }
    throw error;
  }
};
