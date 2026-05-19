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
