/**
 * 个人素材库左栏：项目范围标识 + 文件夹列表 + 底部新建文件夹
 */

import {
    IconFolder,
    IconFolderPlus,
    IconPencil,
    IconTrash,
} from "@tabler/icons-react";
import type { AssetFolder } from "shared/types/api/assets";
import { cn } from "shared/utils/utils";

export interface AssetFolderListProps {
    folders: AssetFolder[];
    loading: boolean;
    activeFolderId: string | null;
    onSelect: (folderId: string) => void;
    onCreate: () => void;
    onRename: (folder: AssetFolder) => void;
    onDelete: (folder: AssetFolder) => void;
}

export const AssetFolderList = ({
    folders,
    loading,
    activeFolderId,
    onSelect,
    onCreate,
    onRename,
    onDelete,
}: AssetFolderListProps) => {
    return (
        <div className="flex h-full w-51 shrink-0 flex-col border-r border-white/8 bg-[#111217]">
            <div className="shrink-0 border-b border-white/8 px-4 py-3">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-white/85">
                    <IconFolder size={16} stroke={1.9} />
                    个人素材库
                </div>
                <div className="mt-0.5 text-[11px] text-white/38">仅当前项目可见</div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto asset-library-scrollbar px-2 py-2">
                {loading ? (
                    <div className="px-3 py-2 text-[12px] text-white/35">加载中…</div>
                ) : folders.length === 0 ? (
                    <div className="px-3 py-2 text-[12px] text-white/35">暂无文件夹</div>
                ) : (
                    <div className="flex flex-col gap-0.5">
                        {folders.map((folder) => {
                            const active = folder.id === activeFolderId;
                            const isDefault = folder.isDefault === 1;
                            return (
                                <div
                                    key={folder.id}
                                    className={cn(
                                        "group flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                                        active
                                            ? "bg-[#B43FEB]/20 text-white"
                                            : "text-white/70 hover:bg-white/6 hover:text-white",
                                    )}
                                >
                                    <button
                                        type="button"
                                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                        onClick={() => onSelect(folder.id)}
                                    >
                                        <IconFolder size={16} stroke={1.8} className="shrink-0" />
                                        <span className="min-w-0 flex-1 truncate text-[13px]">
                                            {folder.name}
                                        </span>
                                        <span className="shrink-0 text-[11px] text-white/40">
                                            {folder.assetCount}
                                        </span>
                                    </button>
                                    {!isDefault ? (
                                        <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                                            <button
                                                type="button"
                                                aria-label="重命名"
                                                className="rounded p-1 text-white/55 hover:bg-white/12 hover:text-white"
                                                onClick={() => onRename(folder)}
                                            >
                                                <IconPencil size={13} />
                                            </button>
                                            <button
                                                type="button"
                                                aria-label="删除"
                                                className="rounded p-1 text-white/55 hover:bg-red-500/20 hover:text-red-300"
                                                onClick={() => onDelete(folder)}
                                            >
                                                <IconTrash size={13} />
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="shrink-0 border-t border-white/8 p-3">
                <button
                    type="button"
                    onClick={onCreate}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/16 py-2 text-[13px] text-white/70 transition-colors hover:border-[#B43FEB]/50 hover:bg-[#B43FEB]/10 hover:text-white"
                >
                    <IconFolderPlus size={16} stroke={1.8} />
                    新建文件夹
                </button>
            </div>
        </div>
    );
};
