/**
 * AI 对话抽屉组件
 * 支持聊天消息发送、历史记录管理等功能
 */
import { IconClock, IconPlus, IconPlayerStop, IconSend, IconTrash, IconX } from '@tabler/icons-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useResizableWidth } from '@/hooks/useResizableWidth'
import { CANVAS_CHAT_PERSONAS, NO_CHAT_PERSONA_ID } from '@/constants/chat-personas'
import { useChatSettingsStore } from '@/store/chatSettingsStore'
import { cn } from '@/lib/utils'
import type { ChatPersonaId, NoteGenerationMessage } from '@/types/NoteGeneration'
import { useChatHistory } from '@/hooks/useChatHistory'

import { ChatMessageList } from './ChatMessageList'
import { ChatHistoryPanel } from './ChatHistoryPanel'

type ChatDrawerProps = {
    open: boolean
    onClose: () => void
    messages: NoteGenerationMessage[]
    isLoading: boolean
    sendMessage: (payload: { content: string; personaId: ChatPersonaId; model?: string }) => void
    stopMessage: () => void
    clearLocalMessages: () => void
    setMessages: (messages: NoteGenerationMessage[]) => void
}

export const ChatDrawer = ({
    open,
    onClose,
    messages,
    isLoading,
    sendMessage,
    stopMessage,
    clearLocalMessages,
    setMessages,
}: ChatDrawerProps) => {
    const { width, isResizing, handlePointerDown } = useResizableWidth()
    const { defaultPersonaId } = useChatSettingsStore()

    const [inputValue, setInputValue] = useState('')
    const [selectedPersonaId, setSelectedPersonaId] = useState<ChatPersonaId>(defaultPersonaId)
    const [showHistory, setShowHistory] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // 聊天历史管理
    const {
        sessionList,
        currentSession,
        createNewSession,
        switchSession,
        saveCurrentSession,
        renameCurrentSession,
        deleteSessionById,
    } = useChatHistory({ autoLoad: open })

    // 同步 store 中的默认值
    useEffect(() => {
        setSelectedPersonaId(defaultPersonaId)
    }, [defaultPersonaId])

    // 当切换会话时，同步 personaId
    useEffect(() => {
        if (currentSession) {
            setSelectedPersonaId(currentSession.personaId)
        }
    }, [currentSession])

    // 自动保存消息到 IndexedDB
    useEffect(() => {
        if (messages.length > 0 && !isLoading) {
            saveCurrentSession(messages, selectedPersonaId)
        }
    }, [messages, isLoading, saveCurrentSession, selectedPersonaId])

    // 自动滚动到底部
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // 打开时聚焦输入框
    useEffect(() => {
        if (open) {
            setTimeout(() => textareaRef.current?.focus(), 100)
        }
    }, [open])

    const handleSend = useCallback(() => {
        const content = inputValue.trim()
        if (!content || isLoading) return
        sendMessage({ content, personaId: selectedPersonaId })
        setInputValue('')
    }, [inputValue, isLoading, sendMessage, selectedPersonaId])

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
            }
        },
        [handleSend],
    )

    const handleClear = useCallback(() => {
        clearLocalMessages()
        setInputValue('')
    }, [clearLocalMessages])

    // 选择历史会话
    const handleSelectSession = useCallback(
        async (sessionId: string) => {
            const session = await switchSession(sessionId)
            if (session) {
                setMessages(session.messages)
                setShowHistory(false)
            }
        },
        [switchSession, setMessages],
    )

    // 重命名会话
    const handleRenameSession = useCallback(
        async (sessionId: string, newTitle: string) => {
            // 如果是当前会话，使用 renameCurrentSession
            if (currentSession?.id === sessionId) {
                return renameCurrentSession(newTitle)
            }
            // 否则直接调用存储层重命名
            const { renameSession } = await import('@/utils/chatHistoryStorage')
            return renameSession(sessionId, newTitle)
        },
        [currentSession, renameCurrentSession],
    )

    // 删除会话
    const handleDeleteSession = useCallback(
        async (sessionId: string) => {
            const success = await deleteSessionById(sessionId)
            // 如果删除的是当前会话，清空消息
            if (success && currentSession?.id === sessionId) {
                clearLocalMessages()
            }
            return success
        },
        [deleteSessionById, currentSession, clearLocalMessages],
    )

    // 新建聊天
    const handleNewChat = useCallback(async () => {
        await createNewSession(selectedPersonaId)
        clearLocalMessages()
        setShowHistory(false)
    }, [createNewSession, selectedPersonaId, clearLocalMessages])

    return (
        <Drawer open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
            <DrawerContent
                aria-label="AI 对话抽屉"
                className={cn(
                    'border-neutral-700 bg-neutral-900 text-neutral-100 transition-none',
                    isResizing && 'select-none',
                )}
                style={{ width: `${width + (showHistory ? 288 : 0)}px` }}
            >
                {/* Resize Handle */}
                <div
                    className={cn(
                        'absolute top-0 left-0 z-50 h-full w-1 cursor-col-resize transition-colors hover:bg-blue-500/50',
                        isResizing && 'bg-blue-500/50',
                    )}
                    onPointerDown={handlePointerDown}
                />

                <div className="flex h-full">
                    {/* Main Chat Area */}
                    <div className="flex h-full flex-1 flex-col border-r border-neutral-700">
                        {/* Header */}
                        <header className="flex items-center justify-between border-b border-neutral-700 px-4 py-3">
                            <DrawerTitle className="text-neutral-100">AI 对话</DrawerTitle>
                            <button
                                type="button"
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
                                onClick={onClose}
                            >
                                <IconX size={18} />
                            </button>
                        </header>

                        {/* Persona Selector */}
                        <div className="flex items-center gap-2 border-b border-neutral-700/60 px-4 py-2">
                            <Select
                                value={selectedPersonaId}
                                onValueChange={(v) => setSelectedPersonaId(v as ChatPersonaId)}
                            >
                                <SelectTrigger className="h-8 flex-1 border-neutral-600 bg-neutral-800 text-xs text-neutral-200">
                                    <SelectValue placeholder="选择人设" />
                                </SelectTrigger>
                                <SelectContent align="start">
                                    <SelectItem value={NO_CHAT_PERSONA_ID}>无（默认）</SelectItem>
                                    {CANVAS_CHAT_PERSONAS.map((persona) => (
                                        <SelectItem key={persona.id} value={persona.id}>
                                            {persona.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* 新建聊天按钮 */}
                            <button
                                type="button"
                                title="新建聊天"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
                                onClick={handleNewChat}
                            >
                                <IconPlus size={16} />
                            </button>

                            {/* 历史记录按钮 */}
                            <button
                                type="button"
                                title="历史记录"
                                className={cn(
                                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                                    showHistory
                                        ? 'bg-blue-600 text-white'
                                        : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100',
                                )}
                                onClick={() => setShowHistory(!showHistory)}
                            >
                                <IconClock size={16} />
                            </button>

                            {/* 清空对话按钮 */}
                            <button
                                type="button"
                                title="清空对话"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
                                onClick={handleClear}
                            >
                                <IconTrash size={16} />
                            </button>
                        </div>

                        {/* Messages */}
                        <ChatMessageList messages={messages} isLoading={isLoading} />
                        <div ref={messagesEndRef} />

                        {/* Input Area */}
                        <div className="border-t border-neutral-700 p-3">
                            <div className="flex items-end gap-2">
                                <Textarea
                                    ref={textareaRef}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="输入消息… (Enter 发送，Shift+Enter 换行)"
                                    rows={1}
                                    className="min-h-30 max-h-60 resize-none "
                                    disabled={isLoading}
                                />
                                {isLoading ? (
                                    <button
                                        type="button"
                                        title="停止生成"
                                        className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-lg bg-red-600 text-white transition-colors hover:bg-red-500"
                                        onClick={stopMessage}
                                    >
                                        <IconPlayerStop size={18} />
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        title="发送"
                                        className={cn(
                                            'flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-lg text-white transition-colors',
                                            inputValue.trim()
                                                ? 'bg-blue-600 hover:bg-blue-500'
                                                : 'bg-neutral-700 text-neutral-500',
                                        )}
                                        onClick={handleSend}
                                        disabled={!inputValue.trim()}
                                    >
                                        <IconSend size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* History Panel */}
                    {showHistory && (
                        <ChatHistoryPanel
                            sessionList={sessionList}
                            currentSessionId={currentSession?.id}
                            onSelectSession={handleSelectSession}
                            onRenameSession={handleRenameSession}
                            onDeleteSession={handleDeleteSession}
                            onClose={() => setShowHistory(false)}
                        />
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    )
}