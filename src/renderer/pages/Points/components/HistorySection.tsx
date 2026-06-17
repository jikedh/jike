import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Gift,
  ImageIcon,
  Loader2,
  ReceiptText,
  RefreshCw,
  Video,
  X,
  Zap,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import type { ScoreRecordItem, ScoreTransactionItem } from "shared/types/jikeing";
import { cn } from "shared/utils/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const formatTime = (timestamp: number) => {
  if (!timestamp) return "-";
  const date = new Date(timestamp * 1000);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const isScoreRecordIncome = (item: ScoreRecordItem): boolean =>
  item.type?.toUpperCase() === "INCOME";

const isIncomeDirection = (direction?: string | null): boolean =>
  direction?.toUpperCase() === "INCOME";

const formatSignedScore = (
  score: number | null | undefined,
  isIncome: boolean,
): string => `${isIncome ? "+" : "-"}${Math.abs(score ?? 0)}`;

const getRecordIcon = (item: ScoreRecordItem): ReactNode => {
  if (item.bizType === "desktop_video" || item.bizType === "video") {
    return <Video className="h-5 w-5" />;
  }
  if (item.bizType === "desktop_image" || item.bizType === "image") {
    return <ImageIcon className="h-5 w-5" />;
  }
  if (isScoreRecordIncome(item)) {
    return <Gift className="h-5 w-5" />;
  }
  return <Zap className="h-5 w-5" />;
};

const getRecordTitle = (item: ScoreRecordItem): string => {
  if (item.sourceLabel) return item.sourceLabel;
  if (item.model) return item.model;
  if (item.memo) return item.memo;
  return item.typeLabel || "积分变动";
};

const getRecordDescription = (item: ScoreRecordItem): string => {
  const parts: string[] = [];
  if (item.model && item.sourceLabel) parts.push(item.model);
  if (item.generateTime) {
    parts.push(`耗时 ${item.generateTime}s`);
  }
  parts.push(formatTime(item.createTime));
  return parts.join(" · ");
};

const getStatusLabel = (item: ScoreRecordItem): string => {
  if (item.ledgerStatusLabel) return item.ledgerStatusLabel;
  if (isScoreRecordIncome(item)) return "已到账";
  return "已完成";
};

// 详情弹窗中的信息行
const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start justify-between gap-4 py-2.5 border-b border-white/5 last:border-b-0">
    <span className="text-xs text-white/40 shrink-0">{label}</span>
    <span className="text-xs text-white/80 text-right break-all">{value}</span>
  </div>
);

// 积分明细详情弹窗
const RecordDetailDialog = ({
  record,
  open,
  onOpenChange,
}: {
  record: ScoreRecordItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  if (!record) return null;

  const isIncome = isScoreRecordIncome(record);
  const amount = formatSignedScore(record.totalScore, isIncome);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1a1e] border-white/10 text-white max-h-[80vh] overflow-y-auto">
        <DialogClose className="text-white/40 hover:text-white hover:bg-white/10">
          <X className="h-4 w-4" />
        </DialogClose>
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-3">
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl",
                isIncome
                  ? "bg-green-500/10 text-green-500"
                  : "bg-blue-500/10 text-blue-500",
              )}
            >
              {getRecordIcon(record)}
            </span>
            <span>{getRecordTitle(record)}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-0">
          <DetailRow label="类型" value={record.typeLabel || record.type || "-"} />
          <DetailRow label="积分变动" value={amount} />
          <DetailRow label="永久积分" value={formatSignedScore(record.forScore, isIncome)} />
          <DetailRow label="会员积分" value={formatSignedScore(record.vipScore, isIncome)} />
          <DetailRow label="永久积分余额" value={String(record.forBalanceScore ?? "-")} />
          <DetailRow label="会员积分余额" value={String(record.vipBalanceScore ?? "-")} />
          <DetailRow label="来源" value={record.sourceLabel || record.source || "-"} />
          <DetailRow label="模型" value={record.model || "-"} />
          <DetailRow label="业务类型" value={record.bizType || "-"} />
          <DetailRow label="业务 ID" value={record.bizId || "-"} />
          <DetailRow label="任务 ID" value={record.taskId || "-"} />
          <DetailRow label="流水状态" value={record.ledgerStatusLabel || record.ledgerStatus || "-"} />
          {record.failReason && (
            <DetailRow label="失败原因" value={record.failReason} />
          )}
          {record.memo && (
            <DetailRow label="备注" value={record.memo} />
          )}
          <DetailRow label="生成耗时" value={record.generateTime ? `${record.generateTime}s` : "-"} />
          <DetailRow label="创建时间" value={formatTime(record.createTime)} />
          <DetailRow label="更新时间" value={formatTime(record.updateTime)} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

