import {
    ArrowDownLeft,
    ArrowUpRight,
    History,
    ReceiptText,
    X,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import type {
    TeamConsumptionRecord,
    TeamCreditLedger,
    TeamCreditLedgerType,
    TeamMember,
} from "shared/types/api/teams";
import { cn } from "shared/utils/utils";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Pagination,
    PaginationButton,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { formatCredits, formatTeamTime } from "../utils";

const PAGE_SIZE = 5;

const LEDGER_TYPE_META: Record<
    TeamCreditLedgerType,
    { label: string; income: boolean; className: string }
> = {
    ALLOCATE: { label: "负责人分配", income: true, className: "bg-green-500/10 text-green-400" },
    RECLAIM: { label: "负责人回收", income: false, className: "bg-orange-500/10 text-orange-400" },
    TASK_CONSUME: { label: "任务消费", income: false, className: "bg-blue-500/10 text-blue-400" },
    TASK_CONSUME_REVERSAL: { label: "消费冲正", income: true, className: "bg-cyan-500/10 text-cyan-400" },
    ACCOUNT_MIGRATION: { label: "账户迁移", income: true, className: "bg-purple-500/10 text-purple-400" },
};

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
            "relative pb-3 text-sm font-bold transition-all",
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

/** 计算页码序列：首尾页 + 当前页附近。 */
const buildPageItems = (page: number, totalPages: number): (number | "ellipsis")[] => {
    const items: (number | "ellipsis")[] = [];
    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) {
            items.push(p);
        } else if (items[items.length - 1] !== "ellipsis") {
            items.push("ellipsis");
        }
    }
    return items;
};

const Pager = ({
    page,
    total,
    onPageChange,
}: {
    page: number;
    total: number;
    onPageChange: (page: number) => void;
}) => {
    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (totalPages <= 1) return null;

    return (
        <Pagination className="border-t border-white/5 px-5 py-3">
            <PaginationContent>
                <PaginationItem>
                    <PaginationPrevious
                        disabled={page <= 1}
                        onClick={() => onPageChange(page - 1)}
                    />
                </PaginationItem>
                {buildPageItems(page, totalPages).map((item, index) =>
                    item === "ellipsis" ? (
                        <PaginationItem key={`ellipsis-${index}`}>
                            <PaginationEllipsis />
                        </PaginationItem>
                    ) : (
                        <PaginationItem key={item}>
                            <PaginationButton
                                isActive={item === page}
                                onClick={() => onPageChange(item)}
                            >
                                {item}
                            </PaginationButton>
                        </PaginationItem>
                    ),
                )}
                <PaginationItem>
                    <PaginationNext
                        disabled={page >= totalPages}
                        onClick={() => onPageChange(page + 1)}
                    />
                </PaginationItem>
            </PaginationContent>
        </Pagination>
    );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 py-2.5 last:border-b-0">
        <span className="shrink-0 text-xs text-white/40">{label}</span>
        <span className="break-all text-right text-xs text-white/80">{value}</span>
    </div>
);

interface RecordsSectionProps {
    ledgers: TeamCreditLedger[];
    consumption: TeamConsumptionRecord[];
    members: TeamMember[];
    isOwner: boolean;
}

