import { cn } from "shared/utils/utils";
import { useSidebar } from "../context/sidebarContext";
import { SidebarNavItemProps } from "shared/types/sidebar/sidebar";

// 导航项组件
export const SidebarNavItem = ({
  id,
  icon,
  label,
  onClick,
  classNames,
}: SidebarNavItemProps) => {
  const { activeId, setActiveId } = useSidebar();
  const isActive = activeId === id;

  const handleClick = () => {
    setActiveId(id);
    onClick?.();
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex w-16 shrink-0 flex-col items-center justify-center rounded-xl px-2 py-3 transition-all duration-200 group",
        isActive
          ? "bg-[#B43FEB]/10 text-[#B43FEB]"
          : "text-white/50 hover:bg-white/5 hover:text-white/90",
        classNames?.root,
      )}
      title={label}
      data-active={isActive}
    >
      {icon && <span className={cn("mb-1.5", classNames?.icon)}>{icon}</span>}
      {label && (
        <span className="text-[11px] font-medium leading-tight">{label}</span>
      )}
    </button>
  );
};
