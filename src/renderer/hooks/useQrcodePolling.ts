import { useCallback, useEffect, useRef } from "react";
import { type LoginResponse } from "shared/types/jikeing";
import { setJikeingToken, setJikeingUserId } from "shared/utils/utils";
import { querySceneStatus } from "@/api/jikeGo";

// 轮询配置常量
const POLLING_INTERVAL = 2000;

interface UseQrcodePollingOptions {
  onSuccess: (token: string, userId?: string) => void | Promise<void>;
}

export const useQrcodePolling = ({ onSuccess }: UseQrcodePollingOptions) => {
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // 启动轮询
  const startPolling = useCallback(
    (sceneId: string) => {
      stopPolling();

      pollingRef.current = setInterval(async () => {
        try {
          const res: LoginResponse = await querySceneStatus(sceneId);

          if (res.code === 200 && res.data?.token) {
            stopPolling();
            setJikeingToken(res.data.token);
            if (res.data.id) {
              setJikeingUserId(res.data.id);
            }
            await onSuccess(res.data.token, res.data.id?.toString());
          }
        } catch (error) {
          console.error("[登录] 查询状态失败:", error);
        }
      }, POLLING_INTERVAL);
    },
    [stopPolling, onSuccess],
  );

  // 组件卸载时清理
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return { startPolling, stopPolling };
};
