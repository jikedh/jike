/**
 * 管理端登录接口
 * 对应 jikeing-web/src/api/manager/info.js
 */

import { jikeingAdminService } from "service/aiRequest";
import type {
  DigitalCaptchaRequest,
  DigitalCaptchaResponse,
  RegisterRequest,
  LoginByUsernameRequest,
  LoginResponse,
  GetUserInfoResponse,
} from "shared/types/api/user";

// 环境变量配置的基础路径
const ADMIN_BASE_API = import.meta.env.VITE_JAVA_ADMIN_BASE_API || "";
const JAVA_BASE_API = import.meta.env.VITE_JAVA_BASE_API || "";

/** 图形验证码 */
export function digital(
  data?: DigitalCaptchaRequest,
): Promise<DigitalCaptchaResponse> {
  return jikeingAdminService({
    url: "/v1/captcha/digital",
    method: "post",
    data,
  });
}

/** 用户注册 */
export function register(
  data: RegisterRequest,
): Promise<{ code: number; msg?: string }> {
  return jikeingAdminService({
    url: "/v1/user/register",
    method: "post",
    data,
  });
}

/** 用户名登录 */
export function login(data: LoginByUsernameRequest): Promise<LoginResponse> {
  return jikeingAdminService({
    url: "/v1/user/login/byUsername",
    method: "post",
    data,
  });
}

/** 获取当前用户信息 */
export function getUserInfo(): Promise<GetUserInfoResponse> {
  return jikeingAdminService({
    baseURL: JAVA_BASE_API,
    url: "/v1/user/info",
    method: "get",
  });
}
