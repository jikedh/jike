/**
 * 百度网盘模块类型定义
 */

// ===================== 百度网盘 =====================

/** 百度网盘授权 URL 响应 */
export interface BaidupanAuthUrlResponse {
    code: number;
    msg?: string;
    data: {
        authUrl: string;
    };
}

/** 百度网盘文件项 */
export interface BaidupanFileItem {
    id: string;
    name: string;
    path: string;
    size?: number;
    isDirectory: boolean;
    thumbnail?: string;
    downloadUrl?: string;
    createTime?: string;
    updateTime?: string;
}

/** 百度网盘文件列表响应 */
export interface BaidupanFileListResponse {
    code: number;
    msg?: string;
    data: {
        list: BaidupanFileItem[];
        total: number;
        currentDir: string;
    };
}

/** 百度网盘文件列表请求 */
export interface BaidupanFileListRequest {
    path?: string;
    orderBy?: string;
    orderDesc?: boolean;
    page?: number;
    pageSize?: number;
}
