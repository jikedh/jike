import { SidebarLogoProps } from "@/types/sidebar/sidebar";
import { cn } from "@/utils/utils";

// Logo 区域组件
export const SidebarLogo = ({
  children,
  classNames,
  label,
}: SidebarLogoProps & { label?: string }) => {
  return (
    <div
      className={cn(
        "mb-10 flex flex-col items-center justify-center px-2 text-center cursor-pointer",
        classNames?.root,
      )}
    >
      {children && (
        <div className={cn("flex items-center justify-center")}>{children}</div>
      )}
      {label && (
        <span
          className="text-[14px] text-white/90 leading-tight font-normal tracking-widest mt-2"
          style={{ fontFamily: "var(--font-legendary)" }}
        >
          {label}
        </span>
      )}
    </div>
  );
};
