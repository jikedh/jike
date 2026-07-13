import { EditorContent, type Editor, useEditor } from "@tiptap/react";
import { TableKit } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";
import { forwardRef, useImperativeHandle, useEffect } from "react";
import { looksLikeMarkdown, markdownToSafeHtml } from "./markdownPaste";

export interface NoteEditorHandle {
    getHTML: () => string;
    getText: () => string;
    setContent: (html: string) => void;
    focus: () => void;
    /** 聚焦并将光标定位到指定视口坐标对应的文档位置 */
    focusAt: (clientX: number, clientY: number) => void;
    editor: Editor | null;
}

interface NoteEditorProps {
    initialHtml?: string;
    initialMarkdown?: string;
    onFocus?: () => void;
    onBlur?: (html: string, text: string) => void;
    className?: string;
}

export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(
    ({ initialHtml, initialMarkdown, onFocus, onBlur, className }, ref) => {
        const editor = useEditor({
            extensions: [
                StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
                TableKit.configure({ table: { resizable: false } }),
            ],
            content: initialHtml || "",
            editorProps: {
                attributes: {
                    class:
                        "note-scrollbar prose prose-invert prose-sm max-w-none h-full outline-none px-3 py-2 text-sm text-white/90 [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-white [&_h1]:mt-2 [&_h1]:mb-1 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-white [&_p]:my-1 [&_p]:leading-relaxed [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:text-white [&_strong]:font-bold [&_pre]:bg-black/30 [&_pre]:p-2 [&_pre]:rounded [&_blockquote]:border-l-2 [&_blockquote]:border-[#B43FEB] [&_blockquote]:pl-3 [&_blockquote]:text-white/70 [&_hr]:!border-white/10 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-white/15 [&_th]:bg-white/5 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-white/10 [&_td]:px-2 [&_td]:py-1",
                },
                handleDOMEvents: {
                    focus: () => {
                        onFocus?.();
                        return false;
                    },
                    blur: () => {
                        onBlur?.(editor?.getHTML() ?? "", editor?.getText() ?? "");
                        return false;
                    },
                },
                handlePaste: (_view, event) => {
                    const text = event.clipboardData?.getData("text/plain") ?? "";
                    if (!looksLikeMarkdown(text)) return false;

                    event.preventDefault();
                    const html = markdownToSafeHtml(text);
                    editor?.chain().focus().insertContent(html).run();
                    return true;
                },
            },
            immediatelyRender: false,
        });

        // 兼容旧 Markdown 数据：首次挂载时迁移为 Tiptap 可编辑结构。
        useEffect(() => {
            if (!editor) return;
            if (initialMarkdown && !initialHtml) {
                const content = editor.getHTML();
                if (!content || content === "<p></p>") {
                    editor.commands.setContent(markdownToSafeHtml(initialMarkdown));
                }
            }
        }, [editor, initialMarkdown, initialHtml]);

        // 普通节点编辑器保持挂载；沉浸编辑器保存后需同步最新 HTML。
        useEffect(() => {
            if (!editor || editor.isFocused || initialHtml === undefined) return;
            if (editor.getHTML() !== initialHtml) {
                editor.commands.setContent(initialHtml, { emitUpdate: false });
            }
        }, [editor, initialHtml]);

        useImperativeHandle(ref, () => ({
            getHTML: () => editor?.getHTML() ?? "",
            getText: () => editor?.getText() ?? "",
            setContent: (html: string) => {
                editor?.commands.setContent(html);
            },
            focus: () => {
                editor?.commands.focus();
            },
            focusAt: (clientX: number, clientY: number) => {
                if (!editor) return;
                editor.commands.focus();
                // ProseMirror 需要用 pageX/Y，而 clientX/Y 在无滚动时与其一致
                const pos = editor.view.posAtCoords({
                    left: clientX,
                    top: clientY,
                });
                if (pos) {
                    editor.commands.setTextSelection(pos.pos);
                }
            },
            editor,
        }));

        return (
            <div className="note-scrollbar h-full overflow-y-auto overscroll-contain">
                <EditorContent
                    editor={editor}
                    className={className}
                />
            </div>
        );
    },
);

NoteEditor.displayName = "NoteEditor";
