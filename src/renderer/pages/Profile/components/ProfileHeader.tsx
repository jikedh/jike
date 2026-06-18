import { Camera, ShieldCheck } from "lucide-react";

interface ProfileHeaderProps {
    avatarUrl: string;
    nickname: string;
    userId: string;
    vipLabel: string;
    registeredAt: string;
}

// 顶部展示区：大头像 + 昵称 + 会员徽章 + 注册时间
export const ProfileHeader = ({
    avatarUrl,
    nickname,
    userId,
    vipLabel,
    registeredAt,
}: ProfileHeaderProps) => (
    <header className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-[#1a1a1c] to-[#09090b] px-8 pb-12 pt-16">
        {/* 紫色光晕装饰，参考 Points 页面风格 */}
        <span className="pointer-events-none absolute right-0 top-0 h-[300px] w-[500px] -translate-y-20 translate-x-40 rounded-full bg-[#B43FEB]/5 blur-[120px]" />

        <section className="relative z-10 mx-auto flex max-w-5xl flex-col items-center gap-8 md:flex-row md:items-center md:gap-10">
            <figure className="group relative">
                <span className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-[#B43FEB] to-[#2b5aed] opacity-40 blur transition duration-500 group-hover:opacity-70" />
                <img
                    src={avatarUrl}
                    alt={nickname}
                    className="relative h-28 w-28 rounded-3xl border-2 border-white/10 bg-[#161618] object-cover"
                />
                {/* 修改头像入口（静态展示，暂不实现上传） */}
                <button
                    type="button"
                    className="absolute -bottom-2 -right-2 flex items-center justify-center rounded-xl border-2 border-[#09090b] bg-[#B43FEB] p-2 shadow-lg transition-transform hover:scale-105"
                    title="更换头像"
                >
                    <Camera className="h-3.5 w-3.5 text-white" />
                </button>
            </figure>

            <section className="flex flex-1 flex-col items-center text-center md:items-start md:text-left">
                <h1 className="flex flex-wrap items-center justify-center gap-3 text-3xl font-bold tracking-tight md:justify-start">
                    {nickname}
                    <span className="rounded-md border border-[#B43FEB]/30 bg-[#B43FEB]/20 px-2 py-0.5 text-[10px] font-bold text-[#B43FEB]">
                        {vipLabel}
                    </span>
                </h1>
                <p className="mt-2 text-sm text-white/40">
                    ID: {userId} · 注册于 {registeredAt}
                </p>
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    账户安全状态良好
                </p>
            </section>
        </section>
    </header>
);
