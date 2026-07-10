import { useMemo } from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AssetCategory, PrimaryCategory } from "shared/types/api/assets";
import { cn } from "shared/utils/utils";

interface AssetCategoryCascadeSelectProps {
    categories: AssetCategory[];
    value?: PrimaryCategory | "all";
    onChange: (value: PrimaryCategory | "all") => void;
    includeAll?: boolean;
    disabled?: boolean;
    placeholder?: string;
}

const getCategoryValue = (category: AssetCategory): PrimaryCategory =>
    category.code || String(category.id);

const findPath = (
    categories: AssetCategory[],
    code?: PrimaryCategory | "all",
): AssetCategory[] => {
    if (!code || code === "all") return [];
    for (const category of categories) {
        if (getCategoryValue(category) === code) return [category];
        const childPath = findPath(category.children || [], code);
        if (childPath.length > 0) return [category, ...childPath];
    }
    return [];
};

const isLeaf = (category: AssetCategory) =>
    !category.children || category.children.length === 0;

export const getAssetCategoryDisplayName = (
    categories: AssetCategory[],
    code?: PrimaryCategory | "all",
) => {
    if (!code || code === "all") return "全部分类";
    const path = findPath(categories, code);
    return path.length > 0 ? path.map((item) => item.name).join("-") : code;
};

export const AssetCategoryCascadeSelect = ({
    categories,
    value = "all",
    onChange,
    includeAll = true,
    disabled = false,
    placeholder = "选择分类",
}: AssetCategoryCascadeSelectProps) => {
    const selectedLabel = useMemo(
        () => getAssetCategoryDisplayName(categories, value) || placeholder,
        [categories, placeholder, value],
    );

    const renderCategoryItems = (items: AssetCategory[]) => (
        <>
            {items.map((category) => {
                const leaf = isLeaf(category);
                const categoryValue = getCategoryValue(category);
                if (!leaf) {
                    return (
                        <DropdownMenuSub key={category.code || category.id}>
                            <DropdownMenuSubTrigger className="h-8 px-2.5 text-xs text-white/70 focus:bg-white/8 focus:text-white data-open:bg-white/8 data-open:text-white">
                                <span className="truncate">{category.name}</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="min-w-36 border-white/10 bg-[#121214] text-white shadow-2xl">
                                {renderCategoryItems(category.children || [])}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                    );
                }

                return (
                    <DropdownMenuItem
                        key={category.code || category.id}
                        className={cn(
                            "h-8 px-2.5 text-xs text-white/70 focus:bg-white/8 focus:text-white",
                            value === categoryValue && "bg-[#B43FEB]/20 text-white",
                        )}
                        onSelect={() => onChange(categoryValue)}
                    >
                        <span className="truncate">{category.name}</span>
                    </DropdownMenuItem>
                );
            })}
        </>
    );

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild disabled={disabled}>
                <button
                    type="button"
                    className="min-w-44 rounded-md border border-white/10 bg-white/4 px-2.5 py-1.5 text-left text-xs text-white/80 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 data-open:border-[#B43FEB]/60 data-open:text-white"
                >
                    <span className="block truncate">{selectedLabel}</span>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="start"
                sideOffset={6}
                className="z-95 w-auto min-w-44 border-white/10 bg-[#121214] text-white shadow-2xl"
            >
                {includeAll ? (
                    <>
                        <DropdownMenuItem
                            className={cn(
                                "h-8 px-2.5 text-xs text-white/70 focus:bg-white/8 focus:text-white",
                                value === "all" && "bg-[#B43FEB]/20 text-white",
                            )}
                            onSelect={() => onChange("all")}
                        >
                            全部分类
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                    </>
                ) : null}
                {renderCategoryItems(categories)}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
