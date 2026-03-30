import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'

import { CanvasFlow } from './components/CanvasFlow'
import { CanvasSidebar } from './components/CanvasSidebar'
import { CanvasChatToolbar } from './components/CanvasChatToolbar'
import { ChatDrawer } from './components/ChatDrawer'
import ReactFlowDevTools from './DevTools'
import { useCanvasChat } from '@/hooks/useCanvasChat'
import { useChatSettingsStore } from '@/store/chatSettingsStore'

// 外部组件 - 提供 ReactFlowProvider 和工具栏
const CanvasPage = () => {
  // 从路由参数获取项目 ID
  const { projectId } = useParams<{ projectId: string }>()
  const [isChatOpen, setIsChatOpen] = useState(false)
  const { messages, isLoading, sendMessage, stopMessage, clearLocalMessages, setMessages } = useCanvasChat()
  // 从设置 store 读取调试工具面板的显示状态
  const devToolsVisible = useChatSettingsStore((state) => state.devToolsVisible)

  return (
    <ReactFlowProvider>
      <div className="h-screen w-screen">
        <CanvasFlow projectId={projectId} />

        {/* 悬浮侧边栏：与 CanvasFlow 同级，避免节点移动时不必要重渲染。 */}
        <CanvasSidebar />

        {/* 右下圆形聊天工具栏：负责打开抽屉与切换 system 人设。 */}
        <CanvasChatToolbar
          onOpenChat={() => setIsChatOpen(true)}
          isChatOpen={isChatOpen}
        />

        {/* 右侧抽屉聊天窗口：统一走 createChatCompletion，并使用 idb-keyval 持久化会话。 */}
        <ChatDrawer
          open={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={messages}
          isLoading={isLoading}
          sendMessage={sendMessage}
          stopMessage={stopMessage}
          clearLocalMessages={clearLocalMessages}
          setMessages={setMessages}
        />

        {/* 调试工具面板：由设置中心控制显示/隐藏 */}
        {devToolsVisible && <ReactFlowDevTools position="top-left" />}
      </div>
    </ReactFlowProvider>
  )
}

export default CanvasPage
