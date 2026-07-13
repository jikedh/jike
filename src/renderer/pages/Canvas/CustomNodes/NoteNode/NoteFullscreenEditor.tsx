import {
    Modal,
    ModalContent,
} from "@/components/ui/modal";
import { useCallback, useRef } from "react";
import type { NoteEditorHandle } from "./NoteEditor";
import { NoteEditor } from "./NoteEditor";
import { NoteToolbar } from "./NoteToolbar";

interface NoteFullscreenEditorProps {
    open: boolean;
    content: string;
    contentHtml?: string;
    onClose: (html: string, text: string) => void;
    onDelete: () => void;
}

export const NoteFullscreenEditor = ({
    open,
    content,
    contentHtml,
    onClose,
    onDelete,
}: NoteFullscreenEditorProps) => {
    const editorRef = useRef<NoteEditorHandle>(null);

    const editor = editorRef.current?.editor ?? null;

    const handleClose = useCallback(() => {
        const currentEditor = editorRef.current;
        onClose(
            currentEditor?.getHTML() ?? contentHtml ?? "",
            currentEditor?.getText() ?? content,
        );
    }, [content, contentHtml, onClose]);

    const handleCopy = useCallback(() => {
        if (editor) {
            const html = editor.getHTML();
            const text = editor.getText();
            navigator.clipboard.write([
                new ClipboardItem({
                    "text/plain": new Blob([text], { type: "text/plain" }),
                    "text/html": new Blob([html], { type: "text/html" }),
                }),
            ]).catch(() => {
                // Fallback: copy text only
                navigator.clipboard.writeText(text).catch(() => { });
            });
        }
    }, [editor]);

    return (
        <Modal open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
            <ModalContent className="!h-[92vh] !w-[min(960px,96vw)] !max-h-[92vh] flex flex-col !bg-[#121214]">
                {/* 工具栏 */}
                <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-2">
                    <NoteToolbar
                        editor={editor}
                        onCopy={handleCopy}
                        onDelete={onDelete}
                        onFullscreen={handleClose}
                    />
                    <button
                        type="button"
                        onClick={handleClose}
                        className="rounded-lg px-4 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white/90"
                    >
                        完成
                    </button>
                </div>

                {/* 编辑器 */}
                <div className="min-h-0 flex-1 overflow-hidden">
                    <NoteEditor
                        ref={editorRef}
                        initialHtml={contentHtml}
                        initialMarkdown={content && !contentHtml ? content : undefined}
                    />
                </div>
            </ModalContent>
        </Modal>
    );
};
