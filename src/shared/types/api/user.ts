/**
 * 用户模块类型定义
 */

// ===================== 用户信息 =====================

/** 用户信息 */
export interface UserInfo {
  id: string | number;
  uuid: string;
  username: string;
  nickname: string;
  avatar: string;
  mobile?: string;
  email?: string;
  roles?: string[];
  role?: string;
  baiduBind?: boolean;
  createTime?: string;
  isPluginMember?: boolean;
  pluginMemberExpireAt?: string;
  isMaterialMember?: boolean;
  materialMemberExpireAt?: string;
  vipLevel?: number;
  vipExpireAt?: string;
  aiGenMember?: boolean;
  imageSplitMember?: boolean;
}

/** 获取用户信息响应 */
export interface GetUserInfoResponse {
  code: number;
  msg?: string;
  data: UserInfo;
}

/** 更新用户信息请求 */
export interface UpdateUserInfoRequest {
  nickname?: string;
  avatar?: string;
  mobile?: string;
}

// ===================== 注册登录 =====================

/** 用户名登录请求 */
export interface LoginByUsernameRequest {
  username: string;
  password: string;
}

/** 登录响应 */
export interface LoginResponse {
  code: number;
  msg?: string;
  token?: string;
  expireAt?: number;
  userInfo?: UserInfo;
}

/** 注册请求 */
export interface RegisterRequest {
  username: string;
  password: string;
  nickname?: string;
}

/** 图形验证码请求 */
export interface DigitalCaptchaRequest {
  type?: string;
}

/** 图形验证码响应 */
export interface DigitalCaptchaResponse {
  captchaId: string;
  captchaImage: string;
}

// ===================== 管理端用户 =====================

/** 按 UUID 查询会员信息响应 */
export interface GetMemberInfoByUuidResponse {
  code: number;
  msg?: string;
  data?: {
    uuid: string;
    username: string;
    nickname: string;
    avatar: string;
    vipLevel: number;
    vipExpireAt?: string;
    pluginMember: boolean;
    pluginMemberExpireAt?: string;
    materialMember: boolean;
    materialMemberExpireAt?: string;
    aiGenMember: boolean;
    aiGenMemberExpireAt?: string;
    imageSplitMember: boolean;
    imageSplitMemberExpireAt?: string;
  };
}

/** 设置会员权益请求 */
export interface AddVipRequest {
  uuid: string;
  vipLevel?: number;
  pluginMember?: boolean;
  pluginMemberExpireAt?: string;
  materialMember?: boolean;
  materialMemberExpireAt?: string;
  aiGenMember?: boolean;
  aiGenMemberExpireAt?: string;
  imageSplitMember?: boolean;
  imageSplitMemberExpireAt?: string;
}

/** 设置会员权益响应 */
export interface AddVipResponse {
  code: number;
  msg?: string;
}
