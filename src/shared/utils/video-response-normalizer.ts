import { GenerationStatus } from "shared/constants/enum";

const seedance20InProgressStatusMap: Record<string, GenerationStatus> = {
  queued: GenerationStatus.QUEUED,
  processing: GenerationStatus.IN_PROGRESS,
  running: GenerationStatus.IN_PROGRESS,
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

export const normalizeVideoTaskResponse = (response: any) => {
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
