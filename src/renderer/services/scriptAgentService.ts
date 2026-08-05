/**
 * 剧本Agent IPC 服务
 * 封装 Tauri command 调用，供页面组件使用
 */
import { invoke } from "@tauri-apps/api/core";
import type {
    ScriptAgentSessionMeta,
    ScriptAgentMessage,
    ScriptAgentMemory,
} from "shared/types/scriptAgent";
import { SCRIPT_AGENT_SYSTEM_PROMPT } from "shared/constants/scriptAgent";

const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || "";
const DEEPSEEK_API_BASE =
    import.meta.env.VITE_DEEPSEEK_API_BASE_URL || "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-chat";

/** 创建新会话 */
export const createSession = async (
    title: string = "新对话",
): Promise<ScriptAgentSessionMeta> => {
    return invoke("script_agent_create_session", { title });
};

/** 获取会话列表 */
export const listSessions = async (): Promise<ScriptAgentSessionMeta[]> => {
    return invoke("script_agent_list_sessions");
};

/** 删除会话 */
export const deleteSession = async (sessionId: string): Promise<void> => {
    return invoke("script_agent_delete_session", { sessionId });
};

/** 重命名会话 */
export const renameSession = async (
    sessionId: string,
    newTitle: string,
): Promise<void> => {
    return invoke("script_agent_rename_session", { sessionId, newTitle });
};

/** 获取会话消息列表 */
export const getMessages = async (
    sessionId: string,
): Promise<ScriptAgentMessage[]> => {
    return invoke("script_agent_get_messages", { sessionId });
};

/** 发送消息（流式），AI 回复通过 Tauri 事件推送 */
export const sendMessage = async (
    sessionId: string,
    content: string,
): Promise<{ userMessage: ScriptAgentMessage; assistantMessageId: string }> => {
    if (!DEEPSEEK_API_KEY) {
        throw new Error("DeepSeek API Key 未配置，请在 .env 中设置 VITE_DEEPSEEK_API_KEY");
    }
    return invoke("script_agent_send_message", {
        sessionId,
        content,
        apiKey: DEEPSEEK_API_KEY,
        apiBase: DEEPSEEK_API_BASE,
        model: DEFAULT_MODEL,
        systemPrompt: SCRIPT_AGENT_SYSTEM_PROMPT,
    });
};

/** 获取所有记忆条目 */
export const listMemories = async (): Promise<ScriptAgentMemory[]> => {
    return invoke("script_agent_list_memories");
};

/** 手动添加/更新记忆 */
export const upsertMemory = async (
    category: string,
    key: string,
    value: string,
): Promise<ScriptAgentMemory> => {
    return invoke("script_agent_upsert_memory", { category, key, value });
};

/** 删除记忆 */
export const deleteMemory = async (memoryId: string): Promise<void> => {
    return invoke("script_agent_delete_memory", { memoryId });
};
