import { useNavigate } from 'react-router-dom'
import { Film, Folder, House, Mic, Settings, SquareDashedMousePointer, Type, Zap } from 'lucide-react'

import { SidebarFooter } from './components/SidebarFooter'
import { SidebarLogo } from './components/SidebarLogo'
import { SidebarNav } from './components/SidebarNav'
import { SidebarNavItem } from './components/SidebarNavItem'
import { SidebarRoot } from './components/SidebarRoot'

// 侧边栏组件：统一走 Sidebar 上下文结构，保留当前分支的全新视觉样式。
export const SidebarCeBianLan = () => {
  const navigate = useNavigate()

  // 路由跳转处理：只负责页面导航，不引入额外状态。
  const handleNavClick = (path: string) => {
    navigate(path)
  }

  // 快速功能点击处理：暂时保留占位提示，后续可替换为真实能力入口。
  const handleQuickClick = () => {
    alert('功能正在开发中...')
  }

  return (
    <SidebarRoot defaultActiveId="home">
      {/* Logo 区域：使用 SVG 保持品牌图形一致性。 */}
      <SidebarLogo label="即刻">
        <button
          type="button"
          onClick={() => handleNavClick('/home')}
          className="flex flex-col items-center justify-center"
        >
          <div className="flex h-10 w-10 items-center justify-center">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366F1" />
                  <stop offset="100%" stopColor="#B43FEB" />
                </linearGradient>
              </defs>
              <rect x="8" y="12" width="8" height="16" rx="2" fill="url(#logo-gradient)" />
              <rect x="18" y="6" width="8" height="22" rx="2" fill="url(#logo-gradient)" />
              <rect x="28" y="14" width="8" height="14" rx="2" fill="url(#logo-gradient)" />
            </svg>
          </div>
        </button>
      </SidebarLogo>

      {/* 导航区域：保持单一职责，每个入口只负责自己的路由跳转。 */}
      <SidebarNav classNames={{ root: 'flex-1' }}>
        <SidebarNavItem id="home" icon={<House size={24} />} label="首页" onClick={() => handleNavClick('/home')} />
        <SidebarNavItem id="canvas" icon={<SquareDashedMousePointer size={24} />} label="画布" onClick={() => handleNavClick('/canvas')} />
        <SidebarNavItem id="script" icon={<Type size={24} />} label="剧本" onClick={() => handleNavClick('/script')} />
        <SidebarNavItem id="assets" icon={<Folder size={24} />} label="资产库" onClick={() => handleNavClick('/assets')} />
        <SidebarNavItem id="voice" icon={<Mic size={24} />} label="配音工作室" onClick={() => handleNavClick('/voice')} />
        <SidebarNavItem id="video" icon={<Film size={24} />} label="短片合成" onClick={() => handleNavClick('/video')} />
      </SidebarNav>

      {/* 底部操作区：保留“快速”占位和设置入口。 */}
      <SidebarFooter classNames={{ root: 'mt-auto' }}>
        <button
          type="button"
          onClick={handleQuickClick}
          className="flex flex-col items-center justify-center rounded-xl px-2 py-3 text-white/50 transition-all hover:bg-white/5 hover:text-white/90"
          title="快速"
        >
          <Zap size={24} />
        </button>
        <button
          type="button"
          onClick={() => handleNavClick('/settings')}
          className="mt-4 flex flex-col items-center justify-center rounded-xl px-2 py-3 text-white/50 transition-all hover:bg-white/5 hover:text-white/90"
          title="设置"
        >
          <Settings size={24} />
        </button>
      </SidebarFooter>
    </SidebarRoot>
  )
}
