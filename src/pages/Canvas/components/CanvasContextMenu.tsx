import { IconEye, IconNote, IconPhoto, IconVideo } from '@tabler/icons-react'
import type { PropsWithChildren } from 'react'

import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu'

export type CanvasNodeType = 'note' | 'image' | 'video' | 'panorama'

type CanvasContextMenuProps = PropsWithChildren<{
    onCreateNode: (nodeType: CanvasNodeType) => void
    onOpenChange?: (open: boolean) => void
}>

export const CanvasContextMenu = ({ children, onCreateNode, onOpenChange }: CanvasContextMenuProps) => {
    return (
        <ContextMenu onOpenChange={onOpenChange}>
            <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
            <ContextMenuContent className="w-52 bg-neutral-800/95 border-neutral-600">
                <ContextMenuLabel className="text-neutral-300">创建节点</ContextMenuLabel>
                <ContextMenuSeparator className="bg-neutral-600" />
                <ContextMenuItem
                    className="text-neutral-200 focus:bg-neutral-700 focus:text-neutral-100"
                    onSelect={() => onCreateNode('note')}
                >
                    <IconNote size={16} />
                    新建便签节点
                </ContextMenuItem>
                <ContextMenuItem
                    className="text-neutral-200 focus:bg-neutral-700 focus:text-neutral-100"
                    onSelect={() => onCreateNode('image')}
                >
                    <IconPhoto size={16} />
                    新建图片节点
                </ContextMenuItem>
                <ContextMenuItem
                    className="text-neutral-200 focus:bg-neutral-700 focus:text-neutral-100"
                    onSelect={() => onCreateNode('video')}
                >
                    <IconVideo size={16} />
                    新建视频节点
                </ContextMenuItem>
                <ContextMenuItem
                    className="text-white/80 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white rounded-md px-3 py-2 text-sm flex items-center gap-2 cursor-pointer"
                    onSelect={() => onCreateNode('panorama')}
                >
                    <IconEye size={16} />
                    新建全景图节点
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    )
}
