/**
 * Jikeing API 类型定义
 */

export interface SceneQrcodeResponse {
  scene_id: string;
  qrcode_image: string;
}

export interface LoginResponse {
  code: number;
  msg?: string;
  modal?: boolean;
  timestamp?: number;
  data?: {
    id: string | number;
    token: string;
    expireAt: number;
    status: number;
  };
}

export interface UserInfoResponse {
  code: number;
  msg?: string;
  data?: UserInfo;
}

export interface UserInfo {
  id: string | number;
  uuid: string;
  username: string;
  nickname: string;
  avatar: string;
  mobile?: string;
  roles?: string[] | string;
  role?: string;
  baidu_bind?: boolean;
  create_time?: string;
  is_plugin_member?: boolean;
  plugin_member_expire_at?: string;
  is_material_member?: boolean;
  material_member_expire_at?: string;
  vip_level?: number;
  vipLevel?: number;
  pluginMember?: boolean;
  materialMember?: boolean;
  aiGenMember?: boolean;
  imageSplitMember?: boolean;
  pluginMemberExpireAt?: string;
  materialMemberExpireAt?: string;
  vipExpireAt?: string;
}

/**
 * 用户积分余额视图对象
 */
export interface UserScoreVO {
  forScore: number;
  vipScore: number;
  userId: number;
  id: number;
  todayResigned: boolean;
}

/**
 * 积分明细记录项
 */
export interface ScoreRecordItem {
  id: number;
  userId: number;
  type: string;
  typeLabel: string;
  source: string;
  sourceLabel: string;
  model: string;
  bizType: string;
  bizId: string;
  taskId: string;
  ledgerStatus: string;
  ledgerStatusLabel: string;
  totalScore: number;
  forScore: number;
  vipScore: number;
  forBalanceScore: number;
  vipBalanceScore: number;
  createTime: number;
  generateTime: number;
  updateTime: number;
  failReason: string;
  memo: string;
}

/**
 * 积分明细分页响应
 */
export interface ScoreRecordListResponse {
  list: ScoreRecordItem[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * 积分明细查询参数
 */
export interface ScoreRecordListParams {
  page?: number;
  pageSize?: number;
}
