import type { UserInfo } from "shared/types/jikeing";

/**
 * User Store 类型定义（data + 方法配对结构）。
 */
export type UserStoreType = {
  // ── 数据字段 ──────────────────────────────────
  loginStatus: number;
  userInfo: UserInfo | null;
  vipLevel: number;
  isLoading: boolean;
  dialogLoginStatus: boolean;

  // ── 配对 setter ──────────────────────────────
  setLoginStatus: (status: number) => void;
  setUserInfo: (info: UserInfo | null) => void;
  setVipLevel: (level: number) => void;
  setIsLoading: (loading: boolean) => void;
  setDialogLoginStatus: (show: boolean) => void;

  // ── 业务 action ───────────────────────────────
  fetchUserInfo: () => Promise<void>;
  logout: () => Promise<void>;

  // ── 计算属性 ─────────────────────────────────
  isVipLevel3: () => boolean;
  canCreateProject: () => boolean;
};
