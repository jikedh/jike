import { lazy, Suspense } from "react";
import {
  createHashRouter,
  RouterProvider,
  Outlet,
  Navigate,
} from "react-router-dom";
import { CinematicProjectLoader } from "@/components/CinematicProjectLoader";
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
const PointsPage = lazy(() => import("@/pages/Points"));
const LoginPage = lazy(() => import("@/pages/Login"));
const ProfilePage = lazy(() => import("@/pages/Profile"));
// Canvas 是重型页面，独立懒加载
const CanvasPage = lazy(() => import("@/pages/Canvas"));
// Story 故事创作是独立全屏页面
const StoryPage = lazy(() => import("@/pages/Story"));

// 页面加载中 fallback
const PageLoader = () => (
  <div className="flex h-full items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
  </div>
);

const CanvasRouteLoader = () => (
  <CinematicProjectLoader fixed title="" subtitle="" />
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
        path: "/points",
        element: <PointsPage />,
      },
      {
        path: "/profile",
        element: <ProfilePage />,
      },
      {
        path: "/story",
        element: <StoryPage />,
      },
      {
        path: "/story/:projectId",
        element: <StoryPage />,
      },
      {
        path: "/story/:projectId/snippets/:snippetId",
        element: <StoryPage />,
      },
      {
        path: "/story/:projectId/snippets/:snippetId/agent",
        element: <StoryPage />,
      },
    ],
  },
  {
    path: "/canvas/:projectId",
    element: (
      <Suspense fallback={<CanvasRouteLoader />}>
        <CanvasPage />
      </Suspense>
    ),
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