// 分页条
const Pagination = ({
  page,
  totalPages,
  loading,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}) => {
  if (totalPages <= 1) return null;

  return (
    <footer className="flex items-center justify-center gap-2 border-t border-white/5 px-5 py-3">
      <Button
        unstyled
        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/5 hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed"
        disabled={page <= 1 || loading}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter((p) => {
          // 显示首尾页 + 当前页附近 2 页
          if (p === 1 || p === totalPages) return true;
          return Math.abs(p - page) <= 2;
        })
        .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
          if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
            acc.push("ellipsis");
          }
          acc.push(p);
          return acc;
        }, [])
        .map((item, idx) =>
          item === "ellipsis" ? (
            <span key={`e-${idx}`} className="px-1 text-xs text-white/20">
              ...
            </span>
          ) : (
            <Button
              key={item}
              unstyled
              className={cn(
                "flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-medium transition-colors",
                item === page
                  ? "bg-[#B43FEB] text-white"
                  : "text-white/40 hover:bg-white/5 hover:text-white/70",
              )}
              disabled={loading}
              onClick={() => onPageChange(item)}
            >
              {item}
            </Button>
          ),
        )}

      <Button
        unstyled
        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/5 hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed"
        disabled={page >= totalPages || loading}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </footer>
  );
};

const UsageHistoryList = ({
  records,
  loading,
  error,
  onRetry,
  onItemClick,
}: {
  records: ScoreRecordItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onItemClick: (item: ScoreRecordItem) => void;
}) => {
  if (loading && records.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-white/40">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-white/40">
        <AlertCircle className="h-8 w-8 text-red-400/60" />
        <p className="text-sm">{error}</p>
        <Button
          unstyled
          className="text-xs text-[#B43FEB] hover:text-[#B43FEB]/80"
          onClick={onRetry}
        >
          重新加载
        </Button>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-white/30">
        <ReceiptText className="h-8 w-8" />
        <p className="text-sm">暂无积分消耗记录</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-white/5">
      {records.map((item) => {
        const isIncome = isScoreRecordIncome(item);
        const amount = formatSignedScore(item.totalScore, isIncome);

        return (
          <li
            key={item.id}
            className="flex items-center justify-between p-5 transition-colors hover:bg-white/[0.02] cursor-pointer"
            onClick={() => onItemClick(item)}
          >
            <article className="flex items-center gap-4">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  isIncome
                    ? "bg-green-500/10 text-green-500"
                    : "bg-blue-500/10 text-blue-500",
                )}
              >
                {getRecordIcon(item)}
              </span>
              <section>
                <h3 className="text-sm font-bold text-white/90">
                  {getRecordTitle(item)}
                </h3>
                <p className="text-[10px] font-mono uppercase tracking-wider text-white/30">
                  {getRecordDescription(item)}
                </p>
              </section>
            </article>
            <p className="text-right">
              <strong
                className={cn(
                  "block text-sm font-black",
                  isIncome ? "text-green-500" : "text-white/90",
                )}
              >
                {amount}
              </strong>
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-widest",
                  item.ledgerStatus === "refunded"
                    ? "text-orange-400/80"
                    : "text-green-500/80",
                )}
              >
                {getStatusLabel(item)}
              </span>
            </p>
          </li>
        );
      })}
    </ul>
  );
};

const getTransactionIcon = (item: ScoreTransactionItem): ReactNode => {
  switch (item.transactionType) {
    case "recharge":
      return <CreditCard className="h-5 w-5" />;
    case "daily_checkin":
      return <Gift className="h-5 w-5" />;
    case "refund":
      return <RefreshCw className="h-5 w-5" />;
    case "consume":
      if (item.bizType === "desktop_video" || item.bizType === "video") {
        return <Video className="h-5 w-5" />;
      }
      if (item.bizType === "desktop_image" || item.bizType === "image") {
        return <ImageIcon className="h-5 w-5" />;
      }
      return <Zap className="h-5 w-5" />;
    case "admin_adjust":
      return isIncomeDirection(item.direction) ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />;
    default:
      return isIncomeDirection(item.direction) ? <Gift className="h-5 w-5" /> : <Zap className="h-5 w-5" />;
  }
};

const getTransactionTitle = (item: ScoreTransactionItem): string => {
  if (item.transactionTypeLabel) return item.transactionTypeLabel;
  if (item.sourceLabel) return item.sourceLabel;
  return item.memo || "积分变动";
};

