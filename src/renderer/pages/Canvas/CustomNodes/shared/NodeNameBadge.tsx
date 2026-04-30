import type { ReactNode } from "react";
import { cn } from "shared/utils/utils";

type NodeNameBadgeProps = {
  children: ReactNode;
  className?: string;
};

export const NodeNameBadge = ({ children, className }: NodeNameBadgeProps) => {
  return (
    <div
      className={cn(
        "pointer-events-none absolute left-2 top-0 z-30 -translate-y-[calc(100%+6px)] rounded-md bg-transparent px-2 py-0.5 text-[11px] font-medium leading-4 text-white shadow-[0_4px_14px_rgba(0,0,0,0.24)] backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </div>
  );
};
