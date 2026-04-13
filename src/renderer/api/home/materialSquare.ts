/**
 * 素材广场接口
 * 对应 jikeing-web/src/api/home/materialSquare.js
 */

import { jikeingService } from "service/aiRequest";
import type {
    MaterialSquareItem,
    MaterialSquareListResponse,
    ImageUploadSubmitRequest,
    ImageUploadSubmitResponse,
} from "shared/types/api/materialSquare";

/** 素材广场列表 */
export function apiMaterailSquareList(params?: {
    page?: number;
    pageSize?: number;
}): Promise<MaterialSquareListResponse> {
    return jikeingService({
        url: "/materialsquare/v1/page-list",
        method: "get",
        params,
    });
}

/** 图片拆分提交 */
export function apiImageUploadSubmit(
    data: ImageUploadSubmitRequest,
): Promise<ImageUploadSubmitResponse> {
    return jikeingService({
        url: "/imagesplit/v1/submit",
        method: "post",
        data,
    });
}
