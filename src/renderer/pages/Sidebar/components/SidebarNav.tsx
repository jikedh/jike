import { SidebarNavProps } from "shared/types/sidebar/sidebar";
import { cn } from "shared/utils/utils";

// 导航区域组件
export const SidebarNav = ({ children, classNames }: SidebarNavProps) => {
  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-1 flex-col items-center gap-4 overflow-y-auto overscroll-contain no-scrollbar",
        classNames?.root,
      )}
    >
      {children}
    </div>
  );
};
