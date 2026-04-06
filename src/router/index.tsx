import { createHashRouter, RouterProvider, Outlet, Navigate } from 'react-router-dom'
import CanvasPage from '@/pages/Canvas'
import HomePage from '@/pages/Home'
import TestPage from '@/pages/Test'
import PanoramaDemo from '@/pages/Test/PanoramaDemo'
import CanvasPlaceholderPage from '@/pages/CanvasPlaceholder'
import ScriptPage from '@/pages/Script'
import AssetsPage from '@/pages/Assets'
import VoicePage from '@/pages/Voice'
import VideoPage from '@/pages/Video'
import SettingsPage from '@/pages/Settings'
import LoginPage from '@/pages/Login'
import { SidebarCeBianLan } from '@/pages/Sidebar/SidebarCeBianLan'

// 带侧边栏的布局组件
const SidebarLayout = () => {
  return (
    <div className="flex h-screen">
      <SidebarCeBianLan />
      <div className="flex-1 overflow-auto">
        {/* React Router 提供的动态插槽 */}
        <Outlet />
      </div>
    </div>
  )
}

const router = createHashRouter([
  {
    path: '/login',
    element: <LoginPage />
  },
  {
    element: <SidebarLayout />,
    children: [
      {
        path: '/',
        element: <Navigate to="/login" replace />
      },
      {
        path: '/home',
        element: <HomePage />
      },
      {
        path: '/panorama',
        element: <PanoramaDemo />
      },
      {
        path: '/test',
        element: <TestPage />
      },
      {
        path: '/canvas',
        element: <CanvasPlaceholderPage />
      },
      {
        path: '/script',
        element: <ScriptPage />
      },
      {
        path: '/assets',
        element: <AssetsPage />
      },
      {
        path: '/voice',
        element: <VoicePage />
      },
      {
        path: '/video',
        element: <VideoPage />
      },
      {
        path: '/settings',
        element: <SettingsPage />
      }
    ]
  },
  {
    path: '/canvas/:projectId',
    element: <CanvasPage />
  }
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}
