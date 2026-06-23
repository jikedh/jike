import { isPasswordSettled } from "@/components/FirstLoginGuideDialog";
import { getJikeGoUserInfo } from "@/api/jikeGo";

// 待补全项 key 列表（与 FirstLoginGuideDialog 中 GuideItem["key"] 对齐）
export type PendingItemKey =
    | "nickname"
    | "email"
    | "mobile"
    | "password";

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
            username: String(data.username ?? ""),
        };

        const pending: PendingItemKey[] = [];
        if (!profile.nickname) pending.push("nickname");
        if (!profile.email) pending.push("email");
        if (!profile.mobile) pending.push("mobile");
        // 密码已设置过则不再提示
        if (!isPasswordSettled()) pending.push("password");

        return { pending, profile };
    };

// 判断后端是否成功（供外部使用）
export const isFetchSuccess = (code: number | undefined) =>
    code === undefined || SUCCESS_CODES.has(code);
