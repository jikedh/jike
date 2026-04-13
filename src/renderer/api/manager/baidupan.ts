/**
 * 百度网盘接口
 * 对应 jikeing-web/src/api/manager/baidupan.js
 */

import { jikeingAdminService } from "service/aiRequest";
import type {
  BaidupanFileListResponse,
  BaidupanFileListRequest,
} from "shared/types/api/baidupan";

/** 百度网盘文件列表 */
export function baidupanList(
  params?: BaidupanFileListRequest,
): Promise<BaidupanFileListResponse> {
  return jikeingAdminService({
    url: "/v1/baidupan/filelist",
    method: "get",
    params,
  });
}
