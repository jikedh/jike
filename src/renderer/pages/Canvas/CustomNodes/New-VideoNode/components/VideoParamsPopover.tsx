import { Volume2, VolumeX } from "lucide-react";
import { useMemo } from "react";
import { cn } from "shared/utils/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { AspectRatioIcon } from "../../ImageNode/components/AspectRatioIcon";
import { PROMPT_PANEL_STYLES } from "../../shared/promptPanelStyles";
import type { VideoModeKey } from "../constants/videoModelCapabilities";
import {
  getVideoParamConfig,
  type VideoParamOption,
  type VideoParamState,
} from "../constants/videoParamConfigs";

type VideoParamsPopoverProps = {
  modelId: string;
  mode: VideoModeKey;
  value: VideoParamState;
  onChange: (value: VideoParamState) => void;
};

const getOptionLabel = (
  options: VideoParamOption[] | undefined,
  value: string | number | undefined,
) => options?.find((option) => option.value === value)?.label;

const optionButtonClass = (active: boolean, className?: string) =>
  cn(
    "rounded-lg border text-xs font-medium transition-all",
    active
      ? "border-[#B43FEB] bg-[#B43FEB]/10 text-[#B43FEB]"
      : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-500 hover:bg-neutral-800 hover:text-neutral-100",
    className,
  );

