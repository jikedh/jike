import {
  createImageGeneration,
  fetchMjTask,
  generateGeminiContent,
  getImageTaskStatus,
  submitMjImagine,
} from "@/api/ai";
import { getBalanceInfo, updateVipScore } from "@/api/jikeing";
import { buildMidjourneyPrompt } from "@/pages/Canvas/CustomNodes/ImageNode/utils/buildMidjourneyPrompt";
import { getImageDimensions } from "@/pages/Canvas/CustomNodes/ImageNode/utils/aspectRatioUtils";
import { useUserStore } from "@/stores/useUserStore";
import { generateImageUrl } from "service/oss";
import {
  getCanvasChatImageModelConfig,
  getGenerationScoreCost,
} from "shared/constants/ai-models";
import { getImageGenerationPoints } from "shared/constants/modelPoints";
import type { NoteGenerationImage } from "shared/types/NoteGeneration";
import type { GeminiYwResponseBody } from "shared/types/detail/Yunwu/gemini-yw";
import { uploadBase64ToOSS } from "shared/utils/base64ToImage";
import { getRequestErrorMessage } from "shared/utils/requestErrorHandler";
import { getJikeingUserId } from "shared/utils/utils";

const CHAT_IMAGE_POLL_INTERVAL = 10000;
const CHAT_IMAGE_TIMEOUT = 5 * 60 * 1000;
const CHAT_IMAGE_PRELOAD_TIMEOUT = 12000;
const CHAT_IMAGE_MIRROR_TIMEOUT = 15000;
const DEFAULT_CHAT_IMAGE_SIZE = "1:1";
const DEFAULT_CHAT_IMAGE_RESOLUTION = "2K";

type ChatImageModelConfig = NonNullable<
  ReturnType<typeof getCanvasChatImageModelConfig>
>;

type GenerateCanvasChatImagesOptions = {
  model: string;
  prompt: string;
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
};

export type GenerateCanvasChatImagesResult = {
  images: NoteGenerationImage[];
  label: string;
  requiredPoints: number;
};

const createAbortError = () =>
  new DOMException("Image generation aborted", "AbortError");

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw createAbortError();
  }
};

const wait = (ms: number, signal?: AbortSignal) => {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, ms);

    const handleAbort = () => {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", handleAbort);
      reject(createAbortError());
    };

    if (signal?.aborted) {
      handleAbort();
      return;
    }

    signal?.addEventListener("abort", handleAbort, { once: true });
  });
};

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

const extractTaskId = (response: any) => {
  const result = response?.result;
  if (typeof result === "string") {
    return result;
  }

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

const normalizeImageUrl = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim().replace(/^`|`$/g, "");
  if (!trimmed) {
    return "";
  }

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:image/")
  ) {
    return trimmed;
  }

  if (/^[a-z0-9+/]+=*$/i.test(trimmed) && trimmed.length > 120) {
    return `data:image/png;base64,${trimmed}`;
  }

  return trimmed;
};

const canUseOssImageProcess = (url: string) => {
  if (!/^https?:\/\//i.test(url)) {
    return false;
  }

  try {
    const { hostname, search } = new URL(url);
    if (search) {
      return false;
    }

    return hostname.includes("oss-") && hostname.includes("aliyuncs.com");
  } catch {
    return false;
  }
};

const getChatImagePreviewUrl = (url: string) => {
  if (!canUseOssImageProcess(url)) {
    return url;
  }

  return generateImageUrl(url, [
    { type: "resize", mode: "m_lfit", width: 960 },
    { type: "format", format: "webp" },
    { type: "ignore-error", value: 1 },
  ]);
};

const preloadImage = (url: string, signal?: AbortSignal) => {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    if (!url || signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const image = new Image();
    let settled = false;
    let timeoutId: number | undefined;

    const cleanup = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      image.onload = null;
      image.onerror = null;
      signal?.removeEventListener("abort", handleAbort);
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      const dimensions = {
        width: image.naturalWidth,
        height: image.naturalHeight,
      };
      cleanup();
      resolve(dimensions);
    };

    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("图片预览加载失败"));
    };

    const handleAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(createAbortError());
    };

    image.onload = () => {
      const decode = image.decode?.();
      if (decode) {
        decode.then(finish).catch(finish);
        return;
      }

      finish();
    };
    image.onerror = fail;
    timeoutId = window.setTimeout(fail, CHAT_IMAGE_PRELOAD_TIMEOUT);
    signal?.addEventListener("abort", handleAbort, { once: true });
    image.src = url;
  });
};

