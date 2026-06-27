/**
 * 项目与画布模块类型定义
 * 基于 projects-canvas-api.md 文档
 */

// ===================== 枚举 =====================

/** 项目类型 */
export type ProjectType = "video" | "script";

/** 封面来源 */
export type CoverSource = "manual" | "auto";

/** 排序方式 */
export type ProjectSort = "updated_at_desc" | "updated_at_asc" | "created_at_desc" | "created_at_asc";

export type ApiId = string | number;

export interface ApiResponse<T> {
  code: number;
  msg?: string;
  data: T;
}

// ===================== 项目模型 =====================

/** 项目列表项 */
export interface ProjectListItem {
  id: ApiId;
  userId?: ApiId;
  user_id?: ApiId;
  name: string;
  description?: string | null;
  type: ProjectType;
  coverUrl?: string | null;
  cover_url?: string | null;
  coverLocalPath?: string | null;
  cover_local_path?: string | null;
  coverSource?: CoverSource | null;
  cover_source?: CoverSource | null;
  canvasId?: ApiId;
  canvas_id?: ApiId;
  createTime?: number;
  updateTime?: number;
  created_at?: number;
  updated_at?: number;
}

/** 项目详情 */
export interface ProjectDetail extends ProjectListItem {
  // 详情与列表字段一致，当前无额外字段
}

/** 项目列表响应 */
export interface ProjectListResponse {
  code: number;
  msg?: string;
  data: {
    list: ProjectListItem[];
    total: number;
    page: number;
    page_size: number;
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}

// ===================== 项目 CRUD =====================

/** 项目列表查询参数 */
export interface ProjectListParams {
  keyword?: string;
  type?: ProjectType;
  page?: number;
  page_size?: number;
  sort?: ProjectSort;
}

/** 创建项目请求 */
export interface CreateProjectRequest {
  name: string;
  description?: string;
  type: ProjectType;
  cover_url?: string;
}

/** 创建项目响应 */
export interface CreateProjectResponse {
  code: number;
  msg?: string;
  data: ProjectDetail;
}

/** 更新项目请求（所有字段可选） */
export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  type?: ProjectType;
  cover_url?: string;
  cover_source?: CoverSource;
}

/** 更新项目响应 */
export interface UpdateProjectResponse {
  code: number;
  msg?: string;
  data: ProjectDetail;
}

/** 批量删除请求 */
export interface BatchDeleteProjectsRequest {
  ids: ApiId[];
}

/** 搜索项目参数 */
export interface SearchProjectsParams {
  keyword: string;
  limit?: number;
}

/** 复制项目请求 */
export interface DuplicateProjectRequest {
  name?: string;
}

/** 导入项目请求 */
export interface ImportProjectRequest {
  name: string;
  description?: string;
  type: ProjectType;
  cover_url?: string;
  data: CanvasData;
}

// ===================== 画布模型 =====================

/** 画布数据 */
export interface CanvasData {
  nodes: any[];
  edges: any[];
  groups: any[];
  node_id_counters: Record<string, number>;
}

/** 画布响应 */
export interface CanvasResponse {
  project_id: ApiId;
  version: number;
  saved_at: number;
  data: CanvasData;
}

/** 保存画布请求 */
export interface SaveCanvasRequest {
  version: number;
  saved_at: number;
  data: CanvasData;
}

/** 清空画布请求 */
export interface ClearCanvasRequest {
  keep_counters: boolean;
}

/** 单节点 Patch 请求 */
export interface PatchCanvasNodeRequest {
  data?: Record<string, any>;
  position?: { x: number; y: number };
  width?: number;
  height?: number;
}

// ===================== 导出项目 =====================

/** 导出项目数据 */
export interface ExportProjectData {
  project: ProjectDetail;
  canvas: CanvasResponse;
}

export type CanvasApiResponse = ApiResponse<CanvasResponse>;
export type CanvasSaveResponse = ApiResponse<{ saved_at: number; version: number }>;
export type ProjectExportResponse = ApiResponse<ExportProjectData>;
