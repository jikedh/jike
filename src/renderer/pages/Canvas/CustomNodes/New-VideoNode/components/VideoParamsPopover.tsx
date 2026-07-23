import { AlertCircle, Volume2, VolumeX } from "lucide-react";
import { useMemo } from "react";
import { cn } from "shared/utils/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// Agnes-Video-V2.0 在通用参数面板里集中暴露的可选参数。
// 这些控件与其他模型的 aspectRatios / audio / promptExtend 一样
// 通过 VideoParamsPopover 渲染；用户 @ 提及的 "图片N" 在
// buildAgnesRequest 中按 referenceItems 顺序替换为真实 URL。
const AGNES_NUM_FRAMES_PRESETS: VideoParamOption[] = [
  { label: "81 帧 · 约 3 秒", value: 81 },
  { label: "121 帧 · 约 5 秒", value: 121 },
  { label: "161 帧 · 约 7 秒", value: 161 },
  { label: "241 帧 · 约 10 秒", value: 241 },
  { label: "441 帧 · 约 18 秒", value: 441 },
];

const AGNES_FRAME_RATE_PRESETS: VideoParamOption[] = [
  { label: "12 fps", value: 12 },
  { label: "24 fps", value: 24 },
  { label: "30 fps", value: 30 },
  { label: "60 fps", value: 60 },
];

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

const FIELD_LABEL_CLASS = "text-xs font-medium text-neutral-300";
const FIELD_HINT_CLASS = "text-[10px] text-white/35";
const FIELD_ERROR_CLASS =
  "flex items-center gap-1 text-[10px] text-red-300";

const numFramesErrorMessage = (value: number) => {
  if (!Number.isFinite(value)) return "请输入数字";
  if (value <= 0) return "帧数必须大于 0";
  if (value > 441) return "num_frames 必须 ≤ 441";
  if ((value - 1) % 8 !== 0) return "num_frames 必须满足 8n + 1";
  return null;
};

const frameRateErrorMessage = (value: number) => {
  if (!Number.isFinite(value)) return "请输入数字";
  if (value < 1 || value > 60) return "frame_rate 取值范围为 1-60";
  return null;
};

type AgnesAdvancedParamsProps = {
  value: VideoParamState;
  onChange: (value: VideoParamState) => void;
};

const AgnesAdvancedParams = ({ value, onChange }: AgnesAdvancedParamsProps) => {
  const numFrames = value.agnesNumFrames ?? 121;
  const frameRate = value.agnesFrameRate ?? 24;
  const seedValue = value.agnesSeed;
  const negativePrompt = value.agnesNegativePrompt ?? "";

  const numFramesError = numFramesErrorMessage(numFrames);
  const frameRateError = frameRateErrorMessage(frameRate);
  const hasError = Boolean(numFramesError || frameRateError);

  const patch = (partial: Partial<VideoParamState>) => {
    onChange({ ...value, ...partial });
  };

  return (
    <div className="space-y-4 rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between">
        <span className={cn(FIELD_LABEL_CLASS, "text-[#B43FEB]")}>
          Agnes 高级参数
        </span>
        <span className={FIELD_HINT_CLASS}>
          在输入框 @ 图片 1 / 图片 2 即可引用参考图
        </span>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={FIELD_LABEL_CLASS}>帧数 (num_frames)</span>
          <span className={FIELD_HINT_CLASS}>≤ 441 且 8n + 1</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {AGNES_NUM_FRAMES_PRESETS.map((preset) => {
            const active = numFrames === Number(preset.value);
            return (
              <button
                key={String(preset.value)}
                type="button"
                onClick={() => patch({ agnesNumFrames: Number(preset.value) })}
                className={optionButtonClass(active, "h-7 px-2 text-[11px]")}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <Input
          type="number"
          min={1}
          max={441}
          step={1}
          value={numFrames}
          onChange={(e) =>
            patch({ agnesNumFrames: Number(e.target.value) || 0 })
          }
          className="h-7"
        />
        {numFramesError ? (
          <span className={FIELD_ERROR_CLASS}>
            <AlertCircle className="size-3" />
            {numFramesError}
          </span>
        ) : (
          <span className={FIELD_HINT_CLASS}>
            预计时长 ≈ {(numFrames / Math.max(1, frameRate)).toFixed(2)} 秒
          </span>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={FIELD_LABEL_CLASS}>帧率 (frame_rate)</span>
          <span className={FIELD_HINT_CLASS}>1 ~ 60</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {AGNES_FRAME_RATE_PRESETS.map((preset) => {
            const active = frameRate === Number(preset.value);
            return (
              <button
                key={String(preset.value)}
                type="button"
                onClick={() => patch({ agnesFrameRate: Number(preset.value) })}
                className={optionButtonClass(active, "h-7 px-2 text-[11px]")}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <Input
          type="number"
          min={1}
          max={60}
          step={1}
          value={frameRate}
          onChange={(e) =>
            patch({ agnesFrameRate: Number(e.target.value) || 24 })
          }
          className="h-7"
        />
        {frameRateError ? (
          <span className={FIELD_ERROR_CLASS}>
            <AlertCircle className="size-3" />
            {frameRateError}
          </span>
        ) : null}
      </section>

      {/* <section className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={FIELD_LABEL_CLASS}>随机种子 (seed)</span>
          <button
            type="button"
            onClick={() => patch({ agnesSeed: undefined })}
            className={cn(FIELD_HINT_CLASS, "hover:text-white/70")}
          >
            清除
          </button>
        </div>
        <Input
          type="number"
          value={Number.isFinite(seedValue) ? (seedValue as number) : ""}
          placeholder="留空使用随机种子"
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (!raw) {
              patch({ agnesSeed: undefined });
              return;
            }
            const parsed = Number(raw);
            patch({ agnesSeed: Number.isFinite(parsed) ? parsed : undefined });
          }}
          className="h-7"
        />
        <span className={FIELD_HINT_CLASS}>设置固定值可复现生成结果</span>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={FIELD_LABEL_CLASS}>负向提示词 (negative_prompt)</span>
          <span className={FIELD_HINT_CLASS}>可选</span>
        </div>
        <textarea
          value={negativePrompt}
          onChange={(e) => patch({ agnesNegativePrompt: e.target.value })}
          placeholder="例：blurry, low quality, distorted face"
          rows={2}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-xs text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-[#B43FEB]/60 disabled:opacity-50"
        />
      </section> */}

      {hasError ? (
        <div className="flex items-start gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-300">
          <AlertCircle className="mt-0.5 size-3 shrink-0" />
          <span>Agnes 参数不合法，已自动恢复默认值，请修正后再提交。</span>
        </div>
      ) : null}
    </div>
  );
};

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
    if (modelId === "agnes-video-v2.0") {
      if (value.agnesNumFrames) {
        parts.push(`${value.agnesNumFrames}f`);
      }
      if (value.agnesFrameRate) {
        parts.push(`${value.agnesFrameRate}fps`);
      }
      if (typeof value.agnesSeed === "number") {
        parts.push(`seed ${value.agnesSeed}`);
      }
      if (value.agnesNegativePrompt?.trim()) {
        parts.push("负向");
      }
    }

    return parts;
  }, [config, value, modelId]);

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
                          generationMode: option.value as
                            | "fast"
                            | "mini"
                            | "pro",
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

          {modelId === "agnes-video-v2.0" ? (
            <AgnesAdvancedParams value={value} onChange={onChange} />
          ) : null}

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
