import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getMyFeedbackDetail, type FeedbackDetail } from "@/api/feedback";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

const CATEGORY_LABELS = {
    suggestion: "产品建议",
    bug: "问题反馈",
    complaint: "投诉与服务问题",
    consultation: "功能咨询",
};

const STATUS_LABELS = {
    pending: "待处理",
    processing: "处理中",
    resolved: "已解决",
    closed: "已关闭",
};

const formatTime = (value: number) =>
    value
        ? new Intl.DateTimeFormat("zh-CN", {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(new Date(value))
        : "--";

const hasSuccessCode = (code?: number) => code === 0 || code === 200;

type FeedbackDetailDialogProps = {
    feedbackID: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export const FeedbackDetailDialog = ({
    feedbackID,
    open,
    onOpenChange,
}: FeedbackDetailDialogProps) => {
    const [feedback, setFeedback] = useState<FeedbackDetail | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!open || !feedbackID) {
            return;
        }
        let active = true;
        setIsLoading(true);
        getMyFeedbackDetail(feedbackID)
            .then((response) => {
                if (!hasSuccessCode(response.code) || !response.data) {
                    throw new Error(response.msg || response.message || "加载反馈详情失败");
                }
                if (active) {
                    setFeedback(response.data);
                }
            })
            .catch((error: unknown) => {
                toast.error(error instanceof Error ? error.message : "加载反馈详情失败");
                if (active) {
                    onOpenChange(false);
                }
            })
            .finally(() => {
                if (active) {
                    setIsLoading(false);
                }
            });
        return () => {
            active = false;
        };
    }, [feedbackID, onOpenChange, open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] w-[min(640px,92vw)] flex-col overflow-hidden border-white/10 bg-[#121214] p-0 text-white shadow-2xl">
                <DialogHeader className="border-b border-white/10 px-6 py-5">
                    <DialogTitle className="text-lg text-white">反馈详情</DialogTitle>
                    <DialogDescription className="text-white/45">
                        查看反馈提交内容与处理进度。
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
                    {isLoading ? (
                        <div className="py-12 text-center text-sm text-white/45">正在加载反馈详情...</div>
                    ) : feedback ? (
                        <>
                            <div className="flex items-start justify-between gap-4">
                                <h3 className="text-base font-medium text-white">{feedback.title}</h3>
                                <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70">
                                    {STATUS_LABELS[feedback.status] || feedback.status}
                                </span>
                            </div>
                            <DetailRow label="反馈分类" value={CATEGORY_LABELS[feedback.category] || feedback.category} />
                            <DetailRow label="提交时间" value={formatTime(feedback.createdAt)} />
                            <DetailRow label="更新时间" value={formatTime(feedback.updatedAt)} />
                            <DetailRow label="联系方式" value={feedback.contact || "未填写"} />
                            <DetailBlock label="反馈详情" value={feedback.content} />
                            {feedback.replyContent ? <DetailBlock label="客服回复" value={feedback.replyContent} /> : null}
                            {feedback.resolutionContent ? <DetailBlock label="处理结果" value={feedback.resolutionContent} /> : null}
                            {feedback.closeReason ? <DetailBlock label="关闭原因" value={feedback.closeReason} /> : null}
                            {feedback.attachments.length ? (
                                <div className="flex flex-col gap-2">
                                    <span className="text-sm text-white/70">图片附件</span>
                                    <div className="flex flex-wrap gap-3">
                                        {feedback.attachments.map((attachment) => (
                                            <a
                                                key={attachment.id}
                                                href={attachment.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="group relative size-24 overflow-hidden rounded-lg border border-white/10 bg-white/5"
                                            >
                                                <img src={attachment.url} alt={attachment.filename} className="size-full object-cover" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </>
                    ) : null}
                </div>
                <div className="flex justify-end border-t border-white/10 px-6 py-4">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        关闭
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 py-2.5 last:border-b-0">
        <span className="shrink-0 text-sm text-white/45">{label}</span>
        <span className="break-all text-right text-sm text-white/80">{value}</span>
    </div>
);

const DetailBlock = ({ label, value }: { label: string; value: string }) => (
    <div className="flex flex-col gap-2">
        <span className="text-sm text-white/70">{label}</span>
        <p className="whitespace-pre-wrap rounded-lg bg-white/5 px-3 py-2.5 text-sm leading-6 text-white/75">{value}</p>
    </div>
);
