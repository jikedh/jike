import { useNavigate } from 'react-router-dom'
import { House, SquareDashedMousePointer, Type, Folder, Mic, Film, Zap, Settings } from 'lucide-react'
import { SidebarRoot } from './components/SidebarRoot'
import { SidebarFooter } from './components/SidebarFooter'
import { SidebarLogo } from './components/SidebarLogo'
import { SidebarNav } from './components/SidebarNav'
import { SidebarNavItem } from './components/SidebarNavItem'

// 侧边栏组件
export const SidebarCeBianLan = () => {
  const navigate = useNavigate()

  // 导航处理
  const handleNavClick = (path: string) => {
    navigate(path)
  }

  // 快速功能点击处理
  const handleQuickClick = () => {
    alert('功能正在开发中...')
  }

  return (
    <SidebarRoot defaultActiveId="home">
      {/* Logo */}
      <SidebarLogo label="即刻">
        <div className="w-10 h-10 flex items-center justify-center">
          <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* 彩色渐变 Logo */}
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
      </SidebarLogo>

      {/* 导航区域 */}
      <SidebarNav classNames={{ root: 'flex-1' }}>
        <SidebarNavItem
          id="home"
          icon={<House size={24} />}
          label="首页"
          onClick={() => handleNavClick('/home')}
        />
        <SidebarNavItem
          id="canvas"
          icon={<SquareDashedMousePointer size={24} />}
          label="画布"
          onClick={() => handleNavClick('/canvas')}
        />
        <SidebarNavItem
          id="script"
          icon={<Type size={24} />}
          label="剧本"
          onClick={() => handleNavClick('/script')}
        />
        <SidebarNavItem
          id="assets"
          icon={<Folder size={24} />}
          label="资产库"
          onClick={() => handleNavClick('/assets')}
        />
        <SidebarNavItem
          id="voice"
          icon={<Mic size={24} />}
          label="配音工作室"
          onClick={() => handleNavClick('/voice')}
        />
        <SidebarNavItem
          id="video"
          icon={<Film size={24} />}
          label="短片合成"
          onClick={() => handleNavClick('/video')}
        />
      </SidebarNav>

      {/* 底部快捷按钮 */}
      <SidebarFooter classNames={{ root: 'mt-auto' }}>
        <button
          onClick={handleQuickClick}
          className="flex flex-col items-center justify-center py-3 px-2 rounded-xl text-white/50 hover:bg-white/5 hover:text-white/90 transition-all"
          title="快速"
        >
          <Zap size={24} />
        </button>
        <button
          onClick={() => handleNavClick('/settings')}
          className="flex flex-col items-center justify-center py-3 px-2 rounded-xl text-white/50 hover:bg-white/5 hover:text-white/90 transition-all mt-4"
          title="设置"
        >
          <Settings size={24} />
        </button>
      </SidebarFooter>
    </SidebarRoot>
  )
}
