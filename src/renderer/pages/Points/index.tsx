import { useEffect, useState } from "react";
import { getJikeingToken, getJikeingUserId } from "shared/utils/utils";
import { toast } from "sonner";
import {
    createRechargeOrder,
    getRechargeOrderStatus,
    updateVipScore,
} from "@/api/jikeing";
import { useUserStore } from "@/stores/useUserStore";
import { HistorySection } from "./components/HistorySection";
import { ProfileHeader } from "./components/ProfileHeader";
import { RechargeDialog } from "./components/RechargeDialog";
import { RechargeGrid } from "./components/RechargeGrid";
import { RECHARGE_PACKAGES } from "./lib/constants";
import type { ActiveTab, NativePayOrder, RechargePackage } from "./lib/types";
import { generateAvatarUrl, getRandomStyle } from "./lib/utils";

export function PointsView() {
    const [activeTab, setActiveTab] = useState<ActiveTab>("usage");
    const [avatarUrl, setAvatarUrl] = useState<string>("");
    const [userId, setUserId] = useState<string>("");
    const [selectedPackageId, setSelectedPackageId] = useState<number | null>(
        null,
    );
    const [isCreatingOrder, setIsCreatingOrder] = useState(false);
    const [nativePayOrder, setNativePayOrder] = useState<NativePayOrder | null>(
        null,
    );

    const balanceInfo = useUserStore((state) => state.balanceInfo);
    const fetchBalanceInfo = useUserStore((state) => state.fetchBalanceInfo);
    const setBalanceInfo = useUserStore((state) => state.setBalanceInfo);

    useEffect(() => {
        const token = getJikeingToken();
        if (token) {
            const userId = getJikeingUserId();
            setUserId(userId);
            const userSeed = userId || "default-user";
            const avatarStyle = getRandomStyle(userSeed);
            const url = generateAvatarUrl(userSeed, avatarStyle);
            setAvatarUrl(url);

            void fetchBalanceInfo();
        }
    }, []);

    const selectedPackage =
        selectedPackageId === null
            ? null
            : (RECHARGE_PACKAGES.find((pkg) => pkg.id === selectedPackageId) ?? null);

    const totalScore =
        (balanceInfo?.forScore ?? 0) + (balanceInfo?.vipScore ?? 0);

    const createNativeRechargeOrder = async (pkg: RechargePackage) => {
        if (!userId) {
            toast.error("请先登录后再充值");
            return;
        }

        setIsCreatingOrder(true);
        try {
            const result = await createRechargeOrder({
                userId,
                packageId: pkg.packageId,
            });

            if (!result?.data?.codeUrl) {
                throw new Error(result?.msg || "创建充值订单失败");
            }

            setNativePayOrder({
                orderId: result.data.orderId,
                codeUrl: result.data.codeUrl,
            });
        } catch (error: any) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "创建充值订单失败");
        } finally {
            setIsCreatingOrder(false);
        }
    };

    useEffect(() => {
        if (!selectedPackage || !nativePayOrder?.orderId) {
            return;
        }

        let timer: NodeJS.Timeout;
        let pollingCount = 0;
        const MAX_POLLING_COUNT = 60;

        const checkPaymentStatus = async () => {
            try {
                const result = await getRechargeOrderStatus(nativePayOrder.orderId);

                if (
                    result?.data?.tradeState === "SUCCESS" ||
                    result?.data?.status === "PAID"
                ) {
                    window.clearInterval(timer);

                    try {
                        await updateVipScore({
                            userId,
                            vipScoreDelta: selectedPackage.points,
                        });
                        if (balanceInfo) {
                            setBalanceInfo({
                                ...balanceInfo,
                                forScore: balanceInfo.forScore + selectedPackage.points,
                            });
                        }
                        toast.success("充值成功，积分已到账");
                    } catch (error: any) {
                        console.error(error);
                        toast.error("充值成功但积分更新失败，请刷新页面");
                    }

                    setSelectedPackageId(null);
                    setNativePayOrder(null);
                } else if (result?.data?.status === "CLOSED") {
                    toast.error("支付失败或已取消");
                    setSelectedPackageId(null);
                    setNativePayOrder(null);
                    if (timer) {
                        clearInterval(timer);
                    }
                }
            } catch (error: any) {
                console.error("轮询支付状态失败:", error);
            } finally {
                pollingCount++;
                if (pollingCount >= MAX_POLLING_COUNT) {
                    toast.info("支付超时，请重新尝试");
                    setSelectedPackageId(null);
                    setNativePayOrder(null);
                    if (timer) {
                        clearInterval(timer);
                    }
                }
            }
        };

        checkPaymentStatus();
        timer = setInterval(checkPaymentStatus, 1500);

        return () => {
            if (timer) {
                clearInterval(timer);
            }
        };
    }, [
        balanceInfo,
        nativePayOrder?.orderId,
        selectedPackage,
        setBalanceInfo,
        userId,
    ]);

    const handleRecharge = (pkg: RechargePackage) => {
        setSelectedPackageId(pkg.id);
        setNativePayOrder(null);
        void createNativeRechargeOrder(pkg);
    };

    const handleDialogOpenChange = (open: boolean) => {
        if (!open) {
            setSelectedPackageId(null);
            setNativePayOrder(null);
        }
    };

    return (
        <main className="h-full flex-1 overflow-y-auto bg-[#09090b] font-sans text-white scrollbar-hide">
            <ProfileHeader
                avatarUrl={avatarUrl}
                userId={userId}
                totalScore={totalScore}
            />

            <section className="mx-auto grid max-w-6xl gap-12 px-8 py-12">
                <RechargeGrid packages={RECHARGE_PACKAGES} onRecharge={handleRecharge} />
                <HistorySection activeTab={activeTab} onTabChange={setActiveTab} />
            </section>

            <RechargeDialog
                selectedPackage={selectedPackage}
                nativePayOrder={nativePayOrder}
                isCreatingOrder={isCreatingOrder}
                onOpenChange={handleDialogOpenChange}
            />
        </main>
    );
}

export default PointsView;
