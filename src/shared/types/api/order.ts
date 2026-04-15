/**
 * 订单模块类型定义
 */

// ===================== 管理端订单 =====================

/** 订单项 */
export interface OrderItem {
  id: string;
  orderNo: string;
  userId: string;
  userName?: string;
  userNickname?: string;
  productName: string;
  productType: string;
  payAmount: number;
  payStatus: "pending" | "paid" | "refunded" | "cancelled";
  payTime?: number;
  createTime: number;
}

/** 用户已支付订单列表响应 */
export interface UserPayedOrderListResponse {
  code: number;
  msg?: string;
  data: {
    list: OrderItem[];
    total: number;
    page: number;
    pageSize: number;
  };
}

/** 查询用户订单请求 */
export interface SelectUserOrderListRequest {
  uuid?: string;
  userId?: string;
  orderNo?: string;
  payStatus?: string;
  startTime?: string;
  endTime?: string;
  page?: number;
  pageSize?: number;
}
