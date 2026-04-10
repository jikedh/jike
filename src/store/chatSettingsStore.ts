import { create } from "zustand";
import { persist } from "zustand/middleware";

import { DEFAULT_CANVAS_CHAT_MODEL } from "@/constants/ai-models";
import type { ChatPersonaId } from "@/types/NoteGeneration";

type ChatSettingsState = {
  /** 默认对话模型 */
  defaultModel: string;
  /** 默认人设 ID */
  defaultPersonaId: ChatPersonaId;
  /** 自动保存开关 */
  autoSaveEnabled: boolean;
  /** 网格显示开关 */
  gridVisible: boolean;
  /** 节点是否吸附到网格 */
  snapToGrid: boolean;
  /** 网格吸附尺寸 [x, y] */
  snapGridSize: [number, number];
  /** 节点搜索栏显示开关 */
  nodeSearchVisible: boolean;
  /** 调试工具面板显示开关*/
  devToolsVisible: boolean;
  /** 项目存储路径 */
  storagePath: string;
};

type ChatSettingsActions = {
  setDefaultModel: (model: string) => void;
  setDefaultPersonaId: (personaId: ChatPersonaId) => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  setGridVisible: (visible: boolean) => void;
  setSnapToGrid: (enabled: boolean) => void;
  setSnapGridSize: (size: [number, number]) => void;
  setNodeSearchVisible: (visible: boolean) => void;
  setDevToolsVisible: (visible: boolean) => void;
  setStoragePath: (path: string) => void;
  resetToDefault: () => void;
};

const INITIAL_STATE: ChatSettingsState = {
  defaultModel: DEFAULT_CANVAS_CHAT_MODEL,
  defaultPersonaId: "none",
  autoSaveEnabled: true,
  gridVisible: true,
  // 默认开启吸附网格，提升节点排版一致性
  snapToGrid: true,
  // 固定 40x40 网格步进（当前版本采用最小改动策略）
  snapGridSize: [40, 40],
  nodeSearchVisible: false,
  devToolsVisible: false,
  storagePath: "",
};

export const useChatSettingsStore = create<
  ChatSettingsState & ChatSettingsActions
>()(
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
