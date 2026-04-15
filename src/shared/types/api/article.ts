/**
 * 文章模块类型定义
 */

// ===================== 管理端文章 =====================

/** 文章项 */
export interface ArticleItem {
  id: string;
  title: string;
  cover: string;
  content: string;
  categoryId?: string;
  categoryName?: string;
  author?: string;
  tags?: string[];
  status: number;
  viewCount?: number;
  likeCount?: number;
  createTime: string;
  updateTime?: string;
}

/** 文章列表响应 */
export interface ArticleListResponse {
  code: number;
  msg?: string;
  data: {
    list: ArticleItem[];
    total: number;
    page: number;
    pageSize: number;
  };
}

/** 文章详情响应 */
export interface ArticleDetailResponse {
  code: number;
  msg?: string;
  data: ArticleItem;
}

/** 创建文章请求 */
export interface CreateArticleRequest {
  title: string;
  cover: string;
  content: string;
  categoryId?: string;
  author?: string;
  tags?: string[];
  status?: number;
}

/** 更新文章请求 */
export interface UpdateArticleRequest extends CreateArticleRequest {
  id: string;
}

/** 文章状态修改请求 */
export interface ArticleStatusRequest {
  id: string;
  status: number;
}

// ===================== 文章分类 =====================

/** 文章分类项 */
export interface ArticleCategoryItem {
  id: string;
  name: string;
  sort: number;
  status: number;
  createTime: string;
  updateTime?: string;
}

/** 文章分类列表响应 */
export interface ArticleCategoryListResponse {
  code: number;
  msg?: string;
  data: {
    list: ArticleCategoryItem[];
    total: number;
  };
}

/** 文章分类详情响应 */
export interface ArticleCategoryDetailResponse {
  code: number;
  msg?: string;
  data: ArticleCategoryItem;
}

/** 创建文章分类请求 */
export interface CreateArticleCategoryRequest {
  name: string;
  sort?: number;
  status?: number;
}

/** 更新文章分类请求 */
export interface UpdateArticleCategoryRequest
  extends CreateArticleCategoryRequest {
  id: string;
}