/** 积分审计流水 + 成员消费记录区。 */
export function RecordsSection({
    ledgers,
    consumption,
    members,
    isOwner,
}: RecordsSectionProps) {
    const [activeTab, setActiveTab] = useState<"ledgers" | "consumption">("ledgers");
    const [ledgerPage, setLedgerPage] = useState(1);
    const [consumptionPage, setConsumptionPage] = useState(1);
    const [memberFilter, setMemberFilter] = useState<string>("all");
    const [detailLedger, setDetailLedger] = useState<TeamCreditLedger | null>(null);

    const pagedLedgers = useMemo(
        () => ledgers.slice((ledgerPage - 1) * PAGE_SIZE, ledgerPage * PAGE_SIZE),
        [ledgers, ledgerPage],
    );

    const filteredConsumption = useMemo(
        () =>
            memberFilter === "all"
                ? consumption
                : consumption.filter((record) => String(record.userId) === memberFilter),
        [consumption, memberFilter],
    );

    const pagedConsumption = useMemo(
        () =>
            filteredConsumption.slice(
                (consumptionPage - 1) * PAGE_SIZE,
                consumptionPage * PAGE_SIZE,
            ),
        [filteredConsumption, consumptionPage],
    );

    const pageTotalVip = pagedConsumption.reduce((sum, r) => sum + r.vipScore, 0);
    const pageTotalFor = pagedConsumption.reduce((sum, r) => sum + r.forScore, 0);

    return (
        <section className="overflow-hidden rounded-[24px] border border-white/5 bg-[#121214]">
            <header className="flex items-center justify-between border-b border-white/5 px-6 pt-4">
                <div className="flex items-center gap-6">
                    <TabButton
                        active={activeTab === "ledgers"}
                        icon={<History className="h-4 w-4" />}
                        label="积分审计流水"
                        onClick={() => setActiveTab("ledgers")}
                    />
                    {isOwner && (
                        <TabButton
                            active={activeTab === "consumption"}
                            icon={<ReceiptText className="h-4 w-4" />}
                            label="成员消费记录"
                            onClick={() => setActiveTab("consumption")}
                        />
                    )}
                </div>
                {activeTab === "consumption" && (
                    <Select
                        value={memberFilter}
                        onValueChange={(value) => {
                            setMemberFilter(value);
                            setConsumptionPage(1);
                        }}
                    >
                        <SelectTrigger className="mb-2 w-36 border-white/10 text-white/70">
                            <SelectValue placeholder="全部成员" />
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-[#1a1a1e] text-white">
                            <SelectItem value="all">全部成员</SelectItem>
                            {members.map((member) => (
                                <SelectItem key={String(member.userId)} value={String(member.userId)}>
                                    {member.nickname}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </header>

            {activeTab === "ledgers" && (
                <>
                    <ul className="divide-y divide-white/5">
                        {pagedLedgers.length === 0 && (
                            <li className="px-6 py-10 text-center text-xs text-white/30">
                                暂无积分流水
                            </li>
                        )}
                        {pagedLedgers.map((ledger) => {
                            const meta = LEDGER_TYPE_META[ledger.type];
                            return (
                                <li key={String(ledger.id)}>
                                    <Button
                                        unstyled
                                        onClick={() => setDetailLedger(ledger)}
                                        className="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-white/2"
                                    >
                                        <span
                                            className={cn(
                                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                                                meta.className,
                                            )}
                                        >
                                            {meta.income ? (
                                                <ArrowDownLeft className="h-5 w-5" />
                                            ) : (
                                                <ArrowUpRight className="h-5 w-5" />
                                            )}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-bold text-white">
                                                {meta.label} · {ledger.memberNickname}
                                            </div>
                                            <div className="mt-0.5 text-xs text-white/30">
                                                操作人 {ledger.operatorNickname} · {formatTeamTime(ledger.createdAt)}
                                            </div>
                                        </div>
                                        <span
                                            className={cn(
                                                "shrink-0 text-base font-extrabold",
                                                meta.income ? "text-green-400" : "text-white/80",
                                            )}
                                        >
                                            {meta.income ? "+" : "-"}
                                            {formatCredits(Math.abs(ledger.amount))}
                                        </span>
                                    </Button>
                                </li>
                            );
                        })}
                    </ul>
                    <Pager page={ledgerPage} total={ledgers.length} onPageChange={setLedgerPage} />
                </>
            )}

            {activeTab === "consumption" && isOwner && (
                <>
                    <ul className="divide-y divide-white/5">
                        {pagedConsumption.length === 0 && (
                            <li className="px-6 py-10 text-center text-xs text-white/30">
                                暂无消费记录
                            </li>
                        )}
                        {pagedConsumption.map((record) => (
                            <li
                                key={record.recordId}
                                className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-white/2"
                            >
                                <img
                                    src={record.avatar}
                                    alt={record.nickname}
                                    className="h-10 w-10 shrink-0 rounded-full border border-white/10 bg-white/5"
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-bold text-white">
                                        {record.memo || record.sourceLabel}
                                    </div>
                                    <div className="mt-0.5 text-xs text-white/30">
                                        {record.nickname} · {record.sourceLabel} · {record.model} ·{" "}
                                        {formatTeamTime(record.createTime)}
                                    </div>
                                </div>
                                <div className="shrink-0 text-right">
                                    <div className="text-sm font-extrabold text-white/85">
                                        -{formatCredits(record.vipScore + record.forScore)}
                                    </div>
                                    <div className="mt-0.5 text-[11px] text-white/30">
                                        会员 {formatCredits(record.vipScore)} · 永久{" "}
                                        {formatCredits(record.forScore)}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                    {filteredConsumption.length > 0 && (
                        <div className="flex items-center justify-end gap-4 border-t border-white/5 px-6 py-2.5 text-[11px] text-white/35">
                            <span>
                                本页合计：会员积分 {formatCredits(pageTotalVip)} · 永久积分{" "}
                                {formatCredits(pageTotalFor)}
                            </span>
                        </div>
                    )}
                    <Pager
                        page={consumptionPage}
                        total={filteredConsumption.length}
                        onPageChange={setConsumptionPage}
                    />
                </>
            )}

            {/* 流水详情弹窗 */}
            <Dialog open={!!detailLedger} onOpenChange={(open) => !open && setDetailLedger(null)}>
                <DialogContent className="max-h-[80vh] overflow-y-auto border-white/10 bg-[#1a1a1e] text-white no-scrollbar">
                    <DialogClose className="text-white/40 hover:bg-white/10 hover:text-white">
                        <X className="h-4 w-4" />
                    </DialogClose>
                    {detailLedger && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-3 text-white">
                                    <span
                                        className={cn(
                                            "flex h-9 w-9 items-center justify-center rounded-xl",
                                            LEDGER_TYPE_META[detailLedger.type].className,
                                        )}
                                    >
                                        {LEDGER_TYPE_META[detailLedger.type].income ? (
                                            <ArrowDownLeft className="h-5 w-5" />
                                        ) : (
                                            <ArrowUpRight className="h-5 w-5" />
                                        )}
                                    </span>
                                    <span>流水详情</span>
                                </DialogTitle>
                            </DialogHeader>
                            <div className="mt-4">
                                <DetailRow
                                    label="类型"
                                    value={LEDGER_TYPE_META[detailLedger.type].label}
                                />
                                <DetailRow
                                    label="积分变动"
                                    value={`${LEDGER_TYPE_META[detailLedger.type].income ? "+" : "-"
                                        }${formatCredits(Math.abs(detailLedger.amount))}`}
                                />
                                <DetailRow label="成员" value={detailLedger.memberNickname} />
                                <DetailRow
                                    label="成员用户 ID"
                                    value={String(detailLedger.memberUserId)}
                                />
                                <DetailRow label="操作人" value={detailLedger.operatorNickname} />
                                <DetailRow label="业务类型" value={detailLedger.bizType || "-"} />
                                <DetailRow label="业务 ID" value={detailLedger.bizId || "-"} />
                                <DetailRow
                                    label="发生时间"
                                    value={formatTeamTime(detailLedger.createdAt)}
                                />
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </section>
    );
}
