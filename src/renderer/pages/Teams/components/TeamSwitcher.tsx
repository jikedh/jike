import { Crown, Plus, Users } from "lucide-react";
import type { TeamInfo } from "shared/types/api/teams";
import { cn } from "shared/utils/utils";
import { formatTeamTime } from "../utils";

interface TeamSwitcherProps {
    teams: TeamInfo[];
    memberCounts: Record<string, number>;
    currentTeamId: string | number;
    onSelect: (teamId: string | number) => void;
    onCreate: () => void;
}

/** 顶部团队切换卡片列表 + 创建入口。 */
export function TeamSwitcher({
    teams,
    memberCounts,
    currentTeamId,
    onSelect,
    onCreate,
}: TeamSwitcherProps) {
    return (
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {teams.map((info) => {
                const active = String(info.id) === String(currentTeamId);
                const isOwner = info.currentRole === "OWNER";
                const count = memberCounts[String(info.id)] ?? 0;
                return (
                    <button
                        key={String(info.id)}
                        type="button"
                        onClick={() => onSelect(info.id)}
                        className={cn(
                            "group flex w-72 shrink-0 flex-col gap-3 rounded-[24px] border p-5 text-left transition-all cursor-pointer",
                            active
                                ? "border-[#B43FEB]/60 bg-linear-to-br from-[#B43FEB]/15 via-[#121214] to-[#121214] shadow-[0_0_25px_rgba(180,63,235,0.15)]"
                                : "border-white/5 bg-[#121214] hover:border-white/15",
                        )}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <span className="text-base font-bold text-white truncate">
                                {info.name}
                            </span>
                            <span
                                className={cn(
                                    "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold",
                                    isOwner
                                        ? "bg-[#B43FEB]/15 text-[#d896ff]"
                                        : "bg-white/5 text-white/50",
                                )}
                            >
                                {isOwner && <Crown className="h-3 w-3" />}
                                {isOwner ? "负责人" : "成员"}
                            </span>
                        </div>
                        <p className="line-clamp-2 min-h-8 text-xs leading-relaxed text-white/35">
                            {info.description || "暂无团队简介"}
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-white/30">
                            <span className="flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5" />
                                {count} 名成员
                            </span>
                            <span>创建于 {formatTeamTime(info.createdAt).slice(0, 10)}</span>
                        </div>
                    </button>
                );
            })}

            <button
                type="button"
                onClick={onCreate}
                className="flex w-48 shrink-0 flex-col items-center justify-center gap-2 rounded-[24px] border border-dashed border-white/10 bg-transparent text-white/35 transition-all hover:border-[#B43FEB]/50 hover:text-[#d896ff] cursor-pointer"
            >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
                    <Plus className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium">创建新团队</span>
            </button>
        </div>
    );
}
