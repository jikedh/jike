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

/** 签到响应 */
export interface DailyResignResponse {
  code: number;
  msg?: string;
  data?: {
    score: number; // 获得的积分数
    totalScore: number; // 签到后总积分
    连续签到天数?: number;
  };
}

// ===================== 管理端积分 =====================

/** 管理员添加积分请求 */
export interface AdminAddScoreRequest {
  toUserId: string;
  score: number;
  memo?: string;
}

/** 管理员添加积分响应 */
export interface AdminAddScoreResponse {
  code: number;
  msg?: string;
  data?: {
    beforeScore: number;
    afterScore: number;
    changeScore: number;
  };
}

/** 按 UUID 查询用户积分响应 */
export interface GetUserScoreByUuidResponse {
  code: number;
  msg?: string;
  data?: {
    uuid: string;
    forScore: number;
    vipScore: number;
    totalScore: number;
    todayResigned: boolean;
    连续签到天数?: number;
  };
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
