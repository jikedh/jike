import { ChevronRight, KeyRound } from "lucide-react";
import { useMemo, useState } from "react";
import { ProfileHeader } from "./components/ProfileHeader";
import {
    PROFILE_INFO_ICONS,
    ProfileInfoCard,
    type ProfileInfoItem,
} from "./components/ProfileInfoCard";
import { PasswordDialog } from "./components/PasswordDialog";
import { getAvatarUrl } from "./lib/avatar";
import { PROFILE_MOCK } from "./lib/mock";

const ProfilePage = () => {
    const [passwordOpen, setPasswordOpen] = useState(false);

    // 静态 mock 数据集中在 lib/mock.ts，后续替换为真实接口即可
    const avatarUrl = useMemo(() => getAvatarUrl(PROFILE_MOCK.userId), []);

    // 信息列表数据，纯展示用
    const infoItems = useMemo<ProfileInfoItem[]>(
        () => [
            {
                key: "nickname",
                icon: PROFILE_INFO_ICONS.nickname,
                label: "自定义昵称",
                value: PROFILE_MOCK.nickname,
                editable: true,
            },
            {
                key: "email",
                icon: PROFILE_INFO_ICONS.email,
                label: "邮箱",
                value: PROFILE_MOCK.email,
                editable: true,
                actionText: "更换",
            },
            {
                key: "phone",
                icon: PROFILE_INFO_ICONS.phone,
                label: "手机号",
                value: PROFILE_MOCK.phone,
                editable: true,
                actionText: "更换",
            },
        ],
        [],
    );

    return (
        <div className="min-h-screen bg-[#09090b] text-white">
            <ProfileHeader
                avatarUrl={avatarUrl}
                nickname={PROFILE_MOCK.nickname}
                userId={PROFILE_MOCK.userId}
                vipLabel={PROFILE_MOCK.vipLabel}
                registeredAt={PROFILE_MOCK.registeredAt}
            />

            <main className="mx-auto max-w-5xl px-8 py-10">
                {/* 基础信息 */}
                <section className="space-y-3">
                    <header className="flex items-end justify-between">
                        <h2 className="text-sm font-semibold tracking-tight text-white/80">
                            基础信息
                        </h2>
                        <span className="text-[11px] text-white/30">
                            点击右侧按钮可修改对应信息
                        </span>
                    </header>
                    <ProfileInfoCard items={infoItems} />
                </section>

                {/* 安全设置 */}
                <section className="mt-8 space-y-3">
                    <header className="flex items-end justify-between">
                        <h2 className="text-sm font-semibold tracking-tight text-white/80">
                            安全设置
                        </h2>
                        <span className="text-[11px] text-white/30">
                            上次更新：{PROFILE_MOCK.lastPasswordUpdate}
                        </span>
                    </header>
                    <ul className="overflow-hidden rounded-2xl border border-white/5 bg-[#121214]">
                        <li
                            className="group flex cursor-pointer items-center gap-4 px-5 py-4 transition-colors hover:bg-white/[0.03]"
                            onClick={() => setPasswordOpen(true)}
                        >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#B43FEB]/15 text-[#B43FEB]">
                                <KeyRound className="h-4 w-4" />
                            </span>
                            <div className="flex min-w-0 flex-1 flex-col">
                                <span className="text-sm text-white/90">登录密码</span>
                                <span className="mt-0.5 text-xs text-white/40">
                                    定期更换密码可提升账户安全
                                </span>
                            </div>
                            <span className="flex shrink-0 items-center gap-1 text-xs text-white/40 transition-colors group-hover:text-white/80">
                                设置
                                <ChevronRight className="h-3.5 w-3.5" />
                            </span>
                        </li>
                    </ul>
                </section>
            </main>

            <PasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
        </div>
    );
};

export default ProfilePage;
