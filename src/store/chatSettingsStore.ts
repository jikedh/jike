import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { DEFAULT_CANVAS_CHAT_MODEL } from '@/constants/ai-models'
import type { ChatPersonaId } from '@/types/NoteGeneration'

type ChatSettingsState = {
  /** 默认对话模型 */
  defaultModel: string
  /** 默认人设 ID */
  defaultPersonaId: ChatPersonaId
  /** 自动保存开关 */
  autoSaveEnabled: boolean
  /** 网格显示开关 */
  gridVisible: boolean
  /** 节点搜索栏显示开关 */
  nodeSearchVisible: boolean
  /** 调试工具面板显示开关*/
  devToolsVisible: boolean
}

type ChatSettingsActions = {
  setDefaultModel: (model: string) => void
  setDefaultPersonaId: (personaId: ChatPersonaId) => void
  setAutoSaveEnabled: (enabled: boolean) => void
  setGridVisible: (visible: boolean) => void
  setNodeSearchVisible: (visible: boolean) => void
  setDevToolsVisible: (visible: boolean) => void
  resetToDefault: () => void
}

const INITIAL_STATE: ChatSettingsState = {
  defaultModel: DEFAULT_CANVAS_CHAT_MODEL,
  defaultPersonaId: 'none',
  autoSaveEnabled: true,
  gridVisible: true,
  nodeSearchVisible: false,
  devToolsVisible: false,
}

export const useChatSettingsStore = create<ChatSettingsState & ChatSettingsActions>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      setDefaultModel: (model) => set({ defaultModel: model }),
      setDefaultPersonaId: (personaId) => set({ defaultPersonaId: personaId }),
      setAutoSaveEnabled: (enabled) => set({ autoSaveEnabled: enabled }),
      setGridVisible: (visible) => set({ gridVisible: visible }),
      setNodeSearchVisible: (visible) => set({ nodeSearchVisible: visible }),
      setDevToolsVisible: (visible) => set({ devToolsVisible: visible }),
      resetToDefault: () => set(INITIAL_STATE),
    }),
    {
      name: 'canvas-chat-settings',
    },
  ),
)
