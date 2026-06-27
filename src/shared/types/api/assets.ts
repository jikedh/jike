/**
 * 资产库模块类型定义
 * 基于 asset-api-design.md 文档
 */

// ===================== 通用 =====================

/** 分页信息 */
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** 通用列表响应 */
export interface PaginatedResponse<T> {
  list: T[];
  pagination: Pagination;
}

// ===================== 枚举 =====================

/** 资产等级 */
export type AssetScope = "personal" | "project" | "public";

/** 媒体类型 */
export type MediaType = "image" | "video" | "audio";

/** 主分类 */
export type PrimaryCategory = "character" | "scene" | "prop";

/** 资产状态 */
export type AssetStatus = 0 | 1;

// ===================== Conditions 结构化筛选 =====================

/** 角色 conditions */
export interface CharacterConditions {
  gender?: "male" | "female" | "unlimited" | "other";
  age_group?: "child" | "youth" | "middle_age" | "elderly";
  style_era?: "ancient" | "modern" | "scifi" | "fantasy" | "republican" | "post_apocalyptic";
  character_type?: "protagonist" | "supporting" | "extra" | "npc" | "monster" | "villain";
  composition?: "avatar" | "half_body" | "full_body" | "close_up";
  pose?: "standing" | "sitting" | "action" | "combat" | "expression";
}

/** 场景 conditions */
export interface SceneConditions {
  scene_type?: "indoor" | "outdoor" | "nature" | "city" | "building" | "battlefield" | "ruins" | "base";
  style_era?: "ancient" | "modern" | "scifi" | "fantasy" | "republican" | "post_apocalyptic";
  time_of_day?: "day" | "night" | "dusk" | "dawn";
  weather?: "sunny" | "rain" | "snow" | "fog" | "overcast";
  usage?: "background" | "empty_scene" | "transition" | "atmosphere" | "cover";
}

/** 道具 conditions */
export interface PropConditions {
  prop_type?: "weapon" | "clothing" | "furniture" | "vehicle" | "magic_tool" | "daily_item" | "device" | "food" | "medicine";
  style_era?: "ancient" | "modern" | "scifi" | "fantasy" | "republican" | "post_apocalyptic";
  material?: "metal" | "wood" | "fabric" | "plastic" | "glass" | "glowing";
  usage?: "key_prop" | "normal_prop" | "decoration" | "consumable";
}

/** 音频补充字段 */
export interface AudioConditions {
  audio_usage?: "bgm" | "sound_effect" | "vocal" | "ambient";
  mood?: "tense" | "warm" | "sad" | "epic" | "funny" | "horror";
  tempo?: "slow" | "medium" | "fast";
  is_loop?: boolean;
  duration_range?: "short" | "medium" | "long";
}

/** conditions 联合类型 */
export type AssetConditions = CharacterConditions | SceneConditions | PropConditions | AudioConditions;

// ===================== 资产标签 =====================

export interface AssetTag {
  id: number;
  tag: string;
  createTime?: number;
}

// ===================== 资产模型 =====================

/** 资产列表项（简化） */
export interface AssetListItem {
  id: number;
  userId: number;
  scope: AssetScope;
  projectId: number | null;
  name: string;
  mediaType: MediaType;
  primaryCategory: PrimaryCategory;
  conditions: AssetConditions | null;
  description: string | null;
  fileUrl: string;
  thumbnailUrl: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  status: AssetStatus;
  createTime: number;
  updateTime: number;
  tags: string[];
  refCount: number;
}

/** 资产详情（完整） */
export interface AssetDetail {
  id: number;
  userId: number;
  userName?: string;
  userAvatar?: string;
  scope: AssetScope;
  projectId: number | null;
  projectName?: string | null;
  name: string;
  mediaType: MediaType;
  primaryCategory: PrimaryCategory;
  conditions: AssetConditions | null;
  description: string | null;
  fileKey: string;
  fileUrl: string;
  fileHash: string | null;
  fileSize: number;
  fileName: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  thumbnailKey: string;
  thumbnailUrl: string;
  sourceProjectId: number | null;
  sourceProjectName?: string | null;
  sourceCanvasId: number | null;
  sourceNodeId: string | null;
  sourceTaskId: number | null;
  status: AssetStatus;
  createTime: number;
  updateTime: number;
  tags: AssetTag[];
  refCount: number;
}

// ===================== 文件上传 =====================

