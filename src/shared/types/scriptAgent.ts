// 剧本Agent 跨进程共享类型

/** 聊天消息角色 */
export type ScriptAgentRole = "user" | "assistant" | "system";

/** 单条聊天消息 */
export type ScriptAgentMessage = {
    id: string;
    sessionId: string;
    role: ScriptAgentRole;
    content: string;
    createdAt: number;
};

/** 会话元数据（列表展示用，不含完整消息） */
export type ScriptAgentSessionMeta = {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    messageCount: number;
};

/** 完整会话（含消息列表） */
export type ScriptAgentSession = ScriptAgentSessionMeta & {
    messages: ScriptAgentMessage[];
};

/** 记忆条目类型 */
export type ScriptAgentMemoryCategory = "preference" | "knowledge" | "character" | "style";

/** 单条记忆 */
export type ScriptAgentMemory = {
    id: string;
    category: ScriptAgentMemoryCategory;
    key: string;
    value: string;
    createdAt: number;
    updatedAt: number;
};

/** DeepSeek 流式响应 chunk */
export type DeepSeekStreamChunk = {
    id: string;
    choices: Array<{
        delta: {
            role?: ScriptAgentRole;
            content?: string;
        };
        finish_reason: string | null;
    }>;
};

/** Tauri 流式事件载荷（Rust → 前端） */
export type ScriptAgentStreamEvent = {
    session_id: string;
    delta: string;
    done: boolean;
    error: string | null;
};
