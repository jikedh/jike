import { Star, Zap } from "lucide-react";
import { useMemo } from "react";
import { cn } from "shared/utils/utils";
import { generateAvatarUrl, getRandomStyle } from "../lib/utils";

const ScoreStat = ({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) => (
  <div>
    <dt className="mb-0.5 text-xs text-white/30">{label}</dt>
    <dd
      className={cn(
        "flex items-center gap-2 text-2xl font-bold tracking-tighter",
        muted && "text-white/80",
      )}
    >
      {!muted && <Zap className="h-4 w-4 fill-[#B43FEB] text-[#B43FEB]" />}
      {value}
    </dd>
  </div>
);

export const ProfileHeader = ({
  avatarUrl,
  userId,
  totalScore,
}: {
  avatarUrl: string;
  userId: string;
  totalScore: number;
}) => {
  // 优先真实头像，无真实头像时 fallback 到基于 userId 的 dicebear 头像
  const displayAvatar = useMemo(() => {
    if (avatarUrl) return avatarUrl;
    const seed = userId || "default-user";
    const style = getRandomStyle(seed);
    return generateAvatarUrl(seed, style);
  }, [avatarUrl, userId]);

  return (
    <header className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-[#1a1a1c] to-[#09090b] px-8 pb-12 pt-16">
      <span className="absolute right-0 top-0 h-[300px] w-[500px] -translate-y-20 translate-x-40 rounded-full bg-[#B43FEB]/5 blur-[120px]" />

      <section className="relative z-10 mx-auto flex max-w-6xl flex-col items-center gap-8 md:flex-row md:items-end md:justify-between">
        <article className="flex items-center gap-6">
          <figure className="group relative">
            <span className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-[#B43FEB] to-[#2b5aed] opacity-40 blur transition duration-500 group-hover:opacity-70" />
            <img
              src={displayAvatar}
              alt="User Avatar"
              className="relative h-24 w-24 rounded-3xl border-2 border-white/10 bg-[#161618] object-cover"
            />
            <figcaption className="absolute -bottom-2 -right-2 rounded-xl border-2 border-[#09090b] bg-[#B43FEB] p-1.5 shadow-lg">
              <Star className="h-4 w-4 fill-white text-white" />
            </figcaption>
          </figure>

          <section>
            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
              即刻创作者
              <span className="rounded-md border border-[#B43FEB]/30 bg-[#B43FEB]/20 px-2 py-0.5 text-[10px] font-bold text-[#B43FEB]">
                PRO MEMBER
              </span>
            </h1>
            <p className="mb-4 mt-2 text-sm text-white/40">
              ID: {userId || "88592031"}
              {/* · 注册于 2024年3月 */}
            </p>
            <dl className="flex items-center gap-6">
              <ScoreStat label="剩余积分" value={totalScore.toLocaleString()} />
              <span className="h-8 w-px bg-white/5" />
              <ScoreStat label="累计消耗" value="12.5k" muted />
            </dl>
          </section>
        </article>
      </section>
    </header>
  );
};
