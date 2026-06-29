import { getJikeGoUserInfo } from "@/api/jikeGo";

// 待补全项 key 列表（与 FirstLoginGuideDialog 中 GuideItem["key"] 对齐）
export type PendingItemKey = "username";

export interface ProfileCompletenessResult {
  pending: PendingItemKey[];
  // 后端返回的原始信息（用于其他组件读取，避免重复请求）
  profile: {
    id: string;
    uuid: string;
    nickname: string;
    email: string;
    mobile: string;
    avatar: string;
    username: string;
  };
}

// 与 Profile 页一致的 success code 判定
const SUCCESS_CODES = new Set([200, 10000]);

// 判断 username 是否属于"尚未自定义"：
// 为空、或以 wx_ 开头（微信渠道默认账号）均视为待补全
const isUsernameUnset = (username: string): boolean =>
  !username || username.startsWith("wx_");

// 校验用户基础信息与安全设置的完整性，返回待补全项列表
export const checkProfileCompleteness =
  async (): Promise<ProfileCompletenessResult> => {
    const res: any = await getJikeGoUserInfo();
    const data = res?.data ?? {};

    const profile = {
      id: String(data.id ?? ""),
      uuid: String(data.uuid ?? ""),
      nickname: String(data.nickname ?? "").trim(),
      email: String(data.email ?? "").trim(),
      mobile: String(data.mobile ?? "").trim(),
      avatar: String(data.avatar ?? ""),
      username: String(data.username ?? "").trim(),
    };

    // 当前账号完善引导只要求用户设置自定义用户名。
    const pending: PendingItemKey[] = [];
    if (isUsernameUnset(profile.username)) pending.push("username");

    return { pending, profile };
  };

// 判断后端是否成功（供外部使用）
export const isFetchSuccess = (code: number | undefined) =>
  code === undefined || SUCCESS_CODES.has(code);
