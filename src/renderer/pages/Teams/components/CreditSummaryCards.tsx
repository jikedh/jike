import { Crown, Gem, PiggyBank, Wallet } from "lucide-react";
import type { TeamCreditSummary } from "shared/types/api/teams";
import { cn } from "shared/utils/utils";
import { formatCredits } from "../utils";

interface CreditSummaryCardsProps {
    summary: TeamCreditSummary;
}

/** 团队积分概览统计卡。 */
export function CreditSummaryCards({ summary }: CreditSummaryCardsProps) {
    const cards = [
        {
            key: "allocatable",
            label: "我可分配积分",
            value: summary.allocatablePersonalCredits,
            icon: <Wallet className="h-5 w-5" />,
            highlight: true,
            desc: "可分配给团队成员",
        },
        {
            key: "total",
            label: "团队已分配总额",
            value: summary.teamTotalAllocatedCredits,
            icon: <PiggyBank className="h-5 w-5" />,
            highlight: false,
            desc: "本团队累计发放",
        },
        {
            key: "vip",
            label: "我的会员积分",
            value: summary.currentVipScore,
            icon: <Crown className="h-5 w-5" />,
            highlight: false,
            desc: "随会员周期重置",
        },
        {
            key: "for",
            label: "我的永久积分",
            value: summary.currentForScore,
            icon: <Gem className="h-5 w-5" />,
            highlight: false,
            desc: "长期有效不清零",
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {cards.map((card) => (
                <div
                    key={card.key}
                    className={cn(
                        "flex flex-col gap-3 rounded-[24px] border p-5",
                        card.highlight
                            ? "border-[#B43FEB]/50 bg-linear-to-br from-[#B43FEB]/20 via-[#121214] to-[#121214]"
                            : "border-white/5 bg-[#121214]",
                    )}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-white/40">{card.label}</span>
                        <span
                            className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-xl",
                                card.highlight
                                    ? "bg-[#B43FEB]/20 text-[#d896ff]"
                                    : "bg-white/5 text-white/50",
                            )}
                        >
                            {card.icon}
                        </span>
                    </div>
                    <div className="text-3xl font-extrabold tracking-tight text-white">
                        {formatCredits(card.value)}
                    </div>
                    <div className="text-[11px] text-white/30">{card.desc}</div>
                </div>
            ))}
        </div>
    );
}
