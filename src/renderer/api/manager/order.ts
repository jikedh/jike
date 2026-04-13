/**
 * 管理端订单接口
 * 对应 jikeing-web/src/api/manager/order.ts
 */

import { jikeingAdminService } from "service/aiRequest";
import type {
    UserPayedOrderListResponse,
    SelectUserOrderListRequest,
} from "shared/types/api/order";

// 环境变量配置的基础路径
const ADMIN_BASE_API = import.meta.env.VITE_JAVA_ADMIN_BASE_API || "";

/** 用户已支付订单列表 */
export function selectUserOrderList(
    params?: SelectUserOrderListRequest,
): Promise<UserPayedOrderListResponse> {
    return jikeingAdminService({
        baseURL: ADMIN_BASE_API,
        url: "/order/v1/user-payed-order-list",
        method: "get",
        params,
    });
}
