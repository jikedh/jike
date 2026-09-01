import {
    IconChevronDown,
    IconChevronUp,
    IconTags,
    IconX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { getPublicAssetTags } from "@/api/assets";
import { cn } from "shared/utils/utils";
import { ASSET_TAG_TAXONOMY } from "../tagTaxonomy";

/** 「其他」分类的 key，对应 tagTaxonomy 中无静态分组的动态分类 */
const OTHER_CATEGORY_KEY = "other";

/** 汇总内置静态标签，用于从聚合标签中排除，避免「其他」分类重复展示 */
const BUILTIN_TAGS = new Set(
    ASSET_TAG_TAXONOMY.flatMap((category) =>
        category.groups.flatMap((group) => group.tags),
    ),
);

// ===================== 组件 Props =====================

interface TagFilterPanelProps {
    /** 当前已选中的所有标签（跨分组） */
    selectedTags: string[];
    /** 选中标签变化回调 */
    onTagsChange: (tags: string[]) => void;
    /** 左侧栏布局仅展示标签体系，已选标签由资产列表区域展示 */
    layout?: "horizontal" | "sidebar";
}

// ===================== 主组件 =====================

/**
 * 公共资产库标签筛选面板
 *
 * 展示方式：
 * - 顶部为 人物 / 场景 / 道具 三大类切换，只影响下方展示的标签分组，不直接过滤资产
 * - 分组标签以行内标签云形式平铺，选中即加入筛选条件
 * - 选中标签以后端 AND 语义过滤：资产须同时拥有全部选中标签
 * - 已选标签以 chips 形式回显，可单独移除或一键清空
 */
export const TagFilterPanel = ({
    selectedTags,
    onTagsChange,
    layout = "horizontal",
}: TagFilterPanelProps) => {
    const [activeCategoryKey, setActiveCategoryKey] = useState(
        ASSET_TAG_TAXONOMY[0].key,
    );
    const [expanded, setExpanded] = useState(true);
    const [otherTags, setOtherTags] = useState<string[]>([]);
    const [otherTagsLoading, setOtherTagsLoading] = useState(false);

    const selectedSet = useMemo(() => new Set(selectedTags), [selectedTags]);
    const activeCategory =
        ASSET_TAG_TAXONOMY.find(
            (category) => category.key === activeCategoryKey,
        ) ?? ASSET_TAG_TAXONOMY[0];
    const isOtherCategory = activeCategoryKey === OTHER_CATEGORY_KEY;
    const hasSelection = selectedTags.length > 0;
    const isSidebar = layout === "sidebar";

    // 「其他」分类：聚合后端公共资产标签，排除内置静态标签后展示
    useEffect(() => {
        if (!isOtherCategory) return;
        let cancelled = false;
        setOtherTagsLoading(true);
        void getPublicAssetTags()
            .then((envelope) => {
                if (
                    cancelled ||
                    (envelope.code !== 0 && envelope.code !== 200) ||
                    !Array.isArray(envelope.data)
                ) {
                    return;
                }
                setOtherTags(
                    envelope.data.filter(
                        (tag) => typeof tag === "string" && !BUILTIN_TAGS.has(tag),
                    ),
                );
            })
            .catch(() => undefined)
            .finally(() => {
                if (!cancelled) setOtherTagsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isOtherCategory]);

    const toggleTag = (tag: string) => {
        onTagsChange(
            selectedSet.has(tag)
                ? selectedTags.filter((item) => item !== tag)
                : [...selectedTags, tag],
        );
    };

    return (
        <section
            className={cn(
                "flex shrink-0 flex-col",
                isSidebar
                    ? "min-h-0 flex-1 px-5 py-5"
                    : "border-b border-white/8 px-6 py-3",
            )}
        >
            {/* 头部：大类切换 + 操作区 */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs text-white/35">
                    <IconTags size={13} />
                    标签
                </span>
                <div className="flex items-center gap-1 rounded-md bg-white/4 p-0.5">
                    {ASSET_TAG_TAXONOMY.map((category) => (
                        <button
                            key={category.key}
                            type="button"
                            onClick={() => setActiveCategoryKey(category.key)}
                            className={cn(
                                "rounded px-2.5 py-1 text-xs transition-colors",
                                activeCategoryKey === category.key
                                    ? "bg-[#B43FEB]/25 text-white"
                                    : "text-white/55 hover:text-white",
                            )}
                        >
                            {category.label}
                        </button>
                    ))}
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                    {hasSelection ? (
                        <>
                            <span className="text-[11px] text-white/40">
                                已选 {selectedTags.length} 个
                            </span>
                            <button
                                type="button"
                                onClick={() => onTagsChange([])}
                                className="rounded px-2 py-1 text-[11px] text-white/55 transition-colors hover:bg-white/8 hover:text-white"
                            >
                                清空
                            </button>
                        </>
                    ) : null}
                    {!isSidebar ? (
                        <button
                            type="button"
                            onClick={() => setExpanded((current) => !current)}
                            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-white/55 transition-colors hover:bg-white/8 hover:text-white"
                        >
                            {expanded ? "收起" : "展开"}
                            {expanded ? (
                                <IconChevronUp size={12} />
                            ) : (
                                <IconChevronDown size={12} />
                            )}
                        </button>
                    ) : null}
                </div>
            </div>

            {/* 标签分组：行内标签云；「其他」分类展示动态聚合标签 */}
            {expanded || isSidebar ? (
                <div
                    className={cn(
                        "asset-library-scrollbar mt-3 flex flex-col gap-2.5 overflow-y-auto pr-1",
                        isSidebar ? "min-h-0 flex-1" : "max-h-52",
                    )}
                >
                    {isOtherCategory ? (
                        <div className="flex flex-wrap gap-1.5">
                            {otherTagsLoading ? (
                                <span className="text-[11px] text-white/35">
                                    正在加载...
                                </span>
                            ) : otherTags.length === 0 ? (
                                <span className="text-[11px] text-white/35">
                                    暂无其他标签
                                </span>
                            ) : (
                                otherTags.map((tag) => {
                                    const selected = selectedSet.has(tag);
                                    return (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => toggleTag(tag)}
                                            className={cn(
                                                "rounded-md border px-2 py-1 text-[11px] transition-colors",
                                                selected
                                                    ? "border-[#B43FEB]/70 bg-[#B43FEB]/25 text-[#e0aaff]"
                                                    : "border-white/10 bg-white/4 text-white/55 hover:border-white/20 hover:text-white/80",
                                            )}
                                        >
                                            {tag}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    ) : (
                        activeCategory.groups.map((group) => (
                            <div key={group.key} className="flex items-start gap-3">
                                <span className="mt-1 w-16 shrink-0 text-right text-[11px] leading-5 text-white/35">
                                    {group.label}
                                </span>
                                <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                                    {group.tags.map((tag) => {
                                        const selected = selectedSet.has(tag);
                                        return (
                                            <button
                                                key={tag}
                                                type="button"
                                                onClick={() => toggleTag(tag)}
                                                className={cn(
                                                    "rounded-md border px-2 py-1 text-[11px] transition-colors",
                                                    selected
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
                        ))
                    )}
                </div>
            ) : null}

            {/* 已选标签回显 */}
            {hasSelection && !isSidebar ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {selectedTags.map((tag) => (
                        <span
                            key={tag}
                            className="inline-flex items-center gap-1 rounded-md border border-[#B43FEB]/40 bg-[#B43FEB]/15 px-2 py-0.5 text-[11px] text-[#d486ff]"
                        >
                            {tag}
                            <button
                                type="button"
                                onClick={() => toggleTag(tag)}
                                className="text-[#d486ff]/60 hover:text-[#d486ff]"
                            >
                                <IconX size={10} />
                            </button>
                        </span>
                    ))}
                </div>
            ) : null}
        </section>
    );
};
