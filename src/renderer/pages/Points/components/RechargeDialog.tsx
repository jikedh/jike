import { Wallet, Zap } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { NativePayOrder, RechargePackage } from "../lib/types";
import { buildQrcodeImageByCodeUrl } from "../lib/utils";

const RechargeSummary = ({
    selectedPackage,
}: {
    selectedPackage: RechargePackage;
}) => (
    <dl className="grid grid-cols-2 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
        <div>
            <dt className="text-xs text-white/40">充值套餐</dt>
            <dd className="mt-1 flex items-center gap-2">
                <Zap className="h-4 w-4 fill-[#B43FEB] text-[#B43FEB]" />
                <span className="text-lg font-black tracking-tight">
                    {selectedPackage.points}
                </span>
                <span className="text-xs text-white/35">积分</span>
            </dd>
        </div>
        <div className="text-right">
            <dt className="text-xs text-white/40">应付金额</dt>
            <dd className="mt-1 text-lg font-black tracking-tight">
                ¥{selectedPackage.price}
            </dd>
        </div>
    </dl>
);

const PaymentQrcode = ({
    codeUrl,
    isCreatingOrder,
}: {
    codeUrl?: string;
    isCreatingOrder: boolean;
}) => (
    <figure className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-[#0f0f12] px-6 py-6">
        {isCreatingOrder ? (
            <Skeleton className="h-60 w-60 rounded-2xl bg-white/10" />
        ) : codeUrl ? (
            <>
                <figcaption className="mb-3 text-xs font-bold text-white/70">
                    请使用微信扫码支付
                </figcaption>
                <img
                    src={buildQrcodeImageByCodeUrl(codeUrl)}
                    alt="微信支付二维码"
                    className="h-60 w-60 rounded-2xl bg-white p-2"
                />
                <p className="mt-3 text-[10px] text-white/35">
                    支付完成后积分将自动到账
                </p>
            </>
        ) : (
            <figcaption className="py-16 text-sm text-red-300">
                未获取到支付二维码，请重试
            </figcaption>
        )}
    </figure>
);

export const RechargeDialog = ({
    selectedPackage,
    nativePayOrder,
    isCreatingOrder,
    onOpenChange,
}: {
    selectedPackage: RechargePackage | null;
    nativePayOrder: NativePayOrder | null;
    isCreatingOrder: boolean;
    onOpenChange: (open: boolean) => void;
}) => (
    <Dialog open={selectedPackage !== null} onOpenChange={onOpenChange}>
        <DialogContent className="w-[min(520px,92vw)] border border-white/10 bg-[#121214] p-0 text-white">
            <DialogHeader className="border-b border-white/5 bg-[#18181b] px-5 py-4">
                <DialogTitle className="flex items-center gap-2 text-white">
                    <Wallet className="h-4.5 w-4.5 text-[#B43FEB]" />
                    积分充值
                </DialogTitle>
            </DialogHeader>

            {selectedPackage && (
                <section className="space-y-5 px-5 py-5">
                    <RechargeSummary selectedPackage={selectedPackage} />
                    <p className="rounded-xl border border-[#B43FEB]/30 bg-[#B43FEB]/10 px-3 py-2 text-center text-sm font-bold text-white">
                        微信扫码支付
                    </p>
                    <PaymentQrcode
                        codeUrl={nativePayOrder?.codeUrl}
                        isCreatingOrder={isCreatingOrder}
                    />
                </section>
            )}
        </DialogContent>
    </Dialog>
);
