/**
 * 素材网格：固定宽度卡片，文字叠加在渐变底部
 */

import { useState } from "react";
import { IconMusic, IconVideo } from "@tabler/icons-react";
import type { AssetListItem, MediaType } from "shared/types/api/assets";
import { cn } from "shared/utils/utils";

export interface AssetGridProps {
    assets: AssetListItem[];
    loading: boolean;
    activeFolderId: string | null;
    onSelect?: (asset: AssetListItem) => void;
}

const getMediaIcon = (mediaType: MediaType) => {
    if (mediaType === "video") return <IconVideo size={18} stroke={1.8} />;
    if (mediaType === "audio") return <IconMusic size={18} stroke={1.8} />;
    return null;
};

const getThumb = (asset: AssetListItem): string => {
    if (asset.thumbnailUrl) return asset.thumbnailUrl;
    if (asset.mediaType === "image") return asset.fileUrl;
    return "";
};

export const AssetGrid = ({
    assets,
    loading,
    activeFolderId,
    onSelect,
}: AssetGridProps) => {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    if (!activeFolderId) {
        return (
            <div className="flex flex-1 items-center justify-center text-[13px] text-white/40">
                请选择左侧文件夹
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center text-[13px] text-white/40">
                加载中…
            </div>
        );
    }

    if (assets.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[13px] text-white/40">
                该文件夹暂无素材
            </div>
        );
    }

    return (
        <div className="grid grid-cols-[repeat(auto-fill,145px)] justify-start gap-3 p-5">
            {assets.map((asset) => {
                const thumb = getThumb(asset);
                const mediaIcon = getMediaIcon(asset.mediaType);
                return (
                    <button
                        key={asset.id}
                        type="button"
                        onClick={() => {
                            setSelectedId(asset.id);
                            onSelect?.(asset);
                        }}
                        className={cn(
                            "group relative h-[145px] w-[145px] overflow-hidden rounded-xl border bg-[#1a1a20] transition-colors",
                            selectedId === asset.id
                                ? "border-[#B43FEB] ring-1 ring-[#B43FEB]/50"
                                : "border-white/10 hover:border-[#B43FEB]/60",
                        )}
                    >
                        {thumb ? (
                            <img
                                src={thumb}
                                alt={asset.name}
                                className="size-full object-cover"
                                draggable={false}
                            />
                        ) : (
                            <div className="flex size-full items-center justify-center text-white/35">
                                {mediaIcon ?? (
                                    <span className="text-[11px]">{asset.mediaType}</span>
                                )}
                            </div>
                        )}

                        {mediaIcon ? (
                            <div
                                className={cn(
                                    "absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md",
                                    asset.mediaType === "image"
                                        ? "hidden"
                                        : "bg-black/55 text-white/85",
                                )}
                            >
                                {mediaIcon}
                            </div>
                        ) : null}

                        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 via-black/45 to-transparent px-2 pb-1.5 pt-6">
                            <div className="truncate text-left text-[11px] leading-4 text-white/92">
                                {asset.name}
                            </div>
                            <div className="truncate text-left text-[10px] text-white/50">
                                {asset.mediaType}
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
};
