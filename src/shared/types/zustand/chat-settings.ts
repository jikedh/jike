import type { ChatPersonaId } from "shared/types/NoteGeneration";

/**
 * ChatSettings Store 类型定义（data + 方法配对结构）。
 */
export type ChatSettingsStoreType = {
  // ── 数据字段 ──────────────────────────────────
  defaultModel: string;
  defaultImageModel: string;
  defaultImagePlatform?: string;
  defaultImageSize: string;
  defaultImageResolution: string;
  defaultVideoModel: string;
  defaultVideoAspectRatio: string;
  defaultVideoDuration: number;
  defaultVideoResolution: string;
  defaultVideoMode?: string;
  defaultVideoGenerateAudio?: boolean;
  defaultVideoAudio?: boolean;
  defaultVideoPromptExtend?: boolean;
  defaultNewVideoModel?: string;
  defaultNewVideoAspectRatio?: string;
  defaultNewVideoDuration?: number;
  defaultNewVideoResolution?: string;
  defaultNewVideoMode?: string;
  defaultNewVideoGenerateAudio?: boolean;
  defaultNewVideoPromptExtend?: boolean;
  defaultPersonaId: ChatPersonaId;
  autoSaveEnabled: boolean;
  gridVisible: boolean;
  snapToGrid: boolean;
  edgeAnimationEnabled: boolean;
  snapGridSize: [number, number];
  nodeSearchVisible: boolean;
  devToolsVisible: boolean;
  storagePath: string;

  // ── 配对 setter ───────────────────────────────
  setDefaultModel: (model: string) => void;
  setDefaultImagePreset: (preset: {
    model?: string;
    platform?: string;
    size?: string;
    resolution?: string;
  }) => void;
  setDefaultVideoPreset: (preset: {
    model?: string;
    aspectRatio?: string;
    duration?: number;
    resolution?: string;
    mode?: string;
    generateAudio?: boolean;
    audio?: boolean;
    promptExtend?: boolean;
  }) => void;
  setDefaultNewVideoPreset: (preset: {
    model?: string;
    aspectRatio?: string;
    duration?: number;
    resolution?: string;
    mode?: string;
    generateAudio?: boolean;
    promptExtend?: boolean;
  }) => void;
  setDefaultPersonaId: (personaId: ChatPersonaId) => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  setGridVisible: (visible: boolean) => void;
  setSnapToGrid: (enabled: boolean) => void;
  setEdgeAnimationEnabled: (enabled: boolean) => void;
  setSnapGridSize: (size: [number, number]) => void;
  setNodeSearchVisible: (visible: boolean) => void;
  setDevToolsVisible: (visible: boolean) => void;
  setStoragePath: (path: string) => void;

  // ── 业务 action ───────────────────────────────
  resetToDefault: () => void;
};
