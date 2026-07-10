import { useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { cn } from "shared/utils/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RechargePackage } from "../lib/types";

const PageTitle = () => (
    <header className="mb-8">
        <h2 className="flex items-center gap-3 text-2xl font-bold">
            <Wallet className="h-6 w-6 text-[#B43FEB]" />
            积分充值
        </h2>
        <p className="mt-1 text-sm text-white/40">
            选择最适合您的创作套餐，即刻开启无限创意
        </p>
    </header>
);

const RechargePackageCard = ({
    pkg,
    onRecharge,
}: {
    pkg: RechargePackage;
    onRecharge: (pkg: RechargePackage) => void;
}) => (
    <article
        className={cn(
            "group relative overflow-hidden rounded-[24px] border p-7 transition-all duration-500",
            pkg.popular
                ? "border-[#B43FEB]/50 bg-gradient-to-br from-[#B43FEB]/10 to-transparent shadow-[0_20px_40px_rgba(180,63,235,0.1)]"
                : "border-white/5 bg-[#121214] hover:border-white/20 hover:bg-[#161618]",
        )}
    >
        {pkg.popular && (
            <span className="absolute right-0 top-0 rounded-bl-2xl bg-gradient-to-l from-[#B43FEB] to-[#2b5aed] px-4 py-1.5 text-[10px] font-black tracking-widest text-white">
                RECOMMENDED
            </span>
        )}

        <header className="mb-6 flex items-start justify-between gap-4">
            <section>
                <span
                    className={cn(
                        "mb-3 inline-block rounded-md px-2 py-0.5 text-[10px] font-bold",
                        pkg.popular ? "bg-[#B43FEB] text-white" : "bg-white/10 text-white/60",
                    )}
                >
                    {pkg.tag}
                </span>
                <h3 className="flex items-center gap-2 text-3xl font-black tracking-tighter">
                    {pkg.points}
                    <span className="text-xs font-medium tracking-normal text-white/30">
                        Points
                    </span>
                </h3>
            </section>

            <p className="text-right">
                <strong className="block text-2xl font-bold tracking-tight text-white">
                    ¥{pkg.price}
                </strong>
                {pkg.originalPrice !== pkg.price && (
                    <span className="text-xs text-white/20 line-through">
                        ¥{pkg.originalPrice}
                    </span>
                )}
            </p>
        </header>

        <Button
            unstyled
            className={cn(
                "w-full rounded-2xl py-3.5 text-sm font-bold transition-all duration-300",
                pkg.popular
                    ? "bg-[#B43FEB] text-white shadow-xl shadow-[#B43FEB]/20 hover:scale-[1.02]"
                    : "bg-white/5 text-white/80 group-hover:bg-white group-hover:text-black",
            )}
            onClick={() => onRecharge(pkg)}
        >
            立即充值
        </Button>
    </article>
);

const CustomRechargeCard = ({
    onRecharge,
}: {
    onRecharge: (amountYuan: number) => void;
}) => {
    const [amount, setAmount] = useState("");
    const amountYuan = Number(amount);
    // 1 元 = 60 积分，按比例预估；前端允许两位小数
    const points = useMemo(
        () => (Number.isFinite(amountYuan) && amountYuan > 0 ? Math.round(amountYuan * 60) : 0),
        [amountYuan],
    );
    const isValidAmount = Number.isFinite(amountYuan) && amountYuan >= 0.01 && amountYuan <= 1_000_000;

    return (
        <article className="rounded-[24px] border border-white/5 bg-[#121214] p-7 transition-all duration-500 hover:border-[#B43FEB]/40 hover:bg-[#161618]">
            <header className="mb-6 space-y-3">
                <div>
                    <h3 className="text-2xl font-black tracking-tighter">自定义金额</h3>
                    <p className="mt-1 text-xs text-white/35">1元 = 60积分，最低 0.01 元，最高 100 万元</p>
                </div>
            </header>

            <div className="mb-5 space-y-3">
                <Input
                    id="custom-recharge-amount"
                    type="number"
                    min={0.01}
                    step={0.01}
                    inputMode="decimal"
                    value={amount}
                    placeholder="请输入充值金额(单位元)"
                    className="h-12 rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-white/25 focus-visible:ring-[#B43FEB]"
                    onChange={(event) => setAmount(event.target.value)}
                />
                <p className="text-xs text-white/35">
                    预计到账 <span className="font-bold text-[#B43FEB]">{points}</span> 积分
                </p>
            </div>

            <Button
                unstyled
                disabled={!isValidAmount}
                className={cn(
                    "w-full rounded-2xl py-3.5 text-sm font-bold transition-all duration-300",
                    isValidAmount
                        ? "bg-[#B43FEB] text-white shadow-xl shadow-[#B43FEB]/20 hover:scale-[1.02]"
                        : "cursor-not-allowed bg-white/5 text-white/30",
                )}
                onClick={() => onRecharge(amountYuan)}
            >
                自定义充值
            </Button>
        </article>
    );
};

export const RechargeGrid = ({
    packages,
    onRecharge,
    onCustomRecharge,
}: {
    packages: RechargePackage[];
    onRecharge: (pkg: RechargePackage) => void;
    onCustomRecharge: (amountYuan: number) => void;
}) => (
    <section>
        <PageTitle />
        <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {packages.map((pkg) => (
                <li key={pkg.id}>
                    <RechargePackageCard pkg={pkg} onRecharge={onRecharge} />
                </li>
            ))}
            <li>
                <CustomRechargeCard onRecharge={onCustomRecharge} />
            </li>
        </ul>
    </section>
);
