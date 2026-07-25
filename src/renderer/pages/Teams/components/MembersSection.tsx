import { Coins, Crown, LogOut, MoreHorizontal, Trash2, UserPlus } from "lucide-react";
import type { TeamMember } from "shared/types/api/teams";
import { cn } from "shared/utils/utils";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatTeamTime } from "../utils";

interface MembersSectionProps {
    members: TeamMember[];
    isOwner: boolean;
    currentUserId: string;
    onInvite: () => void;
    onAllocate: (member: TeamMember) => void;
    onRemove: (member: TeamMember) => void;
    onLeave: () => void;
}

/** 团队成员管理区。 */
export function MembersSection({
    members,
    isOwner,
    currentUserId,
    onInvite,
    onAllocate,
    onRemove,
    onLeave,
}: MembersSectionProps) {
    return (
        <section className="overflow-hidden rounded-[24px] border border-white/5 bg-[#121214]">
            <header className="flex items-center justify-between border-b border-white/5 px-6 py-4">
                <div>
                    <h2 className="text-base font-bold text-white">成员管理</h2>
                    <p className="mt-0.5 text-xs text-white/35">
                        共 {members.length} 名成员，负责人可分配积分或移除成员
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {!isOwner && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onLeave}
                            className="text-red-400/80 hover:text-red-300"
                        >
                            <LogOut className="h-4 w-4" />
                            退出团队
                        </Button>
                    )}
                    {isOwner && (
                        <Button variant="blue" size="sm" onClick={onInvite}>
                            <UserPlus className="h-4 w-4" />
                            邀请成员
                        </Button>
                    )}
                </div>
            </header>

            <ul className="divide-y divide-white/5">
                {members.map((member) => {
                    const isSelf = String(member.userId) === currentUserId;
                    const isMemberOwner = member.role === "OWNER";
                    return (
                        <li
                            key={String(member.id)}
                            className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-white/2"
                        >
                            <img
                                src={member.avatar}
                                alt={member.nickname}
                                className="h-11 w-11 shrink-0 rounded-full border border-white/10 bg-white/5"
                            />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-bold text-white">
                                        {member.nickname}
                                    </span>
                                    {isMemberOwner && (
                                        <span className="flex items-center gap-1 rounded-full bg-[#B43FEB]/15 px-2 py-0.5 text-[10px] font-bold text-[#d896ff]">
                                            <Crown className="h-3 w-3" />
                                            负责人
                                        </span>
                                    )}
                                    {isSelf && (
                                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/45">
                                            我
                                        </span>
                                    )}
                                </div>
                                <div className="mt-0.5 text-xs text-white/30">
                                    ID {String(member.userId)} · {formatTeamTime(member.joinedAt)} 加入
                                </div>
                            </div>

                            {isOwner && !isSelf && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            unstyled
                                            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/5 hover:text-white/80"
                                        >
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        className="w-40 border-white/10 bg-[#1a1a1e] text-white"
                                    >
                                        <DropdownMenuItem
                                            onClick={() => onAllocate(member)}
                                            className="cursor-pointer text-white/80 focus:bg-white/5 focus:text-white"
                                        >
                                            <Coins className="h-4 w-4 text-[#d896ff]" />
                                            分配积分
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator className="bg-white/5" />
                                        <DropdownMenuItem
                                            variant="destructive"
                                            onClick={() => onRemove(member)}
                                            className={cn(
                                                "cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-300",
                                            )}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            移除成员
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
