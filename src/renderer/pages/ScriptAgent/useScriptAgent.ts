/**
 * 剧本Agent 自定义 Hook
 * 管理会话列表、当前会话消息、流式接收 AI 回复等状态
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
    ScriptAgentMessage,
    ScriptAgentSessionMeta,
    ScriptAgentStreamEvent,
} from "shared/types/scriptAgent";
import * as api from "@/services/scriptAgentService";

export const useScriptAgent = () => {
    const [sessions, setSessions] = useState<ScriptAgentSessionMeta[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ScriptAgentMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    // 当前正在流式输出的 AI 消息内容
    const [streamingContent, setStreamingContent] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    // 加载会话列表
    const loadSessions = useCallback(async () => {
        try {
            const list = await api.listSessions();
            setSessions(list);
        } catch (e: any) {
            console.error("[ScriptAgent] loadSessions failed", e);
        }
    }, []);

    // 加载指定会话的消息
    const loadMessages = useCallback(
        async (sessionId: string) => {
            setLoading(true);
            try {
                const msgs = await api.getMessages(sessionId);
                setMessages(msgs);
                setActiveSessionId(sessionId);
                setStreamingContent("");
                setTimeout(scrollToBottom, 50);
            } catch (e: any) {
                console.error("[ScriptAgent] loadMessages failed", e);
            } finally {
                setLoading(false);
            }
        },
        [scrollToBottom],
    );

    // 创建新会话
    const createNewSession = useCallback(async () => {
        try {
            const meta = await api.createSession("新对话");
            setSessions((prev) => [meta, ...prev]);
            setActiveSessionId(meta.id);
            setMessages([]);
            setStreamingContent("");
        } catch (e: any) {
            console.error("[ScriptAgent] createSession failed", e);
        }
    }, []);

    // 删除会话
    const removeSession = useCallback(
        async (sessionId: string) => {
            try {
                await api.deleteSession(sessionId);
                setSessions((prev) => prev.filter((s) => s.id !== sessionId));
                if (activeSessionId === sessionId) {
                    setActiveSessionId(null);
                    setMessages([]);
                    setStreamingContent("");
                }
            } catch (e: any) {
                console.error("[ScriptAgent] deleteSession failed", e);
            }
        },
        [activeSessionId],
    );

    // 重命名会话
    const renameSession = useCallback(
        async (sessionId: string, newTitle: string) => {
            try {
                await api.renameSession(sessionId, newTitle);
                setSessions((prev) =>
                    prev.map((s) =>
                        s.id === sessionId ? { ...s, title: newTitle } : s,
                    ),
                );
            } catch (e: any) {
                console.error("[ScriptAgent] renameSession failed", e);
            }
        },
        [],
    );

    // 发送消息（触发流式）
    const send = useCallback(
        async (content: string, displayContent: string, deepThinking: boolean) => {
            if (!content.trim() || !activeSessionId || sending) return;
            setSending(true);
            setStreamingContent("");
            try {
                const result = await api.sendMessage(
                    activeSessionId,
                    content.trim(),
                    deepThinking,
                );
                // 立即追加用户消息到列表
                setMessages((prev) => [
                    ...prev,
                    { ...result.userMessage, content: displayContent },
                ]);
                setTimeout(scrollToBottom, 50);
            } catch (e: any) {
                console.error("[ScriptAgent] sendMessage failed", e);
                const errorMsg: ScriptAgentMessage = {
                    id: `error-${Date.now()}`,
                    sessionId: activeSessionId,
                    role: "assistant",
                    content: `⚠️ ${e.message || "发送失败，请重试"}`,
                    createdAt: Date.now(),
                };
                setMessages((prev) => [...prev, errorMsg]);
                setSending(false);
            }
        },
        [activeSessionId, sending, scrollToBottom],
    );

    // 监听 Tauri 流式事件
    useEffect(() => {
        let unlisten: UnlistenFn | null = null;

        const setupListener = async () => {
            unlisten = await listen<ScriptAgentStreamEvent>(
                "script-agent-stream",
                (event) => {
                    const { session_id, delta, done, error } = event.payload;

                    if (error) {
                        // 流式出错
                        const errorMsg: ScriptAgentMessage = {
                            id: `error-${Date.now()}`,
                            sessionId: session_id,
                            role: "assistant",
                            content: `⚠️ ${error}`,
                            createdAt: Date.now(),
                        };
                        setMessages((prev) => [...prev, errorMsg]);
                        setStreamingContent("");
                        setSending(false);
                        return;
                    }

                    if (done) {
                        // 流结束：将累积的 streamingContent 转为正式消息
                        setStreamingContent((prev) => {
                            if (prev) {
                                const assistantMsg: ScriptAgentMessage = {
                                    id: `stream-${Date.now()}`,
                                    sessionId: session_id,
                                    role: "assistant",
                                    content: prev,
                                    createdAt: Date.now(),
                                };
                                setMessages((msgs) => [...msgs, assistantMsg]);
                                // 刷新会话列表（标题可能更新）
                                api.listSessions().then(setSessions).catch(() => { });
                            }
                            setSending(false);
                            setTimeout(scrollToBottom, 50);
                            return "";
                        });
                        return;
                    }

                    // 增量追加
                    if (delta) {
                        setStreamingContent((prev) => prev + delta);
                        setTimeout(scrollToBottom, 10);
                    }
                },
            );
        };

        setupListener();

        return () => {
            unlisten?.();
        };
    }, [scrollToBottom]);

    // 初始化加载
    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    return {
        sessions,
        activeSessionId,
        messages,
        loading,
        sending,
        streamingContent,
        messagesEndRef,
        loadSessions,
        loadMessages,
        createNewSession,
        removeSession,
        send,
        renameSession,
    };
};
