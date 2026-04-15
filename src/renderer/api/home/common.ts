/**
 * 首页通用接口
 * 对应 jikeing-web/src/api/home/common.js
 */

import { jikeingService } from "service/aiRequest";
import type {
  GetSceneQrcodeResponse,
  QuerySceneStatusRequest,
  QuerySceneStatusResponse,
  StudentInfoRequest,
  CommitAiTaskRequest,
  AiTaskListItem,
  AiTaskListResponse,
  AiBatTaskDetailRequest,
  UploadSplitListItem,
  ScoreConfigResponse,
  CommitAiHpRequest,
  CommitAiMultiSceneRequest,
  CommitSoraTaskRequest,
  SoraTaskListItem,
  VideoHpTaskListItem,
  CommitVideoHpTaskRequest,
  CommitVideoTaskHpRequest,
  GetSysConfigResponse,
} from "shared/types/api/home";

// ===================== 微信扫码登录 =====================

/** 获取场景二维码 */
export function getSceneQrcode(): Promise<GetSceneQrcodeResponse> {
  return jikeingService({
    url: "/v1/user/get-scene-qrcode",
    method: "get",
  });
}

/** 查询扫码状态 */
export function querySceneStatus(
  params: QuerySceneStatusRequest,
): Promise<QuerySceneStatusResponse> {
  return jikeingService({
    url: "/v1/user/query-scene-status",
    method: "get",
    params,
  });
}

// ===================== 学员信息 =====================

/** 绑定学员信息 */
export function studentInfo(data: StudentInfoRequest): Promise<any> {
  return jikeingService({
    url: "/v1/user/student-info",
    method: "put",
    data,
  });
}

/** 角色需求提交 */
export function characterRequirements(data: any): Promise<any> {
  return jikeingService({
    url: "/v1/materials/requirements",
    method: "put",
    data,
  });
}

// ===================== AI 任务 =====================

/** 提交 AI 生成任务 */
export function commitAiTask(data: CommitAiTaskRequest): Promise<any> {
  return jikeingService({
    url: "/v1/nanotask/submit",
    method: "post",
    data,
  });
}

/** AI 任务列表 */
export function aiTaskList(params?: {
  page?: number;
  pageSize?: number;
}): Promise<AiTaskListResponse> {
  return jikeingService({
    url: "/v1/nanotask/page-list",
    method: "get",
    params,
  });
}

/** 批量任务详情 */
export function aiBatTaskDetail(
  data: AiBatTaskDetailRequest,
): Promise<AiTaskListItem[]> {
  return jikeingService({
    url: "/v1/nanotask/bat-tasks-detail",
    method: "post",
    data,
  });
}

/** 图片拆分任务列表 */
export function uploadSplitList(params?: {
  page?: number;
  pageSize?: number;
}): Promise<{ list: UploadSplitListItem[]; total: number }> {
  return jikeingService({
    url: "/imagesplit/v1/page-list",
    method: "get",
    params,
  });
}

/** 获取积分配置 */
export function getScoreConfig(): Promise<ScoreConfigResponse> {
  return jikeingService({
    url: "/userscore/v1/get-score-config",
    method: "get",
  });
}

/** AI 任务高清处理 */
export function commitAiHp(data: CommitAiHpRequest): Promise<any> {
  return jikeingService({
    url: "/v1/nanotask/hp",
    method: "post",
    data,
  });
}

/** 多场景提交 */
export function commitAiMultiScene(
  data: CommitAiMultiSceneRequest,
): Promise<any> {
  return jikeingService({
    url: "/v1/nanotask/multi-scene",
    method: "post",
    data,
  });
}

// ===================== 视频任务 =====================

/** 提交 Sora 视频任务 */
export function commitSoraTask(data: CommitSoraTaskRequest): Promise<any> {
  return jikeingService({
    url: "/sorotask/v1/submit",
    method: "post",
    data,
  });
}

/** Sora 视频任务列表 */
export function soraTaskList(params?: {
  page?: number;
  pageSize?: number;
}): Promise<{ list: SoraTaskListItem[]; total: number }> {
  return jikeingService({
    url: "/sorotask/v1/page-list",
    method: "get",
    params,
  });
}

/** 视频高清任务列表 */
export function videoHpTaskList(params?: {
  page?: number;
  pageSize?: number;
}): Promise<{ list: VideoHpTaskListItem[]; total: number }> {
  return jikeingService({
    url: "/sorotask/v1/hp/page-list",
    method: "get",
    params,
  });
}

/** 提交视频高清处理 */
export function commitVideoHpTask(
  data: CommitVideoHpTaskRequest,
): Promise<any> {
  return jikeingService({
    url: "/sorotask/v1/hp/submit",
    method: "post",
    data,
  });
}

/** 对已有视频任务做高清处理 */
export function commitVideoTaskHp(
  data: CommitVideoTaskHpRequest,
): Promise<any> {
  return jikeingService({
    url: "/sorotask/v1/task/hp",
    method: "post",
    data,
  });
}

// ===================== 系统配置 =====================

/** 获取系统配置 */
export function getSysConfig(): Promise<GetSysConfigResponse> {
  return jikeingService({
    url: "/sysconfig/v1/getconfig",
    method: "get",
  });
}
