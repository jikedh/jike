import { MessageSquarePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { getFeedbackSettings } from "@/api/feedback";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { FeedbackHistory } from "@/components/FeedbackHistory";
import { Button } from "@/components/ui/button";

const FeedbackPage = () => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
    const [customerServiceQrUrl, setCustomerServiceQrUrl] = useState("");
    const [qrError, setQrError] = useState(false);

    useEffect(() => {
        let active = true;
        getFeedbackSettings().then(response => {
            if (active) {
                setCustomerServiceQrUrl(response.code === 0 || response.code === 200 ? response.data?.customerServiceQrUrl || "" : "");
            }
        }).catch(() => {
            if (active) setCustomerServiceQrUrl("");
        });
        return () => { active = false; };
    }, []);

    return (
        <main className="min-h-full bg-[#0b0b0d] px-6 py-8 text-white md:px-10">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold">我的反馈</h1>
                        <p className="mt-2 text-sm text-white/50">查看已提交的反馈及处理进度。</p>
                    </div>
                    <Button variant="blue" onClick={() => setIsDialogOpen(true)}>
                        <MessageSquarePlus />
                        提交反馈
                    </Button>
                </header>
                <div className="rounded-2xl border border-white/10 bg-[#121214] p-5 shadow-xl">
                    <FeedbackHistory refreshToken={historyRefreshToken} />
                </div>
                {customerServiceQrUrl && !qrError ? (
                    <img
                        src={customerServiceQrUrl}
                        alt="客服微信二维码"
                        className="mx-auto size-56 rounded-2xl object-contain"
                        onError={() => setQrError(true)}
                    />
                ) : (
                    <p className="text-center text-sm text-white/50">客服二维码暂不可用，请通过反馈表单联系我们。</p>
                )}
            </div>
            <FeedbackDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSubmitted={() => setHistoryRefreshToken((current) => current + 1)}
            />
        </main>
    );
};

export default FeedbackPage;