export const VideoParamsPopover = ({
  modelId,
  mode,
  value,
  onChange,
}: VideoParamsPopoverProps) => {
  const config = getVideoParamConfig(modelId, mode);

  const summary = useMemo(() => {
    const parts: string[] = [];
    const ratio = getOptionLabel(config.aspectRatios, value.aspectRatio);
    const qualityValue =
      config.qualityGroup?.key === "resolution"
        ? value.resolution
        : value.quality;
    const quality = getOptionLabel(config.qualityGroup?.options, qualityValue);
    const generationMode = getOptionLabel(
      config.generationMode?.options,
      value.generationMode,
    );

    if (ratio) parts.push(ratio);
    if (quality) parts.push(quality);
    if (generationMode) parts.push(generationMode);
    if (value.autoDuration) {
      parts.push("自动");
    } else if (value.duration) {
      parts.push(`${value.duration}s`);
    }
    if (config.promptExtend && value.promptExtend) parts.push("改写");

    return parts;
  }, [config, value]);

  const patch = (patchValue: Partial<VideoParamState>) => {
    onChange({ ...value, ...patchValue });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button unstyled className={PROMPT_PANEL_STYLES.paramsButton}>
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate">{summary.join(" | ")}</span>
            {config.audio ? (
              value.generateAudio ? (
                <Volume2 className="h-3.5 w-3.5 shrink-0 text-neutral-300" />
              ) : (
                <VolumeX className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
              )
            ) : null}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-80 border border-neutral-700 bg-neutral-900 p-4 shadow-xl"
      >
        <div className="space-y-5">
          {config.aspectRatios ? (
            <section className="space-y-2">
              <div className="text-xs font-medium text-neutral-300">比例</div>
              <div className="grid grid-cols-5 gap-2">
                {config.aspectRatios.map((option) => {
                  const active = value.aspectRatio === option.value;
                  const isAuto = option.value === "adaptive";

                  return (
                    <button
                      key={String(option.value)}
                      type="button"
                      onClick={() =>
                        patch({ aspectRatio: String(option.value) })
                      }
                      className={optionButtonClass(
                        active,
                        "flex h-[54px] flex-col items-center justify-center gap-1 px-2",
                      )}
                    >
                      {isAuto ? (
                        <span
                          className={cn(
                            "h-3 w-3 rounded-[2px] border",
                            active ? "border-[#B43FEB]" : "border-neutral-400",
                          )}
                        />
                      ) : (
                        <AspectRatioIcon
                          ratio={String(option.value)}
                          size={18}
                          active={active}
                        />
                      )}
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {config.qualityGroup ? (
            <section className="space-y-2">
              <div className="text-xs font-medium text-neutral-300">
                {config.qualityGroup.label}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {config.qualityGroup.options.map((option) => {
                  const active =
                    config.qualityGroup?.key === "resolution"
                      ? value.resolution === option.value
                      : value.quality === option.value;

                  return (
                    <button
                      key={String(option.value)}
                      type="button"
                      onClick={() =>
                        patch(
                          config.qualityGroup?.key === "resolution"
                            ? {
                              resolution: String(option.value),
                              quality: undefined,
                            }
                            : {
                              quality: String(option.value),
                              resolution: undefined,
                            },
                        )
                      }
                      className={optionButtonClass(active, "h-8 px-3")}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {config.generationMode ? (
            <section className="space-y-2">
              <div className="text-xs font-medium text-neutral-300">
                {config.generationMode.label}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {config.generationMode.options.map((option) => {
                  const active = value.generationMode === option.value;

                  return (
                    <button
                      key={String(option.value)}
                      type="button"
                      onClick={() =>
                        patch({
                          generationMode: option.value as "fast" | "pro",
                        })
                      }
                      className={optionButtonClass(active, "h-8 px-3")}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-neutral-300">视频时长</span>
              <span className="font-semibold text-[#B43FEB]">
                {value.autoDuration ? "自动" : `${value.duration}s`}
              </span>
            </div>

            {config.autoDuration ? (
              <label className="flex items-center justify-between rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2">
                <span className="text-xs text-neutral-300">
                  {config.autoDuration.label}
                </span>
                <Switch
                  checked={value.autoDuration ?? false}
                  onCheckedChange={(checked) =>
                    patch({ autoDuration: checked })
                  }
                />
              </label>
            ) : null}

            {config.duration.type === "slider" ? (
              <div className={cn("space-y-2", value.autoDuration && "pointer-events-none opacity-40")}>
                <Slider
                  value={[value.duration]}
                  min={config.duration.min}
                  max={config.duration.max}
                  step={config.duration.step ?? 1}
                  onValueChange={(values) => patch({ duration: values[0] })}
                  className="[&_[data-slot=slider-range]]:bg-[#B43FEB] [&_[data-slot=slider-thumb]]:border-[#B43FEB]"
                />
                <div className="flex justify-between text-[11px] text-neutral-500">
                  <span>{config.duration.min}s</span>
                  <span>{config.duration.max}s</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {config.duration.options.map((option) => {
                  const active = value.duration === Number(option.value);
                  return (
                    <button
                      key={String(option.value)}
                      type="button"
                      onClick={() => patch({ duration: Number(option.value) })}
                      className={optionButtonClass(active, "h-8 px-3")}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {config.audio ? (
            <section className="space-y-2">
              <div className="text-xs font-medium text-neutral-300">
                {config.audio.label}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => patch({ generateAudio: true })}
                  className={optionButtonClass(value.generateAudio, "h-8 px-3")}
                >
                  开启
                </button>
                <button
                  type="button"
                  onClick={() => patch({ generateAudio: false })}
                  className={optionButtonClass(
                    !value.generateAudio,
                    "h-8 px-3",
                  )}
                >
                  关闭
                </button>
              </div>
            </section>
          ) : null}

          {config.webSearch ? (
            <section className="space-y-2">
              <label className="flex items-center justify-between rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2">
                <span className="text-xs text-neutral-300">
                  {config.webSearch.label}
                </span>
                <Switch
                  checked={value.webSearch ?? false}
                  onCheckedChange={(checked) =>
                    patch({ webSearch: checked })
                  }
                />
              </label>
            </section>
          ) : null}

          {config.promptExtend ? (
            <section className="space-y-2">
              <div className="text-xs font-medium text-neutral-300">
                {config.promptExtend.label}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => patch({ promptExtend: true })}
                  className={optionButtonClass(
                    Boolean(value.promptExtend),
                    "h-8 px-3",
                  )}
                >
                  开启
                </button>
                <button
                  type="button"
                  onClick={() => patch({ promptExtend: false })}
                  className={optionButtonClass(!value.promptExtend, "h-8 px-3")}
                >
                  关闭
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
};
