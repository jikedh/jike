import { jikeingService, SKIP_AUTH_HEADER } from "service/aiRequest";
import {
  getJikeingToken,
  getJikeingUserId,
  getJikeingUserInfo,
} from "shared/utils/utils";
import type {
  CreateVideoEnhanceTaskRequest,
  VideoEnhanceResolution,
  VideoEnhanceScene,
  VideoEnhanceStatus,
  VideoEnhanceTaskResponse,
  VideoEnhanceToolVersion,
} from "@/api/jikeGo";

const JIKE_GO_BASE_URL =
  import.meta.env.VITE_JIKE_GO_BASE_URL || "http://localhost:9181";

const getJikeGoAuthHeaders = () => {
  const token = getJikeingToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ===================== 埋点数据类型定义 =====================

export type VideoEnhanceTrackStatus = "PENDING" | "SUCCESS" | "FAIL";

export interface VideoEnhanceTrackData {
  userId: string;
  userUuid?: string;
  apiName: string;
  model: string;
  taskId: string;
  responseTaskId?: string;
  videoUrl: string;
  scene?: VideoEnhanceScene;
  toolVersion?: VideoEnhanceToolVersion;
  originalResolution?: string;
  targetResolution?: VideoEnhanceResolution;
  resolutionLimit?: number;
  fps?: number;
  durationMs?: number;
  outputResolution?: string;
  outputFps?: number;
  generatedVideoUrl?: string;
  requestParams?: Record<string, unknown>;
  provider?: string;
  status: VideoEnhanceTrackStatus;
  errorMessage?: string;
  scoreCost?: number;
  timestamp: number;
}

// ===================== 埋点服务 =====================

/**
 * AI 视频超清处理埋点服务
 * 用于采集并发送视频超清处理相关的埋点数据
 */
class AIVideoEnhanceTrackingService {
  /**
   * 发送埋点数据（创建任务时调用）
   */
  async track(
    data: Omit<VideoEnhanceTrackData, "userId" | "timestamp">,
  ): Promise<void> {
    try {
      const trackData: VideoEnhanceTrackData = {
        ...data,
        userId: this.getCurrentUserId(),
        userUuid: this.getCurrentUserUuid(),
        timestamp: Date.now(),
      };

      await jikeingService({
        baseURL: JIKE_GO_BASE_URL,
        url: "/v1/ai/video-enhance/track",
        method: "post",
        data: {
          userId: trackData.userId,
          userUuid: trackData.userUuid,
          apiName: trackData.apiName,
          model: trackData.model,
          taskId: trackData.taskId,
          responseTaskId: trackData.responseTaskId,
          videoUrl: trackData.videoUrl,
          scene: trackData.scene,
          toolVersion: trackData.toolVersion,
          originalResolution: trackData.originalResolution,
          targetResolution: trackData.targetResolution,
          resolutionLimit: trackData.resolutionLimit,
          fps: trackData.fps,
          durationMs: trackData.durationMs,
          outputResolution: trackData.outputResolution,
          outputFps: trackData.outputFps,
          generatedVideoUrl: trackData.generatedVideoUrl,
          requestParams: trackData.requestParams
            ? JSON.stringify(trackData.requestParams)
            : undefined,
          provider: trackData.provider,
          status: trackData.status,
          errorMessage: trackData.errorMessage,
          scoreCost: trackData.scoreCost,
          createTime: trackData.timestamp,
        },
        headers: {
          ...getJikeGoAuthHeaders(),
          [SKIP_AUTH_HEADER]: "true",
        },
      });
    } catch (error) {
      console.error("[AIVideoEnhanceTracking] 埋点数据发送失败:", error);
    }
  }

  /**
   * 更新埋点状态（任务完成后调用）
   */
  async updateStatus(
    taskId: string,
    status: VideoEnhanceTrackStatus,
    result?: {
      errorMessage?: string;
      generatedVideoUrl?: string;
      durationMs?: number;
      outputResolution?: string;
      outputFps?: number;
    },
  ): Promise<void> {
    if (!taskId || status === "PENDING") {
      return;
    }

    try {
      await jikeingService({
        baseURL: JIKE_GO_BASE_URL,
        url: "/v1/ai/video-enhance/track/status",
        method: "post",
        data: {
          taskId,
          status,
          errorMessage: result?.errorMessage,
          generatedVideoUrl: result?.generatedVideoUrl,
          durationMs: result?.durationMs,
          outputResolution: result?.outputResolution,
          outputFps: result?.outputFps,
          updateTime: Date.now(),
        },
        headers: {
          ...getJikeGoAuthHeaders(),
          [SKIP_AUTH_HEADER]: "true",
        },
      });
    } catch (error) {
      console.error("[AIVideoEnhanceTracking] 状态更新失败:", error);
    }
  }

  /**
   * 从 createTask 响应中提取追踪数据
   */
  buildTrackDataFromCreateRequest(
    taskId: string,
    responseTaskId: string,
    requestData: CreateVideoEnhanceTaskRequest,
    provider?: string,
    scoreCost?: number,
  ): Omit<VideoEnhanceTrackData, "userId" | "timestamp"> {
    return {
      apiName: "/v1/ai/video-enhance/create-task",
      model: requestData.tool_version || "standard",
      taskId,
      responseTaskId,
      videoUrl: requestData.video_url,
      scene: requestData.scene,
      toolVersion: requestData.tool_version,
      originalResolution: undefined,
      targetResolution: requestData.resolution,
      resolutionLimit: requestData.resolution_limit,
      fps: requestData.fps,
      requestParams: {
        video_url: requestData.video_url,
        video_duration: requestData.video_duration,
        scene: requestData.scene,
        tool_version: requestData.tool_version,
        resolution: requestData.resolution,
        resolution_limit: requestData.resolution_limit,
        fps: requestData.fps,
      },
      provider: provider || "video_enhance",
      status: "PENDING",
      scoreCost,
    };
  }

  /**
   * 从 queryTask 响应中提取状态更新数据
   */
  buildStatusUpdateFromQueryResponse(
    taskId: string,
    response: VideoEnhanceTaskResponse,
  ): {
    status: VideoEnhanceTrackStatus;
    result: {
      errorMessage?: string;
      generatedVideoUrl?: string;
      durationMs?: number;
      outputResolution?: string;
      outputFps?: number;
    };
  } {
    const statusMap: Record<VideoEnhanceStatus, VideoEnhanceTrackStatus> = {
      running: "PENDING",
      succeeded: "SUCCESS",
      failed: "FAIL",
    };

    return {
      status: statusMap[response.status] || "PENDING",
      result: {
        errorMessage: response.error,
        generatedVideoUrl: response.video_url,
        durationMs: response.duration_ms,
        outputResolution: response.output_resolution,
        outputFps: response.output_fps,
      },
    };
  }

  /**
   * 获取当前用户ID
   */
  private getCurrentUserId(): string {
    const userInfo = getJikeingUserInfo();
    return String(
      userInfo?.userId || userInfo?.id || getJikeingUserId() || "UNKNOWN",
    );
  }

  /**
   * 获取当前用户UUID
   */
  private getCurrentUserUuid(): string | undefined {
    const userInfo = getJikeingUserInfo();
    const uuid = userInfo?.uuid || userInfo?.userUuid || getJikeingUserId();
    return uuid ? String(uuid) : undefined;
  }

  /**
   * 验证必填参数
   */
  validateParams(params: {
    model?: string;
    taskId?: string;
    apiName?: string;
  }): { valid: boolean; error?: string } {
    if (!params.model) {
      return { valid: false, error: "model 参数必填" };
    }
    if (!params.taskId) {
      return { valid: false, error: "taskId 参数必填" };
    }
    if (!params.apiName) {
      return { valid: false, error: "apiName 参数必填" };
    }
    return { valid: true };
  }
}

export const aiVideoEnhanceTrackingService =
  new AIVideoEnhanceTrackingService();
