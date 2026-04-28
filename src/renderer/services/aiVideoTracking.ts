import { jikeingRequest } from "service/aiRequest";

export interface AIVideoTrackData {
  userId: string;
  userUuid?: string;
  apiName: string;
  model: string;
  taskId: string;
  prompt?: string;
  provider?: string;
  requestParams?: Record<string, unknown>;
  status: "SUCCESS" | "FAIL" | "PENDING";
  timestamp: number;
}

/**
 * AI 视频生成埋点服务
 * 用于采集并发送视频生成相关的埋点数据
 */
class AIVideoTrackingService {
  /**
   * 发送埋点数据
   */
  async track(data: Omit<AIVideoTrackData, "userId" | "timestamp">): Promise<void> {
    try {
      const trackData: AIVideoTrackData = {
        ...data,
        userId: this.getCurrentUserId(),
        timestamp: Date.now(),
      };

      await jikeingRequest({
        url: "/sorotask/v1/track",
        method: "post",
        data: {
          ...trackData,
          userUuid: this.getCurrentUserUuid(),
          requestParams: trackData.requestParams
            ? JSON.stringify(trackData.requestParams)
            : undefined,
          createTime: trackData.timestamp,
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
    status: "SUCCESS" | "FAIL" | "PENDING",
    errorMessage?: string,
  ): Promise<void> {
    try {
      await window.tracking.updateStatus(taskId, status, errorMessage);
    } catch (error) {
      console.error("[AIVideoTracking] 状态更新失败:", error);
    }
  }

  /**
   * 获取当前用户ID
   */
  private getCurrentUserId(): string {
    // 从 localStorage 或其他方式获取用户ID
    const userInfo = localStorage.getItem("userInfo");
    if (userInfo) {
      try {
        const parsed = JSON.parse(userInfo);
        return parsed.userId || parsed.id || "UNKNOWN";
      } catch {
        return "UNKNOWN";
      }
    }
    return "UNKNOWN";
  }

  /**
   * 获取当前用户UUID
   */
  private getCurrentUserUuid(): string | undefined {
    const userInfo = localStorage.getItem("userInfo");
    if (userInfo) {
      try {
        const parsed = JSON.parse(userInfo);
        return parsed.uuid || parsed.userUuid;
      } catch {
        return undefined;
      }
    }
    return undefined;
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
