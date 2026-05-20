import axios from "axios";

export type WuhenRect = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type WuhenTaskStatus =
  | "created"
  | "queued"
  | "processing"
  | "success"
  | "failed"
  | "paused";

export type CreateWuhenVideoRemovalTaskPayload = {
  sourceVideoUrl: string;
  uploadUrl: string;
  uploadHeaders?: Record<string, string>;
  resultVideoUrl: string;
  rect: WuhenRect;
  model?: "video_removal_std" | "video_removal_pro";
};

export type WuhenVideoRemovalTaskRecord = {
  taskId: string;
  sourceVideoUrl: string;
  resultVideoUrl: string;
  uploadUrl: string;
  model: string;
  status: WuhenTaskStatus;
  progress: number;
  rect: WuhenRect;
  message?: string;
  description?: string;
  credits?: number | null;
  metering?: number | null;
  createdAt: number;
  updatedAt: number;
  completedAt?: number | null;
};

const WUHEI_SERVER_BASE_URL =
  ((import.meta as any).env?.VITE_WUHEI_SERVER_BASE_URL as
    | string
    | undefined) || "http://127.0.0.1:8787";

export async function createWuhenVideoRemovalTask(
  payload: CreateWuhenVideoRemovalTaskPayload,
) {
  const response = await axios.post(
    `${WUHEI_SERVER_BASE_URL}/api/wuhen/video-removal/create`,
    payload,
  );

  return response.data as {
    success: boolean;
    data: {
      taskId: string;
      status: WuhenTaskStatus;
      resultVideoUrl: string;
    };
  };
}

export async function getWuhenVideoRemovalTaskStatus(taskId: string) {
  const response = await axios.get(
    `${WUHEI_SERVER_BASE_URL}/api/wuhen/video-removal/status`,
    {
      params: { taskId },
    },
  );

  return response.data as {
    success: boolean;
    data: WuhenVideoRemovalTaskRecord;
  };
}
