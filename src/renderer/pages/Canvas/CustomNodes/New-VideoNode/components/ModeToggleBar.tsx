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
            <Button
              key={mode.key}
              variant="ghost"
              size="sm"
              onClick={() => onModeChange(mode.key)}
              className={[
                "relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                mode.key === activeMode
                  ? "bg-[#B43FEB]/15 text-[#B43FEB] hover:bg-[#B43FEB]/20 hover:text-[#B43FEB]"
                  : "bg-white/3 text-white/60 hover:bg-white/6 hover:text-white/80",
              ].join(" ")}
            >
              {mode.key === activeMode && (
                <span className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-[#B43FEB]" />
              )}
              {mode.label}
            </Button>
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
                    className="relative px-3 py-1.5 rounded-lg text-xs font-medium bg-white/2 text-white/25 cursor-not-allowed opacity-40 pointer-events-none"
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
