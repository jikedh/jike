import { useCallback, useState } from "react";
import {
  type CreateVideoEnhanceTaskRequest,
  createVideoEnhanceTask,
  queryVideoEnhanceTask,
  type VideoEnhanceTaskResponse,
} from "@/api/jikeGo";
import { aiVideoEnhanceTrackingService } from "@/services/aiVideoEnhanceTracking";

type TaskState = {
  taskId: string | null;
  status: "idle" | "creating" | "pending" | "succeeded" | "failed";
  result: VideoEnhanceTaskResponse | null;
  error: string | null;
};

/**
 * 视频超清处理 Hook — 封装 createVideoEnhanceTask / queryVideoEnhanceTask 及埋点追踪
 */
export function useVideoEnhanceTask() {
  const [state, setState] = useState<TaskState>({
    taskId: null,
    status: "idle",
    result: null,
    error: null,
  });

  /**
   * 发起画质增强任务（含埋点 PENDING 记录）
   */
  const enhanceVideo = useCallback(
    async (request: CreateVideoEnhanceTaskRequest, provider?: string) => {
      setState((prev) => ({ ...prev, status: "creating", error: null }));

      try {
        const res = await createVideoEnhanceTask(request);
        const data = res as any;
        const taskId = data?.task_id || data?.data?.task_id || "";

        if (!taskId) {
          throw new Error("未获取到任务 ID");
        }

        setState((prev) => ({
          ...prev,
          taskId,
          status: "pending",
          error: null,
        }));

        // 埋点：创建任务
        await aiVideoEnhanceTrackingService.track(
          aiVideoEnhanceTrackingService.buildTrackDataFromCreateRequest(
            taskId,
            taskId,
            request,
            provider,
          ),
        );

        return taskId;
      } catch (error: any) {
        const errorMsg = error?.message || String(error);

        setState((prev) => ({
          ...prev,
          status: "failed",
          error: errorMsg,
        }));

        // 埋点：创建失败
        if (errorMsg !== "未获取到任务 ID") {
          await aiVideoEnhanceTrackingService.track({
            apiName: "/v1/ai/video-enhance/create-task",
            model: request.tool_version || "standard",
            taskId: "unknown",
            videoUrl: request.video_url,
            scene: request.scene,
            toolVersion: request.tool_version,
            targetResolution: request.resolution,
            requestParams: request as unknown as Record<string, unknown>,
            provider: provider || "video_enhance",
            status: "FAIL",
            errorMessage: errorMsg,
          });
        }

        throw error;
      }
    },
    [],
  );

  /**
   * 查询任务状态（含埋点状态更新）
   */
  const queryTaskStatus = useCallback(
    async (taskId: string): Promise<VideoEnhanceTaskResponse | null> => {
      try {
        const res = await queryVideoEnhanceTask({ task_id: taskId });
        const data = res as any;
        const resp: VideoEnhanceTaskResponse = {
          task_id: data?.task_id || taskId,
          status: data?.status || "running",
          video_url: data?.video_url,
          error: data?.error,
          duration_ms: data?.duration_ms,
          output_resolution: data?.output_resolution,
          output_fps: data?.output_fps,
          tool_version: data?.tool_version,
          billing_amount: data?.billing_amount,
        };

        setState((prev) => ({
          ...prev,
          result: resp,
          status:
            resp.status === "succeeded"
              ? "succeeded"
              : resp.status === "failed"
                ? "failed"
                : prev.status,
          error: resp.error || prev.error,
        }));

        // 埋点：更新状态（仅终态时）
        if (resp.status === "succeeded" || resp.status === "failed") {
          const statusUpdate =
            aiVideoEnhanceTrackingService.buildStatusUpdateFromQueryResponse(
              taskId,
              resp,
            );
          await aiVideoEnhanceTrackingService.updateStatus(
            taskId,
            statusUpdate.status,
            statusUpdate.result,
          );
        }

        return resp;
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        setState((prev) => ({
          ...prev,
          status: "failed",
          error: errorMsg,
        }));

        // 埋点：查询异常
        await aiVideoEnhanceTrackingService.updateStatus(taskId, "FAIL", {
          errorMessage: errorMsg,
        });

        throw error;
      }
    },
    [],
  );

  /**
   * 轮询任务直到完成或失败
   */
  const pollUntilComplete = useCallback(
    async (
      taskId: string,
      intervalMs = 5000,
      timeoutMs = 2 * 60 * 60 * 1000,
    ): Promise<VideoEnhanceTaskResponse | null> => {
      const startTime = Date.now();

      while (Date.now() - startTime < timeoutMs) {
        const resp = await queryTaskStatus(taskId);
        if (!resp) return null;

        if (resp.status === "succeeded" || resp.status === "failed") {
          return resp;
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }

      throw new Error("任务超时");
    },
    [queryTaskStatus],
  );

  return {
    ...state,
    enhanceVideo,
    queryTaskStatus,
    pollUntilComplete,
  };
}
