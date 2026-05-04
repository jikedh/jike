import { cn } from "shared/utils/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AspectRatioIcon } from "./AspectRatioIcon";

export type ImageParamOption = {
  label: string;
  value: string;
  description?: string;
};

type ImageParamsPopoverProps = {
  size: string;
  resolution?: string;
  sizeOptions: ImageParamOption[];
  resolutionOptions?: ImageParamOption[];
  sizeLabel?: string;
  resolutionLabel?: string;
  onSizeChange: (value: string) => void;
  onResolutionChange?: (value: string) => void;
};

export const ImageParamsPopover = ({
  size,
  resolution,
  sizeOptions,
  resolutionOptions,
  sizeLabel = "图片比例",
  resolutionLabel = "分辨率",
  onSizeChange,
  onResolutionChange,
}: ImageParamsPopoverProps) => {
  const currentSizeLabel =
    sizeOptions.find((item) => item.value === size)?.label ?? size;
  const showResolution =
    Boolean(resolution) &&
    Boolean(onResolutionChange) &&
    Boolean(resolutionOptions?.length);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          unstyled
          className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-xs text-white/72 transition-colors hover:border-[#B43FEB]/45 hover:bg-white/[0.06] hover:text-white"
        >
          <AspectRatioIcon ratio={size} size={16} />
          <span>{currentSizeLabel}</span>
          {resolution ? (
            <>
              <span className="text-white/28">/</span>
              <span>{resolution}</span>
            </>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={10}
        className="w-[390px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#121214] p-0 text-white shadow-[0_18px_48px_rgba(0,0,0,0.42)]"
      >
        <div className="border-b border-white/[0.06] bg-[#18181b] px-4 py-3">
          <div className="text-xs font-semibold text-white/86">生成参数</div>
          <div className="mt-0.5 text-[11px] text-white/38">
            {currentSizeLabel}
            {resolution ? ` · ${resolution}` : ""}
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <div className="text-xs font-medium text-white/68">{sizeLabel}</div>
            <div className="grid grid-cols-5 gap-2">
              {sizeOptions.map((item) => {
                const isActive = size === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onSizeChange(item.value)}
                    className={cn(
                      "flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border p-2 transition-all",
                      isActive
                        ? "border-[#B43FEB] bg-[#B43FEB]/12 shadow-[0_0_20px_rgba(180,63,235,0.18)]"
                        : "border-white/[0.07] bg-white/[0.03] hover:border-[#B43FEB]/35 hover:bg-white/[0.06]",
                    )}
                    title={item.description}
                  >
                    <AspectRatioIcon
                      ratio={item.value}
                      size={24}
                      active={isActive}
                    />
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        isActive ? "text-[#e9c8ff]" : "text-white/48",
                      )}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {showResolution ? (
            <div className="space-y-2">
              <div className="text-xs font-medium text-white/68">
                {resolutionLabel}
              </div>
              <div className="flex gap-2">
                {resolutionOptions?.map((item) => {
                  const isActive = resolution === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => onResolutionChange?.(item.value)}
                      className={cn(
                        "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-2 transition-all",
                        isActive
                          ? "border-[#B43FEB] bg-[#B43FEB]/12 text-[#e9c8ff] shadow-[0_0_20px_rgba(180,63,235,0.18)]"
                          : "border-white/[0.07] bg-white/[0.03] text-white/66 hover:border-[#B43FEB]/35 hover:bg-white/[0.06] hover:text-white",
                      )}
                      title={item.description}
                    >
                      <span className="text-xs font-semibold">
                        {item.label}
                      </span>
                      {item.description ? (
                        <span className="text-[10px] text-white/36">
                          {item.description}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
};
