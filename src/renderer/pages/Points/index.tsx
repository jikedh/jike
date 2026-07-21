import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScoreRecordItem, ScoreTransactionItem } from "shared/types/jikeing";
import { getJikeingToken, getJikeingUserId } from "shared/utils/utils";
import { toast } from "sonner";
import {
    createRechargeOrder,
    getRechargeOrderStatus,
    updateVipScore,
} from "@/api/jikeing";
import { getJikeGoScoreRecords, getJikeGoScoreTransactions } from "@/api/jikeGo";
import { useUserStore } from "@/stores/useUserStore";
import { HistorySection } from "./components/HistorySection";
import { ProfileHeader } from "./components/ProfileHeader";
import { RechargeDialog } from "./components/RechargeDialog";
import { RechargeGrid } from "./components/RechargeGrid";
import { RECHARGE_PACKAGES } from "./lib/constants";
import type { ActiveTab, NativePayOrder, RechargePackage } from "./lib/types";
import { generateAvatarUrl, getRandomStyle } from "./lib/utils";

export function PointsView() {
    const [activeTab, setActiveTab] = useState<ActiveTab>("transaction");
    const [userId, setUserId] = useState<string>("");
    const [selectedPackage, setSelectedPackage] = useState<RechargePackage | null>(
        null,
    );
    const [isCreatingOrder, setIsCreatingOrder] = useState(false);
    const [nativePayOrder, setNativePayOrder] = useState<NativePayOrder | null>(
        null,
    );

    // 积分明细状态
    const [records, setRecords] = useState<ScoreRecordItem[]>([]);
    const [recordsPage, setRecordsPage] = useState(1);
    const [recordsTotal, setRecordsTotal] = useState(0);
    const [recordsLoading, setRecordsLoading] = useState(false);
    const [recordsError, setRecordsError] = useState<string | null>(null);

    // 充值消费明细状态
    const [transactions, setTransactions] = useState<ScoreTransactionItem[]>([]);
    const [transactionsPage, setTransactionsPage] = useState(1);
    const [transactionsTotal, setTransactionsTotal] = useState(0);
    const [transactionsLoading, setTransactionsLoading] = useState(false);
    const [transactionsError, setTransactionsError] = useState<string | null>(null);
    const hasRequestedTransactionsRef = useRef(false);
    const transactionsRequestRef = useRef<{ page: number; id: number } | null>(
        null,
    );
    const transactionsRequestIdRef = useRef(0);

    const balanceInfo = useUserStore((state) => state.balanceInfo);
    const fetchBalanceInfo = useUserStore((state) => state.fetchBalanceInfo);
    const setBalanceInfo = useUserStore((state) => state.setBalanceInfo);

    const fetchRecords = useCallback(async (page = 1) => {
        setRecordsLoading(true);
        setRecordsError(null);
        try {
            const res = await getJikeGoScoreRecords({ page, pageSize: 10 });
            const data = res?.data;
            if (data) {
                setRecords(data.list || []);
                setRecordsPage(data.page || 1);
                setRecordsTotal(data.total || 0);
            }
        } catch (error: any) {
            setRecordsError(error?.message || "加载积分明细失败");
        } finally {
            setRecordsLoading(false);
        }
    }, []);

    const fetchTransactions = useCallback(async (page = 1) => {
        if (transactionsRequestRef.current?.page === page) {
            return;
        }

        const requestId = transactionsRequestIdRef.current + 1;
        transactionsRequestIdRef.current = requestId;
        transactionsRequestRef.current = { page, id: requestId };
        hasRequestedTransactionsRef.current = true;

        setTransactionsLoading(true);
        setTransactionsError(null);
        try {
            const res = await getJikeGoScoreTransactions({ page, pageSize: 10 });
            const data = res?.data;
            if (data && transactionsRequestRef.current?.id === requestId) {
                setTransactions(data.list || []);
                setTransactionsPage(data.page || 1);
                setTransactionsTotal(data.total || 0);
            }
        } catch (error: any) {
            if (transactionsRequestRef.current?.id === requestId) {
                setTransactionsError(error?.message || "加载充值消费明细失败");
            }
        } finally {
            if (transactionsRequestRef.current?.id === requestId) {
                transactionsRequestRef.current = null;
                setTransactionsLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        const token = getJikeingToken();
        if (token) {
            const uid = getJikeingUserId();
            setUserId(uid);

            void fetchBalanceInfo();
            void fetchRecords(1);
        }
    }, [fetchBalanceInfo, fetchRecords]);

    // 头像：优先使用用户真实上传头像，无真实头像时 fallback 到 dicebear
    const userInfo = useUserStore((s) => s.userInfo);
    const avatarUrl = useMemo(() => {
        if (userInfo?.avatar) return userInfo.avatar;
        const userSeed = userId || "default-user";
        const avatarStyle = getRandomStyle(userSeed);
        return generateAvatarUrl(userSeed, avatarStyle);
    }, [userInfo?.avatar, userId]);

    useEffect(() => {
        if (
            activeTab === "transaction" &&
            getJikeingToken() &&
            !hasRequestedTransactionsRef.current
        ) {
            void fetchTransactions(1);
        }
    }, [activeTab, fetchTransactions]);

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

    const createNativeCustomRechargeOrder = async (amountYuan: number) => {
        if (!userId) {
            toast.error("请先登录后再充值");
            return;
        }

        const points = Math.round(amountYuan * 60);
        const customPackage: RechargePackage = {
            id: 0,
            packageId: "pkg_custom",
            points,
            price: amountYuan,
            originalPrice: amountYuan,
            tag: "自定义充值",
        };

        setSelectedPackage(customPackage);
        setNativePayOrder(null);
        setIsCreatingOrder(true);
        try {
            const result = await createRechargeOrder({
                userId,
                customAmountFen: Math.round(amountYuan * 100),
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
            setSelectedPackage(null);
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
                        void fetchBalanceInfo();
                        void fetchRecords(1);
                        void fetchTransactions(1);
                        toast.success("充值成功，积分已到账");
                    } catch (error: any) {
                        console.error(error);
                        toast.error("充值成功但积分更新失败，请刷新页面");
                    }

                    setSelectedPackage(null);
                    setNativePayOrder(null);
                } else if (result?.data?.status === "CLOSED") {
                    toast.error("支付失败或已取消");
                    setSelectedPackage(null);
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
                    setSelectedPackage(null);
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
        fetchBalanceInfo,
        fetchRecords,
        fetchTransactions,
        nativePayOrder?.orderId,
        selectedPackage,
        setBalanceInfo,
        userId,
    ]);

    const handleRecharge = (pkg: RechargePackage) => {
        setSelectedPackage(pkg);
        setNativePayOrder(null);
        void createNativeRechargeOrder(pkg);
    };

    const handleCustomRecharge = (amountYuan: number) => {
        void createNativeCustomRechargeOrder(amountYuan);
    };

    const handleDialogOpenChange = (open: boolean) => {
        if (!open) {
            setSelectedPackage(null);
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
                <RechargeGrid
                    packages={RECHARGE_PACKAGES}
                    onRecharge={handleRecharge}
                    onCustomRecharge={handleCustomRecharge}
                />
                <HistorySection
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    records={records}
                    transactions={transactions}
                    page={recordsPage}
                    transactionsPage={transactionsPage}
                    total={recordsTotal}
                    transactionsTotal={transactionsTotal}
                    loading={recordsLoading}
                    transactionsLoading={transactionsLoading}
                    error={recordsError}
                    transactionsError={transactionsError}
                    onPageChange={(page) => void fetchRecords(page)}
                    onTransactionPageChange={(page) => void fetchTransactions(page)}
                    onRetry={() => void fetchRecords(1)}
                    onTransactionRetry={() => void fetchTransactions(1)}
                />
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
