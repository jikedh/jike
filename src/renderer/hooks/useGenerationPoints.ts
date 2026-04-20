import { useCallback, useEffect, useMemo, useState } from "react";
import { getScoreConfig } from "@/api/jikeing";
import { useUserStore } from "@/stores/useUserStore";

type EnsurePointsOptions = {
  requiredPoints: number;
  actionLabel: string;
  warning: (message: string) => void;
};

export function useGenerationPoints() {
  const loginStatus = useUserStore((state) => state.loginStatus);
  const balanceInfo = useUserStore((state) => state.balanceInfo);
  const fetchBalanceInfo = useUserStore((state) => state.fetchBalanceInfo);
  const setDialogLoginStatus = useUserStore((state) => state.setDialogLoginStatus);

  const [fallbackAIGenPrice, setFallbackAIGenPrice] = useState<number>(12);

  useEffect(() => {
    if (loginStatus === 1 && !balanceInfo) {
      void fetchBalanceInfo();
    }
  }, [balanceInfo, fetchBalanceInfo, loginStatus]);

  useEffect(() => {
    let disposed = false;

    void getScoreConfig()
      .then((res) => {
        if (disposed) {
          return;
        }

        const price = Number(res?.data?.aiGenPrice);
        if (Number.isFinite(price) && price > 0) {
          setFallbackAIGenPrice(price);
        }
      })
      .catch(() => {
        // 积分兜底值读取失败时保持本地默认值即可
      });

    return () => {
      disposed = true;
    };
  }, []);

  const totalPoints = useMemo(() => {
    return (balanceInfo?.forScore ?? 0) + (balanceInfo?.vipScore ?? 0);
  }, [balanceInfo]);

  const ensureEnoughPoints = useCallback(
    ({ requiredPoints, actionLabel, warning }: EnsurePointsOptions) => {
      if (loginStatus !== 1) {
        warning(`请先登录后再${actionLabel}`);
        setDialogLoginStatus(true);
        return false;
      }

      if (totalPoints < requiredPoints) {
        warning(
          `积分不足，当前剩余 ${totalPoints} 积分，${actionLabel}需要 ${requiredPoints} 积分`,
        );
        return false;
      }

      return true;
    },
    [loginStatus, setDialogLoginStatus, totalPoints],
  );

  return {
    totalPoints,
    fallbackAIGenPrice,
    refreshBalanceInfo: fetchBalanceInfo,
    ensureEnoughPoints,
  };
}
