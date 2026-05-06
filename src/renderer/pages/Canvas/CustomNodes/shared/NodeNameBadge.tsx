import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "shared/utils/utils";

type NodeNameBadgeProps = {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  iconClassName?: string;
  inputClassName?: string;
  measureClassName?: string;
  minInputWidth?: number;
  maxInputWidth?: number;
  isEditing?: boolean;
  selected?: boolean;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onRename?: (name: string) => void;
};

export const NodeNameBadge = ({
  children,
  className,
  icon,
  iconClassName,
  inputClassName,
  measureClassName,
  minInputWidth = 64,
  maxInputWidth = 320,
  isEditing = false,
  selected = false,
  onEditStart,
  onEditEnd,
  onPointerDown,
  onRename,
}: NodeNameBadgeProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [draftName, setDraftName] = useState(String(children ?? ""));
  const [inputWidth, setInputWidth] = useState(64);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    const measuredWidth = measureRef.current?.offsetWidth ?? 0;
    setInputWidth(
      Math.min(maxInputWidth, Math.max(minInputWidth, measuredWidth + 22)),
    );
  }, [draftName, isEditing, maxInputWidth, minInputWidth]);

  useEffect(() => {
    if (!isEditing) {
      setDraftName(String(children ?? ""));
      return;
    }

    setDraftName(String(children ?? ""));
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [children, isEditing]);

  const commitRename = () => {
    const nextName = draftName.trim();
    if (nextName && nextName !== String(children ?? "")) {
      onRename?.(nextName);
    }
    onEditEnd?.();
  };

  const cancelRename = () => {
    setDraftName(String(children ?? ""));
    onEditEnd?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitRename();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelRename();
    }
  };

  return (
    <div
      className={cn(
        "absolute left-2 top-0 z-30 flex max-w-[calc(100%-16px)] -translate-y-[calc(100%+6px)] items-center gap-1 rounded-md bg-transparent px-2 py-0.5 text-[13px] font-medium leading-4 text-white shadow-[0_4px_14px_rgba(0,0,0,0.24)] backdrop-blur-sm",
        selected ? "pointer-events-auto" : "pointer-events-none",
        className,
      )}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (selected) {
          onEditStart?.();
        }
      }}
      onPointerDown={onPointerDown}
    >
      {icon ? (
        <span className={cn("shrink-0 text-white/55", iconClassName)}>
          {icon}
        </span>
      ) : null}
      {isEditing ? (
        <span className="relative inline-flex min-w-0">
          <span
            ref={measureRef}
            className={cn(
              "pointer-events-none invisible absolute left-0 top-0 whitespace-pre px-1.5 text-[13px] font-medium leading-5",
              measureClassName,
            )}
          >
            {draftName || " "}
          </span>
          <input
            ref={inputRef}
            className={cn(
              "nodrag nopan nowheel h-5 min-w-0 rounded border border-white/35 bg-[#1f1f23] px-1.5 text-[13px] font-medium leading-5 text-white outline-none ring-1 ring-[#B43FEB]/60",
              inputClassName,
            )}
            style={{ width: `${inputWidth}px` }}
            value={draftName}
            onBlur={commitRename}
            onChange={(event) => setDraftName(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onKeyDown={handleKeyDown}
          />
        </span>
      ) : (
        <span className="min-w-0 truncate">{children}</span>
      )}
    </div>
  );
};
