import { Clock3, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
    getMyFeedbackHistory,
    type FeedbackCategory,
    type FeedbackHistoryItem,
    type FeedbackHistoryResponse,
} from "@/api/feedback";
import { FeedbackDetailDialog } from "@/components/FeedbackDetailDialog";
import {
    Pagination,
    PaginationButton,
    PaginationContent,
    PaginationItem,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
    suggestion: "产品建议",
    bug: "问题反馈",
    complaint: "投诉与服务问题",
    consultation: "功能咨询",
};

const STATUS_LABELS: Record<FeedbackHistoryItem["status"], string> = {
    pending: "待处理",
    processing: "处理中",
    resolved: "已解决",
    closed: "已关闭",
};

const STATUS_CLASSES: Record<FeedbackHistoryItem["status"], string> = {
    pending: "bg-amber-400/10 text-amber-300",
    processing: "bg-sky-400/10 text-sky-300",
    resolved: "bg-emerald-400/10 text-emerald-300",
    closed: "bg-white/10 text-white/55",
};

const formatTime = (value: number) =>
    value
        ? new Intl.DateTimeFormat("zh-CN", {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(new Date(value))
        : "--";

const hasSuccessCode = (code?: number) => code === 0 || code === 200;

type FeedbackHistoryProps = {
    refreshToken?: number;
    className?: string;
};

export const FeedbackHistory = ({
    refreshToken = 0,
    className,
}: FeedbackHistoryProps) => {
    const [page, setPage] = useState(1);
    const [result, setResult] = useState<FeedbackHistoryResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedFeedbackID, setSelectedFeedbackID] = useState<string | null>(null);

    useEffect(() => {
        setPage(1);
    }, [refreshToken]);

    useEffect(() => {
        let active = true;
        setIsLoading(true);
        getMyFeedbackHistory(page)
            .then((response) => {
                if (!hasSuccessCode(response.code) || !response.data) {
                    throw new Error(response.msg || response.message || "加载历史反馈失败");
                }
                if (active) {
                    setResult(response.data);
                }
            })
            .catch((error: unknown) => {
                toast.error(error instanceof Error ? error.message : "加载历史反馈失败");
            })
            .finally(() => {
                if (active) {
                    setIsLoading(false);
                }
            });
        return () => {
            active = false;
        };
    }, [page, refreshToken]);

    const totalPages = result?.pagination.totalPages || 0;
    const feedbacks = result?.list || [];

    return (
        <>
            <section className={className}>
                {isLoading ? (
                    <div className="py-12 text-center text-sm text-white/45">正在加载历史反馈...</div>
                ) : feedbacks.length ? (
                    <div className="flex flex-col gap-3">
                        {feedbacks.map((feedback) => (
                            <button
                                key={feedback.id}
                                type="button"
                                onClick={() => setSelectedFeedbackID(feedback.id)}
                                className="flex w-full flex-col gap-3 rounded-xl border border-white/10 bg-white/3 px-4 py-3 text-left hover:border-[#B43FEB]/50 hover:bg-[#B43FEB]/5"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <span className="line-clamp-1 text-sm font-medium text-white/90">{feedback.title}</span>
                                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${STATUS_CLASSES[feedback.status]}`}>
                                        {STATUS_LABELS[feedback.status]}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-white/40">
                                    <span>{CATEGORY_LABELS[feedback.category]}</span>
                                    <span className="flex items-center gap-1"><Clock3 size={13} />{formatTime(feedback.createdAt)}</span>
                                </div>
                                {feedback.replyContent || feedback.resolutionContent || feedback.closeReason ? (
                                    <p className="line-clamp-1 text-xs text-white/50">
                                        {feedback.replyContent || feedback.resolutionContent || feedback.closeReason}
                                    </p>
                                ) : null}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3 py-14 text-center">
                        <FileText className="text-white/25" size={28} />
                        <p className="text-sm text-white/55">暂未提交过反馈</p>
                    </div>
                )}

                {totalPages > 1 ? (
                    <Pagination className="mt-5">
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious disabled={page <= 1} onClick={() => setPage(page - 1)} />
                            </PaginationItem>
                            {Array.from({ length: totalPages }, (_, index) => index + 1).map((item) => (
                                <PaginationItem key={item}>
                                    <PaginationButton isActive={page === item} onClick={() => setPage(item)}>{item}</PaginationButton>
                                </PaginationItem>
                            ))}
                            <PaginationItem>
                                <PaginationNext disabled={page >= totalPages} onClick={() => setPage(page + 1)} />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                ) : null}
            </section>
            <FeedbackDetailDialog
                feedbackID={selectedFeedbackID}
                open={Boolean(selectedFeedbackID)}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedFeedbackID(null);
                    }
                }}
            />
        </>
    );
};
