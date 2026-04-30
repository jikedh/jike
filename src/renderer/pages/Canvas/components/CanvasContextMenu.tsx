import {
  IconBrain,
  IconEye,
  IconMusic,
  IconNote,
  IconPhoto,
  IconSparkles,
  IconVideo,
} from "@tabler/icons-react";
import type { PropsWithChildren } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export type CanvasNodeType =
  | "note"
  | "image"
  | "video"
  | "newVideo"
  | "panorama"
  | "audio"
  | "textAgent"
  | "imageAgent"
  | "videoAgent";

type CanvasContextMenuProps = PropsWithChildren<{
  onCreateNode: (nodeType: CanvasNodeType) => void;
  onOpenChange?: (open: boolean) => void;
}>;

export const CanvasContextMenu = ({
  children,
  onCreateNode,
  onOpenChange,
}: CanvasContextMenuProps) => {
  return (
    <ContextMenu onOpenChange={onOpenChange}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-54 bg-[#121214] border border-white/10 rounded-xl shadow-2xl overflow-hidden p-1">
        <ContextMenuLabel className="text-white/70 text-xs font-medium px-3 py-2">
          创建节点
        </ContextMenuLabel>
        <ContextMenuSeparator className="bg-white/5 h-px" />
        <ContextMenuItem
          className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer transition-colors"
          onSelect={() => onCreateNode("note")}
        >
          <IconNote size={16} />
          新建便签节点
        </ContextMenuItem>
        <ContextMenuItem
          className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer transition-colors"
          onSelect={() => onCreateNode("image")}
        >
          <IconPhoto size={16} />
          新建生成图片节点
        </ContextMenuItem>
        <ContextMenuItem
          className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer transition-colors"
          onSelect={() => onCreateNode("video")}
        >
          <IconVideo size={16} />
          新建生成视频节点
        </ContextMenuItem>

        <ContextMenuItem
          className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer transition-colors"
          onSelect={() => onCreateNode("newVideo")}
        >
          <IconVideo size={16} />
          新建生成视频节点(新版)
        </ContextMenuItem>
        <ContextMenuItem
          className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer transition-colors"
          onSelect={() => onCreateNode("audio")}
        >
          <IconMusic size={16} />
          新建生成音频节点
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer transition-colors">
            <IconSparkles size={16} />
            智能体
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-44 bg-[#121214] border border-white/10 rounded-xl shadow-2xl overflow-hidden p-1">
            <ContextMenuItem
              className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer transition-colors"
              onSelect={() => onCreateNode("textAgent")}
            >
              <IconBrain size={15} />
              文本智能体
            </ContextMenuItem>
            <ContextMenuItem
              className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer transition-colors"
              onSelect={() => onCreateNode("imageAgent")}
            >
              <IconPhoto size={15} />
              图片智能体
            </ContextMenuItem>
            <ContextMenuItem
              className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer transition-colors"
              onSelect={() => onCreateNode("videoAgent")}
            >
              <IconVideo size={15} />
              视频智能体
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem
          className="text-white/80 hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB] rounded-lg px-3 py-2.5 text-sm flex items-center gap-3 cursor-pointer transition-colors"
          onSelect={() => onCreateNode("panorama")}
        >
          <IconEye size={16} />
          新建全景图节点
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
