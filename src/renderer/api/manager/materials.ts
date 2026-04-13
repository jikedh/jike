/**
 * 管理端素材接口
 * 对应 jikeing-web/src/api/manager/materials.js
 */

import { jikeingAdminService } from "service/aiRequest";
import type {
  AdminCategoryListResponse,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  AdminMaterialsListResponse,
  MaterialDetailAdminResponse,
  CreateMaterialRequest,
  UpdateMaterialRequest,
  CourseItem,
  CoursesListResponse,
  CourseDetailResponse,
  CourseCommentItem,
  CoursesCommentsResponse,
  CourseLessonItem,
  CoursesLessonsResponse,
} from "shared/types/api/materials";

// ===================== 素材分类 =====================

/** 素材分类列表 */
export function categoryList(params?: {
  page?: number;
  pageSize?: number;
}): Promise<AdminCategoryListResponse> {
  return jikeingAdminService({
    url: "/admin/v1/materials/category/list",
    method: "get",
    params,
  });
}

/** 删除素材分类 */
export function deleteCategory(data: { id: string }): Promise<any> {
  return jikeingAdminService({
    url: "/admin/v1/materials/category/delete",
    method: "post",
    data,
  });
}

/** 创建素材分类 */
export function createCategory(
  data: CreateCategoryRequest,
): Promise<{ code: number; msg?: string }> {
  return jikeingAdminService({
    url: "/admin/v1/materials/category/create",
    method: "post",
    data,
  });
}

/** 更新素材分类 */
export function updateCategory(
  data: UpdateCategoryRequest,
): Promise<{ code: number; msg?: string }> {
  return jikeingAdminService({
    url: "/admin/v1/materials/category/update",
    method: "post",
    data,
  });
}

// ===================== 素材管理 =====================

/** 素材列表 */
export function materialsList(params?: {
  categoryId?: string;
  page?: number;
  pageSize?: number;
}): Promise<AdminMaterialsListResponse> {
  return jikeingAdminService({
    url: "/admin/v1/materials/list",
    method: "get",
    params,
  });
}

/** 素材详情 */
export function materialsDetail(params: {
  id: string;
}): Promise<MaterialDetailAdminResponse> {
  return jikeingAdminService({
    url: "/admin/v1/materials/detail",
    method: "get",
    params,
  });
}

/** 创建素材 */
export function createMaterials(
  data: CreateMaterialRequest,
): Promise<{ code: number; msg?: string }> {
  return jikeingAdminService({
    url: "/admin/v1/materials/create",
    method: "post",
    data,
  });
}

/** 更新素材 */
export function updateMaterials(
  data: UpdateMaterialRequest,
): Promise<{ code: number; msg?: string }> {
  return jikeingAdminService({
    url: "/admin/v1/materials/update",
    method: "post",
    data,
  });
}

/** 批量删除素材 */
export function deleteMaterials(data: { ids: string[] }): Promise<any> {
  return jikeingAdminService({
    url: "/admin/v1/materials/delete-batch",
    method: "post",
    data,
  });
}

// ===================== 课程相关（用户端复用） =====================

/** 课程列表 */
export function coursesList(params?: {
  page?: number;
  pageSize?: number;
}): Promise<CoursesListResponse> {
  return jikeingAdminService({
    url: "/v1/courses/list",
    method: "get",
    params,
  });
}

/** 课程详情 */
export function coursesDetail(params: {
  id: string;
}): Promise<CourseDetailResponse> {
  return jikeingAdminService({
    url: "/v1/courses/detail",
    method: "get",
    params,
  });
}

/** 课程评论 */
export function coursesComments(params: {
  id: string;
  page?: number;
  pageSize?: number;
}): Promise<CoursesCommentsResponse> {
  return jikeingAdminService({
    url: "/v1/courses/comments",
    method: "get",
    params,
  });
}

/** 课程课时 */
export function coursesLessons(params: {
  id: string;
}): Promise<CoursesLessonsResponse> {
  return jikeingAdminService({
    url: "/v1/courses/lessons",
    method: "get",
    params,
  });
}
