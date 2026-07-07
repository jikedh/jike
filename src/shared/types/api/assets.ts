/**
 * 资产库模块类型定义
 * 基于 docs/asset-api-design.md + 后端 jike-go 实际响应进行兼容
 *
 * 重要约定：
 * - 所有 ID 由后端 Snowflake 生成，序列化为 JSON 字符串，避免 JS 数值精度丢失。
 * - 后端统一响应 envelope：`{ code, msg, data, timestamp }`；当前后端成功 code 为 200。
 * - 业务错误同样以 HTTP 200 返回 envelope，调用方必须基于 envelope.code 判断成功。
 */

// ===================== 通用 envelope =====================

export interface ApiEnvelope<T> {
  code: number;
  msg?: string;
  message?: string;
  modal?: boolean;
  data: T;
  timestamp?: number;
}

/** 分页信息 */
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** 分页数据（envelope.data 内层结构） */
export interface PaginatedData<T> {
  list: T[];
  pagination: Pagination;
}

// ===================== 枚举 =====================

export type AssetScope = "personal" | "project" | "public";

export type MediaType = "image" | "video" | "audio";

export type PrimaryCategory = string;

export type AssetStatus = 0 | 1;

export interface AssetCategory {
  id: string;
  code: PrimaryCategory;
  name: string;
  sort: number;
  status: AssetStatus;
}

// ===================== Conditions 结构化筛选 =====================

export interface CharacterConditions {
  gender?: "male" | "female" | "unlimited" | "other";
  age_group?: "child" | "youth" | "middle_age" | "elderly";
  style_era?:
  | "ancient"
  | "modern"
  | "scifi"
  | "fantasy"
  | "republican"
  | "post_apocalyptic";
  character_type?:
  | "protagonist"
  | "supporting"
  | "extra"
  | "npc"
  | "monster"
  | "villain";
  composition?: "avatar" | "half_body" | "full_body" | "close_up";
  pose?: "standing" | "sitting" | "action" | "combat" | "expression";
}

export interface SceneConditions {
  scene_type?:
  | "indoor"
  | "outdoor"
  | "nature"
  | "city"
  | "building"
  | "battlefield"
  | "ruins"
  | "base";
  style_era?: CharacterConditions["style_era"];
  time_of_day?: "day" | "night" | "dusk" | "dawn";
  weather?: "sunny" | "rain" | "snow" | "fog" | "overcast";
  usage?: "background" | "empty_scene" | "transition" | "atmosphere" | "cover";
}

export interface PropConditions {
  prop_type?:
  | "weapon"
  | "clothing"
  | "furniture"
  | "vehicle"
  | "magic_tool"
  | "daily_item"
  | "device"
  | "food"
  | "medicine";
  style_era?: CharacterConditions["style_era"];
  material?: "metal" | "wood" | "fabric" | "plastic" | "glass" | "glowing";
  usage?: "key_prop" | "normal_prop" | "decoration" | "consumable";
}

export interface AudioConditions {
  audio_usage?: "bgm" | "sound_effect" | "vocal" | "ambient";
  mood?: "tense" | "warm" | "sad" | "epic" | "funny" | "horror";
  tempo?: "slow" | "medium" | "fast";
  is_loop?: boolean;
  duration_range?: "short" | "medium" | "long";
}

export type AssetConditions =
  | CharacterConditions
  | SceneConditions
  | PropConditions
  | AudioConditions;

// ===================== 资产标签 =====================

export interface AssetTag {
  /** Snowflake ID，字符串 */
  id: string;
  tag: string;
  createTime?: number;
}

// ===================== 资产模型 =====================

export interface AssetListItem {
  id: string;
  userId: string;
  scope: AssetScope;
  projectId: string | null;
  name: string;
  mediaType: MediaType;
  categoryId?: string | null;
  primaryCategory: PrimaryCategory;
  categoryName?: string;
  conditions: AssetConditions | null;
  description: string | null;
  fileUrl: string;
  thumbnailUrl: string;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  status: AssetStatus;
  createTime: number;
  updateTime: number;
  tags: string[];
  refCount: number;
}

