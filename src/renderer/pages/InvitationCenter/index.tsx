import { ArrowLeft, Crown, Loader2, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { TeamId, TeamInfo, TeamInvitation } from "shared/types/api/teams";
import { cn } from "shared/utils/utils";
import { toast } from "sonner";
import {
    acceptTeamInvitation,
    getMyTeamInvitations,
    getTeamInvitations,
    getTeamList,
    rejectTeamInvitation,
} from "@/api/teams";
import { Button } from "@/components/ui/button";
import { InvitationsPanel } from "@/pages/Teams/components/InvitationsPanel";
import { formatTeamTime } from "@/pages/Teams/utils";

const DATA_PAGE_SIZE = 100;

function InvitationCenterPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const teamIdParam = searchParams.get("teamId");

    // 团队列表
    const [teams, setTeams] = useState<TeamInfo[]>([]);
    const [isPageLoading, setIsPageLoading] = useState(true);

    // 当前选中的团队（用于展示已发出邀请）
    const [selectedTeamId, setSelectedTeamId] = useState<TeamId | null>(null);

    // 邀请数据
    const [myInvitations, setMyInvitations] = useState<TeamInvitation[]>([]);
    const [sentInvitations, setSentInvitations] = useState<TeamInvitation[]>([]);
    const [isInvLoading, setIsInvLoading] = useState(false);

    /* ---------------- 数据加载 ---------------- */

    const loadTeamList = useCallback(async () => {
        try {
            const res = await getTeamList({ pageSize: DATA_PAGE_SIZE });
            const list = res.data?.list ?? [];
            setTeams(list);
            // 有 URL 参数以参数为准，否则默认选中第一个团队
            if (teamIdParam) {
                setSelectedTeamId(teamIdParam);
            } else if (list.length > 0) {
                setSelectedTeamId(list[0].id);
            }
        } catch {
            toast.error("加载团队列表失败");
        } finally {
            setIsPageLoading(false);
        }
    }, [teamIdParam]);

    const loadMyInvitations = useCallback(async () => {
        try {
            const myRes = await getMyTeamInvitations({ pageSize: DATA_PAGE_SIZE });
            setMyInvitations(myRes.data?.list ?? []);
        } catch {
            // 静默失败
        }
    }, []);

    const loadSentInvitations = useCallback(async (teamId: TeamId) => {
        setIsInvLoading(true);
        try {
            const sentRes = await getTeamInvitations(teamId, { pageSize: DATA_PAGE_SIZE });
            setSentInvitations(sentRes.data?.list ?? []);
        } catch {
            setSentInvitations([]);
        } finally {
            setIsInvLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTeamList();
        loadMyInvitations();
    }, [loadTeamList, loadMyInvitations]);

    useEffect(() => {
        if (selectedTeamId) {
            loadSentInvitations(selectedTeamId);
        }
    }, [selectedTeamId, loadSentInvitations]);

    /* ---------------- 团队选择 ---------------- */

    const handleSelectTeam = (teamId: TeamId) => {
        setSelectedTeamId(teamId);
        setSearchParams({ teamId: String(teamId) }, { replace: true });
    };

    /* ---------------- 邀请操作 ---------------- */

    const handleAccept = async (invitation: TeamInvitation) => {
        try {
            await acceptTeamInvitation(invitation.id);
            toast.success(`已加入「${invitation.teamName}」`);
            await loadMyInvitations();
        } catch {
            toast.error("接受邀请失败");
        }
    };

    const handleReject = async (invitation: TeamInvitation) => {
        try {
            await rejectTeamInvitation(invitation.id);
            toast.success(`已拒绝「${invitation.teamName}」的邀请`);
            await loadMyInvitations();
        } catch {
            toast.error("拒绝邀请失败");
        }
    };

    /* ---------------- 派生数据 ---------------- */

    const selectedTeam = useMemo(
        () => teams.find((t) => String(t.id) === String(selectedTeamId)) ?? null,
        [teams, selectedTeamId],
    );

    const isSelectedTeamOwner = selectedTeam?.currentRole === "OWNER";

    /* ---------------- 渲染 ---------------- */

    if (isPageLoading) {
        return (
            <main className="flex h-full items-center justify-center bg-[#09090b]">
                <Loader2 className="h-8 w-8 animate-spin text-white/30" />
            </main>
        );
    }

    return (
        <main className="h-full flex-1 overflow-y-auto bg-[#09090b] font-sans text-white scrollbar-hide">
            <header className="mx-auto flex max-w-6xl items-center justify-between px-8 pt-10">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">邀请中心</h1>
                    <p className="mt-1 text-sm text-white/35">
                        处理收到的团队邀请，并查看各团队已发出的邀请
                    </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate("/teams")}>
                    <ArrowLeft className="h-4 w-4" />
                    返回团队管理
                </Button>
            </header>

            <section className="mx-auto max-w-6xl px-8 py-8">
                {/* 团队选择卡片 */}
                {teams.length > 0 && (
                    <div className="mb-8 flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                        {teams.map((team) => {
                            const active = String(team.id) === String(selectedTeamId);
                            const isOwner = team.currentRole === "OWNER";
                            return (
                                <button
                                    key={String(team.id)}
                                    onClick={() => handleSelectTeam(team.id)}
                                    className={cn(
                                        "flex w-64 shrink-0 flex-col gap-3 rounded-[24px] border p-5 text-left transition-all",
                                        active
                                            ? "border-[#B43FEB]/60 bg-linear-to-br from-[#B43FEB]/15 via-[#121214] to-[#121214] shadow-[0_0_25px_rgba(180,63,235,0.15)]"
                                            : "border-white/5 bg-[#121214] hover:border-white/15",
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="truncate text-base font-bold text-white">
                                            {team.name}
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
                                        {team.description || "暂无团队简介"}
                                    </p>
                                    <div className="flex items-center gap-1.5 text-[11px] text-white/30">
                                        <Users className="h-3.5 w-3.5" />
                                        创建于{" "}
                                        {formatTeamTime(team.createdAt).slice(0, 10)}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                {isInvLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-6 w-6 animate-spin text-white/30" />
                    </div>
                ) : (
                    <InvitationsPanel
                        myInvitations={myInvitations}
                        sentInvitations={sentInvitations}
                        isOwner={isSelectedTeamOwner}
                        onAccept={handleAccept}
                        onReject={handleReject}
                    />
                )}
            </section>
        </main>
    );
}

export default InvitationCenterPage;
