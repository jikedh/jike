import { create } from 'zustand'
import { getUserInfo } from '@/api/ai'
import { setJikeingToken, setJikeingUserId, clearJikeingToken, clearJikeingUserId, getJikeingToken } from '@/utils/utils'
import type { UserInfo } from '@/types/jikeing'

interface UserState {
  loginStatus: number
  userInfo: UserInfo | null
  vipLevel: number
  isLoading: boolean
  dialogLoginStatus: boolean
}

interface UserActions {
  setLoginStatus: (status: number) => void
  setUserInfo: (info: UserInfo | null) => void
  fetchUserInfo: () => Promise<void>
  logout: () => Promise<void>
  setDialogLoginStatus: (show: boolean) => void
  isVipLevel3: () => boolean
  canCreateProject: () => boolean
}

const initialState: UserState = {
  loginStatus: 0,
  userInfo: null,
  vipLevel: 0,
  isLoading: false,
  dialogLoginStatus: false,
}

export const useUserStore = create<UserState & UserActions>((set, get) => ({
  ...initialState,

  setLoginStatus: (status) => set({ loginStatus: status }),

  setUserInfo: (info) => {
    if (info) {
      set({
        userInfo: info,
        vipLevel: info.vipLevel || 0,
        loginStatus: 1,
      })
    } else {
      set({
        userInfo: null,
        vipLevel: 0,
        loginStatus: 0,
      })
    }
  },

  fetchUserInfo: async () => {
    const token = getJikeingToken()
    if (!token) {
      console.log('[fetchUserInfo] 没有 token，跳过获取用户信息')
      set({ loginStatus: 0, userInfo: null, vipLevel: 0 })
      return
    }

    set({ isLoading: true })

    try {
      console.log('[fetchUserInfo] 开始获取用户信息，token:', token.substring(0, 20) + '...')
      const res = await getUserInfo()
      console.log('[fetchUserInfo] API 响应:', JSON.stringify(res, null, 2))

      if ((res.code === 10000 || res.code === 200) && res.data) {
        const data = res.data
        console.log('[fetchUserInfo] 原始用户数据:', data)
        const vipLevel = data.vip_level ?? data.vipLevel ?? 0
        const pluginMember = data.is_plugin_member ?? data.pluginMember ?? false
        const materialMember = data.is_material_member ?? data.materialMember ?? false

        console.log('[fetchUserInfo] 用户信息:', {
          id: data.id,
          uuid: data.uuid,
          username: data.username,
          nickname: data.nickname,
          vipLevel,
          materialMember,
          pluginMember,
          plugin_member_expire_at: data.plugin_member_expire_at,
          material_member_expire_at: data.material_member_expire_at,
        })

        set({
          userInfo: data,
          vipLevel,
          loginStatus: 1,
        })
      } else {
        console.log('[fetchUserInfo] 获取用户信息失败，code:', res.code, 'msg:', res.msg)
        set({ loginStatus: 0, userInfo: null, vipLevel: 0 })
      }
    } catch (error) {
      console.error('[fetchUserInfo] 获取用户信息异常:', error)
      set({ loginStatus: 0, userInfo: null, vipLevel: 0 })
    } finally {
      set({ isLoading: false })
    }
  },

  logout: async () => {
    clearJikeingToken()
    clearJikeingUserId()
    set({
      loginStatus: 0,
      userInfo: null,
      vipLevel: 0,
      dialogLoginStatus: false,
    })
  },

  setDialogLoginStatus: (show) => set({ dialogLoginStatus: show }),

  isVipLevel3: () => {
    const state = get()
    return state.vipLevel >= 3
  },

  canCreateProject: () => {
    const state = get()
    if (state.loginStatus !== 1) {
      return false
    }
    return state.vipLevel >= 1
  },
}))
