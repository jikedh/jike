import { Check, Inbox, MailQuestion, Send, X } from "lucide-react";
import type { TeamInvitation, TeamInvitationStatus } from "shared/types/api/teams";
import { cn } from "shared/utils/utils";
import { Button } from "@/components/ui/button";
import { formatTeamTime } from "../utils";

const STATUS_STYLE: Record<TeamInvitationStatus, { label: string; className: string }> = {
    PENDING: { label: "待处理", className: "bg-amber-500/10 text-amber-400" },
    ACCEPTED: { label: "已接受", className: "bg-green-500/10 text-green-400" },
    REJECTED: { label: "已拒绝", className: "bg-white/5 text-white/40" },
};

const StatusBadge = ({ status }: { status: TeamInvitationStatus }) => (
    <span
        className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold",
            STATUS_STYLE[status].className,
        )}
    >
        {STATUS_STYLE[status].label}
    </span>
);

interface InvitationsPanelProps {
    myInvitations: TeamInvitation[];
    sentInvitations: TeamInvitation[];
    isOwner: boolean;
    onAccept: (invitation: TeamInvitation) => void;
    onReject: (invitation: TeamInvitation) => void;
}

/** 邀请中心：我收到的邀请 + 当前团队已发出的邀请。 */
export function InvitationsPanel({
    myInvitations,
    sentInvitations,
    isOwner,
    onAccept,
    onReject,
}: InvitationsPanelProps) {
    const pendingCount = myInvitations.filter((inv) => inv.status === "PENDING").length;

    return (
        <section className="overflow-hidden rounded-[24px] border border-white/5 bg-[#121214]">
            <header className="flex items-center justify-between border-b border-white/5 px-6 py-4">
                <div>
                    <h2 className="text-base font-bold text-white">邀请中心</h2>
                    <p className="mt-0.5 text-xs text-white/35">
                        处理收到的团队邀请，并查看当前团队已发出的邀请
                    </p>
                </div>
                {pendingCount > 0 && (
                    <span className="rounded-full bg-[#B43FEB]/15 px-3 py-1 text-xs font-bold text-[#d896ff]">
                        {pendingCount} 条待处理
                    </span>
                )}
            </header>

            <div className="grid gap-0 xl:grid-cols-2 xl:divide-x xl:divide-white/5">
                {/* 我收到的邀请 */}
                <div>
                    <div className="flex items-center gap-2 px-6 pt-4 text-xs font-bold text-white/45">
                        <Inbox className="h-4 w-4" />
                        我收到的邀请
                    </div>
                    <ul className="divide-y divide-white/5">
                        {myInvitations.length === 0 && (
                            <li className="px-6 py-8 text-center text-xs text-white/30">
                                暂无收到的邀请
                            </li>
                        )}
                        {myInvitations.map((inv) => (
                            <li key={String(inv.id)} className="flex items-center gap-3 px-6 py-4">
                                <img
                                    src={inv.inviterAvatar}
                                    alt={inv.inviterNickname}
                                    className="h-9 w-9 shrink-0 rounded-full border border-white/10 bg-white/5"
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm text-white">
                                        <span className="font-bold">{inv.inviterNickname}</span>
                                        <span className="text-white/50"> 邀请你加入 </span>
                                        <span className="font-bold text-[#d896ff]">{inv.teamName}</span>
                                    </div>
                                    <div className="mt-0.5 text-[11px] text-white/30">
                                        {formatTeamTime(inv.createdAt)}
                                    </div>
                                </div>
                                {inv.status === "PENDING" ? (
                                    <div className="flex shrink-0 items-center gap-2">
                                        <Button size="sm" variant="blue" onClick={() => onAccept(inv)}>
                                            <Check className="h-3.5 w-3.5" />
                                            接受
                                        </Button>
                                        <Button size="sm" onClick={() => onReject(inv)}>
                                            <X className="h-3.5 w-3.5" />
                                            拒绝
                                        </Button>
                                    </div>
                                ) : (
                                    <StatusBadge status={inv.status} />
                                )}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* 当前团队已发出的邀请 */}
                <div>
                    <div className="flex items-center gap-2 px-6 pt-4 text-xs font-bold text-white/45">
                        <Send className="h-4 w-4" />
                        已发出的邀请
                    </div>
                    <ul className="divide-y divide-white/5">
                        {!isOwner && (
                            <li className="flex items-center gap-2 px-6 py-8 text-xs text-white/30">
                                <MailQuestion className="h-4 w-4" />
                                仅团队负责人可查看已发出的邀请
                            </li>
                        )}
                        {isOwner && sentInvitations.length === 0 && (
                            <li className="px-6 py-8 text-center text-xs text-white/30">
                                当前团队暂未发出邀请
                            </li>
                        )}
                        {isOwner &&
                            sentInvitations.map((inv) => (
                                <li key={String(inv.id)} className="flex items-center gap-3 px-6 py-4">
                                    <img
                                        src={inv.inviteeAvatar}
                                        alt={inv.inviteeNickname}
                                        className="h-9 w-9 shrink-0 rounded-full border border-white/10 bg-white/5"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-bold text-white">
                                            {inv.inviteeNickname}
                                            <span className="ml-2 text-xs font-normal text-white/35">
                                                ID {String(inv.inviteeUserId)}
                                            </span>
                                        </div>
                                        <div className="mt-0.5 text-[11px] text-white/30">
                                            邀请于 {formatTeamTime(inv.createdAt)}
                                        </div>
                                    </div>
                                    <StatusBadge status={inv.status} />
                                </li>
                            ))}
                    </ul>
                </div>
            </div>
        </section>
    );
}
