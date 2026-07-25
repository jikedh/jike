import { Coins, Loader2, PencilLine, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TeamConsumptionRecord, TeamCreditLedger, TeamCreditSummary, TeamId, TeamInfo, TeamInvitation, TeamMember } from "shared/types/api/teams";
import { toast } from "sonner";
import {
    acceptTeamInvitation,
    allocateTeamCredits,
    createTeam,
    createTeamInvitation,
    getMyTeamInvitations,
    getTeamConsumptionRecords,
    getTeamCreditLedgers,
    getTeamCreditSummary,
    getTeamInvitations,
    getTeamList,
    getTeamMembers,
    leaveTeam,
    rejectTeamInvitation,
    removeTeamMember,
    updateTeam,
} from "@/api/teams";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/stores/useUserStore";
import { CreditSummaryCards } from "./components/CreditSummaryCards";
import { InvitationsPanel } from "./components/InvitationsPanel";
import { MembersSection } from "./components/MembersSection";
import { RecordsSection } from "./components/RecordsSection";
import {
    AllocateCreditsDialog,
    ConfirmActionDialog,
    InviteMemberDialog,
    TeamFormDialog,
} from "./components/TeamDialogs";
import { TeamSwitcher } from "./components/TeamSwitcher";

const DATA_PAGE_SIZE = 100;

interface ConfirmState {
    open: boolean;
    title: string;
    description: string;
    confirmText: string;
    action: (() => void) | null;
}

const INITIAL_CONFIRM: ConfirmState = {
    open: false,
    title: "",
    description: "",
    confirmText: "确认",
    action: null,
};

const EMPTY_SUMMARY: TeamCreditSummary = {
    allocatablePersonalCredits: 0,
    teamTotalAllocatedCredits: 0,
    currentVipScore: 0,
    currentForScore: 0,
    currentRole: "MEMBER",
};

