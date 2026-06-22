import { Handle, type HandleProps } from "@xyflow/react";
import { memo, type ComponentProps } from "react";

import { cn } from "shared/utils/utils";

export type BaseHandleProps = HandleProps;

const HANDLE_BASE_STYLE = {
  background: "none",
  border: "none",
} as const;

const HIT_AREA_STYLE = {
  background: "transparent",
} as const;

const BaseHandleInner = ({
  className,
  children,
  ...props
}: ComponentProps<typeof Handle>) => {
  return (
    <Handle
      {...props}
      className={cn(
        "h-2.75 w-2.75 rounded-full border-0 bg-transparent shadow-none",
        className,
      )}
      style={HANDLE_BASE_STYLE}
    >
      {/* 扩大连接范围的不可见区域 */}
      <div
        className="absolute -inset-6 rounded-full"
        style={HIT_AREA_STYLE}
      />
      {children}
    </Handle>
  );
};

export const BaseHandle = memo(BaseHandleInner);

