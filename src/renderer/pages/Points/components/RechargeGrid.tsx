import { Wallet } from "lucide-react";
import { cn } from "shared/utils/utils";
import { Button } from "@/components/ui/button";
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

export const RechargeGrid = ({
    packages,
    onRecharge,
}: {
    packages: RechargePackage[];
    onRecharge: (pkg: RechargePackage) => void;
}) => (
    <section>
        <PageTitle />
        <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {packages.map((pkg) => (
                <li key={pkg.id}>
                    <RechargePackageCard pkg={pkg} onRecharge={onRecharge} />
                </li>
            ))}
        </ul>
    </section>
);
