/**
 * 素材区工具栏：搜索 + 分页 + 上传 + 刷新
 */

import {
    IconChevronLeft,
    IconChevronRight,
    IconRefresh,
    IconSearch,
    IconUpload,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

export interface AssetToolbarProps {
    keyword: string;
    onKeywordChange: (value: string) => void;
    page: number;
    totalPages: number;
    total: number;
    refreshing: boolean;
    uploading: boolean;
    onPrevPage: () => void;
    onNextPage: () => void;
    onRefresh: () => void;
    onUploadClick: () => void;
}

export const AssetToolbar = ({
    keyword,
    onKeywordChange,
    page,
    totalPages,
    total,
    refreshing,
    uploading,
    onPrevPage,
    onNextPage,
    onRefresh,
    onUploadClick,
}: AssetToolbarProps) => {
    return (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/8 px-5 py-3">
            <div className="flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-black/24 px-2.5 text-white/70">
                <IconSearch size={15} stroke={1.8} />
                <input
                    value={keyword}
                    onChange={(event) => onKeywordChange(event.target.value)}
                    placeholder="搜索素材"
                    className="h-6 w-44 bg-transparent text-[12px] text-white outline-none placeholder:text-white/34"
                />
            </div>

            <div className="ml-auto flex items-center gap-1.5 text-[12px] text-white/50">
                <span>
                    {total > 0 ? `${total} 个素材` : "暂无素材"}
                </span>
                <button
                    type="button"
                    aria-label="上一页"
                    disabled={page <= 1}
                    onClick={onPrevPage}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-white/65 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                >
                    <IconChevronLeft size={15} />
                </button>
                <span className="tabular-nums">
                    {page} / {totalPages}
                </span>
                <button
                    type="button"
                    aria-label="下一页"
                    disabled={page >= totalPages}
                    onClick={onNextPage}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-white/65 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                >
                    <IconChevronRight size={15} />
                </button>
            </div>

            <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onRefresh}
                disabled={refreshing}
                className="text-white/65 hover:text-white"
            >
                <IconRefresh size={15} className={refreshing ? "animate-spin" : ""} />
                刷新
            </Button>

            <Button
                type="button"
                size="sm"
                variant="blue"
                onClick={onUploadClick}
                disabled={uploading}
            >
                <IconUpload size={14} />
                {uploading ? "上传中…" : "上传素材"}
            </Button>
        </div>
    );
};
