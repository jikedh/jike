/**
 * 素材广场模块类型定义
 */

// ===================== 用户端素材广场 =====================

/** 素材广场列表项 */
export interface MaterialSquareItem {
    id: string;
    title: string;
    cover: string;
    images?: string[];
    authorId?: string;
    authorName?: string;
    authorAvatar?: string;
    tags?: string[];
    collectCount?: number;
    viewCount?: number;
    createTime: number;
}

/** 素材广场列表响应 */
export interface MaterialSquareListResponse {
    list: MaterialSquareItem[];
    total: number;
    page: number;
    pageSize: number;
}

/** 图片拆分提交请求 */
export interface ImageUploadSubmitRequest {
    imageUrl: string;
    type?: string;
}

/** 图片拆分提交响应 */
export interface ImageUploadSubmitResponse {
    taskId: string;
    status: string;
}

// ===================== 管理端素材广场 =====================

/** 管理端素材广场列表项 */
export interface AdminMaterialSquareItem {
    id: string;
    title: string;
    cover: string;
    images?: string[];
    authorId?: string;
    authorName?: string;
    authorAvatar?: string;
    tags?: string[];
    collectCount?: number;
    viewCount?: number;
    status: number;
    auditStatus?: number;
    createTime: string;
    updateTime?: string;
}

/** 管理端素材广场列表响应 */
export interface AdminMaterialSquareListResponse {
    list: AdminMaterialSquareItem[];
    total: number;
    page: number;
    pageSize: number;
}

/** 添加素材到广场请求 */
export interface AddMaterailToSquareRequest {
    materialId: string;
    title?: string;
    cover?: string;
    tags?: string[];
}

/** 拆图审核列表项 */
export interface AdminUploadSplitAuditItem {
    id: string;
    userId: string;
    userName?: string;
    originalImage: string;
    splitImages?: string[];
    status: "pending" | "approved" | "rejected";
    createTime: string;
    auditTime?: string;
    auditMemo?: string;
}

/** 拆图审核列表响应 */
export interface AdminUploadSplitAuditListResponse {
    list: AdminUploadSplitAuditItem[];
    total: number;
    page: number;
    pageSize: number;
}

/** 审核状态变更请求 */
export interface AdminUploadSplitStateChangeRequest {
    id: string;
    status: "approved" | "rejected";
    memo?: string;
}

/** 审核拒绝请求 */
export interface AdminUploadSplitRefuseRequest {
    id: string;
    reason: string;
}
