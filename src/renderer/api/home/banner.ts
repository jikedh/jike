/**
 * 首页轮播图接口
 * 对应 jikeing-web/src/api/home/banner.js
 */

import { jikeingService } from "service/aiRequest";
import type { BannerItem } from "shared/types/api/banner";

/** 轮播图列表 */
export function bannersList(): Promise<{ list: BannerItem[] }> {
  return jikeingService({
    url: "/v1/home/banners",
    method: "get",
  });
}
