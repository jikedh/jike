// 项目与画布 API 接口
// 基于 projects-canvas-api.md 文档生成

import { jikeingService } from "service/aiRequest";
import {
  BatchDeleteProjectsRequest,
  CanvasResponse,
  ClearCanvasRequest,
  CreateProjectRequest,
  CreateProjectResponse,
  DuplicateProjectRequest,
  ExportProjectData,
  ImportProjectRequest,
  PatchCanvasNodeRequest,
  ProjectDetail,
  ProjectListParams,
  ProjectListResponse,
  SaveCanvasRequest,
  SearchProjectsParams,
  UpdateProjectRequest,
  UpdateProjectResponse,
} from "shared/types/api/projects";

const JIKE_GO_BASE_URL = import.meta.env.VITE_JIKE_GO_BASE_URL;

// ===================== 项目 CRUD =====================

/**
 * 获取项目列表
 * GET /v1/projects
 */
export function getProjectList(
  params?: ProjectListParams,
): Promise<ProjectListResponse> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/projects",
    method: "get",
    params,
  });
}

/**
 * 创建项目
 * POST /v1/projects
 */
export function createProject(
  data: CreateProjectRequest,
): Promise<CreateProjectResponse> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/projects",
    method: "post",
    data,
  });
}

/**
 * 获取项目详情
 * GET /v1/projects/:id
 */
export function getProjectDetail(id: number): Promise<CreateProjectResponse> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: `/v1/projects/${id}`,
    method: "get",
  });
}

/**
 * 更新项目
 * PATCH /v1/projects/:id
 */
export function updateProject(
  id: number,
  data: UpdateProjectRequest,
): Promise<UpdateProjectResponse> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: `/v1/projects/${id}`,
    method: "patch",
    data,
  });
}

/**
 * 删除项目（软删除）
 * DELETE /v1/projects/:id
 */
export function deleteProject(id: number): Promise<any> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: `/v1/projects/${id}`,
    method: "delete",
  });
}

/**
 * 批量删除项目
 * POST /v1/projects/batch-delete
 */
export function batchDeleteProjects(
  data: BatchDeleteProjectsRequest,
): Promise<any> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/projects/batch-delete",
    method: "post",
    data,
  });
}

// ===================== 项目搜索/复制/导入导出 =====================

/**
 * 搜索项目
 * GET /v1/projects/search
 */
export function searchProjects(
  params: SearchProjectsParams,
): Promise<ProjectListResponse> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/projects/search",
    method: "get",
    params,
  });
}

/**
 * 复制项目
 * POST /v1/projects/:id/duplicate
 */
export function duplicateProject(
  id: number,
  data?: DuplicateProjectRequest,
): Promise<CreateProjectResponse> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: `/v1/projects/${id}/duplicate`,
    method: "post",
    data,
  });
}

/**
 * 导出项目
 * GET /v1/projects/:id/export
 */
export function exportProject(id: number): Promise<ExportProjectData> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: `/v1/projects/${id}/export`,
    method: "get",
  });
}

/**
 * 导入项目
 * POST /v1/projects/import
 */
export function importProject(
  data: ImportProjectRequest,
): Promise<CreateProjectResponse> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: "/v1/projects/import",
    method: "post",
    data,
  });
}

// ===================== 画布 CRUD =====================

/**
 * 加载画布
 * GET /v1/projects/:id/canvas
 */
export function getCanvas(projectId: number): Promise<CanvasResponse> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: `/v1/projects/${projectId}/canvas`,
    method: "get",
  });
}

/**
 * 保存画布
 * PUT /v1/projects/:id/canvas
 */
export function saveCanvas(
  projectId: number,
  data: SaveCanvasRequest,
): Promise<any> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: `/v1/projects/${projectId}/canvas`,
    method: "put",
    data,
  });
}

/**
 * 清空画布
 * DELETE /v1/projects/:id/canvas
 */
export function clearCanvas(
  projectId: number,
  data?: ClearCanvasRequest,
): Promise<any> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: `/v1/projects/${projectId}/canvas`,
    method: "delete",
    data,
  });
}

/**
 * 单节点 Patch
 * PATCH /v1/projects/:id/canvas/nodes/:nodeId
 */
export function patchCanvasNode(
  projectId: number,
  nodeId: string,
  data: PatchCanvasNodeRequest,
): Promise<any> {
  return jikeingService({
    baseURL: JIKE_GO_BASE_URL,
    url: `/v1/projects/${projectId}/canvas/nodes/${nodeId}`,
    method: "patch",
    data,
  });
}
