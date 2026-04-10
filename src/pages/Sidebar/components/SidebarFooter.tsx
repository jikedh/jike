import { SidebarFooterProps } from "@/types/sidebar/sidebar";
import { cn } from "@/utils/utils";

// 底部区域组件
export const SidebarFooter = ({ children, classNames }: SidebarFooterProps) => {
  return (
    <div
      className={cn(
        "flex-1 flex flex-col justify-end items-center mt-auto",
        classNames?.root,
      )}
    >
      {children}
    </div>
  );
};
