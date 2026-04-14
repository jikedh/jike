// 积分相关 API 接口
// 基于 score-api-analysis.md 文档生成

import { jikeingAdminService, jikeingService } from 'service/aiRequest';
import { GetScoreBalanceResponse } from 'shared/types/api/score';

// ===================== 用户侧 API（jike-web-api）/userscore/v1 =====================

/**
 * 每日签到
 * 发放签到积分，有幂等控制
 */
export function dailyResign(): any {
  return jikeingService({
    url: '/userscore/v1/daily-resign',
    method: 'get',
  });
}

/**
 * 初始化积分
 * 固定发放 300 积分
 * ⚠️ 注意：当前代码未看到幂等限制
 */
export function initScore(): any {
  return jikeingService({
    url: '/userscore/v1/init',
    method: 'get',
  });
}

/**
 * 获取积分配置
 * 不需要登录认证
 */
export function getScoreConfig(): any {
  return jikeingService({
    url: '/userscore/v1/get-score-config',
    method: 'get',
  });
}

/**
 * 查询当前用户积分余额和今日签到状态
 */
export function getBalanceInfo(): Promise<GetScoreBalanceResponse> {
  return jikeingService({
    url: '/userscore/v1/balance-info',
    method: 'get',
  });
}

// ===================== 管理侧 API（jike-admin-api）/userscore/v1 =====================
// 管理侧积分接口已迁移至 manager/score.ts
// import { addScore, getUserScore, adminGetScoreConfig } from './manager/score'

// ===================== 内部接口（jike-web-api）/inner =====================

/**
 * 内部添加积分接口
 * 管理侧加积分的真实执行接口
 * @param data - { userId: string, score: number }
 */
export function innerAddUserScore(data: { userId: string; score: number }): any {
  return jikeingAdminService({
    url: '/inner/addUserScore',
    method: 'post',
    data,
  });
}
