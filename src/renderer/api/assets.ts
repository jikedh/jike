// 资产库 API 接口
// 基于 asset-api-design.md 文档生成

import { jikeingService } from "service/aiRequest";
import {
  AddProjectAssetRefRequest,
  AddProjectAssetRefResponse,
  AssetDetail,
  AssetListParams,
  AssetListResponse,
  AssetRefsResponse,
  AssetSearchParams,
  AssetTagsRequest,
  AssetTagsResponse,
  ChangeAssetScopeRequest,
  ChangeAssetScopeResponse,
  CheckDuplicateRequest,
  CheckDuplicateResponse,
  CreateAssetRequest,
  CreateAssetResponse,
  DeleteAssetResponse,
  GetUploadUrlRequest,
  GetUploadUrlResponse,
  UpdateAssetRequest,
} from "shared/types/api/assets";

const JIKE_GO_BASE_URL = import.meta.env.VITE_JIKE_GO_BASE_URL;

// ===================== 文件上传 =====================

/**
 * 获取文件上传预签名 URL
 * POST /v1/assets/upload-url
 */
export function getAssetUploadUrl(
  data: GetUploadUrlRequest,
): Promise<GetUploadUrlResponse> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/assets/upload-url",
    method: "post",
    data,
  });
}

/**
 * 文件重复检测
 * POST /v1/assets/check-duplicate
 */
export function checkAssetDuplicate(
  data: CheckDuplicateRequest,
): Promise<CheckDuplicateResponse> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/assets/check-duplicate",
    method: "post",
    data,
  });
}

// ===================== 资产 CRUD =====================

/**
 * 创建资产
 * POST /v1/assets
 */
export function createAsset(
  data: CreateAssetRequest,
): Promise<CreateAssetResponse> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/assets",
    method: "post",
    data,
  });
}

/**
 * 资产列表查询（支持多维度筛选）
 * GET /v1/assets
 */
export function getAssetList(
  params?: AssetListParams,
): Promise<AssetListResponse> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/assets",
    method: "get",
    params,
  });
}

/**
 * 关键词搜索资产
 * GET /v1/assets/search
 */
export function searchAssets(
  params: AssetSearchParams,
): Promise<AssetListResponse> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/assets/search",
    method: "get",
    params,
  });
}

/**
 * 获取资产详情
 * GET /v1/assets/:id
 */
export function getAssetDetail(id: number): Promise<CreateAssetResponse> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: `/v1/assets/${id}`,
    method: "get",
  });
}

/**
 * 更新资产元数据
 * PUT /v1/assets/:id
 */
export function updateAsset(
  id: number,
  data: UpdateAssetRequest,
): Promise<CreateAssetResponse> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: `/v1/assets/${id}`,
    method: "put",
    data,
  });
}

/**
 * 删除/下架资产
 * DELETE /v1/assets/:id
 */
export function deleteAsset(id: number): Promise<DeleteAssetResponse> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: `/v1/assets/${id}`,
    method: "delete",
  });
}

// ===================== 资产升降级 =====================

/**
 * 资产升降级
 * PATCH /v1/assets/:id/scope
 */
export function changeAssetScope(
  id: number,
  data: ChangeAssetScopeRequest,
): Promise<ChangeAssetScopeResponse> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: `/v1/assets/${id}/scope`,
    method: "patch",
    data,
  });
}

// ===================== 资产引用 =====================

/**
 * 查询资产的引用记录
 * GET /v1/assets/:id/refs
 */
export function getAssetRefs(
  id: number,
  params?: { page?: number; pageSize?: number },
): Promise<AssetRefsResponse> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: `/v1/assets/${id}/refs`,
    method: "get",
    params,
  });
}

/**
 * 向项目添加资产引用
 * POST /v1/projects/:projectId/assets
 */
export function addProjectAssetRef(
  projectId: number,
  data: AddProjectAssetRefRequest,
): Promise<AddProjectAssetRefResponse> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: `/v1/projects/${projectId}/assets`,
    method: "post",
    data,
  });
}

/**
 * 移除项目资产引用
 * DELETE /v1/projects/:projectId/assets/:assetId
 */
export function removeProjectAssetRef(
  projectId: number,
  assetId: number,
): Promise<any> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: `/v1/projects/${projectId}/assets/${assetId}`,
    method: "delete",
  });
}

/**
 * 获取项目可用资产列表
 * GET /v1/projects/:projectId/assets
 */
export function getProjectAssets(
  projectId: number,
  params?: AssetListParams,
): Promise<AssetListResponse> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: `/v1/projects/${projectId}/assets`,
    method: "get",
    params,
  });
}

// ===================== 标签管理 =====================

/**
 * 获取资产标签列表
 * GET /v1/assets/:id/tags
 */
export function getAssetTags(id: number): Promise<AssetTagsResponse> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: `/v1/assets/${id}/tags`,
    method: "get",
  });
}

/**
 * 为资产添加标签
 * POST /v1/assets/:id/tags
 */
export function addAssetTags(
  id: number,
  data: AssetTagsRequest,
): Promise<AssetTagsResponse> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: `/v1/assets/${id}/tags`,
    method: "post",
    data,
  });
}

/**
 * 批量设置资产标签（全量替换）
 * PUT /v1/assets/:id/tags
 */
export function setAssetTags(
  id: number,
  data: AssetTagsRequest,
): Promise<AssetTagsResponse> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: `/v1/assets/${id}/tags`,
    method: "put",
    data,
  });
}

/**
 * 删除资产标签
 * DELETE /v1/assets/:id/tags/:tagId
 */
export function removeAssetTag(
  id: number,
  tagId: number,
): Promise<any> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: `/v1/assets/${id}/tags/${tagId}`,
    method: "delete",
  });
}