const withPreviewImages = (images: NoteGenerationImage[]) =>
  images.map((image) => ({
    ...image,
    previewUrl: image.previewUrl ?? getChatImagePreviewUrl(image.url),
  }));

const getImageDisplayDimensions = async (
  image: NoteGenerationImage,
  signal?: AbortSignal,
) => {
  if (image.width && image.height) {
    return {
      width: image.width,
      height: image.height,
    };
  }

  try {
    return await preloadImage(image.previewUrl ?? image.url, signal);
  } catch {
    throwIfAborted(signal);
  }

  try {
    return await getImageDimensions(image.url);
  } catch {
    return null;
  }
};

const preloadImagePreviews = async (
  images: NoteGenerationImage[],
  signal?: AbortSignal,
) => {
  const settled = await Promise.allSettled(
    images.map(async (image) => {
      const dimensions = await getImageDisplayDimensions(image, signal);
      return { image, dimensions };
    }),
  );
  throwIfAborted(signal);

  return images.map((image, index) => {
    const result = settled[index];
    if (
      result?.status === "fulfilled" &&
      result.value.dimensions?.width &&
      result.value.dimensions?.height
    ) {
      return {
        ...image,
        width: result.value.dimensions.width,
        height: result.value.dimensions.height,
      };
    }

    return image;
  });
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
) => {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
};

const shouldMirrorImageToOss = (url: string) => {
  if (!/^https?:\/\//i.test(url)) {
    return false;
  }

  try {
    const { hostname } = new URL(url);
    return !hostname.includes("aliyuncs.com");
  } catch {
    return false;
  }
};

const mirrorImageToOss = async (
  image: NoteGenerationImage,
  index: number,
): Promise<NoteGenerationImage> => {
  if (!shouldMirrorImageToOss(image.url) || !window.download?.imageAsBase64) {
    return image;
  }

  try {
    const downloadResult = await withTimeout(
      window.download.imageAsBase64(image.url),
      CHAT_IMAGE_MIRROR_TIMEOUT,
      "图片转存下载超时",
    );
    if (!downloadResult.success || !downloadResult.data?.base64) {
      throw new Error(downloadResult.error || "图片转存下载失败");
    }

    const ossResult = await withTimeout(
      uploadBase64ToOSS(
        downloadResult.data.base64,
        `chat-image-${Date.now()}-${index}`,
      ),
      CHAT_IMAGE_MIRROR_TIMEOUT,
      "图片转存上传超时",
    );

    return {
      ...image,
      originalUrl: image.originalUrl ?? image.url,
      url: ossResult.url,
      previewUrl: getChatImagePreviewUrl(ossResult.url),
    };
  } catch (error) {
    console.warn("[canvas-chat-image] 图片转存 OSS 失败，回退原始地址", {
      url: image.url,
      error,
    });
    return image;
  }
};

const mirrorImagesToOss = async (images: NoteGenerationImage[]) => {
  return Promise.all(
    images.map((image, index) => mirrorImageToOss(image, index)),
  );
};

const extractImages = (response: any): NoteGenerationImage[] => {
  const rawData =
    response?.result?.data ??
    response?.data?.data ??
    response?.data?.images ??
    response?.result?.images ??
    response?.imageUrls ??
    response?.images ??
    [];

  const rawItems = Array.isArray(rawData) ? rawData : [rawData];
  return rawItems
    .map((item: any) => {
      const url = normalizeImageUrl(
        typeof item === "string"
          ? item
          : (item?.url ?? item?.image_url ?? item?.imageUrl ?? item?.b64_json),
      );
      if (!url) {
        return null;
      }

      return {
        url,
        previewUrl: getChatImagePreviewUrl(url),
        localPath: item?.localPath,
        localName: item?.localName,
        width: Number(item?.width ?? item?.naturalWidth) || undefined,
        height: Number(item?.height ?? item?.naturalHeight) || undefined,
      } satisfies NoteGenerationImage;
    })
    .filter(Boolean) as NoteGenerationImage[];
};

