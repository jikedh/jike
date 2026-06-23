import { SidebarContextValue } from "shared/types/sidebar/sidebar";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { useLocation } from "react-router-dom";

// 创建上下文
const SidebarContext = createContext<SidebarContextValue | null>(null);

const ROUTE_ACTIVE_ID_MAP: Record<string, string> = {
  settings: "model-settings",
};

// Provider 属性类型
type SidebarProviderProps = {
  children: React.ReactNode;
  defaultActiveId?: string;
};

// Sidebar Provider 组件
export const SidebarProvider = ({
  children,
  defaultActiveId,
}: SidebarProviderProps) => {
  const location = useLocation();
  const [activeId, setActiveId] = useState<string | null>(
    defaultActiveId || null,
  );
  const [collapsed, setCollapsed] = useState(false);

  // 监听路由变化，自动更新活跃导航项
  useEffect(() => {
    const pathname = location.pathname;
    // 从路径中提取路由名称（例如 /canvas -> canvas）
    const routeName = pathname.split("/").filter(Boolean)[0];
    if (routeName) {
      setActiveId(ROUTE_ACTIVE_ID_MAP[routeName] ?? routeName);
    } else {
      setActiveId(null);
    }
  }, [location.pathname]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const value = useMemo<SidebarContextValue>(
    () => ({
      activeId,
      setActiveId,
      collapsed,
      toggleCollapsed,
    }),
    [activeId, collapsed, toggleCollapsed],
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
};

// 自定义 hook 获取上下文值
export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export { SidebarContext };
