/**
 * 管理端文章接口
 * 对应 jikeing-web/src/api/manager/article.js
 */

import { jikeingAdminService } from "service/aiRequest";
import type {
    ArticleListResponse,
    ArticleDetailResponse,
    CreateArticleRequest,
    UpdateArticleRequest,
    ArticleStatusRequest,
    ArticleCategoryListResponse,
    ArticleCategoryDetailResponse,
    CreateArticleCategoryRequest,
    UpdateArticleCategoryRequest,
} from "shared/types/api/article";

// ===================== 文章管理 =====================

/** 文章列表 */
export function articleList(params?: {
    page?: number;
    pageSize?: number;
}): Promise<ArticleListResponse> {
    return jikeingAdminService({
        url: "/admin/v1/articles/list",
        method: "get",
        params,
    });
}

/** 创建文章 */
export function createArticle(
    data: CreateArticleRequest,
): Promise<{ code: number; msg?: string }> {
    return jikeingAdminService({
        url: "/admin/v1/articles/create",
        method: "post",
        data,
    });
}

/** 删除文章 */
export function deleteArticle(data: { id: string }): Promise<any> {
    return jikeingAdminService({
        url: "/admin/v1/articles/delete",
        method: "post",
        data,
    });
}

/** 文章状态修改 */
export function articleStatus(data: ArticleStatusRequest): Promise<any> {
    return jikeingAdminService({
        url: "/admin/v1/articles/status",
        method: "post",
        data,
    });
}

/** 文章详情 */
export function articleDetail(params: {
    id: string;
}): Promise<ArticleDetailResponse> {
    return jikeingAdminService({
        url: "/admin/v1/articles/detail",
        method: "get",
        params,
    });
}

/** 更新文章 */
export function updateArticle(
    data: UpdateArticleRequest,
): Promise<{ code: number; msg?: string }> {
    return jikeingAdminService({
        url: "/admin/v1/articles/update",
        method: "put",
        data,
    });
}

// ===================== 文章分类 =====================

/** 创建文章分类 */
export function createCategory(
    data: CreateArticleCategoryRequest,
): Promise<{ code: number; msg?: string }> {
    return jikeingAdminService({
        url: "/admin/v1/articles/category/create",
        method: "post",
        data,
    });
}

/** 删除文章分类 */
export function deleteCategory(data: { id: string }): Promise<any> {
    return jikeingAdminService({
        url: "/admin/v1/articles/category/delete",
        method: "post",
        data,
    });
}

/** 文章分类列表 */
export function categoryList(): Promise<ArticleCategoryListResponse> {
    return jikeingAdminService({
        url: "/admin/v1/articles/category/list",
        method: "get",
    });
}

/** 文章分类详情 */
export function categoryDetail(params: {
    id: string;
}): Promise<ArticleCategoryDetailResponse> {
    return jikeingAdminService({
        url: "/admin/v1/articles/category/detail",
        method: "get",
        params,
    });
}

/** 更新文章分类 */
export function updateCategory(
    data: UpdateArticleCategoryRequest,
): Promise<{ code: number; msg?: string }> {
    return jikeingAdminService({
        url: "/admin/v1/articles/category/update",
        method: "post",
        data,
    });
}
