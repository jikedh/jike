import { CircleHelp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

import { getImageModelHelp } from "../constants/imageModelHelp";

type ImageModelHelpTooltipProps = {
    modelId: string;
};

export const ImageModelHelpTooltip = ({
    modelId,
}: ImageModelHelpTooltipProps) => {
    const help = getImageModelHelp(modelId);

    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="nodrag nopan nowheel size-7 shrink-0 rounded-full p-0 text-white/45 hover:bg-white/10 hover:text-white/80"
                        aria-label="查看当前模型的参考素材说明"
                    >
                        <CircleHelp />
                    </Button>
                </TooltipTrigger>
                <TooltipContent
                    side="top"
                    align="start"
                    sideOffset={8}
                    className="nodrag nopan nowheel w-80 max-w-[calc(100vw-24px)] whitespace-pre-line rounded-xl border border-white/10 bg-[#18181b] p-4 text-left text-xs leading-5 text-white/75 shadow-xl"
                >
                    {help}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};
