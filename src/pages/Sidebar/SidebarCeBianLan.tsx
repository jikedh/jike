import { useNavigate } from 'react-router-dom'
import { Film, Folder, House, Mic, Settings, SquareDashedMousePointer, Type, Zap } from 'lucide-react'

import { SidebarFooter } from './components/SidebarFooter'
import { SidebarLogo } from './components/SidebarLogo'
import { SidebarNav } from './components/SidebarNav'
import { SidebarNavItem } from './components/SidebarNavItem'
import { SidebarRoot } from './components/SidebarRoot'

// 用户积分数据（后续接入后端）
const USER_CREDITS = 1280

// 侧边栏组件：统一走 Sidebar 上下文结构，保留当前分支的全新视觉样式。
export const SidebarCeBianLan = () => {
  const navigate = useNavigate()

  // 路由跳转处理：只负责页面导航，不引入额外状态。
  const handleNavClick = (path: string) => {
    navigate(path)
  }

  return (
    <SidebarRoot defaultActiveId="home">
      {/* Logo 区域：使用图片保持品牌图形一致性。 */}
        <button
          type="button"
          onClick={() => handleNavClick('/home')}
        className="mb-10 flex flex-col items-center justify-center px-2 text-center cursor-pointer group"
        >
        <div className="w-10 h-10 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
          <img
            src="/icon.png"
            alt="即刻"
            className="w-full h-full object-contain"
          />
          </div>
        <span className="text-[14px] text-white/90 leading-tight font-normal tracking-widest mt-1">
          即刻
        </span>
      </button>

      {/* 导航区域：保持单一职责，每个入口只负责自己的路由跳转。 */}
      <SidebarNav classNames={{ root: 'flex-1' }}>
        <SidebarNavItem id="home" icon={<House size={24} />} label="首页" onClick={() => handleNavClick('/home')} />
        <SidebarNavItem id="canvas" icon={<SquareDashedMousePointer size={24} />} label="画布" onClick={() => handleNavClick('/canvas')} />
        <SidebarNavItem id="script" icon={<Type size={24} />} label="剧本" onClick={() => handleNavClick('/script')} />
        <SidebarNavItem id="assets" icon={<Folder size={24} />} label="资产库" onClick={() => handleNavClick('/assets')} />
        <SidebarNavItem id="voice" icon={<Mic size={24} />} label="配音工作室" onClick={() => handleNavClick('/voice')} />
        <SidebarNavItem id="video" icon={<Film size={24} />} label="短片合成" onClick={() => handleNavClick('/video')} />
      </SidebarNav>

      {/* 底部操作区：积分显示和设置入口。 */}
      <SidebarFooter classNames={{ root: 'mt-auto' }}>
        <CreditsDisplay credits={USER_CREDITS} />
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

// 积分显示组件
interface CreditsDisplayProps {
  credits: number
}

const CreditsDisplay = ({ credits }: CreditsDisplayProps) => (
  <button className="flex flex-col items-center justify-center rounded-xl px-2 py-2 text-white/50 transition-all hover:bg-white/5 hover:text-white/90">
    <div className="flex items-center gap-1.5">
      <Zap className="w-4 h-4 text-amber-400" />
      <span className="text-xs font-medium text-amber-400">{credits}</span>
    </div>
    <span className="text-[10px] text-white/30 mt-0.5">积分</span>
  </button>
)
