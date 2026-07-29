import { useCallback, useEffect, useRef } from "react";
import type { NoteEditorHandle } from "./NoteEditor";
import { NoteEditor } from "./NoteEditor";

type NoteContentProps = {
  content: string;
  contentHtml?: string;
  isEditing: boolean;
  selected: boolean;
  onStartEdit: () => void;
  onContentBlur: (html: string, text: string) => void;
  editorRef?: React.RefObject<NoteEditorHandle | null>;
  scrollbarVariant?: "agent-result";
};

export const NoteContent = ({
  content,
  contentHtml,
  isEditing,
  selected,
  onStartEdit,
  onContentBlur,
  editorRef: externalEditorRef,
  scrollbarVariant,
}: NoteContentProps) => {
  const internalEditorRef = useRef<NoteEditorHandle>(null);
  const editorRef = externalEditorRef ?? internalEditorRef;
  const editingRootRef = useRef<HTMLDivElement>(null);
  const focusTimerRef = useRef<number | null>(null);
  const clickCoordsRef = useRef<{ x: number; y: number } | null>(null);

  // 选中或编辑态下使用 React Flow 原生 nowheel 类，让滚轮事件由浏览器默认滚动接管
  const wheelClass = selected || isEditing ? "nowheel" : "";
  // 仅编辑时阻止 React Flow 拖拽，阅读态仍允许从文本区域移动节点。
  const dragClass = isEditing ? "nodrag" : "";

  const handleBlur = useCallback(
    (html: string, text: string) => {
      onContentBlur(html, text);
    },
    [onContentBlur],
  );

  const handlePreviewDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      e.stopPropagation();
      clickCoordsRef.current = { x: e.clientX, y: e.clientY };
      onStartEdit();
    },
    [onStartEdit],
  );

  // isEditing 从 false → true 后在下一帧聚焦编辑器，并将光标定位到双击位置
  useEffect(() => {
    if (isEditing) {
      if (focusTimerRef.current !== null) {
        window.clearTimeout(focusTimerRef.current);
      }
      focusTimerRef.current = window.setTimeout(() => {
        focusTimerRef.current = null;
        const coords = clickCoordsRef.current;
        clickCoordsRef.current = null;
        if (coords) {
          editorRef.current?.focusAt(coords.x, coords.y);
        } else {
          editorRef.current?.focus();
        }
      }, 0);
    }
    return () => {
      if (focusTimerRef.current !== null) {
        window.clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, [isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasContent = contentHtml || content;

  return (
    <div
      className={`noflow nopan ${dragClass} ${wheelClass} h-full w-full overflow-hidden rounded-xl relative ${isEditing ? "cursor-text" : "cursor-pointer"}`}
    >
      {/* 编辑器始终挂载，让工具栏能访问 editor 实例；非编辑态隐藏 */}
      <div
        ref={editingRootRef}
        className={`h-full w-full [&_.ProseMirror]:min-h-full [&_.ProseMirror]:bg-[#1f1f1f] [&_.ProseMirror]:rounded-xl ${isEditing ? "" : "hidden"}`}
      >
        <NoteEditor
          ref={editorRef}
          initialHtml={contentHtml}
          initialMarkdown={!contentHtml ? content : undefined}
          onBlur={handleBlur}
        />
      </div>

      {/* 阅读态 */}
      {!isEditing && (
        <div
          className={`${scrollbarVariant === "agent-result" ? "agent-result-scrollbar" : "note-scrollbar"} absolute inset-0 rounded-xl bg-[#1f1f1f] p-3 text-sm text-white/90 cursor-pointer overflow-y-auto overflow-x-hidden overscroll-contain`}
          onDoubleClick={handlePreviewDoubleClick}
        >
          {hasContent ? (
            <div
              className="prose prose-invert prose-sm max-w-none [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-white [&_h1]:mt-2 [&_h1]:mb-1 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-white [&_p]:my-1 [&_p]:leading-relaxed [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:text-white [&_strong]:font-bold [&_pre]:bg-black/30 [&_pre]:p-2 [&_pre]:rounded [&_blockquote]:border-l-2 [&_blockquote]:border-[#B43FEB] [&_blockquote]:pl-3 [&_blockquote]:text-white/70 [&_hr]:!border-white/10"
              dangerouslySetInnerHTML={{
                __html: contentHtml || escapeHtml(content),
              }}
            />
          ) : (
            <div className="opacity-70 text-white select-none">
              双击开始编辑...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}
