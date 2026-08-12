/**
 * 剧本Agent 页面
 * 左侧会话列表 + 右侧聊天区域
 */
import { useState } from "react";
import type { ScriptAgentSource } from "shared/types/scriptAgent";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";
import { SessionList } from "./SessionList";
import { SourcePanel } from "./SourcePanel";
import { useScriptAgent } from "./useScriptAgent";

const ScriptAgentPage = () => {
    const [sources, setSources] = useState<ScriptAgentSource[]>([]);
    const {
        sessions,
        activeSessionId,
        messages,
        loading,
        sending,
        streamingContent,
        messagesEndRef,
        loadMessages,
        createNewSession,
        removeSession,
        renameSession,
        send,
    } = useScriptAgent();

    return (
        <div className="flex h-screen bg-[#09090b] text-white">
            {/* 左侧会话列表 */}
            <SessionList
                sessions={sessions}
                activeId={activeSessionId}
                onSelect={loadMessages}
                onCreate={createNewSession}
                onDelete={removeSession}
                onRename={renameSession}
            />

            {/* 右侧聊天区域 */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {!activeSessionId ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-white/30">
                        <span className="text-4xl">🎬</span>
                        <span className="text-lg">选择一个对话或创建新对话开始创作</span>
                    </div>
                ) : (
                    <>
                        <MessageList
                            messages={messages}
                            streamingContent={streamingContent}
                            loading={loading}
                            sending={sending}
                            endRef={messagesEndRef}
                            onShowSources={setSources}
                        />
                        <ChatInput disabled={sending || loading} onSend={send} />
                    </>
                )}
            </div>
            {sources.length > 0 && <SourcePanel sources={sources} onClose={() => setSources([])} />}
        </div>
    );
};

export default ScriptAgentPage;
