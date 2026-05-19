import axios from "axios";
import type {
  CreateWuhenVideoRemovalTaskPayload,
  WuhenTaskStatus,
  WuhenVideoRemovalTaskRecord,
} from "shared/types/api/wuhen";
export type {
  CreateWuhenVideoRemovalTaskPayload,
  WuhenRect,
  WuhenTaskStatus,
  WuhenVideoRemovalTaskRecord,
} from "shared/types/api/wuhen";
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