const ensureEnoughPoints = async (
  config: ChatImageModelConfig,
  requiredPoints: number,
) => {
  const userState = useUserStore.getState();
  if (userState.loginStatus !== 1) {
    userState.setDialogLoginStatus(true);
    throw new Error("请先登录后再生成图片");
  }

  let balanceInfo = userState.balanceInfo;
  if (!balanceInfo) {
    await userState.fetchBalanceInfo();
    balanceInfo = useUserStore.getState().balanceInfo;
  }

  if (!balanceInfo) {
    const response = await getBalanceInfo();
    balanceInfo = response?.data ?? null;
    if (balanceInfo) {
      useUserStore.getState().setBalanceInfo(balanceInfo);
    }
  }

  const totalPoints =
    Number(balanceInfo?.forScore ?? 0) + Number(balanceInfo?.vipScore ?? 0);
  if (totalPoints < requiredPoints) {
    throw new Error(
      `积分不足，当前剩余 ${totalPoints} 积分，生成图片需要 ${requiredPoints} 积分`,
    );
  }

  return config;
};

const deductPoints = async (
  config: ChatImageModelConfig,
  requiredPoints: number,
) => {
  const loginUserId = getJikeingUserId();
  if (!loginUserId) {
    return;
  }

  const scoreCost =
    Number.isFinite(requiredPoints) && requiredPoints > 0
      ? requiredPoints
      : getGenerationScoreCost(config.imageModel);

  try {
    await updateVipScore({
      userId: loginUserId,
      vipScoreDelta: -scoreCost,
    });
    await useUserStore.getState().fetchBalanceInfo();
  } catch (error) {
    console.error("[canvas-chat-image] 扣费失败", {
      model: config.imageModel,
      scoreCost,
      message: getRequestErrorMessage(error),
    });
  }
};

const buildBasePayload = (config: ChatImageModelConfig, prompt: string) => {
  const isNiji7 = config.imageModel === "midjourney-niji7";
  const backendModel = isNiji7 ? "midjourney" : config.imageModel;
  let finalPrompt = prompt;

  if (backendModel === "midjourney") {
    finalPrompt = `${finalPrompt} --ar ${DEFAULT_CHAT_IMAGE_SIZE}`;
    if (isNiji7) {
      finalPrompt = `${finalPrompt} --niji 7`;
    }
  }

  if (config.imagePlatform === "google_pro2") {
    finalPrompt = `${finalPrompt} [尺寸:${DEFAULT_CHAT_IMAGE_SIZE}] [分辨率:${DEFAULT_CHAT_IMAGE_RESOLUTION}]`;
  }

  return {
    model: backendModel,
    originalModel: config.imageModel,
    prompt: finalPrompt,
    resolution: DEFAULT_CHAT_IMAGE_RESOLUTION,
    n: 1,
    image_urls: [],
    size: DEFAULT_CHAT_IMAGE_SIZE,
    metadata: {
      resolution: DEFAULT_CHAT_IMAGE_RESOLUTION,
    },
  };
};

const pollStandardImageGeneration = async (
  taskId: string,
  signal?: AbortSignal,
): Promise<NoteGenerationImage[]> => {
  const startTime = Date.now();

  while (true) {
    throwIfAborted(signal);

    if (Date.now() - startTime > CHAT_IMAGE_TIMEOUT) {
      throw new Error("图片生成超时，请稍后再试");
    }

    const response: any = await getImageTaskStatus(taskId);
    const status =
      response?.data?.status ?? response?.result?.status ?? response?.status;

    if (isSuccessStatus(status)) {
      const images = extractImages(response);
      if (images.length === 0) {
        throw new Error("图片生成完成，但未返回图片地址");
      }
      return images;
    }

    if (isFailureStatus(status)) {
      throw new Error(
        response?.message ||
          response?.data?.message ||
          response?.result?.message ||
          "图片生成失败，请稍后再试",
      );
    }

    await wait(CHAT_IMAGE_POLL_INTERVAL, signal);
    throwIfAborted(signal);
  }
};

const pollMidjourneyImageGeneration = async (
  taskId: string,
  signal?: AbortSignal,
): Promise<NoteGenerationImage[]> => {
  const startTime = Date.now();

  while (true) {
    throwIfAborted(signal);

    if (Date.now() - startTime > CHAT_IMAGE_TIMEOUT) {
      throw new Error("Midjourney 图片生成超时，请稍后再试");
    }

    const response: any = await fetchMjTask(taskId);

    if (isSuccessStatus(response?.status)) {
      const images = extractImages(response);
      if (images.length === 0) {
        throw new Error("Midjourney 生成完成，但未返回图片地址");
      }
      return images;
    }

    if (isFailureStatus(response?.status)) {
      throw new Error(response?.failReason || "Midjourney 图片生成失败");
    }

    await wait(CHAT_IMAGE_POLL_INTERVAL, signal);
    throwIfAborted(signal);
  }
};

