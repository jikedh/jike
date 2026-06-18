import { Camera, Loader2, ShieldCheck } from "lucide-react";
import { useRef } from "react";

interface ProfileHeaderProps {
    avatarUrl: string;
    fallbackAvatarUrl: string;
    nickname: string;
    username: string;
    userId: string;
    vipLabel: string;
    registeredAt: string;
    uploading: boolean;
    onPickAvatar: (file: File) => void;
}

const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/jpg,image/webp";

// 顶部展示区：大头像 + 昵称 + 会员徽章 + 本地上传头像
export const ProfileHeader = ({
    avatarUrl,
    fallbackAvatarUrl,
    nickname,
    username,
    userId,
    vipLabel,
    registeredAt,
    uploading,
    onPickAvatar,
}: ProfileHeaderProps) => {
    const inputRef = useRef<HTMLInputElement | null>(null);

    const handleSelect = () => {
        if (uploading) return;
        inputRef.current?.click();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // 同一文件再次选择时需要清空 value，否则不会触发 change
        e.target.value = "";
        if (!file) return;
        onPickAvatar(file);
    };

    // 真实头像不存在时回退到 dicebear，保证基础视觉
    const displayUrl = avatarUrl || fallbackAvatarUrl;

    return (
        <header className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-[#1a1a1c] to-[#09090b] px-8 pb-12 pt-16">
            <span className="pointer-events-none absolute right-0 top-0 h-[300px] w-[500px] -translate-y-20 translate-x-40 rounded-full bg-[#B43FEB]/5 blur-[120px]" />

            <section className="relative z-10 mx-auto flex max-w-5xl flex-col items-center gap-8 md:flex-row md:items-center md:gap-10">
                <figure className="group relative">
                    <span className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-[#B43FEB] to-[#2b5aed] opacity-40 blur transition duration-500 group-hover:opacity-70" />
                    <img
                        src={displayUrl}
                        alt={nickname || username}
                        className="relative h-28 w-28 rounded-3xl border-2 border-white/10 bg-[#161618] object-cover"
                    />

                    {uploading && (
                        <span className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-black/55 text-white">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={handleSelect}
                        disabled={uploading}
                        className="absolute -bottom-2 -right-2 z-10 flex items-center justify-center rounded-xl border-2 border-[#09090b] bg-[#B43FEB] p-2 shadow-lg transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
                        title="更换头像"
                    >
                        <Camera className="h-3.5 w-3.5 text-white" />
                    </button>

                    <input
                        ref={inputRef}
                        type="file"
                        accept={ACCEPTED_IMAGE_TYPES}
                        className="hidden"
                        onChange={handleChange}
                    />
                </figure>

                <section className="flex flex-1 flex-col items-center text-center md:items-start md:text-left">
                    <h1 className="flex flex-wrap items-center justify-center gap-3 text-3xl font-bold tracking-tight md:justify-start">
                        {nickname || username || "未命名用户"}
                        {vipLabel && (
                            <span className="rounded-md border border-[#B43FEB]/30 bg-[#B43FEB]/20 px-2 py-0.5 text-[10px] font-bold text-[#B43FEB]">
                                {vipLabel}
                            </span>
                        )}
                    </h1>
                    <p className="mt-2 text-sm text-white/40">
                        ID: {userId}
                        {registeredAt && ` · 注册于 ${registeredAt}`}
                    </p>
                    <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        账户安全状态良好
                    </p>
                </section>
            </section>
        </header>
    );
};
