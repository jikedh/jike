import { createHashRouter, RouterProvider, Outlet, Navigate } from 'react-router-dom'
import CanvasPage from '@/pages/Canvas'
import HomePage from '@/pages/Home'
import ProjectListPage from '@/pages/ProjectList'
import TestPage from '@/pages/Test'
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
    element: <SidebarLayout />,
    children: [
      {
        path: '/',
        element: <Navigate to="/home" replace />
      },
      {
        path: '/home',
        element: <HomePage />
      },
      {
        path: '/projects',
        element: <ProjectListPage />
      },
      {
        path: '/test',
        element: <TestPage />
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
