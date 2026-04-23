import {
  IconCopy,
  IconLayoutGrid,
  IconPhoto,
  IconTrash,
  IconLayout,
} from "@tabler/icons-react";
import type { PropsWithChildren } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

type NodeContextMenuProps = PropsWithChildren<{
  onDuplicate: () => void;
  onDelete: () => void;
  onSplitImage?: (gridSize: 2 | 3 | 4) => void;
  onSeparateToNodes?: () => void;
  onSetAsCover?: () => void;
  hasMultipleResults?: boolean;
  separateToNodesLabel?: string;
}>;

export const NodeContextMenu = ({
  children,
  onDuplicate,
  onDelete,
  onSplitImage,
  onSeparateToNodes,
  onSetAsCover,
  hasMultipleResults,
  separateToNodesLabel = "独立为图片",
}: NodeContextMenuProps) => {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-44 bg-[#121214] border border-white/10 rounded-xl shadow-2xl overflow-hidden p-1">
        <ContextMenuItem
          className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer transition-colors"
          onSelect={onDuplicate}
        >
          <IconCopy size={15} />
          复制节点
        </ContextMenuItem>

        {onSplitImage && (
          <ContextMenuSub>
            <ContextMenuSubTrigger className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer transition-colors">
              <IconLayoutGrid size={15} />
              拆图
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-36 bg-[#121214] border border-white/10 rounded-xl shadow-2xl overflow-hidden p-1">
              <ContextMenuItem
                className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer transition-colors"
                onSelect={() => onSplitImage(2)}
              >
                2×2（4张）
              </ContextMenuItem>
              <ContextMenuItem
                className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer transition-colors"
                onSelect={() => onSplitImage(3)}
              >
                3×3（9张）
              </ContextMenuItem>
              <ContextMenuItem
                className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer transition-colors"
                onSelect={() => onSplitImage(4)}
              >
                4×4（16张）
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

        {onSeparateToNodes && hasMultipleResults && (
          <ContextMenuItem
            className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer transition-colors"
            onSelect={onSeparateToNodes}
          >
            <IconLayout size={15} />
            {separateToNodesLabel}
          </ContextMenuItem>
        )}

        {onSetAsCover && (
          <ContextMenuItem
            className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer transition-colors"
            onSelect={onSetAsCover}
          >
            <IconPhoto size={15} />
            设置为封面图
          </ContextMenuItem>
        )}

        <ContextMenuSeparator className="bg-white/5 h-px" />
        <ContextMenuItem
          className="text-red-400 hover:bg-red-500/20 hover:text-red-300 focus:bg-red-500/20 focus:text-red-300 rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer transition-colors"
          onSelect={onDelete}
        >
          <IconTrash size={15} />
          删除节点
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
