import { DEFAULT_CANVAS_CHAT_MODEL } from "shared/constants/ai-models";
import type { ChatPersonaId } from "shared/types/NoteGeneration";
import type { ChatSettingsStoreType } from "shared/types/zustand/chat-settings";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const INITIAL_STATE: Pick<
  ChatSettingsStoreType,
  | "defaultModel"
  | "defaultImageModel"
  | "defaultImagePlatform"
  | "defaultImageSize"
  | "defaultImageResolution"
  | "defaultVideoModel"
  | "defaultVideoAspectRatio"
  | "defaultVideoDuration"
  | "defaultVideoResolution"
  | "defaultVideoMode"
  | "defaultVideoGenerateAudio"
  | "defaultVideoAudio"
  | "defaultVideoPromptExtend"
  | "defaultNewVideoModel"
  | "defaultNewVideoAspectRatio"
  | "defaultNewVideoDuration"
  | "defaultNewVideoResolution"
  | "defaultNewVideoMode"
  | "defaultNewVideoGenerateAudio"
  | "defaultNewVideoPromptExtend"
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
  defaultImageModel: "gemini-3-pro-image-preview",
  defaultImagePlatform: "google",
  defaultImageSize: "1:1",
  defaultImageResolution: "2K",
  defaultVideoModel: "wan2.7-r2v",
  defaultVideoAspectRatio: "16:9",
  defaultVideoDuration: 5,
  defaultVideoResolution: "1080P",
  defaultVideoMode: undefined,
  defaultVideoGenerateAudio: undefined,
  defaultVideoAudio: undefined,
  defaultVideoPromptExtend: false,
  defaultNewVideoModel: "seedance-2.0-pro",
  defaultNewVideoAspectRatio: "16:9",
  defaultNewVideoDuration: 5,
  defaultNewVideoResolution: undefined,
  defaultNewVideoMode: "all-reference",
  defaultNewVideoGenerateAudio: undefined,
  defaultNewVideoPromptExtend: undefined,
  defaultPersonaId: "none" as ChatPersonaId,
  autoSaveEnabled: true,
  gridVisible: true,
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
      setDefaultImagePreset: (preset) =>
        set((state) => ({
          defaultImageModel: preset.model ?? state.defaultImageModel,
          defaultImagePlatform:
            preset.platform ?? state.defaultImagePlatform,
          defaultImageSize: preset.size ?? state.defaultImageSize,
          defaultImageResolution:
            preset.resolution ?? state.defaultImageResolution,
        })),
      setDefaultVideoPreset: (preset) =>
        set((state) => ({
          defaultVideoModel: preset.model ?? state.defaultVideoModel,
          defaultVideoAspectRatio:
            preset.aspectRatio ?? state.defaultVideoAspectRatio,
          defaultVideoDuration:
            preset.duration ?? state.defaultVideoDuration,
          defaultVideoResolution:
            preset.resolution ?? state.defaultVideoResolution,
          defaultVideoMode:
            preset.mode !== undefined ? preset.mode : state.defaultVideoMode,
          defaultVideoGenerateAudio:
            preset.generateAudio !== undefined
              ? preset.generateAudio
              : state.defaultVideoGenerateAudio,
          defaultVideoAudio:
            preset.audio !== undefined ? preset.audio : state.defaultVideoAudio,
          defaultVideoPromptExtend:
            preset.promptExtend !== undefined
              ? preset.promptExtend
              : state.defaultVideoPromptExtend,
        })),
      setDefaultNewVideoPreset: (preset) =>
        set((state) => ({
          // 新版视频节点单独记忆模型、模式与参数，避免影响老版视频节点。
          defaultNewVideoModel: preset.model ?? state.defaultNewVideoModel,
          defaultNewVideoAspectRatio:
            preset.aspectRatio ?? state.defaultNewVideoAspectRatio,
          defaultNewVideoDuration:
            preset.duration ?? state.defaultNewVideoDuration,
          defaultNewVideoResolution:
            preset.resolution ?? state.defaultNewVideoResolution,
          defaultNewVideoMode:
            preset.mode !== undefined
              ? preset.mode
              : state.defaultNewVideoMode,
          defaultNewVideoGenerateAudio:
            preset.generateAudio !== undefined
              ? preset.generateAudio
              : state.defaultNewVideoGenerateAudio,
          defaultNewVideoPromptExtend:
            preset.promptExtend !== undefined
              ? preset.promptExtend
              : state.defaultNewVideoPromptExtend,
        })),
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
