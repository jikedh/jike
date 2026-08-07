import { GenerationStatus } from "shared/constants/enum";

const seedance20InProgressStatusMap: Record<string, GenerationStatus> = {
  queued: GenerationStatus.QUEUED,
  processing: GenerationStatus.IN_PROGRESS,
  running: GenerationStatus.IN_PROGRESS,
};

const wan27I2vStatusMap: Record<string, GenerationStatus> = {
  PENDING: GenerationStatus.QUEUED,
  RUNNING: GenerationStatus.IN_PROGRESS,
  SUCCEEDED: GenerationStatus.COMPLETED,
  FAILED: GenerationStatus.FAILED,
};

const kuaiziVideoStatusMap: Record<string, GenerationStatus> = {
  PENDING: GenerationStatus.QUEUED,
  RUNNING: GenerationStatus.IN_PROGRESS,
  SUCCEEDED: GenerationStatus.COMPLETED,
  FAILED: GenerationStatus.FAILED,
  CANCELED: GenerationStatus.FAILED,
  UNKNOWN: GenerationStatus.IN_PROGRESS,
};

const extractSeedance20VideoItems = (response: any) => {
  const resultUrl = response?.data?.video_url;
  if (!resultUrl) {
    return [];
  }

  return [
    {
      url: resultUrl,
      format: "mp4",
    },
  ];
};

const extractWan27I2vVideoItems = (response: any) => {
  const output = response?.output ?? {};
  const resultUrls = [
    output.video_url,
    output.watermark_video_url,
    output.url,
    ...(Array.isArray(output.video_urls) ? output.video_urls : []),
    ...(Array.isArray(output.results)
      ? output.results.map((item: any) => item?.video_url ?? item?.url)
      : []),
  ].filter((url): url is string => typeof url === "string" && url.length > 0);

  if (resultUrls.length === 0) {
    return [];
  }

  return Array.from(new Set(resultUrls)).map((url) => ({
    url,
    format: "mp4",
  }));
};

const extractKuaiziVideoItems = (response: any) => {
  const output = response?.output ?? response?.data ?? {};
  const resultUrls = [
    output.video_url,
    output.watermark_video_url,
    output.url,
    ...(Array.isArray(output.video_urls) ? output.video_urls : []),
    ...(Array.isArray(output.results)
      ? output.results.map((item: any) => item?.video_url ?? item?.url)
      : []),
  ].filter((url): url is string => typeof url === "string" && url.length > 0);

  if (resultUrls.length === 0) {
    return [];
  }

  return Array.from(new Set(resultUrls)).map((url) => ({
    url,
    format: "mp4",
  }));
};

// Agnes-Video-V2.0 通常在顶层 url 字段返回视频地址，同时兼容代理嵌套结构。
const extractAgnesVideoItems = (response: any) => {
  const candidates = [
    response?.url,
    response?.video_url,
    response?.data?.url,
    response?.data?.video_url,
    response?.result?.url,
    response?.data?.result?.url,
    response?.result?.data?.[0]?.url,
    response?.data?.result?.data?.[0]?.url,
  ].filter((url): url is string => typeof url === "string" && url.length > 0);

  if (candidates.length === 0) {
    return [];
  }

  return Array.from(new Set(candidates)).map((url) => ({
    url,
    format: "mp4",
  }));
};

const extractOverseasSeedanceVideoItems = (response: any) => {
  const content = response?.content ?? response?.data?.content ?? {};
  const resultUrl =
    typeof content?.kz_video_url === "string" && content.kz_video_url.length > 0
      ? content.kz_video_url
      : typeof content?.video_url === "string" && content.video_url.length > 0
        ? content.video_url
        : undefined;

  if (!resultUrl) {
    return [];
  }

  return [{
    url: resultUrl,
    format: "mp4",
  }];
};

const getErrorMessage = (response: any, fallbackMessage: string) => {
  const message =
    response?.error?.message ||
    response?.error ||
    response?.message ||
    response?.data?.error;

  if (!message) {
    return fallbackMessage;
  }

  if (typeof message === "string") {
    return message;
  }

  return JSON.stringify(message);
};

const agnesVideoStatusMap: Record<string, GenerationStatus> = {
  queued: GenerationStatus.QUEUED,
  in_progress: GenerationStatus.IN_PROGRESS,
  completed: GenerationStatus.COMPLETED,
  failed: GenerationStatus.FAILED,
};

