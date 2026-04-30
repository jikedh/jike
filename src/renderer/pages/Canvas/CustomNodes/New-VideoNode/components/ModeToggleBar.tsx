import { IconAlertCircle } from "@tabler/icons-react";

import type { ModeState } from "../constants/videoModelCapabilities";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ModeToggleBarProps {
  modeStates: ModeState[];
  activeMode: string;
  onModeChange: (mode: string) => void;
}

export const ModeToggleBar = ({
  modeStates,
  activeMode,
  onModeChange,
}: ModeToggleBarProps) => {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5">
        {modeStates.map((mode) =>
          mode.enabled ? (
            mode.tooltip ? (
              <Tooltip key={mode.key}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onModeChange(mode.key)}
                    className={[
                      "relative h-8 rounded-lg border px-3 text-xs font-medium transition-all",
                      mode.key === activeMode
                        ? "border-[#B43FEB] bg-[#B43FEB]/10 text-[#B43FEB] hover:bg-[#B43FEB]/15 hover:text-[#B43FEB]"
                        : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-500 hover:bg-neutral-800 hover:text-neutral-100",
                    ].join(" ")}
                  >
                    {mode.label}
                    <IconAlertCircle size={12} className="ml-1 opacity-60" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="bg-neutral-800 text-white/80 border border-white/10 text-xs max-w-60"
                >
                  {mode.tooltip}
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                key={mode.key}
                variant="ghost"
                size="sm"
                onClick={() => onModeChange(mode.key)}
                className={[
                  "relative h-8 rounded-lg border px-3 text-xs font-medium transition-all",
                  mode.key === activeMode
                    ? "border-[#B43FEB] bg-[#B43FEB]/10 text-[#B43FEB] hover:bg-[#B43FEB]/15 hover:text-[#B43FEB]"
                    : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-500 hover:bg-neutral-800 hover:text-neutral-100",
                ].join(" ")}
              >
                {mode.label}
              </Button>
            )
          ) : (
            <Tooltip key={mode.key}>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex cursor-not-allowed"
                  tabIndex={0}
                  aria-label={mode.disabledReason ?? `${mode.label}不可用`}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled
                    className="relative h-8 rounded-lg border border-neutral-800 bg-neutral-900 px-3 text-xs font-medium text-neutral-600 cursor-not-allowed opacity-60 pointer-events-none"
                  >
                    {mode.label}
                    <IconAlertCircle size={12} className="ml-1 opacity-60" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-neutral-800 text-white/80 border border-white/10 text-xs max-w-60"
              >
                {mode.disabledReason ?? `${mode.label}当前不可用`}
              </TooltipContent>
            </Tooltip>
          ),
        )}
      </div>
    </TooltipProvider>
  );
};
