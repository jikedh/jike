import { MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { FeedbackHistory } from "@/components/FeedbackHistory";
import { Button } from "@/components/ui/button";

const FeedbackPage = () => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [historyRefreshToken, setHistoryRefreshToken] = useState(0);

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