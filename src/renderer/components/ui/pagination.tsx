import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "shared/utils/utils";

const Pagination = ({ className, ...props }: HTMLAttributes<HTMLElement>) => (
    <nav
        aria-label="分页导航"
        className={cn("flex w-full items-center justify-center", className)}
        {...props}
    />
);

const PaginationContent = ({
    className,
    ...props
}: HTMLAttributes<HTMLUListElement>) => (
    <ul className={cn("flex items-center gap-1", className)} {...props} />
);

const PaginationItem = ({
    className,
    ...props
}: HTMLAttributes<HTMLLIElement>) => (
    <li className={cn(className)} {...props} />
);

const PaginationButton = ({
    className,
    isActive = false,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { isActive?: boolean }) => (
    <button
        type="button"
        aria-current={isActive ? "page" : undefined}
        className={cn(
            "inline-flex size-9 items-center justify-center rounded-lg border text-sm font-medium transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-40",
            isActive
                ? "border-[#B43FEB]/60 bg-[#B43FEB] text-white shadow-[0_0_15px_rgba(180,63,235,0.25)]"
                : "border-white/10 bg-black/25 text-white/60 hover:border-[#B43FEB]/40 hover:bg-[#B43FEB]/10 hover:text-white",
            className,
        )}
        {...props}
    />
);

const PaginationPrevious = ({
    className,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <PaginationButton
        aria-label="上一页"
        className={cn("w-auto gap-1.5 px-3", className)}
        {...props}
    >
        <ChevronLeft className="size-4" />
        <span>上一页</span>
    </PaginationButton>
);

const PaginationNext = ({
    className,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <PaginationButton
        aria-label="下一页"
        className={cn("w-auto gap-1.5 px-3", className)}
        {...props}
    >
        <span>下一页</span>
        <ChevronRight className="size-4" />
    </PaginationButton>
);

const PaginationEllipsis = ({
    className,
    ...props
}: HTMLAttributes<HTMLSpanElement>) => (
    <span
        aria-hidden="true"
        className={cn(
            "flex size-9 items-center justify-center text-white/40",
            className,
        )}
        {...props}
    >
        <MoreHorizontal className="size-4" />
    </span>
);

export {
    Pagination,
    PaginationButton,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationNext,
    PaginationPrevious,
};
