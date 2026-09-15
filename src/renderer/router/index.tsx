import { lazy, Suspense, useEffect, type ReactNode } from "react";
import {
  createHashRouter,
  RouterProvider,
  Outlet,
  Navigate,
} from "react-router-dom";
import { CinematicProjectLoader } from "@/components/CinematicProjectLoader";
import { SidebarCeBianLan } from "@/pages/Sidebar/SidebarCeBianLan";
import { useUserStore } from "@/stores/useUserStore";
import { getJikeingToken } from "shared/utils/utils";

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
const VideoToScriptPage = lazy(() => import("@/pages/VideoToScript"));
const ShortDramaCommentaryPage = lazy(
  () => import("@/pages/ShortDramaCommentary"),
);
const PointsPage = lazy(() => import("@/pages/Points"));
const LoginPage = lazy(() => import("@/pages/Login"));
const ProfilePage = lazy(() => import("@/pages/Profile"));
const TeamsPage = lazy(() => import("@/pages/Teams"));
const InvitationCenterPage = lazy(() => import("@/pages/InvitationCenter"));
const FeedbackPage = lazy(() => import("@/pages/Feedback"));
// Canvas 是重型页面，独立懒加载
const CanvasPage = lazy(() => import("@/pages/Canvas"));
// Story 故事创作是独立全屏页面
const StoryPage = lazy(() => import("@/pages/Story"));
const ScriptAgentPage = lazy(() => import("@/pages/ScriptAgent"));

// 页面加载中 fallback
const PageLoader = () => (
  <div className="flex h-full items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
  </div>
);

const CanvasRouteLoader = () => (
  <CinematicProjectLoader fixed title="" subtitle="" />
);

const InternalOnlyRoute = ({ children }: { children: ReactNode }) => {
  const isInternalUser = useUserStore((state) => state.isInternalUser);
  const internalAccessLoaded = useUserStore(
    (state) => state.internalAccessLoaded,
  );
  const fetchInternalAccess = useUserStore(
    (state) => state.fetchInternalAccess,
  );
  const token = getJikeingToken();

  useEffect(() => {
    if (token && !internalAccessLoaded) {
      fetchInternalAccess();
    }
  }, [fetchInternalAccess, internalAccessLoaded, token]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (!internalAccessLoaded) {
    return <PageLoader />;
  }
  if (!isInternalUser) {
    return <Navigate to="/home" replace />;
  }

  return children;
};

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
        path: "/script-agent",
        element: <ScriptAgentPage />,
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
        path: "/video-to-script",
        element: (
          <InternalOnlyRoute>
            <VideoToScriptPage />
          </InternalOnlyRoute>
        ),
      },
      {
        path: "/short-drama-commentary",
        element: <ShortDramaCommentaryPage />,
      },
      {
        path: "/points",
        element: <PointsPage />,
      },
      {
        path: "/teams",
        element: <TeamsPage />,
      },
      {
        path: "/invitation-center",
        element: <InvitationCenterPage />,
      },
      {
        path: "/profile",
        element: <ProfilePage />,
      },
      {
        path: "/feedback",
        element: <FeedbackPage />,
      },
      {
        path: "/story",
        element: (
          <InternalOnlyRoute>
            <StoryPage />
          </InternalOnlyRoute>
        ),
      },
      {
        path: "/story/:projectId",
        element: (
          <InternalOnlyRoute>
            <StoryPage />
          </InternalOnlyRoute>
        ),
      },
      {
        path: "/story/:projectId/snippets/:snippetId",
        element: (
          <InternalOnlyRoute>
            <StoryPage />
          </InternalOnlyRoute>
        ),
      },
      {
        path: "/story/:projectId/snippets/:snippetId/agent",
        element: (
          <InternalOnlyRoute>
            <StoryPage />
          </InternalOnlyRoute>
        ),
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
