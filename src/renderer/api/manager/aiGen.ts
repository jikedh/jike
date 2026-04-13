/**
 * 管理端 AI 任务接口
 * 对应 jikeing-web/src/api/manager/aiGen.js
 */

import { jikeingAdminService } from "service/aiRequest";
import type {
    AiAdminTaskListResponse,
    AiAdminTaskListRequest,
} from "shared/types/api/aiGen";

/** AI 任务管理列表 */
export function aiAdminTaskList(
    params?: AiAdminTaskListRequest,
): Promise<AiAdminTaskListResponse> {
    return jikeingAdminService({
        url: "/v1/nanotask/admin/page-list",
        method: "get",
        params,
    });
}
