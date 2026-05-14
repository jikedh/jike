import { jikeingRequest } from "service/aiRequest";
import { getJikeingUserId, getJikeingUserInfo } from "shared/utils/utils";

export interface AIVideoTrackData {
  userId: string;
  userUuid?: string;
  apiName: string;
  model: string;
  taskId: string;
  prompt?: string;
  duration?: number;
  referenceImageUrls?: string[];
  provider?: string;
  requestParams?: Record<string, unknown>;
  generatedVideoUrl?: string;
  status: "SUCCESS" | "FAIL" | "PENDING";
  timestamp: number;
  scoreCost?: number;
}

type AIVideoTrackStatus = AIVideoTrackData["status"];

type AIVideoTrackStatusResponse = {
  data?: {
    generated_video_url?: string;
    generatedVideoUrl?: string;
  };
};

/**
 * AI 视频生成埋点服务
 * 用于采集并发送视频生成相关的埋点数据
 */
class AIVideoTrackingService {
  /**
   * 发送埋点数据
   */
  async track(
    data: Omit<AIVideoTrackData, "userId" | "timestamp">,
  ): Promise<void> {
    try {
      const trackData: AIVideoTrackData = {
        ...data,
        userId: this.getCurrentUserId(),
        userUuid: this.getCurrentUserUuid(),
        timestamp: Date.now(),
      };

      await jikeingRequest({
        url: "/sorotask/v1/track",
        method: "post",
        data: {
          userId: trackData.userId,
          userUuid: trackData.userUuid,
          apiName: trackData.apiName,
          model: trackData.model,
          taskId: trackData.taskId,
          prompt: trackData.prompt,
          provider: trackData.provider,
          responseTaskId: trackData.taskId,
          status: trackData.status,
          requestParams: trackData.requestParams
            ? JSON.stringify(trackData.requestParams)
            : undefined,
          duration: trackData.duration,
          reference_image_url: trackData.referenceImageUrls,
          createTime: trackData.timestamp,
          scoreCost: trackData.scoreCost,
        },
      });

      if (window.tracking) {
        await window.tracking.send(trackData);
      }
    } catch (error) {
      console.error("[AIVideoTracking] 埋点数据发送失败:", error);
    }
  }

  /**
   * 更新埋点状态
   */
  async updateStatus(
    taskId: string,
    status: AIVideoTrackStatus,
    errorMessage?: string,
    generatedVideoUrl?: string,
  ): Promise<{ generatedVideoUrl?: string } | void> {
    if (!taskId || status === "PENDING") {
      return;
    }

    try {
      const response = await jikeingRequest<AIVideoTrackStatusResponse>({
        url: "/sorotask/v1/track/status",
        method: "post",
        data: {
          taskId,
          status,
          errorMessage,
          generated_video_url: generatedVideoUrl,
          updateTime: Date.now(),
        },
      });

      if (window.tracking) {
        await window.tracking.updateStatus(
          taskId,
          status,
          errorMessage,
          generatedVideoUrl,
        );
      }
      return {
        generatedVideoUrl:
          response.data?.generated_video_url ||
          response.data?.generatedVideoUrl,
      };
    } catch (error) {
      console.error("[AIVideoTracking] 状态更新失败:", error);
    }
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

export const aiVideoTrackingService = new AIVideoTrackingService();
