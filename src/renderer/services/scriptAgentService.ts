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
const SCRIPT_AGENT_MODELS = {
    deepThinking: "deepseek-v4-pro",
    fast: "deepseek-v4-flash",
} as const;

const WEB_SEARCH_OUTPUT_INSTRUCTION = `

## 联网搜索回复规则

当前用户已启用联网搜索。请先通过当前模型或服务端提供的联网检索能力核验需要时效性或事实性的内容，再按以下顺序输出：

## AI答案正文

使用清晰的 Markdown 正文回答用户问题。对无法核实的信息明确说明不确定性，不得编造来源。

## 引用来源

仅列出实际使用的来源，每条使用以下格式：

- [来源标题](https://example.com)｜来源摘要

每个链接必须是完整的 http 或 https URL；标题、摘要和链接必须与实际来源一致。没有可靠来源时，输出“未检索到可引用的可靠来源”。`;

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
    deepThinking: boolean,
    webSearchEnabled: boolean,
): Promise<{ userMessage: ScriptAgentMessage; assistantMessageId: string }> => {
    if (!DEEPSEEK_API_KEY) {
        throw new Error("DeepSeek API Key 未配置，请在 .env 中设置 VITE_DEEPSEEK_API_KEY");
    }
    return invoke("script_agent_send_message", {
        sessionId,
        content,
        apiKey: DEEPSEEK_API_KEY,
        apiBase: DEEPSEEK_API_BASE,
        model: deepThinking
            ? SCRIPT_AGENT_MODELS.deepThinking
            : SCRIPT_AGENT_MODELS.fast,
        systemPrompt: `${SCRIPT_AGENT_SYSTEM_PROMPT}${webSearchEnabled ? WEB_SEARCH_OUTPUT_INSTRUCTION : ""}`,
        webSearchEnabled,
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
