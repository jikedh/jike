// 积分相关 API 接口
// 基于 score-api-analysis.md 文档生成

import { jikeingService } from "service/aiRequest";
import {
  CreateRechargeOrderRequest,
  CreateRechargeOrderResponse,
  GetRechargeOrderStatusResponse,
  GetScoreBalanceResponse,
  UpdateVipScoreRequest,
  UpdateVipScoreResponse,
} from "shared/types/api/score";
import { getJikeingUserId } from "shared/utils/utils";

// ===================== 用户侧 API（jike-web-api）/userscore/v1 =====================

/**
 * 获取积分配置
 * 不需要登录认证
 */
export function getScoreConfig(): any {
  return jikeingService({
    url: "/userscore/v1/get-score-config",
    method: "get",
  });
}

/**
 * 查询当前用户积分余额和今日签到状态
 */
export function getBalanceInfo(): Promise<GetScoreBalanceResponse> {
  return jikeingService({
    url: "/userscore/v1/balance-info",
    method: "get",
  });
}

/**
 * 更新会员积分
 * Header: x-token(由 jikeingService 拦截器自动注入) + X-User-Id
 * Body: { userId, vipScoreDelta }
 */
export function updateVipScore(
  data: UpdateVipScoreRequest,
): Promise<UpdateVipScoreResponse> {
  const loginUserId = getJikeingUserId();

  // 前置校验：body.userId 必须与登录用户一致
  if (!loginUserId || String(data.userId) !== String(loginUserId)) {
    return Promise.reject(new Error("请求用户与登录用户不一致"));
  }

  return jikeingService({
    url: "/userscore/v1/update-vip-score",
    method: "post",
    data: {
      userId: data.userId,
      vipScoreDelta: data.vipScoreDelta,
    },
    headers: {
      "X-User-Id": String(loginUserId),
    },
  });
}

// ===================== 充值订单 API（jike-web-api）/recharge/v1 =====================

/**
 * 创建充值订单（微信 Native 扫码支付）
 * @param data - { userId: string, packageId: string }
 */
export function createRechargeOrder(
  data: CreateRechargeOrderRequest,
): Promise<CreateRechargeOrderResponse> {
  return jikeingService({
    url: "/recharge/v1/native/create",
    method: "post",
    data,
  });
}

/**
 * 查询充值订单状态
 * @param orderId - 订单号
 */
export function getRechargeOrderStatus(
  orderId: string,
): Promise<GetRechargeOrderStatusResponse> {
  return jikeingService({
    url: "/recharge/v1/native/status",
    method: "get",
    params: { orderId },
  });
}

