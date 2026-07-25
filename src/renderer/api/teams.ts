/**
 * 团队管理与积分 API 调用层。
 *
 * 所有接口均通过 jike-go 的 /v1/team 路由访问，认证由统一请求实例处理。
 */

import { jikeingService } from "service/aiRequest";
import type {
    AllocateTeamCreditsRequest,
    CreateTeamInvitationRequest,
    CreateTeamInvitationResponse,
    CreateTeamRequest,
    TeamConsumptionRecordListParams,
    TeamConsumptionRecordListResponse,
    TeamCreditLedgerListResponse,
    TeamCreditOperationResponse,
    TeamCreditSummaryResponse,
    TeamDepartureResponse,
    TeamId,
    TeamInvitationListResponse,
    TeamInvitationProcessResponse,
    TeamListResponse,
    TeamMemberListResponse,
    TeamPaginationParams,
    TeamResponse,
    UpdateTeamRequest,
} from "shared/types/api/teams";

const JIKE_GO_BASE_URL = import.meta.env.VITE_JIKE_GO_BASE_URL;

/**
 * 获取当前用户的团队列表
 * GET /v1/team
 */
export function getTeamList(
    params?: TeamPaginationParams,
): Promise<TeamListResponse> {
    return jikeingService({
        baseURL: JIKE_GO_BASE_URL,
        url: "/v1/team",
        method: "get",
        params,
    });
}

/**
 * 创建团队
 * POST /v1/team
 */
export function createTeam(data: CreateTeamRequest): Promise<TeamResponse> {
    return jikeingService({
        baseURL: JIKE_GO_BASE_URL,
        url: "/v1/team",
        method: "post",
        data,
    });
}

/**
 * 获取团队详情
 * GET /v1/team/:teamId
 */
export function getTeamDetail(teamId: TeamId): Promise<TeamResponse> {
    return jikeingService({
        baseURL: JIKE_GO_BASE_URL,
        url: `/v1/team/${encodeURIComponent(String(teamId))}`,
        method: "get",
    });
}

/**
 * 更新团队名称或描述
 * PUT /v1/team/:teamId
 */
export function updateTeam(
    teamId: TeamId,
    data: UpdateTeamRequest,
): Promise<TeamResponse> {
    return jikeingService({
        baseURL: JIKE_GO_BASE_URL,
        url: `/v1/team/${encodeURIComponent(String(teamId))}`,
        method: "put",
        data,
    });
}

/**
 * 获取团队当前有效成员
 * GET /v1/team/:teamId/members
 */
export function getTeamMembers(teamId: TeamId): Promise<TeamMemberListResponse> {
    return jikeingService({
        baseURL: JIKE_GO_BASE_URL,
        url: `/v1/team/${encodeURIComponent(String(teamId))}/members`,
        method: "get",
    });
}

/**
 * 当前成员主动退出团队
 * POST /v1/team/:teamId/leave
 */
export function leaveTeam(teamId: TeamId): Promise<TeamDepartureResponse> {
    return jikeingService({
        baseURL: JIKE_GO_BASE_URL,
        url: `/v1/team/${encodeURIComponent(String(teamId))}/leave`,
        method: "post",
        data: {},
    });
}

/**
 * Owner 移除团队成员
 * DELETE /v1/team/:teamId/members/:userId
 */
export function removeTeamMember(
    teamId: TeamId,
    userId: TeamId,
): Promise<TeamDepartureResponse> {
    return jikeingService({
        baseURL: JIKE_GO_BASE_URL,
        url: `/v1/team/${encodeURIComponent(String(teamId))}/members/${encodeURIComponent(String(userId))}`,
        method: "delete",
    });
}

/**
 * Owner 创建团队邀请
 * POST /v1/team/:teamId/invitations
 */
