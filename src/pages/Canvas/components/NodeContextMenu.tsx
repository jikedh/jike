import { IconCopy, IconLayoutGrid, IconTrash } from '@tabler/icons-react'
import type { PropsWithChildren } from 'react'

import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
    ContextMenuTrigger,
} from '@/components/ui/context-menu'

type NodeContextMenuProps = PropsWithChildren<{
    onDuplicate: () => void
    onDelete: () => void
  /** 拆图回调，传入网格大小 (2=2x2, 3=3x3, 4=4x4) */
  onSplitImage?: (gridSize: 2 | 3 | 4) => void
}>

/**
 * 节点右键菜单组件
 * 提供复制、删除和拆图功能
 */
export const NodeContextMenu = ({ children, onDuplicate, onDelete, onSplitImage }: NodeContextMenuProps) => {
    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
            <ContextMenuContent className="w-44 bg-neutral-800/95 border-neutral-600">
                <ContextMenuItem
                    className="text-neutral-200 focus:bg-neutral-700 focus:text-neutral-100 cursor-pointer"
                    onSelect={onDuplicate}
                >
                    <IconCopy size={15} />
                    复制节点
                </ContextMenuItem>

          {/* 拆图子菜单 - 仅当 onSplitImage 存在时显示 */}
          {onSplitImage && (
            <ContextMenuSub>
              <ContextMenuSubTrigger className="text-neutral-200 focus:bg-neutral-700 focus:text-neutral-100 cursor-pointer">
                <IconLayoutGrid size={15} />
                拆图
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-36 bg-neutral-800/95 border-neutral-600">
                <ContextMenuItem
                  className="text-neutral-200 focus:bg-neutral-700 focus:text-neutral-100 cursor-pointer"
                  onSelect={() => onSplitImage(2)}
                >
                  2×2（4张）
                </ContextMenuItem>
                <ContextMenuItem
                  className="text-neutral-200 focus:bg-neutral-700 focus:text-neutral-100 cursor-pointer"
                  onSelect={() => onSplitImage(3)}
                >
                  3×3（9张）
                </ContextMenuItem>
                <ContextMenuItem
                  className="text-neutral-200 focus:bg-neutral-700 focus:text-neutral-100 cursor-pointer"
                  onSelect={() => onSplitImage(4)}
                >
                  4×4（16张）
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}

                <ContextMenuSeparator className="bg-neutral-600" />
                <ContextMenuItem
                    className="text-red-400 focus:bg-red-500/20 focus:text-red-300 cursor-pointer"
                    onSelect={onDelete}
                >
                    <IconTrash size={15} />
                    删除节点
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    )
}
