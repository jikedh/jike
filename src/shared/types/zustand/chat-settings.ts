import type { ChatPersonaId } from "shared/types/NoteGeneration";

/**
 * ChatSettings Store 类型定义（data + 方法配对结构）。
 */
export type ChatSettingsStoreType = {
  // ── 数据字段 ──────────────────────────────────
  defaultModel: string;
  defaultPersonaId: ChatPersonaId;
  autoSaveEnabled: boolean;
  gridVisible: boolean;
  snapToGrid: boolean;
  snapGridSize: [number, number];
  nodeSearchVisible: boolean;
  devToolsVisible: boolean;
  storagePath: string;

  // ── 配对 setter ───────────────────────────────
  setDefaultModel: (model: string) => void;
  setDefaultPersonaId: (personaId: ChatPersonaId) => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  setGridVisible: (visible: boolean) => void;
  setSnapToGrid: (enabled: boolean) => void;
  setSnapGridSize: (size: [number, number]) => void;
  setNodeSearchVisible: (visible: boolean) => void;
  setDevToolsVisible: (visible: boolean) => void;
  setStoragePath: (path: string) => void;

  // ── 业务 action ───────────────────────────────
  resetToDefault: () => void;
};
