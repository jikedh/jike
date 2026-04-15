/**
 * 管理端用户接口
 * 对应 jikeing-web/src/api/manager/user.js
 */

import { jikeingAdminService } from "service/aiRequest";
import type {
  GetMemberInfoByUuidResponse,
  AddVipRequest,
  AddVipResponse,
} from "shared/types/api/user";

// 环境变量配置的基础路径
const ADMIN_BASE_API = import.meta.env.VITE_JAVA_ADMIN_BASE_API || "";

/** 按 UUID 查询会员信息 */
export function getUserInfoByUUid(params: {
  uuid: string;
}): Promise<GetMemberInfoByUuidResponse> {
  return jikeingAdminService({
    baseURL: ADMIN_BASE_API,
    url: "/user/v1/get-member-info-by-uuid",
    method: "get",
    params,
  });
}

/** 设置会员权益 */
export function updateMemberInfo(data: AddVipRequest): Promise<AddVipResponse> {
  return jikeingAdminService({
    baseURL: ADMIN_BASE_API,
    url: "/user/v1/add-vip",
    method: "get",
    params: data,
  });
}
