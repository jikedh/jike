/**
 * 团队管理页面 Mock 数据。
 *
 * 仅用于 UI 原型演示，数据结构对齐 shared/types/api/teams。
 */

import type {
    TeamConsumptionRecord,
    TeamCreditLedger,
    TeamCreditSummary,
    TeamInfo,
    TeamInvitation,
    TeamMember,
} from "shared/types/api/teams";

/** 单个团队的完整演示数据包。 */
export interface TeamBundle {
    info: TeamInfo;
    members: TeamMember[];
    invitations: TeamInvitation[];
    summary: TeamCreditSummary;
    ledgers: TeamCreditLedger[];
    consumption: TeamConsumptionRecord[];
}

export const CURRENT_USER_ID = "10001";
export const CURRENT_USER_NICKNAME = "阿澈";

/** 2026-07-24 00:00:00 UTC，所有 Mock 时间的基准（秒）。 */
const BASE_TS = 1784966400;
const hoursAgo = (hours: number) => BASE_TS - hours * 3600;

const avatar = (seed: string) =>
    `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;

const buildMember = (
    id: string,
    userId: string,
    nickname: string,
    role: TeamMember["role"],
    joinedHoursAgo: number,
): TeamMember => ({
    id,
    userId,
    nickname,
    avatar: avatar(nickname),
    role,
    joinedAt: hoursAgo(joinedHoursAgo),
});

const buildLedger = (
    id: string,
    memberId: string,
    memberUserId: string,
    memberNickname: string,
    operatorNickname: string,
    type: TeamCreditLedger["type"],
    amount: number,
    bizType: string,
    bizId: string,
    createdHoursAgo: number,
): TeamCreditLedger => ({
    id,
    memberId,
    memberUserId,
    memberNickname,
    memberAvatar: avatar(memberNickname),
    operatorUserId: CURRENT_USER_ID,
    operatorNickname,
    type,
    amount,
    bizType,
    bizId,
    createdAt: hoursAgo(createdHoursAgo),
});

const buildConsumption = (
    recordId: number,
    userId: string,
    nickname: string,
    memberId: string,
    vipScore: number,
    forScore: number,
    source: string,
    sourceLabel: string,
    model: string,
    bizType: string,
    taskId: string,
    createdHoursAgo: number,
    memo: string,
): TeamConsumptionRecord => ({
    recordId,
    userId,
    nickname,
    avatar: avatar(nickname),
    memberId,
    memberStatus: "ACTIVE",
    vipScore,
    forScore,
    vipBalanceScore: 4200,
    forBalanceScore: 5600,
    source,
    sourceLabel,
    model,
    bizType,
    taskId,
    createTime: hoursAgo(createdHoursAgo),
    memo,
});

const xinghuoInfo: TeamInfo = {
    id: "88001",
    name: "星火内容工作室",
    description: "专注短剧解说与 AI 视频量产的核心团队，统一结算积分。",
    createdBy: CURRENT_USER_ID,
    currentRole: "OWNER",
    createdAt: hoursAgo(24 * 92),
    updatedAt: hoursAgo(5),
};

const xinghuoMembers: TeamMember[] = [
    buildMember("m-001", CURRENT_USER_ID, CURRENT_USER_NICKNAME, "OWNER", 24 * 92),
    buildMember("m-002", "10002", "林晚风", "MEMBER", 24 * 80),
    buildMember("m-003", "10003", "陈星河", "MEMBER", 24 * 41),
    buildMember("m-004", "10004", "苏子墨", "MEMBER", 24 * 9),
];

const xinghuoSummary: TeamCreditSummary = {
    allocatablePersonalCredits: 12800,
    teamTotalAllocatedCredits: 36000,
    currentVipScore: 6200,
    currentForScore: 6600,
    currentRole: "OWNER",
};

const xinghuoLedgers: TeamCreditLedger[] = [
    buildLedger("lg-101", "m-002", "10002", "林晚风", CURRENT_USER_NICKNAME, "ALLOCATE", 5000, "manual_allocate", "op-9001", 3),
    buildLedger("lg-102", "m-003", "10003", "陈星河", "林晚风", "TASK_CONSUME", -320, "desktop_video", "task-70021", 7),
    buildLedger("lg-103", "m-002", "10002", "林晚风", "系统", "TASK_CONSUME", -180, "desktop_image", "task-70018", 12),
    buildLedger("lg-104", "m-004", "10004", "苏子墨", CURRENT_USER_NICKNAME, "ALLOCATE", 3000, "manual_allocate", "op-8996", 26),
    buildLedger("lg-105", "m-003", "10003", "陈星河", CURRENT_USER_NICKNAME, "RECLAIM", -800, "manual_reclaim", "op-8990", 49),
    buildLedger("lg-106", "m-002", "10002", "林晚风", "系统", "TASK_CONSUME_REVERSAL", 60, "desktop_video", "task-69902", 55),
    buildLedger("lg-107", "m-003", "10003", "陈星河", CURRENT_USER_NICKNAME, "ALLOCATE", 4000, "manual_allocate", "op-8971", 76),
    buildLedger("lg-108", "m-002", "10002", "林晚风", "系统", "ACCOUNT_MIGRATION", 1200, "migration", "mig-331", 120),
];

const xinghuoConsumption: TeamConsumptionRecord[] = [
    buildConsumption(501, "10002", "林晚风", "m-002", 120, 60, "desktop", "桌面端·视频生成", "Sora 2", "desktop_video", "task-70031", 2, "15s 竖屏短剧镜头"),
    buildConsumption(502, "10003", "陈星河", "m-003", 0, 320, "desktop", "桌面端·视频生成", "Vidu Q2", "desktop_video", "task-70021", 7, "产品广告分镜 3"),
    buildConsumption(503, "10002", "林晚风", "m-002", 180, 0, "desktop", "桌面端·图像生成", "Nano Banana", "desktop_image", "task-70018", 12, "海报主视觉"),
    buildConsumption(504, "10004", "苏子墨", "m-004", 90, 90, "desktop", "桌面端·视频增强", "Topaz Enhance", "desktop_video_enhance", "task-70011", 18, "4K 修复"),
    buildConsumption(505, "10003", "陈星河", "m-003", 260, 0, "desktop", "桌面端·视频生成", "Sora 2", "desktop_video", "task-69998", 27, "开场镜头重制"),
    buildConsumption(506, "10002", "林晚风", "m-002", 0, 140, "web", "网页端·图像生成", "Flux Pro", "image", "task-69980", 33, "社媒配图"),
    buildConsumption(507, "10004", "苏子墨", "m-004", 75, 0, "desktop", "桌面端·图像生成", "Nano Banana", "desktop_image", "task-69961", 44, "贴纸素材"),
    buildConsumption(508, "10003", "陈星河", "m-003", 0, 500, "desktop", "桌面端·视频生成", "Vidu Q2", "desktop_video", "task-69940", 58, "长镜头 60s"),
    buildConsumption(509, "10002", "林晚风", "m-002", 95, 45, "desktop", "桌面端·视频生成", "Sora 2", "desktop_video", "task-69912", 71, "转场片段"),
    buildConsumption(510, "10003", "陈星河", "m-003", 150, 0, "web", "网页端·图像生成", "Flux Pro", "image", "task-69877", 96, "概念草图"),
];

const xinghuoInvitations: TeamInvitation[] = [
    {
        id: "iv-201",
        teamId: "88001",
        teamName: "星火内容工作室",
        inviteeUserId: "10005",
        inviteeNickname: "顾云舟",
        inviteeAvatar: avatar("顾云舟"),
        inviterUserId: CURRENT_USER_ID,
        inviterNickname: CURRENT_USER_NICKNAME,
        inviterAvatar: avatar(CURRENT_USER_NICKNAME),
        status: "PENDING",
        createdAt: hoursAgo(6),
    },
    {
        id: "iv-202",
        teamId: "88001",
        teamName: "星火内容工作室",
        inviteeUserId: "10004",
        inviteeNickname: "苏子墨",
        inviteeAvatar: avatar("苏子墨"),
        inviterUserId: CURRENT_USER_ID,
        inviterNickname: CURRENT_USER_NICKNAME,
        inviterAvatar: avatar(CURRENT_USER_NICKNAME),
        status: "ACCEPTED",
        createdAt: hoursAgo(24 * 9),
        respondedAt: hoursAgo(24 * 9 - 2),
    },
];

const lanhaiInfo: TeamInfo = {
    id: "88002",
    name: "蓝海短剧项目组",
    description: "短剧解说矩阵号项目组，由沈青梧统一分配积分。",
    createdBy: "10006",
    currentRole: "MEMBER",
    createdAt: hoursAgo(24 * 60),
    updatedAt: hoursAgo(30),
};

const lanhaiMembers: TeamMember[] = [
    buildMember("m-101", "10006", "沈青梧", "OWNER", 24 * 60),
    buildMember("m-102", CURRENT_USER_ID, CURRENT_USER_NICKNAME, "MEMBER", 24 * 55),
    buildMember("m-103", "10007", "温故知", "MEMBER", 24 * 20),
];

const lanhaiSummary: TeamCreditSummary = {
    allocatablePersonalCredits: 3000,
    teamTotalAllocatedCredits: 15000,
    currentVipScore: 1200,
    currentForScore: 1800,
    currentRole: "MEMBER",
};

const lanhaiLedgers: TeamCreditLedger[] = [
    buildLedger("lg-201", "m-102", CURRENT_USER_ID, CURRENT_USER_NICKNAME, "沈青梧", "ALLOCATE", 3000, "manual_allocate", "op-8120", 30),
    buildLedger("lg-202", "m-103", "10007", "温故知", "沈青梧", "ALLOCATE", 4500, "manual_allocate", "op-8118", 31),
    buildLedger("lg-203", "m-102", CURRENT_USER_ID, CURRENT_USER_NICKNAME, "系统", "TASK_CONSUME", -260, "desktop_video", "task-68901", 40),
    buildLedger("lg-204", "m-103", "10007", "温故知", "系统", "TASK_CONSUME", -150, "desktop_image", "task-68866", 52),
];

const lanhaiConsumption: TeamConsumptionRecord[] = [
    buildConsumption(601, CURRENT_USER_ID, CURRENT_USER_NICKNAME, "m-102", 260, 0, "desktop", "桌面端·视频生成", "Sora 2", "desktop_video", "task-68901", 40, "短剧第 12 集开场"),
    buildConsumption(602, "10007", "温故知", "m-103", 0, 150, "desktop", "桌面端·图像生成", "Nano Banana", "desktop_image", "task-68866", 52, "封面图"),
    buildConsumption(603, CURRENT_USER_ID, CURRENT_USER_NICKNAME, "m-102", 0, 300, "desktop", "桌面端·视频生成", "Vidu Q2", "desktop_video", "task-68801", 70, "解说画面 B-Roll"),
    buildConsumption(604, "10007", "温故知", "m-103", 88, 0, "desktop", "桌面端·视频增强", "Topaz Enhance", "desktop_video_enhance", "task-68770", 90, "老素材修复"),
    buildConsumption(605, CURRENT_USER_ID, CURRENT_USER_NICKNAME, "m-102", 140, 60, "desktop", "桌面端·视频生成", "Sora 2", "desktop_video", "task-68702", 120, "预告片"),
];

const pinpaiInfo: TeamInfo = {
    id: "88003",
    name: "品牌视觉实验室",
    description: "品牌 KV 与视觉实验小组，探索 AI 图像风格。",
    createdBy: CURRENT_USER_ID,
    currentRole: "OWNER",
    createdAt: hoursAgo(24 * 30),
    updatedAt: hoursAgo(48),
};

const pinpaiMembers: TeamMember[] = [
    buildMember("m-201", CURRENT_USER_ID, CURRENT_USER_NICKNAME, "OWNER", 24 * 30),
    buildMember("m-202", "10008", "何田田", "MEMBER", 24 * 12),
];

const pinpaiSummary: TeamCreditSummary = {
    allocatablePersonalCredits: 5600,
    teamTotalAllocatedCredits: 9000,
    currentVipScore: 2600,
    currentForScore: 3000,
    currentRole: "OWNER",
};

const pinpaiLedgers: TeamCreditLedger[] = [
    buildLedger("lg-301", "m-202", "10008", "何田田", CURRENT_USER_NICKNAME, "ALLOCATE", 2400, "manual_allocate", "op-7301", 48),
    buildLedger("lg-302", "m-202", "10008", "何田田", "系统", "TASK_CONSUME", -210, "desktop_image", "task-67701", 60),
    buildLedger("lg-303", "m-202", "10008", "何田田", "系统", "TASK_CONSUME", -130, "desktop_image", "task-67633", 84),
];

const pinpaiConsumption: TeamConsumptionRecord[] = [
    buildConsumption(701, "10008", "何田田", "m-202", 210, 0, "desktop", "桌面端·图像生成", "Nano Banana", "desktop_image", "task-67701", 60, "夏日 KV 主视觉"),
    buildConsumption(702, "10008", "何田田", "m-202", 0, 130, "web", "网页端·图像生成", "Flux Pro", "image", "task-67633", 84, "风格实验 07"),
    buildConsumption(703, "10008", "何田田", "m-202", 65, 65, "desktop", "桌面端·图像生成", "Nano Banana", "desktop_image", "task-67580", 110, "包装贴图"),
    buildConsumption(704, "10008", "何田田", "m-202", 120, 0, "desktop", "桌面端·图像生成", "Flux Pro", "desktop_image", "task-67492", 150, "节日海报"),
];

export const MOCK_TEAM_BUNDLES: TeamBundle[] = [
    {
        info: xinghuoInfo,
        members: xinghuoMembers,
        invitations: xinghuoInvitations,
        summary: xinghuoSummary,
        ledgers: xinghuoLedgers,
        consumption: xinghuoConsumption,
    },
    {
        info: lanhaiInfo,
        members: lanhaiMembers,
        invitations: [],
        summary: lanhaiSummary,
        ledgers: lanhaiLedgers,
        consumption: lanhaiConsumption,
    },
    {
        info: pinpaiInfo,
        members: pinpaiMembers,
        invitations: [],
        summary: pinpaiSummary,
        ledgers: pinpaiLedgers,
        consumption: pinpaiConsumption,
    },
];

/** 当前用户收到的邀请。 */
export const MOCK_MY_INVITATIONS: TeamInvitation[] = [
    {
        id: "iv-901",
        teamId: "88009",
        teamName: "极光 AIGC 联盟",
        inviteeUserId: CURRENT_USER_ID,
        inviteeNickname: CURRENT_USER_NICKNAME,
        inviteeAvatar: avatar(CURRENT_USER_NICKNAME),
        inviterUserId: "10009",
        inviterNickname: "陆见微",
        inviterAvatar: avatar("陆见微"),
        status: "PENDING",
        createdAt: hoursAgo(4),
    },
    {
        id: "iv-902",
        teamId: "88002",
        teamName: "蓝海短剧项目组",
        inviteeUserId: CURRENT_USER_ID,
        inviteeNickname: CURRENT_USER_NICKNAME,
        inviteeAvatar: avatar(CURRENT_USER_NICKNAME),
        inviterUserId: "10006",
        inviterNickname: "沈青梧",
        inviterAvatar: avatar("沈青梧"),
        status: "ACCEPTED",
        createdAt: hoursAgo(24 * 55),
        respondedAt: hoursAgo(24 * 55 - 1),
    },
];

export { avatar as buildTeamAvatar, hoursAgo as mockHoursAgo };
