import type { UserStoreType } from "shared/types/zustand/user";
import {
  clearJikeingToken,
  clearJikeingUserId,
  getJikeingToken,
} from "shared/utils/utils";
import { create } from "zustand";
import { getUserInfo } from "@/api/ai";

const initialState: Pick<
  UserStoreType,
  "loginStatus" | "userInfo" | "vipLevel" | "isLoading" | "dialogLoginStatus"
> = {
  loginStatus: 0,
  userInfo: null,
  vipLevel: 0,
  isLoading: false,
  dialogLoginStatus: false,
};

export const useUserStore = create<UserStoreType>((set, get) => ({
  ...initialState,

  setLoginStatus: (status) => set({ loginStatus: status }),

  setVipLevel: (level) => set({ vipLevel: level }),

  setIsLoading: (loading) => set({ isLoading: loading }),

  setUserInfo: (info) => {
    if (info) {
      set({
        userInfo: info,
        vipLevel: info.vipLevel || 0,
        loginStatus: 1,
      });
    } else {
      set({
        userInfo: null,
        vipLevel: 0,
        loginStatus: 0,
      });
    }
  },

  fetchUserInfo: async () => {
    const token = getJikeingToken();
    if (!token) {
      set({ loginStatus: 0, userInfo: null, vipLevel: 0 });
      return;
    }

    set({ isLoading: true });

    try {
      const res = await getUserInfo();

      if ((res.code === 10000 || res.code === 200) && res.data) {
        const data = res.data;
        const vipLevel = data.vip_level ?? data.vipLevel ?? 0;
        const pluginMember =
          data.is_plugin_member ?? data.pluginMember ?? false;
        const materialMember =
          data.is_material_member ?? data.materialMember ?? false;

        set({
          userInfo: data,
          vipLevel,
          loginStatus: 1,
        });
      } else {
        set({ loginStatus: 0, userInfo: null, vipLevel: 0 });
      }
    } catch (error) {
      console.error("[fetchUserInfo] 获取用户信息异常:", error);
      set({ loginStatus: 0, userInfo: null, vipLevel: 0 });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    clearJikeingToken();
    clearJikeingUserId();
    set({
      loginStatus: 0,
      userInfo: null,
      vipLevel: 0,
      dialogLoginStatus: false,
    });
  },

  setDialogLoginStatus: (show) => set({ dialogLoginStatus: show }),

  isVipLevel3: () => {
    const state = get();
    return state.vipLevel >= 3;
  },

  canCreateProject: () => {
    const state = get();
    if (state.loginStatus !== 1) {
      return false;
    }
    return state.vipLevel >= 3;
  },
}));
