import { NOTE_CHAT_SYSTEM_PERSONAS } from "@/types/NoteGeneration";

/**
 * 画布聊天人设配置。
 * 说明：先使用占位内容，后续按业务需要替换为正式 system prompt。
 */
export const CANVAS_CHAT_PERSONAS = NOTE_CHAT_SYSTEM_PERSONAS;

/** 人设“未选择”标识 */
export const NO_CHAT_PERSONA_ID = "none" as const;
