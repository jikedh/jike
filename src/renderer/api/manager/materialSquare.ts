/**
 * 管理端素材广场接口
 * 对应 jikeing-web/src/api/manager/materialSquare.js
 */

import { jikeingAdminService } from "service/aiRequest";
import type {
  AdminMaterialSquareListResponse,
  AddMaterailToSquareRequest,
  AdminUploadSplitAuditListResponse,
  AdminUploadSplitStateChangeRequest,
  AdminUploadSplitRefuseRequest,
} from "shared/types/api/materialSquare";

/** 素材广场列表 */
export function apiMaterailSquarePageList(params?: {
  page?: number;
  pageSize?: number;
}): Promise<AdminMaterialSquareListResponse> {
  return jikeingAdminService({
    url: "/materialsquare/v1/page-list",
    method: "get",
    params,
  });
}

/** 添加素材到广场 */
export function apiAddMaterailToSquare(
  data: AddMaterailToSquareRequest,
): Promise<any> {
  return jikeingAdminService({
    url: "/materialsquare/v1/save",
    method: "post",
    data,
  });
}

/** 从广场删除素材 */
export function apiDeleteMaterailFromSquare(params: {
  id: string;
}): Promise<any> {
  return jikeingAdminService({
    url: "/materialsquare/v1/delete",
    method: "get",
    params,
  });
}

/** 拆图审核列表 */
export function apiAdminUploadSplitAuditList(params?: {
  page?: number;
  pageSize?: number;
}): Promise<AdminUploadSplitAuditListResponse> {
  return jikeingAdminService({
    url: "/imagesplit/v1/admin/page-list",
    method: "get",
    params,
  });
}

/** 审核通过或状态变更 */
export function apiAdminUploadSplitStateChange(
  data: AdminUploadSplitStateChangeRequest,
): Promise<any> {
  return jikeingAdminService({
    url: "/imagesplit/v1/admin/update-state",
    method: "post",
    data,
  });
}

/** 审核拒绝 */
export function apiAdminUploadSplitRefuse(
  data: AdminUploadSplitRefuseRequest,
): Promise<any> {
  return jikeingAdminService({
    url: "/imagesplit/v1/admin/refuse",
    method: "post",
    data,
  });
}
