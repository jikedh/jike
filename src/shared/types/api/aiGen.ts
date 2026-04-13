/**
 * AI任务管理模块类型定义
 */

// ===================== 管理端 AI 任务 =====================

/** AI 任务项 */
export interface AiAdminTaskItem {
    id: string;
    userId: string;
    userName?: string;
    userNickname?: string;
    type: string;
    model: string;
    prompt: string;
    status: "pending" | "processing" | "completed" | "failed";
    progress?: number;
    result?: any;
    errorMsg?: string;
    createTime: string;
    updateTime?: string;
    finishTime?: string;
}

/** AI 任务列表响应 */
export interface AiAdminTaskListResponse {
    code: number;
    msg?: string;
    data: {
        list: AiAdminTaskItem[];
        total: number;
        page: number;
        pageSize: number;
    };
}

/** AI 任务列表请求 */
export interface AiAdminTaskListRequest {
    userId?: string;
    type?: string;
    model?: string;
    status?: string;
    startTime?: string;
    endTime?: string;
    page?: number;
    pageSize?: number;
}
