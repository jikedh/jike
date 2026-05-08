import { SidebarFooterProps } from "shared/types/sidebar/sidebar";
import { cn } from "shared/utils/utils";

// 底部区域组件
export const SidebarFooter = ({ children, classNames }: SidebarFooterProps) => {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center justify-end",
        classNames?.root,
      )}
    >
      {children}
    </div>
  );
};
