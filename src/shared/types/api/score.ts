/**
 * 积分模块类型定义
 */

// ===================== 用户端积分 =====================

/** 用户积分余额信息 */
export interface UserScoreBalance {
  forScore: number; // 永久积分
  vipScore: number; // 会员积分
  userId: number;
  id: number;
  todayResigned: boolean; // 当天是否已签到
}

/** 获取积分余额响应 */
export interface GetScoreBalanceResponse {
  code: number;
  msg?: string;
  data: UserScoreBalance;
}

/** 更新会员积分请求 */
export interface UpdateVipScoreRequest {
  userId: string | number;
  vipScoreDelta: number;
}

/** 更新会员积分响应 */
export interface UpdateVipScoreResponse {
  code: number;
  msg?: string;
  data?: any;
}

/** 积分配置 */
export interface ScoreConfig {
  dailySignReward: number;
  aiGenPrice: number;
  imageSplitPrice: number;
  // 其他配置项...
}

/** 获取积分配置响应 */
export interface GetScoreConfigResponse {
  code: number;
  msg?: string;
  data: ScoreConfig;
}

// ===================== 充值订单 =====================

/** 创建充值订单请求 */
export interface CreateRechargeOrderRequest {
  userId: string;
  packageId?: string; // pkg_600, pkg_6000, pkg_18000, pkg_60000
  customAmountFen?: number; // 自定义充值金额，单位：分
}

/** 创建充值订单响应 */
export interface CreateRechargeOrderResponse {
  code: number;
  msg?: string;
  data?: {
    orderId: string;
    codeUrl: string; // 微信支付二维码链接
    points: number;
    amountFen: number;
  };
}

/** 查询订单状态响应 */
export interface GetRechargeOrderStatusResponse {
  code: number;
  msg?: string;
  data?: {
    orderId: string;
    status: "CREATED" | "PAID" | "CLOSED";
    tradeState?: string;
    credited?: boolean;
    creditError?: string | null;
    forBalanceScore?: number;
    vipBalanceScore?: number;
  };
}
