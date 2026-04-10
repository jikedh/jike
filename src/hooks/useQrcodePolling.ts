import { useRef, useCallback, useEffect } from "react";
import { querySceneStatus } from "@/api/ai";
import { type LoginResponse } from "@/types/jikeing";
import { setJikeingToken, setJikeingUserId } from "@/utils/utils";

// 轮询配置常量
const POLLING_INTERVAL = 2000;

interface UseQrcodePollingOptions {
  onSuccess: (token: string, userId?: string) => void;
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
          console.log("[轮询结果]", res);

          if (res.code === 200 && res.data?.token) {
            stopPolling();
            console.log(
              "[登录成功] token:",
              res.data.token.substring(0, 20) + "...",
            );
            console.log("[登录成功] userId:", res.data.id);
            setJikeingToken(res.data.token);
            if (res.data.id) {
              setJikeingUserId(res.data.id);
            }
            onSuccess(res.data.token, res.data.id?.toString());
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
