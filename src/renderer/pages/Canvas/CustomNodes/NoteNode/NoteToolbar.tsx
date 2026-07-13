import {
  IconArrowsMaximize,
  IconBold,
  IconClearFormatting,
  IconCopy,
  IconH1,
  IconH2,
  IconH3,
  IconItalic,
  IconList,
  IconListNumbers,
  IconSeparatorHorizontal,
  IconTrash,
  IconTypography,
} from "@tabler/icons-react";
import type { Editor } from "@tiptap/react";
import { useCallback } from "react";

type NoteToolbarProps = {
  editor: Editor | null;
  onCopy: () => void;
  onDelete: () => void;
  onFullscreen: () => void;
};

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}

const ToolbarButton = ({ onClick, active, title, children }: ToolbarButtonProps) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    className={`rounded-md p-1 transition-colors ${active
        ? "bg-[#B43FEB]/20 text-[#B43FEB]"
        : "text-white/60 hover:bg-white/10 hover:text-white/80"
      }`}
    onClick={onClick}
  >
    {children}
  </button>
);

const ICON_SIZE = 15;

export const NoteToolbar = ({
  editor,
  onCopy,
  onDelete,
  onFullscreen,
}: NoteToolbarProps) => {
  const runCommand = useCallback(
    (command: string, attrs?: Record<string, unknown>) => {
      if (!editor) return;
      switch (command) {
        case "bold":
          editor.chain().focus().toggleBold().run();
          break;
        case "italic":
          editor.chain().focus().toggleItalic().run();
          break;
        case "heading1":
          editor.chain().focus().toggleHeading({ level: 1 }).run();
          break;
        case "heading2":
          editor.chain().focus().toggleHeading({ level: 2 }).run();
          break;
        case "heading3":
          editor.chain().focus().toggleHeading({ level: 3 }).run();
          break;
        case "paragraph":
          editor.chain().focus().setParagraph().run();
          break;
        case "bulletList":
          editor.chain().focus().toggleBulletList().run();
          break;
        case "orderedList":
          editor.chain().focus().toggleOrderedList().run();
          break;
        case "horizontalRule":
          editor.chain().focus().setHorizontalRule().run();
          break;
        case "clearFormatting":
          editor.chain().focus().clearNodes().unsetAllMarks().run();
          break;
      }
    },
    [editor],
  );

  if (!editor) return null;

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-white/[0.08] bg-[#1a1a1e]/95 px-1.5 py-1 shadow-lg backdrop-blur-sm">
      {/* 文本层级 */}
      <ToolbarButton
        onClick={() => runCommand("paragraph")}
        active={editor.isActive("paragraph")}
        title="正文"
      >
        <IconTypography size={ICON_SIZE} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => runCommand("heading1")}
        active={editor.isActive("heading", { level: 1 })}
        title="标题 1"
      >
        <IconH1 size={ICON_SIZE} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => runCommand("heading2")}
        active={editor.isActive("heading", { level: 2 })}
        title="标题 2"
      >
        <IconH2 size={ICON_SIZE} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => runCommand("heading3")}
        active={editor.isActive("heading", { level: 3 })}
        title="标题 3"
      >
        <IconH3 size={ICON_SIZE} />
      </ToolbarButton>

      <div className="mx-0.5 h-4 w-px bg-white/[0.08]" />

      {/* 内联样式 */}
      <ToolbarButton
        onClick={() => runCommand("bold")}
        active={editor.isActive("bold")}
        title="加粗"
      >
        <IconBold size={ICON_SIZE} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => runCommand("italic")}
        active={editor.isActive("italic")}
        title="斜体"
      >
        <IconItalic size={ICON_SIZE} />
      </ToolbarButton>

      <div className="mx-0.5 h-4 w-px bg-white/[0.08]" />

      {/* 列表 */}
      <ToolbarButton
        onClick={() => runCommand("bulletList")}
        active={editor.isActive("bulletList")}
        title="无序列表"
      >
        <IconList size={ICON_SIZE} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => runCommand("orderedList")}
        active={editor.isActive("orderedList")}
        title="有序列表"
      >
        <IconListNumbers size={ICON_SIZE} />
      </ToolbarButton>

      <div className="mx-0.5 h-4 w-px bg-white/[0.08]" />

      {/* 操作 */}
      <ToolbarButton onClick={() => runCommand("horizontalRule")} title="分割线">
        <IconSeparatorHorizontal size={ICON_SIZE} />
      </ToolbarButton>
      <ToolbarButton onClick={() => runCommand("clearFormatting")} title="清除格式">
        <IconClearFormatting size={ICON_SIZE} />
      </ToolbarButton>

      <div className="mx-0.5 h-4 w-px bg-white/[0.08]" />

      {/* 节点操作 */}
      <ToolbarButton onClick={onCopy} title="复制节点">
        <IconCopy size={ICON_SIZE} />
      </ToolbarButton>
      <ToolbarButton onClick={onDelete} title="删除节点">
        <IconTrash size={ICON_SIZE} />
      </ToolbarButton>
      <ToolbarButton onClick={onFullscreen} title="放大编辑">
        <IconArrowsMaximize size={ICON_SIZE} />
      </ToolbarButton>
    </div>
  );
};

