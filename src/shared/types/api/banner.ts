/**
 * 轮播图模块类型定义
 */

// ===================== 用户端轮播图 =====================

/** 轮播图项 */
export interface BannerItem {
    id: string;
    title: string;
    image: string;
    link?: string;
    type?: string;
    sort?: number;
    createTime?: number;
}

/** 轮播图列表响应 */
export interface BannersListResponse {
    list: BannerItem[];
}

// ===================== 管理端轮播图 =====================

/** 轮播图列表项（管理端） */
export interface AdminBannerItem {
    id: string;
    title: string;
    image: string;
    link?: string;
    type: number;
    sort: number;
    status: number;
    createTime: string;
    updateTime?: string;
}

/** 轮播图列表响应（管理端） */
export interface AdminBannersListResponse {
    list: AdminBannerItem[];
    total: number;
    page: number;
    pageSize: number;
}

/** 创建轮播图请求 */
export interface CreateBannerRequest {
    title: string;
    image: string;
    link?: string;
    type?: number;
    sort?: number;
    status?: number;
}

/** 更新轮播图请求 */
export interface UpdateBannerRequest extends CreateBannerRequest {
    id: string;
}

/** 轮播图详情响应 */
export interface BannerDetailResponse extends AdminBannerItem { }
