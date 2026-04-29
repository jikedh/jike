// 积分相关类型定义

/** 积分配置 */
export interface ScoreConfig {
  dailySignReward: number; // 签到奖励积分
  aiGenPrice: number; // AI生成消耗
  imageSplitPrice: number; // 图片处理消耗
}

/** 用户积分余额视图对象 */
export interface UserScoreVO {
  forScore: number; // 永久积分
  vipScore: number; // 会员积分
  userId: number; // 用户ID
  id: number; // 记录ID
  todayResigned: boolean; // 当天是否已签到
}

/** 用户积分记录实体 */
export interface UserScoreRecordEntity {
  id: number; // 记录ID（自增）
  userId: number; // 用户ID
  type: string; // 变更类型（对应 UserScoreUpdateEnum）
  memo: string; // 变更说明
  vipScore: number; // 本次变更的会员积分
  forScore: number; // 本次变更的永久积分
  vipBalanceScore: number; // 变更后会员积分余额
  forBalanceScore: number; // 变更后永久积分余额
  createTime: number; // 创建时间戳（秒）
}

/** 通用 API 响应壳 */
export interface ApiResponse<T = any> {
  code: number; // 状态码
  msg: string; // 提示信息
  data: T; // 业务数据
}

/** 内部添加积分请求 */
export interface InnerAddUserScoreRequest {
  userId: string; // 用户ID，必填
  score: number; // 积分变更值，可正可负
}

/** 管理员添加积分请求 */
export interface AdminAddScoreRequest {
  toUserId: string; // 用户ID
  score: number; // 积分变更值
}

/** 积分变更类型枚举 */
export enum UserScoreUpdateEnum {
  CONSUME = "CONSUME", // 消费
  DAILY_SIGN = "DAILY_SIGN", // 每日签到
  BUY_SCORE = "BUY_SCORE", // 购买积分
  RESET = "RESET", // 积分重置
  INIT = "INIT", // 初始化积分
  BUY_VIP = "BUY_VIP", // 购买会员
  ADMIN_ADD_SCORE = "ADMIN_ADD_SCORE", // 管理员添加积分
  ADMIN_ADD_VIP = "ADMIN_ADD_VIP", // 管理员添加会员积分
  CLEAR = "CLEAR", // 系统清零
  VIP_EXPIRED = "VIP_EXPIRED", // 会员过期
}
