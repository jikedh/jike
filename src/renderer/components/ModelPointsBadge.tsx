import { Zap } from "lucide-react";
import { cn } from "shared/utils/utils";

type ModelPointsBadgeProps = {
  totalPoints: number;
  requiredPoints: number;
  className?: string;
  title?: string;
};

export function ModelPointsBadge({
  totalPoints,
  requiredPoints,
  className,
  title,
}: ModelPointsBadgeProps) {
  const insufficient = totalPoints < requiredPoints;

  return (
    <button
      type="button"
      disabled
      title={title ?? `当前模型生成需要 ${requiredPoints} 积分`}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl px-2 py-2.5 text-white/60 transition-all duration-200",
        insufficient
          ? "bg-red-500/10 text-red-300 ring-1 ring-red-500/20"
          : "hover:bg-white/5 hover:text-white/90",
        className,
      )}
    >
      <Zap className="mb-1 h-4.5 w-4.5" strokeWidth={2} />
      <div
        className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-black shadow-[0_0_12px_rgba(180,63,235,0.5)]",
          insufficient
            ? "bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.35)]"
            : "bg-[#B43FEB] text-white",
        )}
      >
        {requiredPoints}
      </div>
    </button>
  );
}
