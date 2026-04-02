import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, FolderOpen, TestTube, Settings, CircleDot } from 'lucide-react'
import { SidebarRoot } from './components/SidebarRoot'
import { SidebarFooter } from './components/SidebarFooter'
import { SidebarLogo } from './components/SidebarLogo'
import { SidebarNav } from './components/SidebarNav'
import { SidebarNavItem } from './components/SidebarNavItem'

// 侧边栏组件
export const SidebarCeBianLan = () => {
  const navigate = useNavigate()

  // 导航处理
  const handleNavClick = (id: string) => {
    switch (id) {
      case 'home':
        navigate('/home')
        break
      case 'projects':
        navigate('/projects')
        break
      case 'panorama':
        navigate('/panorama')
        break
      case 'test':
        navigate('/test')
        break
    }
  }

  return (
    <SidebarRoot
      defaultActiveId="home"
      classNames={{
        root: 'w-[72px] bg-black border-r border-white/[0.08]  flex flex-col items-center py-6 z-10'
      }}
    >
      {/* Logo */}
      <SidebarLogo classNames={{ root: 'w-8 h-8 text-[#00F0FF] drop-shadow-[0_0_8px_#00F0FF]' }}>
        <svg viewBox="0 0 40 40" fill="currentColor">
          <path d="M14 16C14 18.2091 12.2091 20 10 20C7.79086 20 6 18.2091 6 16C6 13.7909 7.79086 12 10 12C12.2091 12 14 13.7909 14 16Z" />
          <path d="M22 12C26.4183 12 30 15.5817 30 20V24C30 28.4183 26.4183 32 22 32H14C9.58172 32 6 28.4183 6 24V24C6 24 6 24 6 24H14V20C14 15.5817 17.5817 12 22 12Z" />
        </svg>
      </SidebarLogo>

      {/* 首页导航模块 */}
      <SidebarNav classNames={{ root: 'flex-1' }}>
        <SidebarNavItem
          id="home"
          icon={<LayoutDashboard size={20} />}
          label="首页"
          onClick={() => handleNavClick('home')}
        />
        <SidebarNavItem
          id="projects"
          icon={<FolderOpen size={20} />}
          label="项目"
          onClick={() => handleNavClick('projects')}
        />
        <SidebarNavItem
          id="panorama"
          icon={<CircleDot size={20} />}
          label="全景"
          onClick={() => handleNavClick('panorama')}
        />
        <SidebarNavItem
          id="test"
          icon={<TestTube size={20} />}
          label="测试"
          onClick={() => handleNavClick('test')}
        />
      </SidebarNav>

      {/* 底部设置 */}
      <SidebarFooter classNames={{ root: 'mt-auto' }}>
        <div className="w-11 h-11 flex justify-center items-center cursor-pointer rounded-xl text-white hover:text-white hover:bg-white/45 transition-all">
          <Settings size={20} />
        </div>
      </SidebarFooter>
    </SidebarRoot>
  )
}
