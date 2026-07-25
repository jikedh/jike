import { IconTag, IconTrash } from "@tabler/icons-react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "shared/utils/utils";

// ===================== 筛选维度定义 =====================

export interface TagGroup {
    /** 分组唯一标识 */
    key: string;
    /** 分组展示名 */
    label: string;
    /** 可选标签列表 */
    tags: string[];
}

const TAG_GROUPS: TagGroup[] = [
    {
        key: "imageType",
        label: "图片",
        tags: [
            "背景图",
            "图标",
            "插画",
            "商品图",
            "头像",
            "截图",
            "贴纸",
            "蒙版图",
            "透明 PNG",
        ],
    },
    {
        key: "ageGroup",
        label: "年龄段",
        tags: ["儿童", "少年", "青年", "中年", "老年"],
    },
    {
        key: "race",
        label: "种族",
        tags: ["人类", "精灵", "兽人", "机械", "其他"],
    },
    {
        key: "era",
        label: "时代",
        tags: ["先秦", "古代", "近代", "现代", "未来"],
    },
];

// ===================== 组件 Props =====================

interface TagFilterPanelProps {
    /** 当前已选中的所有标签（跨分组） */
    selectedTags: string[];
    /** 选中标签变化回调 */
    onTagsChange: (tags: string[]) => void;
}

// ===================== 主组件 =====================

export const TagFilterPanel = ({
    selectedTags,
    onTagsChange,
}: TagFilterPanelProps) => {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement | null>(null);

    const selectedCount = selectedTags.length;

    const toggleTag = useCallback(
        (tag: string) => {
            const next = selectedTags.includes(tag)
                ? selectedTags.filter((t) => t !== tag)
                : [...selectedTags, tag];
            onTagsChange(next);
        },
        [selectedTags, onTagsChange],
    );

    const clearAll = useCallback(() => {
        onTagsChange([]);
    }, [onTagsChange]);

    const hasSelection = selectedCount > 0;

    // 按分组划分选中状态，用于渲染
    const groupSelectionMap = useMemo(() => {
        const map: Record<string, Set<string>> = {};
        for (const group of TAG_GROUPS) {
            map[group.key] = new Set(
                group.tags.filter((tag) => selectedTags.includes(tag)),
            );
        }
        return map;
    }, [selectedTags]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    ref={triggerRef}
                    type="button"
                    className={cn(
                        "flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors",
                        hasSelection
                            ? "border-[#B43FEB]/60 bg-[#B43FEB]/15 text-[#d486ff]"
                            : "border-white/10 bg-white/4 text-white/65 hover:text-white/85",
                    )}
                >
                    <IconTag size={13} />
                    <span>标签分类</span>
                    {hasSelection ? (
                        <span className="flex size-4 items-center justify-center rounded-full bg-[#B43FEB]/40 text-[10px] font-medium text-white">
                            {selectedCount}
                        </span>
                    ) : null}
                </button>
            </PopoverTrigger>

            <PopoverContent
                align="start"
                side="bottom"
                sideOffset={6}
                className="w-[320px] rounded-xl border border-white/12 bg-[#1a1a1f] p-4 text-white shadow-2xl"
                onPointerDownOutside={() => setOpen(false)}
            >
                {/* 面板头部：标题 + 清空 */}
                <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-white/80">标签分类</span>
                    <button
                        type="button"
                        onClick={clearAll}
                        disabled={!hasSelection}
                        className={cn(
                            "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors",
                            hasSelection
                                ? "text-white/55 hover:bg-white/8 hover:text-white/85"
                                : "cursor-not-allowed text-white/20",
                        )}
                    >
                        <IconTrash size={11} />
                        清空
                    </button>
                </div>

                {/* 4 个独立筛选分组 */}
                <div className="flex flex-col gap-4">
                    {TAG_GROUPS.map((group) => (
                        <div key={group.key}>
                            <div className="mb-2 text-[11px] font-medium text-white/40">
                                {group.label}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {group.tags.map((tag) => {
                                    const isSelected = groupSelectionMap[group.key]?.has(tag);
                                    return (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => toggleTag(tag)}
                                            className={cn(
                                                "rounded-md border px-2 py-1 text-[11px] transition-colors",
                                                isSelected
                                                    ? "border-[#B43FEB]/70 bg-[#B43FEB]/25 text-[#e0aaff]"
                                                    : "border-white/10 bg-white/4 text-white/55 hover:border-white/20 hover:text-white/80",
                                            )}
                                        >
                                            {tag}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
};
