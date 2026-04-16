import { DEFAULT_CANVAS_CHAT_MODEL } from "shared/constants/ai-models";
import type { ChatPersonaId } from "shared/types/NoteGeneration";
import type { ChatSettingsStoreType } from "shared/types/zustand/chat-settings";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const INITIAL_STATE: Pick<
  ChatSettingsStoreType,
  | "defaultModel"
  | "defaultPersonaId"
  | "autoSaveEnabled"
  | "gridVisible"
  | "snapToGrid"
  | "snapGridSize"
  | "nodeSearchVisible"
  | "devToolsVisible"
  | "storagePath"
> = {
  defaultModel: DEFAULT_CANVAS_CHAT_MODEL,
  defaultPersonaId: "none" as ChatPersonaId,
  autoSaveEnabled: true,
  gridVisible: false,
  // 默认开启吸附网格，提升节点排版一致性
  snapToGrid: true,
  // 固定 20x20 网格步进，统一画布交互
  snapGridSize: [20, 20] as [number, number],
  nodeSearchVisible: false,
  devToolsVisible: false,
  storagePath: "",
};

export const useChatSettingsStore = create<ChatSettingsStoreType>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      setDefaultModel: (model) => set({ defaultModel: model }),
      setDefaultPersonaId: (personaId) => set({ defaultPersonaId: personaId }),
      setAutoSaveEnabled: (enabled) => set({ autoSaveEnabled: enabled }),
      setGridVisible: (visible) => set({ gridVisible: visible }),
      // 切换是否启用网格吸附
      setSnapToGrid: (enabled) => set({ snapToGrid: enabled }),
      // 变更网格吸附步进
      setSnapGridSize: (size) => set({ snapGridSize: size }),
      setNodeSearchVisible: (visible) => set({ nodeSearchVisible: visible }),
      setDevToolsVisible: (visible) => set({ devToolsVisible: visible }),
      setStoragePath: (path) => set({ storagePath: path }),
      resetToDefault: () => set(INITIAL_STATE),
    }),
    {
      name: "canvas-chat-settings",
    },
  ),
);
