import { createHashRouter, RouterProvider, Outlet, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { SidebarCeBianLan } from '@/pages/Sidebar/SidebarCeBianLan'

// ==================== 路由懒加载 ====================
// 将各页面组件改为动态导入，实现代码分割，减少首屏加载体积

const CanvasPage = lazy(() => import('@/pages/Canvas'))
const HomePage = lazy(() => import('@/pages/Home'))
const ProjectListPage = lazy(() => import('@/pages/ProjectList'))
const TestPage = lazy(() => import('@/pages/Test'))

// 页面加载中的 fallback 组件
const PageLoading = () => (
  <div className="flex h-screen w-full items-center justify-center bg-[#0a0a0f]">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
      <span className="text-sm text-white/50">加载中...</span>
    </div>
  </div>
)

// 带侧边栏的布局组件
const SidebarLayout = () => {
  return (
    <div className="flex h-screen">
      <SidebarCeBianLan />
      <div className="flex-1 overflow-auto">
        {/* React Router 提供的动态插槽 */}
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
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
    element: (
      <Suspense fallback={<PageLoading />}>
        <CanvasPage />
      </Suspense>
    )
  }
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}
