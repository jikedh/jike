import { useCallback, useEffect, useMemo, useState } from "react";
import {
  normalizeRequiredPoints,
  POINTS_DISABLED_BALANCE,
  POINTS_FEATURE_ENABLED,
} from "shared/constants/points";
import { getScoreConfig } from "@/api/jikeing";
import { useUserStore } from "@/stores/useUserStore";

type EnsurePointsOptions = {
  requiredPoints: number;
  actionLabel: string;
  warning: (message: string) => void;
  skipBalanceCheck?: boolean;
};

type ValidateBalanceOptions = {
  requiredPoints: number;
  warning: (message: string) => void;
  insufficientMessage?: (
    requiredPoints: number,
    currentTotalPoints: number,
  ) => string;
  failureMessage?: string;
};

export function useGenerationPoints() {
  const loginStatus = useUserStore((state) => state.loginStatus);
  const balanceInfo = useUserStore((state) => state.balanceInfo);
  const fetchBalanceInfo = useUserStore((state) => state.fetchBalanceInfo);
  const setDialogLoginStatus = useUserStore(
    (state) => state.setDialogLoginStatus,
  );

  const [fallbackAIGenPrice, setFallbackAIGenPrice] = useState<number>(12);

  useEffect(() => {
    if (!POINTS_FEATURE_ENABLED) {
      return;
    }

    if (loginStatus === 1 && !balanceInfo) {
      void fetchBalanceInfo();
    }
  }, [balanceInfo, fetchBalanceInfo, loginStatus]);

  useEffect(() => {
    if (!POINTS_FEATURE_ENABLED) {
      return;
    }

    let disposed = false;

    void getScoreConfig()
      .then((res: any) => {
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
    if (!POINTS_FEATURE_ENABLED) {
      return POINTS_DISABLED_BALANCE;
    }

    return (balanceInfo?.forScore ?? 0) + (balanceInfo?.vipScore ?? 0);
  }, [balanceInfo]);

  const ensureEnoughPoints = useCallback(
    ({
      requiredPoints,
      actionLabel,
      warning,
      skipBalanceCheck,
    }: EnsurePointsOptions) => {
      const normalizedRequiredPoints = normalizeRequiredPoints(requiredPoints);
      if (!POINTS_FEATURE_ENABLED || normalizedRequiredPoints <= 0) {
        return true;
      }

      if (loginStatus !== 1) {
        warning(`请先登录后再${actionLabel}`);
        setDialogLoginStatus(true);
        return false;
      }

      if (skipBalanceCheck) {
        return true;
      }

      if (totalPoints < normalizedRequiredPoints) {
        warning(
          `积分不足，当前剩余 ${totalPoints} 积分，${actionLabel}需要 ${normalizedRequiredPoints} 积分`,
        );
        return false;
      }

      return true;
    },
    [loginStatus, setDialogLoginStatus, totalPoints],
  );

  const validateBalanceBeforeGenerate = useCallback(
    async ({
      requiredPoints,
      warning,
      insufficientMessage,
      failureMessage = "积分校验失败，请稍后重试",
    }: ValidateBalanceOptions) => {
      const normalizedRequiredPoints = normalizeRequiredPoints(requiredPoints);
      if (!POINTS_FEATURE_ENABLED || normalizedRequiredPoints <= 0) {
        return true;
      }

      try {
        await fetchBalanceInfo();
        const latestBalanceInfo = useUserStore.getState().balanceInfo;
        const currentForScore = Number(latestBalanceInfo?.forScore ?? 0);
        const currentVipScore = Number(latestBalanceInfo?.vipScore ?? 0);
        const currentTotalPoints = currentForScore + currentVipScore;

        if (currentTotalPoints < normalizedRequiredPoints) {
          warning(
            insufficientMessage?.(
              normalizedRequiredPoints,
              currentTotalPoints,
            ) ??
            `积分不足，当前剩余 ${currentTotalPoints} 积分，当前生成需 ${normalizedRequiredPoints} 积分`,
          );
          return false;
        }

        return true;
      } catch {
        warning(failureMessage);
        return false;
      }
    },
    [fetchBalanceInfo],
  );

  const refreshBalanceInfo = useCallback(async () => {
    if (!POINTS_FEATURE_ENABLED) {
      return null;
    }

    return fetchBalanceInfo();
  }, [fetchBalanceInfo]);

  return {
    pointsEnabled: POINTS_FEATURE_ENABLED,
    totalPoints,
    fallbackAIGenPrice: POINTS_FEATURE_ENABLED ? fallbackAIGenPrice : 0,
    normalizeRequiredPoints,
    refreshBalanceInfo,
    ensureEnoughPoints,
    validateBalanceBeforeGenerate,
  };
}
