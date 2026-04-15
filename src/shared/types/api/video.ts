/**
 * 视频模块类型定义
 */

// ===================== 视频上传 =====================

/** 获取视频上传凭证响应 */
export interface GetVodUploadAuthResponse {
  code: number;
  msg?: string;
  data: {
    uploadAuth: string;
    uploadAddress: string;
    videoId: string;
  };
}

// ===================== 管理端视频 =====================

/** 视频项 */
export interface VideoItem {
  id: string;
  title: string;
  cover: string;
  videoUrl: string;
  duration?: number;
  status: number;
  viewCount?: number;
  likeCount?: number;
  createTime: string;
  updateTime?: string;
}

/** 视频列表响应 */
export interface VideoListResponse {
  code: number;
  msg?: string;
  data: {
    list: VideoItem[];
    total: number;
    page: number;
    pageSize: number;
  };
}

/** 视频详情响应 */
export interface VideoDetailResponse {
  code: number;
  msg?: string;
  data: VideoItem;
}

/** 创建视频请求 */
export interface CreateVideoRequest {
  title: string;
  cover: string;
  videoUrl: string;
  duration?: number;
  status?: number;
}

/** 更新视频请求 */
export interface UpdateVideoRequest extends CreateVideoRequest {
  id: string;
}

// ===================== 专辑 =====================

/** 专辑项 */
export interface CollectionItem {
  id: string;
  title: string;
  cover: string;
  description?: string;
  videoCount?: number;
  status: number;
  createTime: string;
  updateTime?: string;
}

/** 专辑列表响应 */
export interface CollectionListResponse {
  code: number;
  msg?: string;
  data: {
    list: CollectionItem[];
    total: number;
    page: number;
    pageSize: number;
  };
}

/** 专辑详情响应 */
export interface CollectionDetailResponse {
  code: number;
  msg?: string;
  data: CollectionItem & {
    videos: VideoItem[];
  };
}

/** 创建专辑请求 */
export interface CreateCollectionRequest {
  title: string;
  cover: string;
  description?: string;
  status?: number;
}

/** 更新专辑请求 */
export interface UpdateCollectionRequest extends CreateCollectionRequest {
  id: string;
}
