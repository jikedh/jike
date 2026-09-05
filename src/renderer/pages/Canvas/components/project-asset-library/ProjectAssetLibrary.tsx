/**
 * 个人素材库（全屏页）
 *
 * 入口：画布悬浮侧边栏「个人素材库」按钮。
 * 数据范围：当前项目 scope=project 的资产 + 项目一级文件夹。
 */

import { useCallback, useRef, useState } from "react";
import { IconX } from "@tabler/icons-react";
import { toast } from "sonner";
import type { AssetFolder } from "shared/types/api/assets";
import { Modal, ModalContent, ModalTitle } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useProjectAssetLibrary } from "./useProjectAssetLibrary";
import { AssetFolderList } from "./AssetFolderList";
import { AssetToolbar } from "./AssetToolbar";
import { AssetGrid } from "./AssetGrid";
import { FolderDialog } from "./FolderDialog";

export interface ProjectAssetLibraryProps {
    open: boolean;
    projectId: string | null;
    onClose: () => void;
}

type FolderDialogState =
    | { mode: "create" }
    | { mode: "rename"; folder: AssetFolder }
    | null;

export const ProjectAssetLibrary = ({
    open,
    projectId,
    onClose,
}: ProjectAssetLibraryProps) => {
    const {
        folders,
        foldersLoading,
        activeFolderId,
        setActiveFolderId,
        assets,
        assetsLoading,
        keyword,
        setKeyword,
        page,
        setPage,
        totalPages,
        total,
        refreshFolders,
        refreshAssets,
        createFolder,
        renameFolder,
        removeFolder,
        uploadFiles,
    } = useProjectAssetLibrary(projectId);

    const [folderDialog, setFolderDialog] = useState<FolderDialogState>(null);
    const [deleteTarget, setDeleteTarget] = useState<AssetFolder | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleUploadClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFilesSelected = useCallback(
        async (files: File[]) => {
            if (files.length === 0) return;
            setUploading(true);
            try {
                await uploadFiles(files);
                toast.success("素材上传完成");
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "上传失败");
            } finally {
                setUploading(false);
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            }
        },
        [uploadFiles],
    );

    const handleDeleteConfirm = useCallback(async () => {
        if (!deleteTarget) return;
        try {
            await removeFolder(deleteTarget.id);
            toast.success("文件夹已删除");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "删除失败");
        } finally {
            setDeleteTarget(null);
        }
    }, [deleteTarget, removeFolder]);

    const requestDelete = useCallback((folder: AssetFolder) => {
        if (folder.assetCount > 0) {
            toast.warning("文件夹内仍有素材，无法删除");
            return;
        }
        setDeleteTarget(folder);
    }, []);

    if (!open) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="个人素材库"
            className="fixed inset-0 z-70 flex bg-[#15151a]"
        >
            <div className="noflow nodrag nopan nowheel flex size-full flex-col overflow-hidden bg-[#15151a] text-white">
                {/* Header */}
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/8 px-6">
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-[15px] font-semibold text-white/90">
                            个人素材库
                        </h1>
                        {projectId ? (
                            <span className="text-[11px] text-white/38">
                                项目 {projectId} 专属素材
                            </span>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white"
                        aria-label="关闭"
                    >
                        <IconX size={18} />
                    </button>
                </div>

                {/* Body: 左侧分类栏 + 右侧素材内容区 */}
                <div className="flex min-h-0 flex-1">
                    <AssetFolderList
                        folders={folders}
                        loading={foldersLoading}
                        activeFolderId={activeFolderId}
                        onSelect={setActiveFolderId}
                        onCreate={() => setFolderDialog({ mode: "create" })}
                        onRename={(folder) => setFolderDialog({ mode: "rename", folder })}
                        onDelete={requestDelete}
                    />

                    <div className="flex min-w-0 flex-1 flex-col">
                        <AssetToolbar
                            keyword={keyword}
                            onKeywordChange={setKeyword}
                            page={page}
                            totalPages={totalPages}
                            total={total}
                            refreshing={assetsLoading}
                            uploading={uploading}
                            onPrevPage={() => setPage((current) => Math.max(1, current - 1))}
                            onNextPage={() =>
                                setPage((current) => Math.min(totalPages, current + 1))
                            }
                            onRefresh={() => {
                                void refreshAssets();
                            }}
                            onUploadClick={handleUploadClick}
                        />

                        <div className="min-h-0 flex-1 overflow-y-auto asset-library-scrollbar">
                            <AssetGrid
                                assets={assets}
                                loading={assetsLoading}
                                activeFolderId={activeFolderId}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,audio/*"
                className="hidden"
                onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    void handleFilesSelected(files);
                }}
            />

            <FolderDialog
                open={folderDialog !== null}
                mode={folderDialog?.mode ?? "create"}
                initialName={folderDialog?.mode === "rename" ? folderDialog.folder.name : ""}
                onClose={() => setFolderDialog(null)}
                onSubmit={async (name) => {
                    if (folderDialog?.mode === "rename") {
                        await renameFolder(folderDialog.folder.id, name);
                        toast.success("文件夹已重命名");
                    } else {
                        await createFolder(name);
                        toast.success("文件夹已创建");
                    }
                }}
            />

            <Modal
                open={deleteTarget !== null}
                onOpenChange={(next) => !next && setDeleteTarget(null)}
            >
                <ModalContent className="w-[min(420px,92vw)]">
                    <div className="p-6">
                        <ModalTitle className="mb-3">删除文件夹</ModalTitle>
                        <p className="text-sm text-white/60">
                            确定删除文件夹「{deleteTarget?.name}」吗？此操作不可撤销。
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                            <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)}>
                                取消
                            </Button>
                            <Button
                                type="button"
                                onClick={() => void handleDeleteConfirm()}
                                className="bg-red-500/90 text-white hover:bg-red-500"
                            >
                                删除
                            </Button>
                        </div>
                    </div>
                </ModalContent>
            </Modal>
        </div>
    );
};
