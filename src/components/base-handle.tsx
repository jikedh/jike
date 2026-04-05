import type { ComponentProps } from "react";
import { Background, Handle, type HandleProps } from "@xyflow/react";

import { cn } from "@/lib/utils";

export type BaseHandleProps = HandleProps;

export function BaseHandle({
  className,
  children,
  ...props
}: ComponentProps<typeof Handle>) {
  return (
    <Handle
      {...props}
      className={cn(
        "h-2.75 w-2.75 rounded-full border-0 bg-transparent shadow-none transition",
        className,
      )}
      style={{
        background: 'none',
        border: 'none',
      }
      }
    >
      {/* 扩大连接范围的不可见区域 */}
      <div 
        className="absolute -inset-6 rounded-full"
        style={{
          background: 'transparent',
        }}
      />
      {children}
    </Handle>
  );
}