const normalizeOverseasSeedanceResponse = (response: any) => {
  const rawStatus = String(response?.status ?? response?.data?.status ?? "");
  const taskId = response?.id ?? response?.data?.id ?? response?.task_id;
  const progress =
    rawStatus === "succeeded"
      ? 100
      : response?.progress ?? response?.data?.progress ?? 0;
  const videoItems = extractOverseasSeedanceVideoItems(response);

  if (rawStatus === "succeeded") {
    return {
      status: GenerationStatus.COMPLETED,
      progress: 100,
      taskId,
      videoItems,
      missingResultUrl: videoItems.length === 0,
      errorMessage: undefined,
    };
  }

  if (rawStatus === "failed" || rawStatus === "expired") {
    return {
      status: GenerationStatus.FAILED,
      progress,
      taskId,
      videoItems: [],
      missingResultUrl: false,
      errorMessage: getErrorMessage(response, "生成失败，请稍后再试"),
    };
  }

  return {
    status:
      rawStatus === "queued"
        ? GenerationStatus.QUEUED
        : GenerationStatus.IN_PROGRESS,
    progress,
    taskId,
    videoItems,
    missingResultUrl: false,
    errorMessage: undefined,
  };
};

const normalizeAgnesVideoResponse = (response: any) => {
  const rawStatus = String(response?.status ?? "");
  const taskId = response?.video_id ?? response?.id ?? response?.task_id;
  const progress = response?.progress ?? 0;
  const videoItems = extractAgnesVideoItems(response);

  if (rawStatus === "completed") {
    return {
      status: GenerationStatus.COMPLETED,
      progress: 100,
      taskId,
      videoItems,
      missingResultUrl: videoItems.length === 0,
      errorMessage: undefined,
    };
  }

  if (rawStatus === "failed") {
    return {
      status: GenerationStatus.FAILED,
      progress,
      taskId,
      videoItems: [],
      missingResultUrl: false,
      errorMessage: getErrorMessage(response, "生成失败，请稍后再试"),
    };
  }

  return {
    status: agnesVideoStatusMap[rawStatus] ?? GenerationStatus.IN_PROGRESS,
    progress,
    taskId,
    videoItems,
    missingResultUrl: false,
    errorMessage: undefined,
  };
};

const normalizeMiniMaxVideoResponse = (response: any) => {
  const task = response?.task ?? {};
  const rawStatus = String(task.status ?? "").toLowerCase();
  const status =
    rawStatus === "success" ||
      rawStatus === "succeeded" ||
      rawStatus === "completed"
      ? GenerationStatus.COMPLETED
      : rawStatus === "failed" ||
        rawStatus === "error" ||
        rawStatus === "cancelled"
        ? GenerationStatus.FAILED
        : rawStatus === "queued" || rawStatus === "pending"
          ? GenerationStatus.QUEUED
          : GenerationStatus.IN_PROGRESS;
  const videoUrl = task.content?.url ?? task.video_url ?? task.url;
  const videoItems = videoUrl ? [{ url: videoUrl, format: "mp4" }] : [];

  return {
    status,
    progress: status === GenerationStatus.COMPLETED ? 100 : task.progress ?? 50,
    taskId: task.id ?? task.task_id,
    videoItems,
    missingResultUrl:
      status === GenerationStatus.COMPLETED && videoItems.length === 0,
    errorMessage:
      task.error?.message ??
      (typeof task.error === "string" ? task.error : undefined),
  };
};

