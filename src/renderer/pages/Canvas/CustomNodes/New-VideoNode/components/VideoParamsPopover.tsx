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
      ? "border-white bg-white/10 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.16)]"
      : "border-white/[0.08] bg-white/[0.025] text-white/45 hover:border-white/20 hover:bg-white/[0.06] hover:text-white/75",
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

    if (ratio) parts.push(ratio);
    if (quality) parts.push(quality);
    if (value.duration) parts.push(`${value.duration}s`);
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
            <span className="truncate">{summary.join(" · ")}</span>
            {config.audio ? (
              value.generateAudio ? (
                <Volume2 className="h-3.5 w-3.5 shrink-0 text-white/65" />
              ) : (
                <VolumeX className="h-3.5 w-3.5 shrink-0 text-white/35" />
              )
            ) : null}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-[340px] rounded-xl border border-white/[0.08] bg-[#242424] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
      >
        <div className="space-y-4">
          {config.aspectRatios ? (
            <section className="space-y-2">
              <div className="text-xs font-medium text-white/45">比例</div>
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
                            active ? "border-white" : "border-white/35",
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
              <div className="text-xs font-medium text-white/45">
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

          <section className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-white/45">视频时长</span>
              <span className="font-semibold text-white/65">
                {value.duration}s
              </span>
            </div>

            {config.duration.type === "slider" ? (
              <div className="space-y-2">
                <Slider
                  value={[value.duration]}
                  min={config.duration.min}
                  max={config.duration.max}
                  step={config.duration.step ?? 1}
                  onValueChange={(values) => patch({ duration: values[0] })}
                  className="[&_[data-slot=slider-track]]:bg-white/14 [&_[data-slot=slider-range]]:bg-[#2D8CFF] [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:bg-white"
                />
                <div className="flex justify-between text-[11px] text-white/35">
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
              <div className="text-xs font-medium text-white/45">
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

          {config.promptExtend ? (
            <section className="space-y-2">
              <div className="text-xs font-medium text-white/45">
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
