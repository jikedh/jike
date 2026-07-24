import { Coins, PencilLine, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { TeamInvitation, TeamMember } from "shared/types/api/teams";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import {
    buildTeamAvatar,
    CURRENT_USER_ID,
    CURRENT_USER_NICKNAME,
    MOCK_MY_INVITATIONS,
    MOCK_TEAM_BUNDLES,
    mockHoursAgo,
    type TeamBundle,
} from "./mockData";

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

let idSequence = 100000;
const nextId = (prefix: string) => `${prefix}-${idSequence++}`;

function TeamsPage() {
    const [teams, setTeams] = useState<TeamBundle[]>(MOCK_TEAM_BUNDLES);
    const [currentTeamId, setCurrentTeamId] = useState<string | number>(
        MOCK_TEAM_BUNDLES[0].info.id,
    );
    const [myInvitations, setMyInvitations] =
        useState<TeamInvitation[]>(MOCK_MY_INVITATIONS);

    // 弹窗状态
    const [teamForm, setTeamForm] = useState<{
        open: boolean;
        mode: "create" | "edit";
    }>({ open: false, mode: "create" });
    const [inviteOpen, setInviteOpen] = useState(false);
    const [allocate, setAllocate] = useState<{
        open: boolean;
        presetMember: TeamMember | null;
    }>({ open: false, presetMember: null });
    const [confirm, setConfirm] = useState<ConfirmState>(INITIAL_CONFIRM);

    const currentTeam = useMemo(
        () =>
            teams.find(
                (bundle) => String(bundle.info.id) === String(currentTeamId),
            ) ?? teams[0],
        [teams, currentTeamId],
    );
    const isOwner = currentTeam.info.currentRole === "OWNER";

    /** 更新当前团队数据包。 */
    const patchCurrentTeam = (updater: (bundle: TeamBundle) => TeamBundle) => {
        setTeams((prev) =>
            prev.map((bundle) =>
                String(bundle.info.id) === String(currentTeam.info.id)
                    ? updater(bundle)
                    : bundle,
            ),
        );
    };

    /* ---------------- 团队基础操作 ---------------- */

    const handleCreateTeam = (name: string, description: string) => {
        const newBundle: TeamBundle = {
            info: {
                id: nextId("team"),
                name,
                description,
                createdBy: CURRENT_USER_ID,
                currentRole: "OWNER",
                createdAt: mockHoursAgo(0),
                updatedAt: mockHoursAgo(0),
            },
            members: [
                {
                    id: nextId("m"),
                    userId: CURRENT_USER_ID,
                    nickname: CURRENT_USER_NICKNAME,
                    avatar: buildTeamAvatar(CURRENT_USER_NICKNAME),
                    role: "OWNER",
                    joinedAt: mockHoursAgo(0),
                },
            ],
            invitations: [],
            summary: {
                allocatablePersonalCredits: 9800,
                teamTotalAllocatedCredits: 0,
                currentVipScore: 6200,
                currentForScore: 6600,
                currentRole: "OWNER",
            },
            ledgers: [],
            consumption: [],
        };
        setTeams((prev) => [...prev, newBundle]);
        setCurrentTeamId(newBundle.info.id);
        toast.success(`团队「${name}」已创建`);
    };

    const handleUpdateTeam = (name: string, description: string) => {
        patchCurrentTeam((bundle) => ({
            ...bundle,
            info: {
                ...bundle.info,
                name,
                description,
                updatedAt: mockHoursAgo(0),
            },
        }));
        toast.success("团队信息已更新");
    };

    const handleLeaveTeam = () => {
        const leavingTeam = currentTeam;
        setConfirm({
            open: true,
            title: "退出团队",
            description: `退出「${leavingTeam.info.name}」后将无法使用团队分配给你的积分，确定退出吗？`,
            confirmText: "退出团队",
            action: () => {
                const remaining = teams.filter(
                    (bundle) =>
                        String(bundle.info.id) !== String(leavingTeam.info.id),
                );
                if (remaining.length === 0) {
                    toast.info("至少需要保留一个团队");
                    return;
                }
                setTeams(remaining);
                setCurrentTeamId(remaining[0].info.id);
                toast.success(`已退出「${leavingTeam.info.name}」`);
            },
        });
    };

    /* ---------------- 成员操作 ---------------- */

    const handleInvite = (inviteeUserId: string) => {
        patchCurrentTeam((bundle) => ({
            ...bundle,
            invitations: [
                {
                    id: nextId("iv"),
                    teamId: bundle.info.id,
                    teamName: bundle.info.name,
                    inviteeUserId,
                    inviteeNickname: `用户${inviteeUserId}`,
                    inviteeAvatar: buildTeamAvatar(inviteeUserId),
                    inviterUserId: CURRENT_USER_ID,
                    inviterNickname: CURRENT_USER_NICKNAME,
                    inviterAvatar: buildTeamAvatar(CURRENT_USER_NICKNAME),
                    status: "PENDING",
                    createdAt: mockHoursAgo(0),
                },
                ...bundle.invitations,
            ],
        }));
        toast.success(`已向用户 ${inviteeUserId} 发出邀请`);
    };

    const handleRemoveMember = (member: TeamMember) => {
        setConfirm({
            open: true,
            title: "移除成员",
            description: `确定将「${member.nickname}」移出团队吗？其名下未消费的团队积分将被回收。`,
            confirmText: "移除成员",
            action: () => {
                patchCurrentTeam((bundle) => ({
                    ...bundle,
                    members: bundle.members.filter(
                        (item) => String(item.id) !== String(member.id),
                    ),
                }));
                toast.success(`已移除成员「${member.nickname}」`);
            },
        });
    };

    /* ---------------- 积分分配 ---------------- */

    const handleAllocate = (memberUserId: string, amount: number) => {
        const member = currentTeam.members.find(
            (item) => String(item.userId) === memberUserId,
        );
        patchCurrentTeam((bundle) => {
            const { currentVipScore, currentForScore } = bundle.summary;
            // 分配优先消耗永久积分，不足部分再扣会员积分，保持 可分配 = 会员 + 永久
            const deductFor = Math.min(currentForScore, amount);
            const deductVip = amount - deductFor;
            return {
                ...bundle,
                summary: {
                    ...bundle.summary,
                    allocatablePersonalCredits:
                        bundle.summary.allocatablePersonalCredits - amount,
                    teamTotalAllocatedCredits:
                        bundle.summary.teamTotalAllocatedCredits + amount,
                    currentForScore: currentForScore - deductFor,
                    currentVipScore: currentVipScore - deductVip,
                },
                ledgers: [
                    {
                        id: nextId("lg"),
                        memberId: member?.id ?? "",
                        memberUserId,
                        memberNickname: member?.nickname ?? `用户${memberUserId}`,
                        memberAvatar:
                            member?.avatar ?? buildTeamAvatar(String(memberUserId)),
                        operatorUserId: CURRENT_USER_ID,
                        operatorNickname: CURRENT_USER_NICKNAME,
                        type: "ALLOCATE",
                        amount,
                        bizType: "manual_allocate",
                        bizId: nextId("op"),
                        createdAt: mockHoursAgo(0),
                    },
                    ...bundle.ledgers,
                ],
            };
        });

    };

    /* ---------------- 收到的邀请 ---------------- */

    const handleAcceptInvitation = (invitation: TeamInvitation) => {
        setMyInvitations((prev) =>
            prev.map((item) =>
                String(item.id) === String(invitation.id)
                    ? { ...item, status: "ACCEPTED", respondedAt: mockHoursAgo(0) }
                    : item,
            ),
        );
        // 接受的团队出现在团队列表中（若尚未加入）
        setTeams((prev) => {
            if (prev.some((bundle) => String(bundle.info.id) === String(invitation.teamId))) {
                return prev;
            }
            return [
                ...prev,
                {
                    info: {
                        id: invitation.teamId,
                        name: invitation.teamName,
                        description: "通过邀请加入的团队。",
                        createdBy: invitation.inviterUserId,
                        currentRole: "MEMBER",
                        createdAt: invitation.createdAt,
                        updatedAt: mockHoursAgo(0),
                    },
                    members: [
                        {
                            id: nextId("m"),
                            userId: invitation.inviterUserId,
                            nickname: invitation.inviterNickname,
                            avatar: invitation.inviterAvatar,
                            role: "OWNER",
                            joinedAt: invitation.createdAt,
                        },
                        {
                            id: nextId("m"),
                            userId: CURRENT_USER_ID,
                            nickname: CURRENT_USER_NICKNAME,
                            avatar: buildTeamAvatar(CURRENT_USER_NICKNAME),
                            role: "MEMBER",
                            joinedAt: mockHoursAgo(0),
                        },
                    ],
                    invitations: [],
                    summary: {
                        allocatablePersonalCredits: 0,
                        teamTotalAllocatedCredits: 0,
                        currentVipScore: 1200,
                        currentForScore: 1800,
                        currentRole: "MEMBER",
                    },
                    ledgers: [],
                    consumption: [],
                },
            ];
        });
        toast.success(`已加入「${invitation.teamName}」`);
    };

    const handleRejectInvitation = (invitation: TeamInvitation) => {
        setMyInvitations((prev) =>
            prev.map((item) =>
                String(item.id) === String(invitation.id)
                    ? { ...item, status: "REJECTED", respondedAt: mockHoursAgo(0) }
                    : item,
            ),
        );
        toast.success(`已拒绝「${invitation.teamName}」的邀请`);
    };

    return (
        <main className="h-full flex-1 overflow-y-auto bg-[#09090b] font-sans text-white scrollbar-hide">
            {/* 页面头部 */}
            <header className="mx-auto flex max-w-6xl items-end justify-between px-8 pt-10">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">团队管理</h1>
                    <p className="mt-1 text-sm text-white/35">
                        统一管理团队成员与积分分配，覆盖邀请、审计与消费全流程
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isOwner && (
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
                <TeamSwitcher
                    teams={teams}
                    currentTeamId={currentTeam.info.id}
                    onSelect={setCurrentTeamId}
                    onCreate={() => setTeamForm({ open: true, mode: "create" })}
                />

                <CreditSummaryCards summary={currentTeam.summary} />

                <MembersSection
                    members={currentTeam.members}
                    isOwner={isOwner}
                    currentUserId={CURRENT_USER_ID}
                    onInvite={() => setInviteOpen(true)}
                    onAllocate={(member) => setAllocate({ open: true, presetMember: member })}
                    onRemove={handleRemoveMember}
                    onLeave={handleLeaveTeam}
                />

                <InvitationsPanel
                    myInvitations={myInvitations}
                    sentInvitations={currentTeam.invitations}
                    isOwner={isOwner}
                    onAccept={handleAcceptInvitation}
                    onReject={handleRejectInvitation}
                />

                <RecordsSection
                    ledgers={currentTeam.ledgers}
                    consumption={currentTeam.consumption}
                    members={currentTeam.members}
                    isOwner={isOwner}
                />
            </section>

            {/* 弹窗 */}
            <TeamFormDialog
                open={teamForm.open}
                mode={teamForm.mode}
                initialName={teamForm.mode === "edit" ? currentTeam.info.name : ""}
                initialDescription={
                    teamForm.mode === "edit" ? currentTeam.info.description : ""
                }
                onOpenChange={(open) =>
                    setTeamForm((prev) => ({ ...prev, open }))
                }
                onSubmit={
                    teamForm.mode === "create" ? handleCreateTeam : handleUpdateTeam
                }
            />

            <InviteMemberDialog
                open={inviteOpen}
                teamName={currentTeam.info.name}
                onOpenChange={setInviteOpen}
                onSubmit={handleInvite}
            />

            <AllocateCreditsDialog
                open={allocate.open}
                members={currentTeam.members}
                presetMember={allocate.presetMember}
                allocatableCredits={currentTeam.summary.allocatablePersonalCredits}
                onOpenChange={(open) =>
                    setAllocate((prev) => ({ ...prev, open }))
                }
                onSubmit={handleAllocate}
            />

            <ConfirmActionDialog
                open={confirm.open}
                title={confirm.title}
                description={confirm.description}
                confirmText={confirm.confirmText}
                onOpenChange={(open) =>
                    setConfirm((prev) => ({ ...prev, open }))
                }
                onConfirm={() => confirm.action?.()}
            />
        </main>
    );
}

export default TeamsPage;
