import { IconAlertTriangle } from "@tabler/icons-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "shared/utils/utils";

type GenerationErrorTooltipProps = {
    message: string;
    label?: string;
    className?: string;
};

export const GenerationErrorTooltip = ({
    message,
    label = message,
    className,
}: GenerationErrorTooltipProps) => {
    return (
        <TooltipProvider delayDuration={120}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        className={cn(
                            "nodrag nopan max-w-full cursor-help rounded-lg border border-red-400/25 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-200 shadow-[0_0_18px_rgba(248,113,113,0.12)]",
                            className,
                        )}
                    >
                        <div className="flex min-w-0 items-center justify-center gap-1.5">
                            <IconAlertTriangle size={14} className="shrink-0 text-red-300" />
                            <span className="min-w-0 truncate">{label}</span>
                        </div>
                    </div>
                </TooltipTrigger>
                <TooltipContent
                    side="top"
                    align="center"
                    sideOffset={8}
                    className="max-w-105 whitespace-pre-wrap wrap-break-word border border-red-400/30 bg-[#1b1114] px-3 py-2 text-left text-xs leading-relaxed text-red-50 shadow-[0_18px_60px_rgba(0,0,0,0.45)]"
                >
                    {message}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};
