/**
 * 管理端视频接口
 * 对应 jikeing-web/src/api/manager/video.js
 */

import { jikeingAdminService } from "service/aiRequest";
import type {
  GetVodUploadAuthResponse,
  VideoListResponse,
  VideoDetailResponse,
  CreateVideoRequest,
  UpdateVideoRequest,
  CollectionListResponse,
  CollectionDetailResponse,
  CreateCollectionRequest,
  UpdateCollectionRequest,
} from "shared/types/api/video";

/** 获取视频上传授权 */
export function getOSSToken(): Promise<GetVodUploadAuthResponse> {
  return jikeingAdminService({
    url: "/admin/v1/vod/upload-auth",
    method: "post",
  });
}

/** 创建视频 */
export function createVideo(
  data: CreateVideoRequest,
): Promise<{ code: number; msg?: string }> {
  return jikeingAdminService({
    url: "/admin/v1/videos/create",
    method: "post",
    data,
  });
}

/** 更新视频 */
export function updateVideo(
  data: UpdateVideoRequest,
): Promise<{ code: number; msg?: string }> {
  return jikeingAdminService({
    url: "/admin/v1/videos/update",
    method: "post",
    data,
  });
}

/** 视频列表 */
export function videoList(params?: {
  page?: number;
  pageSize?: number;
}): Promise<VideoListResponse> {
  return jikeingAdminService({
    url: "/admin/v1/videos/list",
    method: "get",
    params,
  });
}

/** 视频详情 */
export function videoDetail(params: {
  id: string;
}): Promise<VideoDetailResponse> {
  return jikeingAdminService({
    url: "/admin/v1/videos/detail",
    method: "get",
    params,
  });
}

// ===================== 专辑 =====================

/** 创建专辑 */
export function createCollection(
  data: CreateCollectionRequest,
): Promise<{ code: number; msg?: string }> {
  return jikeingAdminService({
    url: "/admin/v1/collection/create",
    method: "post",
    data,
  });
}

/** 删除专辑 */
export function deleteCollection(data: { id: string }): Promise<any> {
  return jikeingAdminService({
    url: "/admin/v1/collection/delete",
    method: "post",
    data,
  });
}

/** 专辑列表 */
export function collectionList(params?: {
  page?: number;
  pageSize?: number;
}): Promise<CollectionListResponse> {
  return jikeingAdminService({
    url: "/admin/v1/collection/list",
    method: "get",
    params,
  });
}

/** 专辑详情 */
export function collectionDetail(params: {
  id: string;
}): Promise<CollectionDetailResponse> {
  return jikeingAdminService({
    url: "/admin/v1/collection/detail",
    method: "get",
    params,
  });
}

/** 更新专辑 */
export function updateCollection(
  data: UpdateCollectionRequest,
): Promise<{ code: number; msg?: string }> {
  return jikeingAdminService({
    url: "/admin/v1/collection/update",
    method: "post",
    data,
  });
}
