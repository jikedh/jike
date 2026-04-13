/**
 * 管理端轮播图接口
 * 对应 jikeing-web/src/api/manager/banner.js
 */

import { jikeingAdminService } from "service/aiRequest";
import type {
    AdminBannersListResponse,
    BannerDetailResponse,
    CreateBannerRequest,
    UpdateBannerRequest,
} from "shared/types/api/banner";

/** 轮播图列表 */
export function bannersList(params?: {
    page?: number;
    pageSize?: number;
}): Promise<AdminBannersListResponse> {
    return jikeingAdminService({
        url: "/admin/v1/banner/list",
        method: "get",
        params,
    });
}

/** 创建轮播图 */
export function createBanners(
    data: CreateBannerRequest,
): Promise<{ code: number; msg?: string }> {
    return jikeingAdminService({
        url: "/admin/v1/banner/create",
        method: "post",
        data,
    });
}

/** 删除轮播图 */
export function deleteBanners(data: { id: string }): Promise<any> {
    return jikeingAdminService({
        url: "/admin/v1/banner/delete",
        method: "post",
        data,
    });
}

/** 轮播图详情 */
export function bannersDetail(params: {
    id: string;
}): Promise<BannerDetailResponse> {
    return jikeingAdminService({
        url: "/admin/v1/banner/detail",
        method: "get",
        params,
    });
}

/** 更新轮播图 */
export function updateBanners(
    data: UpdateBannerRequest,
): Promise<{ code: number; msg?: string }> {
    return jikeingAdminService({
        url: "/admin/v1/banner/update",
        method: "post",
        data,
    });
}
