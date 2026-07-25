/**
 * 团队管理与积分模块接口类型定义。
 *
 * 所有字段保持与 jike-go 的 /v1/team 接口响应一致。
 */

export type TeamId = string | number;
export type TeamRole = "OWNER" | "MEMBER";
export type TeamInvitationStatus = "PENDING" | "ACCEPTED" | "REJECTED";
export type TeamCreditLedgerType =
    | "ALLOCATE"
    | "RECLAIM"
    | "TASK_CONSUME"
    | "TASK_CONSUME_REVERSAL"
    | "ACCOUNT_MIGRATION";

/** 后端统一响应信封。 */
export interface TeamApiResponse<T> {
    code: number;
    msg?: string;
    data: T;
}

/** 分页查询参数。 */
export interface TeamPaginationParams {
    page?: number;
    pageSize?: number;
}

/** 团队基础信息。 */
export interface TeamInfo {
    id: TeamId;
    name: string;
    description: string;
    createdBy: TeamId;
    currentRole: TeamRole;
    createdAt: number | string;
    updatedAt: number | string;
}

/** 创建团队请求。 */
export interface CreateTeamRequest {
    name: string;
    description?: string;
}

/** 更新团队请求，至少传入一个字段。 */
export interface UpdateTeamRequest {
    name?: string;
    description?: string;
}

/** 团队列表响应数据。 */
export interface TeamListData {
    list: TeamInfo[];
    total: number;
    page: number;
    pageSize: number;
}

export type TeamResponse = TeamApiResponse<TeamInfo>;
export type TeamListResponse = TeamApiResponse<TeamListData>;

/** 当前有效团队成员。 */
export interface TeamMember {
    id: TeamId;
    userId: TeamId;
    username: string;
    nickname: string;
    avatar: string;
    role: TeamRole;
    joinedAt: number;
}

/** 团队成员列表响应数据。 */
export interface TeamMemberListData {
    list: TeamMember[];
    currentRole: TeamRole;
}

export type TeamMemberListResponse = TeamApiResponse<TeamMemberListData>;

/** 成员退出或被移除结果。 */
export interface TeamDepartureResult {
    completed: boolean;
}

export type TeamDepartureResponse = TeamApiResponse<TeamDepartureResult>;

/** 创建团队邀请请求。 */
export interface CreateTeamInvitationRequest {
    inviteeUuid: string;
}

/** 团队邀请信息。 */
export interface TeamInvitation {
    id: TeamId;
    teamId: TeamId;
    teamName: string;
    inviteeUserId: TeamId;
    inviteeNickname: string;
    inviteeAvatar: string;
    inviterUserId: TeamId;
    inviterNickname: string;
    inviterAvatar: string;
    status: TeamInvitationStatus;
    createdAt: number;
    respondedAt?: number;
}

/** 重复创建待处理邀请时的响应数据。 */
export interface ExistingTeamInvitationResult {
    message: string;
    invitation: TeamInvitation;
}

/** 邀请列表响应数据。 */
export interface TeamInvitationListData {
    list: TeamInvitation[];
    total: number;
    page: number;
    pageSize: number;
}

/** 接受或拒绝邀请结果。 */
export interface TeamInvitationProcessResult {
    invitationId: TeamId;
    status: Exclude<TeamInvitationStatus, "PENDING">;
    memberId?: TeamId;
}

export type CreateTeamInvitationResponse = TeamApiResponse<
    TeamInvitation | ExistingTeamInvitationResult
>;
export type TeamInvitationListResponse = TeamApiResponse<TeamInvitationListData>;
export type TeamInvitationProcessResponse = TeamApiResponse<TeamInvitationProcessResult>;

/** 当前成员在团队中的积分摘要。 */
export interface TeamCreditSummary {
    allocatablePersonalCredits: number;
    teamTotalAllocatedCredits: number;
    currentVipScore: number;
    currentForScore: number;
    currentRole: TeamRole;
}

export type TeamCreditSummaryResponse = TeamApiResponse<TeamCreditSummary>;

/** 团队积分审计流水。 */
export interface TeamCreditLedger {
    id: TeamId;
    memberId: TeamId;
    memberUserId: TeamId;
    memberNickname: string;
    memberAvatar: string;
    operatorUserId?: TeamId;
    operatorNickname: string;
    type: TeamCreditLedgerType;
    amount: number;
    bizType: string;
    bizId: string;
    createdAt: number;
}

/** 团队积分流水列表响应数据。 */
export interface TeamCreditLedgerListData {
    list: TeamCreditLedger[];
    total: number;
    page: number;
    pageSize: number;
}

export type TeamCreditLedgerListResponse = TeamApiResponse<TeamCreditLedgerListData>;

/** Owner 分配积分请求。 */
export interface AllocateTeamCreditsRequest {
    memberUserId: TeamId;
    amount: number;
    requestKey: string;
}

/** 积分操作结果。 */
export interface TeamCreditOperationResult {
    completed: boolean;
    operationId: TeamId;
    message: string;
}

export type TeamCreditOperationResponse = TeamApiResponse<TeamCreditOperationResult>;

/** Owner 查询成员个人消费流水的筛选参数。 */
export interface TeamConsumptionRecordListParams extends TeamPaginationParams {
    memberUserId?: TeamId;
    bizType?: string;
    source?: string;
    model?: string;
    startTime?: number;
    endTime?: number;
}

/** 当前 ACTIVE 成员的个人消费记录。 */
export interface TeamConsumptionRecord {
    recordId: number;
    userId: TeamId;
    nickname: string;
    avatar: string;
    memberId: TeamId;
    memberStatus: string;
    vipScore: number;
    forScore: number;
    vipBalanceScore: number;
    forBalanceScore: number;
    source: string;
    sourceLabel: string;
    model: string;
    bizType: string;
    bizId?: TeamId;
    taskId: string;
    createTime: number;
    memo: string;
}

/** 成员个人消费流水列表响应数据。 */
export interface TeamConsumptionRecordListData {
    list: TeamConsumptionRecord[];
    total: number;
    page: number;
    pageSize: number;
    pageTotalVipScore: number;
    pageTotalForScore: number;
    allTotalVipScore: number;
    allTotalForScore: number;
}

export type TeamConsumptionRecordListResponse = TeamApiResponse<TeamConsumptionRecordListData>;
