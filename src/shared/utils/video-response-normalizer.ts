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

/**
 * 判断是否为 wan2.7-i2v 响应格式
 * wan2.7-i2v 响应结构: { output: { task_status, video_url, ... } }
 */
const isWan27I2vResponse = (response: any): boolean => {
  return response?.output?.task_status !== undefined;
};

export const normalizeVideoTaskResponse = (response: any) => {
  // wan2.7-i2v 响应格式
  if (isWan27I2vResponse(response)) {
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
  }

  // 快手/Seedance 2.0 响应格式
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
