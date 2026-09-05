/**
 * 新建 / 重命名项目素材文件夹弹窗
 */

import { useEffect, useState } from "react";
import { Modal, ModalContent, ModalTitle } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface FolderDialogProps {
    open: boolean;
    mode: "create" | "rename";
    initialName?: string;
    onClose: () => void;
    onSubmit: (name: string) => Promise<void>;
}

export const FolderDialog = ({
    open,
    mode,
    initialName = "",
    onClose,
    onSubmit,
}: FolderDialogProps) => {
    const [name, setName] = useState(initialName);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setName(initialName);
            setSubmitting(false);
        }
    }, [open, initialName]);

    const handleSubmit = async () => {
        const trimmed = name.trim();
        if (!trimmed) return;
        setSubmitting(true);
        try {
            await onSubmit(trimmed);
            onClose();
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal open={open} onOpenChange={(next) => !next && onClose()}>
            <ModalContent className="w-[min(420px,92vw)]">
                <div className="p-6">
                    <ModalTitle className="mb-4">
                        {mode === "create" ? "新建文件夹" : "重命名文件夹"}
                    </ModalTitle>
                    <Input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && !submitting) {
                                void handleSubmit();
                            }
                        }}
                        placeholder="文件夹名称"
                        maxLength={32}
                        autoFocus
                        className="border-white/10 bg-white/4 text-white"
                    />
                    <div className="mt-5 flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            disabled={submitting}
                        >
                            取消
                        </Button>
                        <Button
                            type="button"
                            variant="blue"
                            onClick={() => void handleSubmit()}
                            disabled={submitting || !name.trim()}
                        >
                            {submitting ? "保存中…" : "保存"}
                        </Button>
                    </div>
                </div>
            </ModalContent>
        </Modal>
    );
};