const normalizeKuaiziVideoResponse = (response: any) => {
  const taskStatus =
    response?.output?.task_status ?? response?.data?.task_status;

  if (taskStatus !== undefined) {
    const rawStatus = String(taskStatus).toUpperCase();
    const taskId =
      response?.output?.task_id ?? response?.data?.task_id ?? response?.task_id;
    const progress = rawStatus === "SUCCEEDED" ? 100 : 0;
    const videoItems = extractKuaiziVideoItems(response);

    if (rawStatus === "SUCCEEDED") {
      return {
        status: GenerationStatus.COMPLETED,
        progress: 100,
        taskId,
        videoItems,
        missingResultUrl: videoItems.length === 0,
        errorMessage: undefined,
      };
    }

    if (rawStatus === "FAILED" || rawStatus === "CANCELED") {
      return {
        status: GenerationStatus.FAILED,
        progress,
        taskId,
        videoItems: [],
        missingResultUrl: false,
        errorMessage: getErrorMessage(response, "生成失败，请稍后再试"),
      };
    }

    return {
      status: kuaiziVideoStatusMap[rawStatus] ?? GenerationStatus.IN_PROGRESS,
      progress,
      taskId,
      videoItems,
      missingResultUrl: false,
      errorMessage: undefined,
    };
  }

  const rawStatus = response?.data?.status;
  const taskId = response?.data?.task_id;
  const progress = response?.data?.progress ?? 0;
  const videoItems = extractSeedance20VideoItems(response);

  if (rawStatus === "succeeded" || rawStatus === "completed") {
    return {
      status: GenerationStatus.COMPLETED,
      progress: 100,
      taskId,
      videoItems,
      missingResultUrl: videoItems.length === 0,
      errorMessage: undefined,
    };
  }

  if (
    rawStatus === "failed" ||
    rawStatus === "canceled" ||
    rawStatus === "cancelled" ||
    rawStatus === "error"
  ) {
    return {
      status: GenerationStatus.FAILED,
      progress,
      taskId,
      videoItems: [],
      missingResultUrl: false,
      errorMessage: getErrorMessage(response, "生成失败，请稍后再试"),
    };
  }

  return {
    status:
      seedance20InProgressStatusMap[rawStatus] ?? GenerationStatus.IN_PROGRESS,
    progress,
    taskId,
    videoItems,
    missingResultUrl: false,
    errorMessage: undefined,
  };
};

const normalizeWan27VideoResponse = (response: any) => {
  const rawStatus = response?.output?.task_status;
  const taskId = response?.output?.task_id;
  const progress = rawStatus === "SUCCEEDED" ? 100 : 0;
  const videoItems = extractWan27I2vVideoItems(response);

  if (rawStatus === "SUCCEEDED") {
    return {
      status: GenerationStatus.COMPLETED,
      progress: 100,
      taskId,
      videoItems,
      missingResultUrl: videoItems.length === 0,
      errorMessage: undefined,
    };
  }

  if (rawStatus === "FAILED") {
    return {
      status: GenerationStatus.FAILED,
      progress,
      taskId,
      videoItems: [],
      missingResultUrl: false,
      errorMessage: getErrorMessage(response, "生成失败，请稍后再试"),
    };
  }

  return {
    status: wan27I2vStatusMap[rawStatus] ?? GenerationStatus.IN_PROGRESS,
    progress,
    taskId,
    videoItems,
    missingResultUrl: false,
    errorMessage: undefined,
  };
};

const videoResponseNormalizerMap: Record<string, (response: any) => any> = {
  kuaizi: normalizeKuaiziVideoResponse,
  "seedance-2.0-fast": normalizeKuaiziVideoResponse,
  "seedance-2.0-mini": normalizeKuaiziVideoResponse,
  "seedance-2.0-pro": normalizeKuaiziVideoResponse,
  "doubao-seedance-2.0-fast": normalizeKuaiziVideoResponse,
  "doubao-seedance-2.0-mini": normalizeKuaiziVideoResponse,
  "doubao-seedance-2.0-pro": normalizeKuaiziVideoResponse,
  kuaizi_global: normalizeOverseasSeedanceResponse,
  "dreamina-seedance-2-0-260128": normalizeOverseasSeedanceResponse,
  agnes: normalizeAgnesVideoResponse,
  "agnes-video-v2.0": normalizeAgnesVideoResponse,
  minimax: normalizeMiniMaxVideoResponse,
  "minimax-h3": normalizeMiniMaxVideoResponse,
  dashscope: normalizeWan27VideoResponse,
  "wan2.7-t2v": normalizeWan27VideoResponse,
  "wan2.7-i2v": normalizeWan27VideoResponse,
  "wan2.7-r2v": normalizeWan27VideoResponse,
};

export const normalizeVideoTaskResponse = (response: any) => {
  const modal =
    typeof response?.modal === "string" ? response.modal.trim().toLowerCase() : "";
  const normalizer = videoResponseNormalizerMap[modal];

  if (normalizer) {
    return normalizer(response);
  }

  return {
    status: GenerationStatus.FAILED,
    progress: 0,
    taskId: undefined,
    videoItems: [],
    missingResultUrl: false,
    errorMessage: modal
      ? `不支持的视频响应来源：${response.modal}`
      : "视频任务响应缺少 modal 字段",
  };
};