export function createTeamInvitation(
    teamId: TeamId,
    data: CreateTeamInvitationRequest,
): Promise<CreateTeamInvitationResponse> {
    return jikeingService({
        baseURL: JIKE_GO_BASE_URL,
        url: `/v1/team/${encodeURIComponent(String(teamId))}/invitations`,
        method: "post",
        data,
    });
}

/**
 * Owner 获取指定团队的邀请列表
 * GET /v1/team/:teamId/invitations
 */
export function getTeamInvitations(
    teamId: TeamId,
    params?: TeamPaginationParams,
): Promise<TeamInvitationListResponse> {
    return jikeingService({
        baseURL: JIKE_GO_BASE_URL,
        url: `/v1/team/${encodeURIComponent(String(teamId))}/invitations`,
        method: "get",
        params,
    });
}

/**
 * 获取当前用户收到的团队邀请
 * GET /v1/team/invitations
 */
export function getMyTeamInvitations(
    params?: TeamPaginationParams,
): Promise<TeamInvitationListResponse> {
    return jikeingService({
        baseURL: JIKE_GO_BASE_URL,
        url: "/v1/team/invitations",
        method: "get",
        params,
    });
}

/**
 * 接受团队邀请
 * POST /v1/team/invitations/:invitationId/accept
 */
export function acceptTeamInvitation(
    invitationId: TeamId,
): Promise<TeamInvitationProcessResponse> {
    return jikeingService({
        baseURL: JIKE_GO_BASE_URL,
        url: `/v1/team/invitations/${encodeURIComponent(String(invitationId))}/accept`,
        method: "post",
        data: {},
    });
}

/**
 * 拒绝团队邀请
 * POST /v1/team/invitations/:invitationId/reject
 */
export function rejectTeamInvitation(
    invitationId: TeamId,
): Promise<TeamInvitationProcessResponse> {
    return jikeingService({
        baseURL: JIKE_GO_BASE_URL,
        url: `/v1/team/invitations/${encodeURIComponent(String(invitationId))}/reject`,
        method: "post",
        data: {},
    });
}

/**
 * 获取团队积分摘要
 * GET /v1/team/:teamId/credits/summary
 */
export function getTeamCreditSummary(
    teamId: TeamId,
): Promise<TeamCreditSummaryResponse> {
    return jikeingService({
        baseURL: JIKE_GO_BASE_URL,
        url: `/v1/team/${encodeURIComponent(String(teamId))}/credits/summary`,
        method: "get",
    });
}

/**
 * 获取团队积分审计流水
 * GET /v1/team/:teamId/credits/ledgers
 */
export function getTeamCreditLedgers(
    teamId: TeamId,
    params?: TeamPaginationParams,
): Promise<TeamCreditLedgerListResponse> {
    return jikeingService({
        baseURL: JIKE_GO_BASE_URL,
        url: `/v1/team/${encodeURIComponent(String(teamId))}/credits/ledgers`,
        method: "get",
        params,
    });
}

/**
 * Owner 向当前有效成员分配个人积分
 * POST /v1/team/:teamId/credits/allocate
 */
export function allocateTeamCredits(
    teamId: TeamId,
    data: AllocateTeamCreditsRequest,
): Promise<TeamCreditOperationResponse> {
    return jikeingService({
        baseURL: JIKE_GO_BASE_URL,
        url: `/v1/team/${encodeURIComponent(String(teamId))}/credits/allocate`,
        method: "post",
        data,
    });
}

/**
 * Owner 查询当前 ACTIVE 成员的个人消费明细
 * GET /v1/team/:teamId/credits/consumption-records
 */
export function getTeamConsumptionRecords(
    teamId: TeamId,
    params?: TeamConsumptionRecordListParams,
): Promise<TeamConsumptionRecordListResponse> {
    return jikeingService({
        baseURL: JIKE_GO_BASE_URL,
        url: `/v1/team/${encodeURIComponent(String(teamId))}/credits/consumption-records`,
        method: "get",
        params,
    });
}
