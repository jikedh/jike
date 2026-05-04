import { cn } from "shared/utils/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const GPTIMAGE2_SIZES = [
  { label: "1:1", value: "1:1", description: "Square" },
  { label: "3:2", value: "3:2", description: "Landscape" },
  { label: "2:3", value: "2:3", description: "Portrait" },
  { label: "4:3", value: "4:3", description: "Classic" },
  { label: "3:4", value: "3:4", description: "Vertical" },
  { label: "16:9", value: "16:9", description: "Wide" },
  { label: "9:16", value: "9:16", description: "Story" },
  { label: "21:9", value: "21:9", description: "Cinema" },
  { label: "5:4", value: "5:4", description: "Landscape" },
  { label: "4:5", value: "4:5", description: "Portrait" },
];

type GptImage2ParamsPanelProps = {
  size: string;
  resolution: string;
  onSizeChange: (value: string) => void;
  onResolutionChange: (value: string) => void;
};

export const GptImage2ParamsPanel = ({
  size,
  resolution,
  onSizeChange,
  onResolutionChange,
}: GptImage2ParamsPanelProps) => {
  const currentSizeLabel =
    GPTIMAGE2_SIZES.find((item) => item.value === size)?.label ?? size;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          unstyled
          className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-100"
        >
          <span>{currentSizeLabel}</span>
          <span className="text-neutral-500">/</span>
          <span>{resolution}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-auto border border-neutral-700 bg-neutral-900 p-3 shadow-xl"
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-300">
              Resolution
            </label>
            <div className="flex gap-2">
              {["1K", "2K", "4K"].map((res) => {
                const isActive = resolution === res;
                return (
                  <button
                    key={res}
                    type="button"
                    onClick={() => onResolutionChange(res)}
                    className={cn(
                      "flex items-center rounded-md border px-3 py-1.5 text-xs transition-all",
                      isActive
                        ? "border-[#B43FEB] bg-[#B43FEB]/10 text-[#B43FEB]"
                        : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-500",
                    )}
                  >
                    {res}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-300">
              Aspect ratio
            </label>
            <div className="grid grid-cols-3 gap-2">
              {GPTIMAGE2_SIZES.map((item) => {
                const isActive = size === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onSizeChange(item.value)}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-lg border p-2.5 transition-all",
                      isActive
                        ? "border-[#B43FEB] bg-[#B43FEB]/10"
                        : "border-neutral-700 bg-neutral-800 hover:border-neutral-500",
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isActive ? "text-[#B43FEB]" : "text-neutral-300",
                      )}
                    >
                      {item.label}
                    </span>
                    <span
                      className={cn(
                        "text-[10px]",
                        isActive ? "text-[#B43FEB]/70" : "text-neutral-500",
                      )}
                    >
                      {item.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
