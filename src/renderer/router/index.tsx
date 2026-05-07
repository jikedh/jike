import { lazy, Suspense } from "react";
import {
  createHashRouter,
  RouterProvider,
  Outlet,
  Navigate,
} from "react-router-dom";
import { SidebarCeBianLan } from "@/pages/Sidebar/SidebarCeBianLan";

// 懒加载页面组件 - 按需加载，减少首屏加载量
const HomePage = lazy(() => import("@/pages/Home"));
const TestPage = lazy(() => import("@/pages/Test"));
const TestGoPage = lazy(() => import("@/pages/TestGo"));
const PanoramaDemo = lazy(() => import("@/pages/Test/PanoramaDemo"));
const CanvasPlaceholderPage = lazy(() => import("@/pages/CanvasPlaceholder"));
const ScriptPage = lazy(() => import("@/pages/Script"));
const AssetsPage = lazy(() => import("@/pages/Assets"));
const VoicePage = lazy(() => import("@/pages/Voice"));
const VideoPage = lazy(() => import("@/pages/Video"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
const PointsPage = lazy(() => import("@/pages/Points"));
const LoginPage = lazy(() => import("@/pages/Login"));
// Canvas 是重型页面，独立懒加载
const CanvasPage = lazy(() => import("@/pages/Canvas"));

// 页面加载中 fallback
const PageLoader = () => (
  <div className="flex items-center justify-center h-full">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

// 带侧边栏的布局组件
const SidebarLayout = () => {
  return (
    <div className="flex h-screen">
      <SidebarCeBianLan />
      <div className="flex-1 overflow-auto">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
};

const router = createHashRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <SidebarLayout />,
    children: [
      {
        path: "/",
        element: <Navigate to="/login" replace />,
      },
      {
        path: "/home",
        element: <HomePage />,
      },
      {
        path: "/panorama",
        element: <PanoramaDemo />,
      },
      {
        path: "/test",
        element: <TestPage />,
      },
      {
        path: "/test-go",
        element: <TestGoPage />,
      },
      {
        path: "/canvas",
        element: <CanvasPlaceholderPage />,
      },
      {
        path: "/script",
        element: <ScriptPage />,
      },
      {
        path: "/assets",
        element: <AssetsPage />,
      },
      {
        path: "/voice",
        element: <VoicePage />,
      },
      {
        path: "/video",
        element: <VideoPage />,
      },
      {
        path: "/settings",
        element: <SettingsPage />,
      },
      {
        path: "/points",
        element: <PointsPage />,
      },
    ],
  },
  {
    path: "/canvas/:projectId",
    element: (
      <Suspense fallback={<PageLoader />}>
        <CanvasPage />
      </Suspense>
    ),
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
