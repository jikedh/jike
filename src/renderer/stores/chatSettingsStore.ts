import { DEFAULT_CANVAS_CHAT_MODEL } from "shared/constants/ai-models";
import type { ChatPersonaId } from "shared/types/NoteGeneration";
import type { ChatSettingsStoreType } from "shared/types/zustand/chat-settings";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const GLOBAL_SETTINGS_KEY = "canvasGlobalSettings";
const LOCAL_SETTINGS_KEY = "canvas-chat-settings";
const DEFAULT_UPDATE_URL = "https://github.com/jikedh/jike/releases";

type GlobalSettings = {
  storagePath?: string;
  assetStoragePath?: string;
  jianyingDraftsPath?: string;
};

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
  | "edgeAnimationEnabled"
  | "snapGridSize"
  | "nodeSearchVisible"
  | "devToolsVisible"
  | "storagePath"
  | "assetStoragePath"
  | "jianyingDraftsPath"
  | "updateUrl"
> = {
  defaultModel: DEFAULT_CANVAS_CHAT_MODEL,
  defaultImageModel: "gpt-image-2",
  defaultImagePlatform: "openai",
  defaultImageSize: "1:1",
  defaultImageResolution: "1K",
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
  edgeAnimationEnabled: true,
  // 默认开启吸附网格，提升节点排版一致性
  snapToGrid: true,
  // 固定 20x20 网格步进，统一画布交互
  snapGridSize: [20, 20] as [number, number],
  nodeSearchVisible: false,
  devToolsVisible: false,
  storagePath: "",
  assetStoragePath: "",
  jianyingDraftsPath: "",
  updateUrl: DEFAULT_UPDATE_URL,
};

const getElectronIpc = () => {
  if (typeof window === "undefined") return null;
  return window.electron?.ipcRenderer || null;
};

const readLocalPersistedPaths = (): GlobalSettings => {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(LOCAL_SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      storagePath: parsed.state?.storagePath || "",
      assetStoragePath: parsed.state?.assetStoragePath || "",
      jianyingDraftsPath: parsed.state?.jianyingDraftsPath || "",
    };
  } catch {
    return {};
  }
};

const readGlobalSettings = async (): Promise<GlobalSettings> => {
  const ipcRenderer = getElectronIpc();
  if (!ipcRenderer) return {};
  try {
    const value = await ipcRenderer.invoke("app:dbStore:get", {
      key: GLOBAL_SETTINGS_KEY,
    });
    return value && typeof value === "object" ? value : {};
  } catch (error) {
    console.warn("[chatSettingsStore] read global settings failed", error);
    return {};
  }
};

const writeGlobalSettings = (settings: GlobalSettings) => {
  const ipcRenderer = getElectronIpc();
  if (!ipcRenderer) return;
  try {
    ipcRenderer.send("app:dbStore:set", {
      key: GLOBAL_SETTINGS_KEY,
      value: settings,
    });
  } catch (error) {
    console.warn("[chatSettingsStore] write global settings failed", error);
  }
};

const writeGlobalSettingsPatch = (patch: GlobalSettings) => {
  const state = useChatSettingsStore.getState();
  writeGlobalSettings({
    storagePath: state.storagePath,
    assetStoragePath: state.assetStoragePath,
    jianyingDraftsPath: state.jianyingDraftsPath,
    ...patch,
  });
};

export const useChatSettingsStore = create<ChatSettingsStoreType>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      setDefaultModel: (model) => set({ defaultModel: model }),
      setDefaultImagePreset: (preset) =>
        set((state) => ({
          defaultImageModel: preset.model ?? state.defaultImageModel,
          defaultImagePlatform: preset.platform ?? state.defaultImagePlatform,
          defaultImageSize: preset.size ?? state.defaultImageSize,
          defaultImageResolution:
            preset.resolution ?? state.defaultImageResolution,
        })),
      setDefaultVideoPreset: (preset) =>
        set((state) => ({
          defaultVideoModel: preset.model ?? state.defaultVideoModel,
          defaultVideoAspectRatio:
            preset.aspectRatio ?? state.defaultVideoAspectRatio,
          defaultVideoDuration: preset.duration ?? state.defaultVideoDuration,
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
            preset.mode !== undefined ? preset.mode : state.defaultNewVideoMode,
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
      setEdgeAnimationEnabled: (enabled) =>
        set({ edgeAnimationEnabled: enabled }),
      // 切换是否启用网格吸附
      setSnapToGrid: (enabled) => set({ snapToGrid: enabled }),
      // 变更网格吸附步进
      setSnapGridSize: (size) => set({ snapGridSize: size }),
      setNodeSearchVisible: (visible) => set({ nodeSearchVisible: visible }),
      setDevToolsVisible: (visible) => set({ devToolsVisible: visible }),
      setStoragePath: (path) => {
        set({ storagePath: path });
        writeGlobalSettingsPatch({ storagePath: path });
      },
      setAssetStoragePath: (path) => {
        set({ assetStoragePath: path });
        writeGlobalSettingsPatch({ assetStoragePath: path });
      },
      setJianyingDraftsPath: (path) => {
        set({ jianyingDraftsPath: path });
        writeGlobalSettingsPatch({ jianyingDraftsPath: path });
      },
      setUpdateUrl: (url) => set({ updateUrl: url }),
      resetToDefault: () => {
        set(INITIAL_STATE);
        writeGlobalSettings({
          storagePath: INITIAL_STATE.storagePath,
          assetStoragePath: INITIAL_STATE.assetStoragePath,
          jianyingDraftsPath: INITIAL_STATE.jianyingDraftsPath,
        });
      },
    }),
    {
      name: LOCAL_SETTINGS_KEY,
    },
  ),
);

void (async () => {
  const globalSettings = await readGlobalSettings();
  const localSettings = readLocalPersistedPaths();
  const state = useChatSettingsStore.getState();

  const nextSettings: GlobalSettings = {
    storagePath:
      globalSettings.storagePath || state.storagePath || localSettings.storagePath,
    assetStoragePath:
      globalSettings.assetStoragePath ||
      state.assetStoragePath ||
      localSettings.assetStoragePath,
    jianyingDraftsPath:
      globalSettings.jianyingDraftsPath ||
      state.jianyingDraftsPath ||
      localSettings.jianyingDraftsPath,
  };

  const shouldUpdateState =
    (nextSettings.storagePath &&
      nextSettings.storagePath !== state.storagePath) ||
    (nextSettings.assetStoragePath &&
      nextSettings.assetStoragePath !== state.assetStoragePath) ||
    (nextSettings.jianyingDraftsPath &&
      nextSettings.jianyingDraftsPath !== state.jianyingDraftsPath);

  if (shouldUpdateState) {
    useChatSettingsStore.setState({
      storagePath: nextSettings.storagePath || state.storagePath,
      assetStoragePath:
        nextSettings.assetStoragePath || state.assetStoragePath,
      jianyingDraftsPath:
        nextSettings.jianyingDraftsPath || state.jianyingDraftsPath,
    });
  }

  if (
    nextSettings.storagePath !== globalSettings.storagePath ||
    nextSettings.assetStoragePath !== globalSettings.assetStoragePath ||
    nextSettings.jianyingDraftsPath !== globalSettings.jianyingDraftsPath
  ) {
    writeGlobalSettings(nextSettings);
  }
})();
