import { Zap } from "lucide-react";
import { POINTS_FEATURE_ENABLED } from "shared/constants/points";
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
  if (!POINTS_FEATURE_ENABLED) {
    return null;
  }

  const insufficient = totalPoints < requiredPoints;

  return (
    <button
      type="button"
      disabled
      title={title ?? `当前模型生成需要 ${requiredPoints} 积分`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold tracking-wide transition-colors",
        insufficient
          ? "border-red-500/20 bg-red-500/10 text-red-300"
          : "border-[#B43FEB]/20 bg-[#B43FEB]/10 text-[#B43FEB]",
        className,
      )}
    >
      <Zap
        className={cn(
          "h-3.5 w-3.5",
          insufficient ? "text-red-300" : "text-[#B43FEB]",
        )}
        strokeWidth={2}
      />
      <span>{requiredPoints}</span>
    </button>
  );
}
