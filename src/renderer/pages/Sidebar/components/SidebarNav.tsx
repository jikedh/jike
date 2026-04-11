import { SidebarNavProps } from "shared/types/sidebar/sidebar";
import { cn } from "shared/utils/utils";

// 导航区域组件
export const SidebarNav = ({ children, classNames }: SidebarNavProps) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center w-full gap-4",
        classNames?.root,
      )}
    >
      {children}
    </div>
  );
};
