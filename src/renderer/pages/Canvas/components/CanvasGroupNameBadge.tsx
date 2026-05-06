import { memo, useEffect, useState } from "react";
import { NodeNameBadge } from "@/pages/Canvas/CustomNodes/shared/NodeNameBadge";

type CanvasGroupNameBadgeProps = {
  name: string;
  selected?: boolean;
  onSelect?: () => void;
  onRename?: (name: string) => void;
};

export const CanvasGroupNameBadge = memo(
  ({
    name,
    selected = false,
    onSelect,
    onRename,
  }: CanvasGroupNameBadgeProps) => {
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
      if (!selected && isEditing) {
        setIsEditing(false);
      }
    }, [isEditing, selected]);

    return (
      <NodeNameBadge
        className={
          selected
            ? "canvas-group-name-badge left-4 z-[12] max-w-[calc(100%-32px)] -translate-y-[calc(100%+5px)] gap-0 bg-[#1b101f]/90 py-1 text-[12px] leading-4 shadow-none"
            : "canvas-group-name-badge left-4 z-[12] max-w-[calc(100%-32px)] -translate-y-[calc(100%+5px)] gap-0 bg-[#101114]/88 py-1 text-[12px] leading-4 text-white/78 shadow-none"
        }
        inputClassName="bg-[#17171b] text-[12px]"
        measureClassName="text-[12px]"
        isEditing={isEditing}
        maxInputWidth={360}
        minInputWidth={88}
        selected={selected}
        onEditStart={() => setIsEditing(true)}
        onEditEnd={() => setIsEditing(false)}
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect?.();
        }}
        onRename={onRename}
      >
        {name}
      </NodeNameBadge>
    );
  },
);

CanvasGroupNameBadge.displayName = "CanvasGroupNameBadge";