/** 获取上传预签名 URL 请求 */
export interface GetUploadUrlRequest {
  fileName: string;
  fileSize: number;
  mimeType: string;
}

/** 获取上传预签名 URL 响应 */
export interface GetUploadUrlResponse {
  uploadUrl: string;
  fileKey: string;
  expireTime: number;
}

// ===================== 文件重复检测 =====================

/** 文件重复检测请求 */
export interface CheckDuplicateRequest {
  fileHash: string;
}

/** 文件重复检测响应（无重复） */
export interface CheckDuplicateNotDuplicateResponse {
  isDuplicate: false;
  existingAsset: null;
}

/** 文件重复检测响应（有重复） */
export interface CheckDuplicateDuplicateResponse {
  isDuplicate: true;
  existingAsset: {
    id: number;
    name: string;
    mediaType: MediaType;
    primaryCategory: PrimaryCategory;
    fileUrl: string;
    thumbnailUrl: string;
    scope: AssetScope;
  };
}

export type CheckDuplicateResponse = CheckDuplicateNotDuplicateResponse | CheckDuplicateDuplicateResponse;

// ===================== 创建资产 =====================

/** 创建资产请求 */
export interface CreateAssetRequest {
  name: string;
  mediaType: MediaType;
  primaryCategory: PrimaryCategory;
  conditions?: AssetConditions | null;
  description?: string | null;
  fileKey: string;
  fileHash?: string | null;
  fileSize?: number | null;
  fileName?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  sourceProjectId?: number | null;
  sourceCanvasId?: number | null;
  sourceNodeId?: string | null;
  sourceTaskId?: number | null;
  tags?: string[];
}

/** 创建资产响应 */
export interface CreateAssetResponse {
  code: number;
  msg?: string;
  data: AssetDetail;
}

// ===================== 资产列表查询 =====================

/** 资产列表查询参数 */
export interface AssetListParams {
  scope?: AssetScope;
  projectId?: number;
  userId?: number;
  mediaType?: MediaType;
  primaryCategory?: PrimaryCategory;
  status?: AssetStatus;
  keyword?: string;
  sortBy?: "createTime" | "updateTime" | "name" | "fileSize";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  /** 结构化条件筛选，如 conditions.gender=female */
  [key: `conditions.${string}`]: string | undefined;
}

/** 资产列表响应 */
export interface AssetListResponse {
  code: number;
  msg?: string;
  data: PaginatedResponse<AssetListItem>;
}

// ===================== 关键词搜索 =====================

/** 资产搜索参数 */
export interface AssetSearchParams {
  q: string;
  scope?: AssetScope;
  page?: number;
  pageSize?: number;
}

// ===================== 更新资产 =====================

/** 更新资产请求 */
export interface UpdateAssetRequest {
  name?: string;
  primaryCategory?: PrimaryCategory;
  conditions?: AssetConditions | null;
  description?: string | null;
}

// ===================== 删除/下架资产 =====================

/** 删除资产响应 */
export interface DeleteAssetResponse {
  id: number;
  action: "unlisted" | "deleted";
  refCount: number;
}

// ===================== 资产升降级 =====================

/** 资产升降级请求 */
export interface ChangeAssetScopeRequest {
  targetScope: AssetScope;
  projectId?: number;
}

/** 资产升降级响应 */
export interface ChangeAssetScopeResponse {
  id: number;
  previousScope: AssetScope;
  currentScope: AssetScope;
  projectId: number | null;
  updateTime: number;
}

// ===================== 项目资产引用 =====================

/** 项目资产引用记录 */
export interface ProjectAssetRef {
  id: number;
  projectId: number;
  projectName?: string;
  userId: number;
  userName?: string;
  createTime: number;
}

/** 资产引用列表响应 */
export interface AssetRefsResponse {
  code: number;
  msg?: string;
  data: PaginatedResponse<ProjectAssetRef>;
}

/** 添加项目资产引用请求 */
export interface AddProjectAssetRefRequest {
  assetId: number;
}

/** 添加项目资产引用响应 */
export interface AddProjectAssetRefResponse {
  id: number;
  projectId: number;
  assetId: number;
  userId: number;
  createTime: number;
}

// ===================== 标签管理 =====================

/** 添加/批量设置标签请求 */
export interface AssetTagsRequest {
  tags: string[];
}

/** 标签列表响应 */
export interface AssetTagsResponse {
  code: number;
  msg?: string;
  data: AssetTag[];
}
