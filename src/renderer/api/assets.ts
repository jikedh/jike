/**
 * 资产库 API 调用层
 *
 * 设计要点：
 * - 通过 `jikeingService` 走统一 axios 实例。响应拦截器返回的是 `response.data`，
 *   也就是后端的 envelope：`{ code, msg, data, timestamp }`。
 * - 本文件不再做 envelope 解包，统一把 envelope 原样返回给调用方。
 *   调用方拿到 envelope 后自行判断 `code` 是否成功，并读取 `data` 或 `msg`。
 * - 这样可以让上层更明确感知后端协议，也避免了「业务错误必须 try/catch 抓
 *   自定义 Error」这种隐式约定带来的额外抽象。
 */

import { jikeingService } from "service/aiRequest";
import type {
  AddProjectAssetRefRequest,
  AddProjectAssetRefResult,
  ApiEnvelope,
  AssetDetail,
  AssetListItem,
  AssetListParams,
  AssetSearchParams,
  AssetTag,
  AssetTagsRequest,
  ChangeAssetScopeRequest,
  ChangeAssetScopeResult,
  CreateAssetRequest,
  DeleteAssetResult,
  PaginatedData,
  ProjectAssetRef,
  UpdateAssetRequest,
  UploadOssFileResult,
} from "shared/types/api/assets";
import { uploadOssFile as jikeGoUploadOssFile } from "./jikeGo";

const JIKE_GO_BASE_URL = import.meta.env.VITE_JIKE_GO_BASE_URL;

/**
 * 通用请求封装：注入 baseURL 并把 axios `response.data`（即后端 envelope）原样返回。
 *
 * 不做 `code` 判断、不做 `data` 解包：
 * - 上层通过 `envelope.code` 判断成功 / 失败
 * - 成功时自行读取 `envelope.data`
 * - 失败时通过 `envelope.msg / envelope.message` 拿到错误文案
 */
const request = async <T>(
  config: Parameters<typeof jikeingService.request>[0],
): Promise<ApiEnvelope<T>> => {
  return (await jikeingService.request({
    baseURL: JIKE_GO_BASE_URL,
    ...config,
  })) as unknown as ApiEnvelope<T>;
};

// ===================== 文件上传 =====================

/**
 * 服务端直传 OSS：POST /v1/oss/upload（multipart/form-data）
 *
 * 替代旧的预签名 PUT 链路：客户端一次提交文件，后端负责转存到 OSS 并返回访问 URL 与 key。
 * 此处保持 envelope 原样返回，由调用方处理 `code / data`。
 */
export const uploadAssetFile = (file: File | Blob) =>
  jikeGoUploadOssFile(file as File) as unknown as Promise<
    ApiEnvelope<UploadOssFileResult>
  >;

// ===================== 资产 CRUD =====================

/**
 * 创建资产
 * POST /v1/assets
 */
export const createAsset = (data: CreateAssetRequest) =>
  request<AssetDetail>({
    url: "/v1/assets",
    method: "post",
    data,
  });

/**
 * 资产列表查询（支持多维度筛选）
 * GET /v1/assets
 */
export const getAssetList = (params?: AssetListParams) =>
  request<PaginatedData<AssetListItem>>({
    url: "/v1/assets",
    method: "get",
    params,
  });

/**
 * 关键词搜索资产
 * GET /v1/assets/search
 */
export const searchAssets = (params: AssetSearchParams) =>
  request<PaginatedData<AssetListItem>>({
    url: "/v1/assets/search",
    method: "get",
    params,
  });

/**
 * 获取资产详情
 * GET /v1/assets/:id
 */
export const getAssetDetail = (id: string) =>
  request<AssetDetail>({
    url: `/v1/assets/${encodeURIComponent(id)}`,
    method: "get",
  });

/**
 * 更新资产元数据
 * PUT /v1/assets/:id
 */
export const updateAsset = (id: string, data: UpdateAssetRequest) =>
  request<AssetDetail>({
    url: `/v1/assets/${encodeURIComponent(id)}`,
    method: "put",
    data,
  });

/**
 * 删除/下架资产
 * DELETE /v1/assets/:id
 */
export const deleteAsset = (id: string) =>
  request<DeleteAssetResult>({
    url: `/v1/assets/${encodeURIComponent(id)}`,
    method: "delete",
  });

// ===================== 资产升降级 =====================

/**
 * 资产升降级
 * PATCH /v1/assets/:id/scope
 */
export const changeAssetScope = (id: string, data: ChangeAssetScopeRequest) =>
  request<ChangeAssetScopeResult>({
    url: `/v1/assets/${encodeURIComponent(id)}/scope`,
    method: "patch",
    data,
  });

// ===================== 资产引用 =====================

/**
 * 查询资产的引用记录
 * GET /v1/assets/:id/refs
 */
export const getAssetRefs = (
  id: string,
  params?: { page?: number; pageSize?: number },
) =>
  request<PaginatedData<ProjectAssetRef>>({
    url: `/v1/assets/${encodeURIComponent(id)}/refs`,
    method: "get",
    params,
  });

/**
 * 向项目添加资产引用
 * POST /v1/projects/:projectId/assets
 */
export const addProjectAssetRef = (
  projectId: string,
  data: AddProjectAssetRefRequest,
) =>
  request<AddProjectAssetRefResult>({
    url: `/v1/projects/${encodeURIComponent(projectId)}/assets`,
    method: "post",
    data,
  });

/**
 * 移除项目资产引用
 * DELETE /v1/projects/:projectId/assets/:assetId
 */
export const removeProjectAssetRef = (projectId: string, assetId: string) =>
  request<{ success: boolean } | null>({
    url: `/v1/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`,
    method: "delete",
  });

/**
 * 获取项目可用资产列表
 *
 * 注意：当前后端 `GET /v1/projects/:projectId/assets` 对 query 参数的支持有限，
 * 推荐统一使用 `getAssetList({ projectId, ...filters })` 以获得完整筛选/分页能力。
 */
export const getProjectAssets = (
  projectId: string,
  params?: AssetListParams,
) =>
  request<PaginatedData<AssetListItem>>({
    url: `/v1/projects/${encodeURIComponent(projectId)}/assets`,
    method: "get",
    params,
  });

// ===================== 标签管理 =====================

export const getAssetTags = (id: string) =>
  request<AssetTag[]>({
    url: `/v1/assets/${encodeURIComponent(id)}/tags`,
    method: "get",
  });

export const addAssetTags = (id: string, data: AssetTagsRequest) =>
  request<AssetTag[]>({
    url: `/v1/assets/${encodeURIComponent(id)}/tags`,
    method: "post",
    data,
  });

export const setAssetTags = (id: string, data: AssetTagsRequest) =>
  request<AssetTag[]>({
    url: `/v1/assets/${encodeURIComponent(id)}/tags`,
    method: "put",
    data,
  });

export const removeAssetTag = (id: string, tagId: string) =>
  request<{ success: boolean } | null>({
    url: `/v1/assets/${encodeURIComponent(id)}/tags/${encodeURIComponent(tagId)}`,
    method: "delete",
  });