const getTransactionDescription = (item: ScoreTransactionItem): string => {
  const parts: string[] = [];
  if (item.amountText && item.transactionType === "recharge") {
    parts.push(item.amountText);
  }
  if (item.model) parts.push(item.model);
  if (item.orderStatusLabel && item.transactionType === "recharge") {
    parts.push(item.orderStatusLabel);
  }
  parts.push(formatTime(item.occurredAt || item.createTime));
  return parts.join(" · ");
};

const formatAmountFen = (amountFen: number | null | undefined): string => {
  if (amountFen == null) return "";
  return `¥${(amountFen / 100).toFixed(2)}`;
};

const TransactionDetailDialog = ({
  record,
  open,
  onOpenChange,
}: {
  record: ScoreTransactionItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  if (!record) return null;

  const isIncome = isIncomeDirection(record.direction);
  const scoreText = isIncome
    ? `+${Math.abs(record.totalScore)}`
    : `-${Math.abs(record.totalScore)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1a1e] border-white/10 text-white max-h-[80vh] overflow-y-auto">
        <DialogClose className="text-white/40 hover:text-white hover:bg-white/10">
          <X className="h-4 w-4" />
        </DialogClose>
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-3">
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl",
                isIncome
                  ? "bg-green-500/10 text-green-500"
                  : "bg-blue-500/10 text-blue-500",
              )}
            >
              {getTransactionIcon(record)}
            </span>
            <span>{getTransactionTitle(record)}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-0">
          <DetailRow label="类型" value={record.transactionTypeLabel || record.transactionType || "-"} />
          <DetailRow label="积分变动" value={scoreText} />
          <DetailRow label="永久积分" value={`${isIncome ? "+" : "-"}${Math.abs(record.forScore)}`} />
          <DetailRow label="会员积分" value={`${isIncome ? "+" : "-"}${Math.abs(record.vipScore)}`} />
          <DetailRow label="永久积分余额" value={String(record.forBalanceScore ?? "-")} />
          <DetailRow label="会员积分余额" value={String(record.vipBalanceScore ?? "-")} />
          <DetailRow label="来源" value={record.sourceLabel || record.source || "-"} />
          {record.amountFen != null && (
            <DetailRow label="支付金额" value={formatAmountFen(record.amountFen)} />
          )}
          {record.orderId && (
            <DetailRow label="订单号" value={record.orderId} />
          )}
          {record.packageId && (
            <DetailRow label="套餐 ID" value={record.packageId} />
          )}
          {record.orderStatus && (
            <DetailRow label="订单状态" value={record.orderStatusLabel || record.orderStatus} />
          )}
          {record.model && (
            <DetailRow label="模型" value={record.model} />
          )}
          {record.bizType && (
            <DetailRow label="业务类型" value={record.bizType} />
          )}
          {record.bizId && (
            <DetailRow label="业务 ID" value={record.bizId} />
          )}
          {record.taskId && (
            <DetailRow label="任务 ID" value={record.taskId} />
          )}
          {record.ledgerStatus && (
            <DetailRow label="流水状态" value={record.ledgerStatusLabel || record.ledgerStatus} />
          )}
          {record.failReason && (
            <DetailRow label="失败/退款原因" value={record.failReason} />
          )}
          {record.memo && (
            <DetailRow label="备注" value={record.memo} />
          )}
          {record.paidTime > 0 && (
            <DetailRow label="支付时间" value={formatTime(record.paidTime)} />
          )}
          <DetailRow label="发生时间" value={formatTime(record.occurredAt)} />
          <DetailRow label="创建时间" value={formatTime(record.createTime)} />
          {record.updateTime > 0 && (
            <DetailRow label="更新时间" value={formatTime(record.updateTime)} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const TransactionHistoryList = ({
  transactions,
  loading,
  error,
  onRetry,
  onItemClick,
}: {
  transactions: ScoreTransactionItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onItemClick: (item: ScoreTransactionItem) => void;
}) => {
  if (loading && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-white/40">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-white/40">
        <AlertCircle className="h-8 w-8 text-red-400/60" />
        <p className="text-sm">{error}</p>
        <Button
          unstyled
          className="text-xs text-[#B43FEB] hover:text-[#B43FEB]/80"
          onClick={onRetry}
        >
          重新加载
        </Button>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-white/30">
        <ReceiptText className="h-8 w-8" />
        <p className="text-sm">暂无充值消费记录</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-white/5">
      {transactions.map((item) => {
        const isIncome = isIncomeDirection(item.direction);
        const scoreText = isIncome
          ? `+${Math.abs(item.totalScore)}`
          : `-${Math.abs(item.totalScore)}`;

        return (
          <li
            key={item.id}
            className="flex items-center justify-between p-5 transition-colors hover:bg-white/2 cursor-pointer"
            onClick={() => onItemClick(item)}
          >
            <article className="flex items-center gap-4">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  isIncome
                    ? "bg-green-500/10 text-green-500"
                    : "bg-blue-500/10 text-blue-500",
                )}
              >
                {getTransactionIcon(item)}
              </span>
              <section>
                <h3 className="text-sm font-bold text-white/90">
                  {getTransactionTitle(item)}
                </h3>
                <p className="text-[10px] font-mono uppercase tracking-wider text-white/30">
                  {getTransactionDescription(item)}
                </p>
              </section>
            </article>
            <p className="text-right">
              <strong
                className={cn(
                  "block text-sm font-black",
                  isIncome ? "text-green-500" : "text-white/90",
                )}
              >
                {scoreText}
              </strong>
              {item.amountFen != null && item.transactionType === "recharge" && (
                <span className="text-[10px] font-bold text-white/40">
                  {formatAmountFen(item.amountFen)}
                </span>
              )}
              {!item.amountFen && (
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-widest",
                    item.transactionType === "refund"
                      ? "text-orange-400/80"
                      : isIncome
                        ? "text-green-500/80"
                        : "text-blue-400/80",
                  )}
                >
                  {item.orderStatusLabel || item.ledgerStatusLabel || item.transactionTypeLabel || ""}
                </span>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
};

type HistorySectionProps = {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  records: ScoreRecordItem[];
  transactions: ScoreTransactionItem[];
  page: number;
  transactionsPage: number;
  total: number;
  transactionsTotal: number;
  loading: boolean;
  transactionsLoading: boolean;
  error: string | null;
  transactionsError: string | null;
  onPageChange: (page: number) => void;
  onTransactionPageChange: (page: number) => void;
  onRetry: () => void;
  onTransactionRetry: () => void;
};

export const HistorySection = (props: HistorySectionProps) => {
  const {
    activeTab,
    onTabChange,
    records,
    transactions,
    page,
    transactionsPage,
    total,
    transactionsTotal,
    loading,
    transactionsLoading,
    error,
    transactionsError,
    onPageChange,
    onTransactionPageChange,
    onRetry,
    onTransactionRetry,
  } = props;
  const pageSize = 10;
  const totalPages = Math.ceil(total / pageSize);
  const transactionsTotalPages = Math.ceil(transactionsTotal / pageSize);

  // 积分消耗明细详情弹窗状态
  const [detailRecord, setDetailRecord] = useState<ScoreRecordItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // 充值消费明细详情弹窗状态
  const [txDetailRecord, setTxDetailRecord] = useState<ScoreTransactionItem | null>(null);
  const [txDetailOpen, setTxDetailOpen] = useState(false);

  const handleItemClick = (item: ScoreRecordItem) => {
    setDetailRecord(item);
    setDetailOpen(true);
  };

  const handleTxItemClick = (item: ScoreTransactionItem) => {
    setTxDetailRecord(item);
    setTxDetailOpen(true);
  };

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between border-b border-white/5">
        <nav className="flex gap-8">
          {/* <TabButton
            active={activeTab === "usage"}
            icon={<ReceiptText className="h-4 w-4" />}
            label="积分消耗明细"
            onClick={() => onTabChange("usage")}
          /> */}
          <TabButton
            active={activeTab === "transaction"}
            icon={<CreditCard className="h-4 w-4" />}
            label="充值消费明细"
            onClick={() => onTabChange("transaction")}
          />
        </nav>
      </header>

      <article className="overflow-hidden rounded-[24px] border border-white/5 bg-[#121214]">
        {activeTab === "usage" ? (
          <>
            <UsageHistoryList
              records={records}
              loading={loading}
              error={error}
              onRetry={onRetry}
              onItemClick={handleItemClick}
            />
            <Pagination
              page={page}
              totalPages={totalPages}
              loading={loading}
              onPageChange={onPageChange}
            />
          </>
        ) : (
          <>
            <TransactionHistoryList
              transactions={transactions}
              loading={transactionsLoading}
              error={transactionsError}
              onRetry={onTransactionRetry}
              onItemClick={handleTxItemClick}
            />
            <Pagination
              page={transactionsPage}
              totalPages={transactionsTotalPages}
              loading={transactionsLoading}
              onPageChange={onTransactionPageChange}
            />
          </>
        )}
      </article>

      <RecordDetailDialog
        record={detailRecord}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
      <TransactionDetailDialog
        record={txDetailRecord}
        open={txDetailOpen}
        onOpenChange={setTxDetailOpen}
      />
    </section>
  );
};
