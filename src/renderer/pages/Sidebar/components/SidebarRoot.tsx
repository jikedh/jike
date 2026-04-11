import { cn } from "shared/utils/utils";
import { SidebarProvider } from "../context/sidebarContext";
import { SidebarRootProps } from "shared/types/sidebar/sidebar";

// 根容器组件
export const SidebarRoot = ({
  children,
  defaultActiveId,
  classNames,
}: SidebarRootProps) => {
  return (
    <SidebarProvider defaultActiveId={defaultActiveId}>
      <nav
        className={cn(
          "w-24 h-screen bg-[#0a0a0a] border-r border-white/5 flex flex-col items-center py-6 shrink-0 z-50",
          classNames?.root,
        )}
      >
        {children}
      </nav>
    </SidebarProvider>
  );
};
