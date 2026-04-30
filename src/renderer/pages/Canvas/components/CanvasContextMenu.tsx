import {
  IconBrain,
  IconEye,
  IconMusic,
  IconNote,
  IconPhoto,
  IconSparkles,
  IconUpload,
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
  onUploadMedia: () => void;
  onOpenChange?: (open: boolean) => void;
  mode: "create" | "upload";
}>;

export const CanvasContextMenu = ({
  children,
  onCreateNode,
  onUploadMedia,
  onOpenChange,
  mode,
}: CanvasContextMenuProps) => {
  return (
    <ContextMenu onOpenChange={onOpenChange}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-54 overflow-hidden rounded-xl border border-white/10 bg-[#121214] p-1 shadow-2xl">
        {mode === "upload" ? (
          <>
            <ContextMenuLabel className="px-3 py-2 text-xs font-medium text-white/70">
              媒体
            </ContextMenuLabel>
            <ContextMenuSeparator className="h-px bg-white/5" />
            <ContextMenuItem
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 transition-colors hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB]"
              onSelect={onUploadMedia}
            >
              <IconUpload size={16} />
              媒体上传
            </ContextMenuItem>
          </>
        ) : (
          <>
            <ContextMenuLabel className="px-3 py-2 text-xs font-medium text-white/70">
              创建节点
            </ContextMenuLabel>
            <ContextMenuSeparator className="h-px bg-white/5" />
            <ContextMenuItem
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 transition-colors hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB]"
              onSelect={() => onCreateNode("note")}
            >
              <IconNote size={16} />
              新建便签节点
            </ContextMenuItem>
            <ContextMenuItem
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 transition-colors hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB]"
              onSelect={() => onCreateNode("image")}
            >
              <IconPhoto size={16} />
              新建生成图片节点
            </ContextMenuItem>
            <ContextMenuItem
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 transition-colors hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB]"
              onSelect={() => onCreateNode("video")}
            >
              <IconVideo size={16} />
              新建生成视频节点
            </ContextMenuItem>
            <ContextMenuItem
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 transition-colors hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB]"
              onSelect={() => onCreateNode("newVideo")}
            >
              <IconVideo size={16} />
              新建生成视频节点(新版)
            </ContextMenuItem>
            <ContextMenuItem
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 transition-colors hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB]"
              onSelect={() => onCreateNode("audio")}
            >
              <IconMusic size={16} />
              新建生成音频节点
            </ContextMenuItem>
            <ContextMenuItem
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 transition-colors hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB]"
              onSelect={onUploadMedia}
            >
              <IconUpload size={16} />
              新建上传媒体节点
            </ContextMenuItem>
            <ContextMenuSub>
              <ContextMenuSubTrigger className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 transition-colors hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB]">
                <IconSparkles size={16} />
                智能体
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-44 overflow-hidden rounded-xl border border-white/10 bg-[#121214] p-1 shadow-2xl">
                <ContextMenuItem
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 transition-colors hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB]"
                  onSelect={() => onCreateNode("textAgent")}
                >
                  <IconBrain size={15} />
                  文本智能体
                </ContextMenuItem>
                <ContextMenuItem
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 transition-colors hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB]"
                  onSelect={() => onCreateNode("imageAgent")}
                >
                  <IconPhoto size={15} />
                  图片智能体
                </ContextMenuItem>
                <ContextMenuItem
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 transition-colors hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB]"
                  onSelect={() => onCreateNode("videoAgent")}
                >
                  <IconVideo size={15} />
                  视频智能体
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuItem
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 transition-colors hover:bg-[#B43FEB]/10 hover:text-[#B43FEB] focus:bg-[#B43FEB]/10 focus:text-[#B43FEB]"
              onSelect={() => onCreateNode("panorama")}
            >
              <IconEye size={16} />
              新建全景图节点
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};
