/**
 * 管理端基础接口
 * 对应 jikeing-web/src/api/manager/base.js
 */

import { jikeingAdminService } from "service/aiRequest";
import type {
    PutUrlRequest,
    PutUrlResponse,
    BaidupanAuthUrlResponse,
    FileListRequest,
    FileListResponse,
    UploadFileResponse,
    CreateFileRequest,
    GroupListResponse,
    AddGroupRequest,
    AssocGroupRequest,
    GetUserTypeListResponse,
    CaptchaRequest,
    CaptchaResponse,
} from "shared/types/api/base";

/** 获取 OSS 上传地址 */
export function putUrl(data: PutUrlRequest): Promise<PutUrlResponse> {
    return jikeingAdminService({
        url: "/v1/oss/put-url",
        method: "post",
        data,
    });
}

/** 百度网盘授权 URL */
export function baidupanAuthUrl(): Promise<BaidupanAuthUrlResponse> {
    return jikeingAdminService({
        url: "/v1/baidupan/oauth-url",
        method: "get",
    });
}

/** 文件列表 */
export function fileList(data?: FileListRequest): Promise<FileListResponse> {
    return jikeingAdminService({
        url: "/api/base/file/getList",
        method: "post",
        data,
    });
}

/** 文件上传 */
export function upload(formData: FormData): Promise<UploadFileResponse> {
    return jikeingAdminService({
        url: "/api/base/file/upload",
        method: "post",
        data: formData,
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });
}

/** 删除文件 */
export function removeFile(data: { ids: string[] }): Promise<any> {
    return jikeingAdminService({
        url: "/api/base/file/remove",
        method: "post",
        data,
    });
}

/** 用户类型列表 */
export function getUserTypeList(): Promise<GetUserTypeListResponse> {
    return jikeingAdminService({
        url: "/api/base/login/getUserTypeList",
        method: "post",
    });
}

/** 新增分组 */
export function addGroup(data: AddGroupRequest): Promise<any> {
    return jikeingAdminService({
        url: "/api/base/file/addGroup",
        method: "post",
        data,
    });
}

/** 分组列表 */
export function groupList(): Promise<GroupListResponse> {
    return jikeingAdminService({
        url: "/api/base/file/getGroupList",
        method: "post",
    });
}

/** 关联分组 */
export function assocGroup(data: AssocGroupRequest): Promise<any> {
    return jikeingAdminService({
        url: "/api/base/file/assocGroup",
        method: "post",
        data,
    });
}

/** 批量删除文件分组关联 */
export function deleteFilesGroup(data: { fileIds: string[] }): Promise<any> {
    return jikeingAdminService({
        url: "/api/base/file/deleteFilesGroup",
        method: "post",
        data,
    });
}

/** 删除分组 */
export function deleteGroup(data: { id: string }): Promise<any> {
    return jikeingAdminService({
        url: "/api/base/file/deleteGroup",
        method: "post",
        data,
    });
}

/** 创建文件记录 */
export function createFile(data: CreateFileRequest): Promise<any> {
    return jikeingAdminService({
        url: "/api/base/file/createFile",
        method: "post",
        data,
    });
}

/** 验证码 */
export function captcha(data?: CaptchaRequest): Promise<CaptchaResponse> {
    return jikeingAdminService({
        url: "/Login/verify",
        method: "post",
        data,
    });
}
