/**
 * 管理端积分接口
 * 对应 jikeing-web/src/api/manager/score.ts
 */

import { jikeingAdminService } from "service/aiRequest";
import type {
  AdminAddScoreRequest,
  AdminAddScoreResponse,
  GetUserScoreByUuidResponse,
  GetScoreConfigResponse,
} from "shared/types/api/score";

// 环境变量配置的基础路径
const ADMIN_BASE_API = import.meta.env.VITE_JAVA_ADMIN_BASE_API || "";

/** 管理员加积分 */
export function addScore(
  params: AdminAddScoreRequest,
): Promise<AdminAddScoreResponse> {
  return jikeingAdminService({
    baseURL: ADMIN_BASE_API,
    url: "/userscore/v1/add-score",
    method: "get",
    params,
  });
}

/** 按 UUID 查询用户积分 */
export function getUserScore(params: {
  uuid: string;
}): Promise<GetUserScoreByUuidResponse> {
  return jikeingAdminService({
    baseURL: ADMIN_BASE_API,
    url: "/userscore/v1/get-user-score",
    method: "get",
    params,
  });
}

/** 管理员获取积分配置 */
export function adminGetScoreConfig(): Promise<GetScoreConfigResponse> {
  return jikeingAdminService({
    baseURL: ADMIN_BASE_API,
    url: "/userscore/v1/get-score-config",
    method: "get",
  });
}