function TeamsPage() {
    const userInfo = useUserStore((s) => s.userInfo);
    const currentUserId = String(userInfo?.id ?? "");

    // 团队列表
    const [teams, setTeams] = useState<TeamInfo[]>([]);
    const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
    const [isPageLoading, setIsPageLoading] = useState(true);

    // 当前选中团队
    const [currentTeamId, setCurrentTeamId] = useState<TeamId | null>(null);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [summary, setSummary] = useState<TeamCreditSummary>(EMPTY_SUMMARY);
    const [ledgers, setLedgers] = useState<TeamCreditLedger[]>([]);
    const [consumption, setConsumption] = useState<TeamConsumptionRecord[]>([]);
    const [sentInvitations, setSentInvitations] = useState<TeamInvitation[]>([]);
    const [isDataLoading, setIsDataLoading] = useState(false);

    // 收到的邀请
    const [myInvitations, setMyInvitations] = useState<TeamInvitation[]>([]);

    // 弹窗
    const [teamForm, setTeamForm] = useState<{ open: boolean; mode: "create" | "edit" }>({ open: false, mode: "create" });
    const [inviteOpen, setInviteOpen] = useState(false);
    const [allocate, setAllocate] = useState<{ open: boolean; presetMember: TeamMember | null }>({ open: false, presetMember: null });
    const [confirm, setConfirm] = useState<ConfirmState>(INITIAL_CONFIRM);

    const isOwner = summary.currentRole === "OWNER";

    /* ---------------- 数据加载 ---------------- */

    const loadTeamList = useCallback(async () => {
        try {
            const res = await getTeamList({ pageSize: DATA_PAGE_SIZE });
            const list = res.data?.list ?? [];
            setTeams(list);
            if (list.length > 0 && !currentTeamId) {
                setCurrentTeamId(list[0].id);
            }
            // 并行加载所有团队的成员数以显示在切换器中
            const counts: Record<string, number> = {};
            await Promise.all(
                list.map(async (team) => {
                    try {
                        const mr = await getTeamMembers(team.id);
                        counts[String(team.id)] = mr.data?.list?.length ?? 0;
                    } catch {
                        counts[String(team.id)] = 0;
                    }
                }),
            );
            setMemberCounts(counts);
        } catch {
            toast.error("加载团队列表失败");
        } finally {
            setIsPageLoading(false);
        }
    }, [currentTeamId]);

    const loadMyInvitations = useCallback(async () => {
        try {
            const res = await getMyTeamInvitations({ pageSize: DATA_PAGE_SIZE });
            setMyInvitations(res.data?.list ?? []);
        } catch {
            // 静默失败
        }
    }, []);

    const loadTeamData = useCallback(async (teamId: TeamId) => {
        setIsDataLoading(true);
        try {
            const [membersRes, summaryRes, ledgersRes, consumptionRes, invitationsRes] =
                await Promise.all([
                    getTeamMembers(teamId),
                    getTeamCreditSummary(teamId),
                    getTeamCreditLedgers(teamId, { pageSize: DATA_PAGE_SIZE }),
                    getTeamConsumptionRecords(teamId, { pageSize: DATA_PAGE_SIZE }),
                    getTeamInvitations(teamId, { pageSize: DATA_PAGE_SIZE }),
                ]);
            setMembers(membersRes.data?.list ?? []);
            setSummary(summaryRes.data ?? EMPTY_SUMMARY);
            setLedgers(ledgersRes.data?.list ?? []);
            setConsumption(consumptionRes.data?.list ?? []);
            setSentInvitations(invitationsRes.data?.list ?? []);
        } catch {
            toast.error("加载团队数据失败");
        } finally {
            setIsDataLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTeamList();
        loadMyInvitations();
    }, [loadTeamList, loadMyInvitations]);

    useEffect(() => {
        if (currentTeamId) {
            loadTeamData(currentTeamId);
        }
    }, [currentTeamId, loadTeamData]);

    /* ---------------- 团队基础操作 ---------------- */

    const handleCreateTeam = async (name: string, description: string) => {
        try {
            await createTeam({ name, description: description || undefined });
            toast.success(`团队「${name}」已创建`);
            await loadTeamList();
            await loadMyInvitations();
        } catch {
            toast.error("创建团队失败");
        }
    };

    const handleUpdateTeam = async (name: string, description: string) => {
        if (!currentTeamId) return;
        try {
            await updateTeam(currentTeamId, { name, description: description || undefined });
            toast.success("团队信息已更新");
            await loadTeamList();
            await loadTeamData(currentTeamId);
        } catch {
            toast.error("更新团队信息失败");
        }
    };

    const handleLeaveTeam = () => {
        if (!currentTeamId) return;
        setConfirm({
            open: true,
            title: "退出团队",
            description: "退出后将无法使用团队分配给你的积分，确定退出吗？",
            confirmText: "退出团队",
            action: async () => {
                try {
                    await leaveTeam(currentTeamId);
                    toast.success("已退出团队");
                    await loadTeamList();
                    await loadMyInvitations();
                } catch {
                    toast.error("退出团队失败");
                }
            },
        });
    };

    /* ---------------- 成员操作 ---------------- */

    const handleInvite = async (inviteeUserId: string) => {
        if (!currentTeamId) return;
        try {
            await createTeamInvitation(currentTeamId, { inviteeUserId });
            toast.success(`已向用户 ${inviteeUserId} 发出邀请`);
            const res = await getTeamInvitations(currentTeamId, { pageSize: DATA_PAGE_SIZE });
            setSentInvitations(res.data?.list ?? []);
        } catch {
            toast.error("发送邀请失败");
        }
    };

    const handleRemoveMember = (member: TeamMember) => {
        if (!currentTeamId) return;
        setConfirm({
            open: true,
            title: "移除成员",
            description: `确定将「${member.nickname}」移出团队吗？`,
            confirmText: "移除成员",
            action: async () => {
                try {
                    await removeTeamMember(currentTeamId, member.userId);
                    toast.success(`已移除成员「${member.nickname}」`);
                    await loadTeamData(currentTeamId);
                } catch {
                    toast.error("移除成员失败");
                }
            },
        });
    };

    /* ---------------- 积分分配 ---------------- */

    const handleAllocate = async (memberUserId: string, amount: number) => {
        if (!currentTeamId) return;
        try {
            const res = await allocateTeamCredits(currentTeamId, {
                memberUserId,
                amount,
                requestKey: `allocate-${currentTeamId}-${memberUserId}-${Date.now()}`,
            });
            toast.success(res.data?.message ?? `已分配 ${amount.toLocaleString("zh-CN")} 积分`);
            await loadTeamData(currentTeamId);
        } catch {
            toast.error("积分分配失败");
        }
    };

    /* ---------------- 收到的邀请 ---------------- */

    const handleAcceptInvitation = async (invitation: TeamInvitation) => {
        try {
            await acceptTeamInvitation(invitation.id);
            toast.success(`已加入「${invitation.teamName}」`);
            await loadTeamList();
            await loadMyInvitations();
        } catch {
            toast.error("接受邀请失败");
        }
    };

    const handleRejectInvitation = async (invitation: TeamInvitation) => {
        try {
            await rejectTeamInvitation(invitation.id);
            toast.success(`已拒绝「${invitation.teamName}」的邀请`);
            await loadMyInvitations();
        } catch {
            toast.error("拒绝邀请失败");
        }
    };

    /* ---------------- 派生数据 ---------------- */

    const allocatableCredits = summary.currentVipScore + summary.currentForScore;

    const currentTeam = useMemo(
        () => teams.find((t) => String(t.id) === String(currentTeamId)) ?? null,
        [teams, currentTeamId],
    );

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
            <header className="mx-auto flex max-w-6xl items-end justify-between px-8 pt-10">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">团队管理</h1>
                    <p className="mt-1 text-sm text-white/35">
                        统一管理团队成员与积分分配，覆盖邀请、审计与消费全流程
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isOwner && currentTeam && (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setTeamForm({ open: true, mode: "edit" })}
                            >
                                <PencilLine className="h-4 w-4" />
                                编辑团队
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => setAllocate({ open: true, presetMember: null })}
                            >
                                <Coins className="h-4 w-4" />
                                分配积分
                            </Button>
                        </>
                    )}
                    <Button
                        variant="blue"
                        size="sm"
                        onClick={() => setTeamForm({ open: true, mode: "create" })}
                    >
                        <Plus className="h-4 w-4" />
                        创建团队
                    </Button>
                </div>
            </header>

            <section className="mx-auto grid max-w-6xl gap-8 px-8 py-8">
                {teams.length > 0 ? (
                    <>
                        <TeamSwitcher
                            teams={teams}
                            memberCounts={memberCounts}
                            currentTeamId={currentTeamId ?? ""}
                            onSelect={setCurrentTeamId}
                            onCreate={() => setTeamForm({ open: true, mode: "create" })}
                        />

                        {isDataLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="h-6 w-6 animate-spin text-white/30" />
                            </div>
                        ) : (
                            <>
                                <CreditSummaryCards summary={summary} />

                                <MembersSection
                                    members={members}
                                    isOwner={isOwner}
                                    currentUserId={currentUserId}
                                    onInvite={() => setInviteOpen(true)}
                                    onAllocate={(member) => setAllocate({ open: true, presetMember: member })}
                                    onRemove={handleRemoveMember}
                                    onLeave={handleLeaveTeam}
                                />

                                <InvitationsPanel
                                    myInvitations={myInvitations}
                                    sentInvitations={sentInvitations}
                                    isOwner={isOwner}
                                    onAccept={handleAcceptInvitation}
                                    onReject={handleRejectInvitation}
                                />

                                <RecordsSection
                                    ledgers={ledgers}
                                    consumption={consumption}
                                    members={members}
                                    isOwner={isOwner}
                                />
                            </>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center gap-4 py-32 text-center">
                        <p className="text-sm text-white/40">你还没有加入任何团队</p>
                        <Button
                            variant="blue"
                            size="sm"
                            onClick={() => setTeamForm({ open: true, mode: "create" })}
                        >
                            <Plus className="h-4 w-4" />
                            创建第一个团队
                        </Button>
                    </div>
                )}
            </section>

            {/* 弹窗 */}
            <TeamFormDialog
                open={teamForm.open}
                mode={teamForm.mode}
                initialName={teamForm.mode === "edit" && currentTeam ? currentTeam.name : ""}
                initialDescription={teamForm.mode === "edit" && currentTeam ? currentTeam.description : ""}
                onOpenChange={(open) => setTeamForm((prev) => ({ ...prev, open }))}
                onSubmit={teamForm.mode === "create" ? handleCreateTeam : handleUpdateTeam}
            />

            <InviteMemberDialog
                open={inviteOpen}
                teamName={currentTeam?.name ?? ""}
                onOpenChange={setInviteOpen}
                onSubmit={handleInvite}
            />

            <AllocateCreditsDialog
                open={allocate.open}
                members={members}
                presetMember={allocate.presetMember}
                allocatableCredits={allocatableCredits}
                onOpenChange={(open) => setAllocate((prev) => ({ ...prev, open }))}
                onSubmit={handleAllocate}
            />

            <ConfirmActionDialog
                open={confirm.open}
                title={confirm.title}
                description={confirm.description}
                confirmText={confirm.confirmText}
                onOpenChange={(open) => setConfirm((prev) => ({ ...prev, open }))}
                onConfirm={() => confirm.action?.()}
            />
        </main>
    );
}

export default TeamsPage;
