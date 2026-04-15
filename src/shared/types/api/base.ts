/**
 * 管理端基础模块类型定义
 */

// ===================== OSS 上传 =====================

/** 获取 OSS 上传地址响应 */
export interface PutUrlResponse {
  code: number;
  msg?: string;
  data: {
    uploadUrl: string;
    fileUrl: string;
  };
}

/** 获取 OSS 上传地址请求 */
export interface PutUrlRequest {
  fileName: string;
  fileType?: string;
}

// ===================== 基础文件管理 =====================

/** 文件项 */
export interface BaseFileItem {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  fileType?: string;
  groupId?: string;
  groupName?: string;
  createTime: string;
  updateTime?: string;
}

/** 文件分组项 */
export interface FileGroupItem {
  id: string;
  name: string;
  sort?: number;
  fileCount?: number;
  createTime: string;
}

/** 文件列表请求 */
export interface FileListRequest {
  groupId?: string;
  fileName?: string;
  page?: number;
  pageSize?: number;
}

/** 文件列表响应 */
export interface FileListResponse {
  code: number;
  msg?: string;
  data: {
    list: BaseFileItem[];
    total: number;
  };
}

/** 上传文件响应 */
export interface UploadFileResponse {
  code: number;
  msg?: string;
  data: {
    fileUrl: string;
    fileName: string;
  };
}

/** 创建文件记录请求 */
export interface CreateFileRequest {
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  fileType?: string;
  groupId?: string;
}

/** 文件分组列表响应 */
export interface GroupListResponse {
  code: number;
  msg?: string;
  data: {
    list: FileGroupItem[];
    total: number;
  };
}

/** 新增分组请求 */
export interface AddGroupRequest {
  name: string;
  sort?: number;
}

/** 关联分组请求 */
export interface AssocGroupRequest {
  fileIds: string[];
  groupId: string;
}

// ===================== 用户类型 =====================

/** 用户类型项 */
export interface UserTypeItem {
  id: string;
  name: string;
  code: string;
}

/** 用户类型列表响应 */
export interface GetUserTypeListResponse {
  code: number;
  msg?: string;
  data: UserTypeItem[];
}

// ===================== 验证码 =====================

/** 验证码请求 */
export interface CaptchaRequest {
  type?: string;
}

/** 验证码响应 */
export interface CaptchaResponse {
  code: number;
  msg?: string;
  data: {
    captchaId: string;
    captchaImage: string;
  };
}