export interface AssetDetail {
  id: string;
  userId: string;
  userName?: string;
  userAvatar?: string;
  scope: AssetScope;
  projectId: string | null;
  projectName?: string | null;
  name: string;
  mediaType: MediaType;
  categoryId?: string | null;
  primaryCategory: PrimaryCategory;
  categoryName?: string;
  conditions: AssetConditions | null;
  description: string | null;
  fileKey: string;
  fileUrl: string;
  fileSize: number | null;
  fileName: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  thumbnailKey: string;
  thumbnailUrl: string;
  sourceProjectId: string | null;
  sourceProjectName?: string | null;
  sourceCanvasId: string | null;
  sourceNodeId: string | null;
  sourceTaskId: string | null;
  status: AssetStatus;
  createTime: number;
  updateTime: number;
  tags: AssetTag[];
  refCount: number;
}

// ===================== 文件上传 =====================

/**
 * `uploadOssFile` 服务端直传 OSS 的返回结构
 * （后端 POST /v1/oss/upload envelope 解包后）
 */
export interface UploadOssFileResult {
  /** OSS 公网访问 URL */
  url: string;
  /** OSS 对象 Key（传给 createAsset.fileKey） */
  key: string;
  /** 原始文件名 */
  filename: string;
  /** 字节数 */
  size: number;
  content_type: string;
}

// ===================== 创建资产 =====================

export interface CreateAssetRequest {
  name: string;
  mediaType: MediaType;
  primaryCategory: PrimaryCategory;
  /** 默认 personal；项目/公开可在创建时直接指定，需后端支持 */
  scope?: AssetScope;
  projectId?: string | null;
  conditions?: AssetConditions | null;
  description?: string | null;
  fileKey: string;
  fileSize?: number | null;
  fileName?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  sourceProjectId?: string | null;
  sourceCanvasId?: string | null;
  sourceNodeId?: string | null;
  sourceTaskId?: string | null;
  tags?: string[];
}

// ===================== 列表查询 =====================

export interface AssetListParams {
  scope?: AssetScope;
  projectId?: string;
  userId?: string;
  mediaType?: MediaType;
  primaryCategory?: PrimaryCategory;
  status?: AssetStatus;
  keyword?: string;
  sortBy?: "createTime" | "updateTime" | "name" | "fileSize";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  /** 结构化条件筛选，键格式：`conditions.<snake_case_field>` */
  [key: `conditions.${string}`]: string | undefined;
}

export interface AssetSearchParams {
  q: string;
  scope?: AssetScope;
  page?: number;
  pageSize?: number;
}

// ===================== 更新资产 =====================

export interface UpdateAssetRequest {
  name?: string;
  primaryCategory?: PrimaryCategory;
  conditions?: AssetConditions | null;
  description?: string | null;
}

// ===================== 删除/下架资产 =====================

export interface DeleteAssetResult {
  id: string;
  action: "unlisted" | "deleted";
  refCount: number;
}

// ===================== 资产升降级 =====================

export interface ChangeAssetScopeRequest {
  targetScope: AssetScope;
  projectId?: string;
}

export interface ChangeAssetScopeResult {
  id: string;
  previousScope: AssetScope;
  currentScope: AssetScope;
  projectId: string | null;
  updateTime: number;
}

// ===================== 项目资产引用 =====================

export interface ProjectAssetRef {
  id: string;
  projectId: string;
  projectName?: string;
  userId: string;
  userName?: string;
  createTime: number;
}

export interface AddProjectAssetRefRequest {
  assetId: string;
}

export interface AddProjectAssetRefResult {
  id: string;
  projectId: string;
  assetId: string;
  userId: string;
  createTime: number;
}

// ===================== 标签管理 =====================

export interface AssetTagsRequest {
  tags: string[];
}
