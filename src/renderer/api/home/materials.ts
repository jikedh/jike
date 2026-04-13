/**
 * 素材接口
 * 对应 jikeing-web/src/api/home/materials.js
 */

import { jikeingService } from "service/aiRequest";
import type {
  MaterialCategoryItem,
  MaterialItem,
  MaterialsListResponse,
  MaterialDetailResponse,
} from "shared/types/api/materials";

/** 素材分类列表 */
export function categoriesList(): Promise<{ list: MaterialCategoryItem[] }> {
  return jikeingService({
    url: "/v1/materials/categories",
    method: "get",
  });
}

/** 素材列表 */
export function materialsList(params?: {
  categoryId?: string;
  page?: number;
  pageSize?: number;
}): Promise<MaterialsListResponse> {
  return jikeingService({
    url: "/v1/materials",
    method: "get",
    params,
  });
}

/** 素材详情 */
export function materialsDetail(params: {
  id: string;
}): Promise<MaterialDetailResponse> {
  return jikeingService({
    url: "/v1/materials/detail",
    method: "get",
    params,
  });
}
