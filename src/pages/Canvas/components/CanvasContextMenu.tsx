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
            <ContextMenuContent className="w-52 bg-[#121214] border border-white/10 rounded-xl shadow-2xl overflow-hidden p-1">
                <ContextMenuLabel className="text-white/70 text-xs font-medium px-3 py-2">创建节点</ContextMenuLabel>
                <ContextMenuSeparator className="bg-white/5 h-px" />
                <ContextMenuItem
                    className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer transition-colors"
                    onSelect={() => onCreateNode('note')}
                >
                    <IconNote size={16} />
                    新建便签节点
                </ContextMenuItem>
                <ContextMenuItem
                    className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer transition-colors"
                    onSelect={() => onCreateNode('image')}
                >
                    <IconPhoto size={16} />
                    新建图片节点
                </ContextMenuItem>
                <ContextMenuItem
                    className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer transition-colors"
                    onSelect={() => onCreateNode('video')}
                >
                    <IconVideo size={16} />
                    新建视频节点
                </ContextMenuItem>
                <ContextMenuItem
                    className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer transition-colors"
                    onSelect={() => onCreateNode('panorama')}
                >
                    <IconEye size={16} />
                    新建全景图节点
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    )
}