const generateGeminiPro2Images = async (
  prompt: string,
  signal?: AbortSignal,
): Promise<NoteGenerationImage[]> => {
  throwIfAborted(signal);

  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
    },
  };

  const response: GeminiYwResponseBody = await generateGeminiContent(
    "gemini-3-pro-image-preview",
    requestBody,
    signal,
  );

  throwIfAborted(signal);

  const imageParts =
    response?.candidates?.[0]?.content?.parts?.filter(
      (part: any) => part?.inlineData?.data || part?.inline_data?.data,
    ) ?? [];

  if (imageParts.length === 0) {
    throw new Error("Gemini 图片生成完成，但未返回图片");
  }

  return Promise.all(
    imageParts.map(async (part: any, index: number) => {
      const inlineData = part.inlineData ?? part.inline_data;
      const base64Data = inlineData.data;
      const mimeType =
        inlineData.mimeType ?? inlineData.mime_type ?? "image/png";

      try {
        const ossResult = await uploadBase64ToOSS(
          base64Data,
          `chat-gemini-${Date.now()}-${index}`,
        );
        return {
          url: ossResult.url,
          previewUrl: getChatImagePreviewUrl(ossResult.url),
        };
      } catch (error) {
        console.error("[canvas-chat-image] 上传 Gemini 图片到 OSS 失败", error);
        const url = `data:${mimeType};base64,${base64Data}`;
        return {
          url,
          previewUrl: url,
        };
      }
    }),
  );
};

export const generateCanvasChatImages = async ({
  model,
  prompt,
  signal,
  onProgress,
}: GenerateCanvasChatImagesOptions): Promise<GenerateCanvasChatImagesResult> => {
  const config = getCanvasChatImageModelConfig(model);
  if (!config) {
    throw new Error("请选择图片生成模型");
  }

  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) {
    throw new Error("请输入图片提示词");
  }

  const requiredPoints = getImageGenerationPoints({
    model: config.imageModel,
    platform: config.imagePlatform,
    count: 1,
  });
  await ensureEnoughPoints(config, requiredPoints);
  throwIfAborted(signal);

  const payload = buildBasePayload(config, normalizedPrompt);
  let images: NoteGenerationImage[];

  if (config.imagePlatform === "google_pro2") {
    onProgress?.("正在生成图片...");
    images = await generateGeminiPro2Images(payload.prompt, signal);
  } else if (payload.model === "midjourney") {
    onProgress?.("已提交 Midjourney 任务，正在生成图片...");
    const finalPrompt = buildMidjourneyPrompt({
      prompt: payload.prompt,
      referenceUrls: [],
      styleUrls: [],
    });
    const response: any = await submitMjImagine({ prompt: finalPrompt });
    if (response?.code !== 1) {
      throw new Error(response?.description || "Midjourney 任务提交失败");
    }

    throwIfAborted(signal);

    const taskId = extractTaskId(response);
    if (!taskId) {
      throw new Error("未返回图片生成任务 ID，请稍后再试");
    }
    images = await pollMidjourneyImageGeneration(taskId, signal);
  } else {
    onProgress?.("已提交图片任务，正在生成图片...");
    const response: any = await createImageGeneration(payload);
    throwIfAborted(signal);

    const taskId = extractTaskId(response);
    if (!taskId) {
      throw new Error("未返回图片生成任务 ID，请稍后再试");
    }
    images = await pollStandardImageGeneration(taskId, signal);
  }

  await deductPoints(config, requiredPoints);

  images = withPreviewImages(images);
  onProgress?.("图片已生成，正在转存预览...");
  images = await mirrorImagesToOss(images);
  images = withPreviewImages(images);
  try {
    images = await preloadImagePreviews(images, signal);
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw error;
    }

    console.warn(
      "[canvas-chat-image] image preview preload did not complete",
      error,
    );
  }

  /* removed legacy fire-and-forget preload
  preloadImagePreviews(images, signal).catch((error) => {
    if (error?.name !== "AbortError") {
      console.warn("[canvas-chat-image] 图片预加载未完成", error);
    }
  });
  end removed legacy fire-and-forget preload */

  return {
    images,
    label: config.name,
    requiredPoints,
  };
};
