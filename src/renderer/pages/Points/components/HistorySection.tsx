import { CreditCard, Gift, ReceiptText, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "shared/utils/utils";
import { Button } from "@/components/ui/button";
import { transactionHistory, usageHistory } from "../lib/constants";
import type { ActiveTab } from "../lib/types";

const TabButton = ({
    active,
    icon,
    label,
    onClick,
}: {
    active: boolean;
    icon: ReactNode;
    label: string;
    onClick: () => void;
}) => (
    <Button
        unstyled
        className={cn(
            "relative pb-4 text-sm font-bold transition-all",
            active ? "text-white" : "text-white/30 hover:text-white/60",
        )}
        onClick={onClick}
    >
        <span className="flex items-center gap-2">
            {icon}
            {label}
        </span>
        {active && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#B43FEB]" />
        )}
    </Button>
);

const HistoryItemMeta = ({
    icon,
    title,
    description,
    positive,
}: {
    icon: ReactNode;
    title: string;
    description: string;
    positive?: boolean;
}) => (
    <article className="flex items-center gap-4">
        <span
            className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl",
                positive === undefined && "bg-white/5 text-white/40",
                positive === true && "bg-green-500/10 text-green-500",
                positive === false && "bg-blue-500/10 text-blue-500",
            )}
        >
            {icon}
        </span>
        <section>
            <h3 className="text-sm font-bold text-white/90">{title}</h3>
            <p className="text-[10px] font-mono uppercase tracking-wider text-white/30">
                {description}
            </p>
        </section>
    </article>
);

const HistoryAmount = ({
    amount,
    status,
    positive,
}: {
    amount: string;
    status: string;
    positive?: boolean;
}) => (
    <p className="text-right">
        <strong
            className={cn(
                "block text-sm font-black",
                positive ? "text-green-500" : "text-white/90",
            )}
        >
            {amount}
        </strong>
        <span
            className={cn(
                "text-[10px] font-bold uppercase tracking-widest",
                status === "Completed" ? "text-green-500/80" : "text-white/20",
            )}
        >
            {status}
        </span>
    </p>
);

const UsageHistoryList = () => (
    <ul className="divide-y divide-white/5">
        {usageHistory.map((item) => (
            <li
                key={item.id}
                className="flex items-center justify-between p-5 transition-colors hover:bg-white/[0.02]"
            >
                <HistoryItemMeta
                    icon={<Zap className="h-5 w-5" />}
                    title={item.type}
                    description={item.date}
                />
                <HistoryAmount amount={item.amount} status="Completed" />
            </li>
        ))}
    </ul>
);

const TransactionHistoryList = () => (
    <ul className="divide-y divide-white/5">
        {transactionHistory.map((item) => {
            const isGift = item.amount.startsWith("+");

            return (
                <li
                    key={item.id}
                    className="flex items-center justify-between p-5 transition-colors hover:bg-white/[0.02]"
                >
                    <HistoryItemMeta
                        icon={
                            isGift ? (
                                <Gift className="h-5 w-5" />
                            ) : (
                                <CreditCard className="h-5 w-5" />
                            )
                        }
                        title={item.type}
                        description={`${item.date} · ${item.method}`}
                        positive={isGift}
                    />
                    <HistoryAmount amount={item.amount} status="Success" positive={isGift} />
                </li>
            );
        })}
    </ul>
);

export const HistorySection = ({
    activeTab,
    onTabChange,
}: {
    activeTab: ActiveTab;
    onTabChange: (tab: ActiveTab) => void;
}) => (
    <section className="space-y-6">
        <header className="flex items-center justify-between border-b border-white/5">
            <nav className="flex gap-8">
                <TabButton
                    active={activeTab === "usage"}
                    icon={<ReceiptText className="h-4 w-4" />}
                    label="积分消耗明细"
                    onClick={() => onTabChange("usage")}
                />
                <TabButton
                    active={activeTab === "transaction"}
                    icon={<CreditCard className="h-4 w-4" />}
                    label="充值消费明细"
                    onClick={() => onTabChange("transaction")}
                />
            </nav>
            <Button
                unstyled
                className="pb-4 text-xs text-white/30 transition-colors hover:text-white"
            >
                导出记录
            </Button>
        </header>

        <article className="overflow-hidden rounded-[24px] border border-white/5 bg-[#121214]">
            {activeTab === "usage" ? <UsageHistoryList /> : <TransactionHistoryList />}
            <footer className="bg-white/[0.02] p-4 text-center">
                <Button
                    unstyled
                    className="text-[10px] font-bold uppercase tracking-widest text-white/20 transition-colors hover:text-white/40"
                >
                    查看更多历史记录
                </Button>
            </footer>
        </article>
    </section>
);
