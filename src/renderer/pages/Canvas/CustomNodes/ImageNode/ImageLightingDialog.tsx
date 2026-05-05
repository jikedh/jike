import {
  IconCheck,
  IconChevronDown,
  IconPalette,
  IconRotateClockwise,
  IconSun,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "shared/utils/utils";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_LIGHTING_CONFIG,
  disposeLightingRenderer,
  getLightingConfigFromPoint,
  getLightingPoint,
  LIGHTING_PRESETS,
  type LightingConfig,
  loadLightingImage,
  renderLightingToCanvas,
} from "./utils/lighting";

type ImageLightingDialogProps = {
  open: boolean;
  imageUrl?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (config: LightingConfig) => Promise<void>;
};

type SliderControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
};

const SliderControl = ({
  label,
  value,
  min,
  max,
  suffix = "",
  onChange,
}: SliderControlProps) => (
  <label className="grid gap-2">
    <span className="flex items-center justify-between text-xs text-white/58">
      <span>{label}</span>
      <span className="font-mono text-white/78">
        {value}
        {suffix}
      </span>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-1.5 w-full cursor-pointer accent-[#B43FEB]"
    />
  </label>
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const ImageLightingDialog = ({
  open,
  imageUrl,
  onOpenChange,
  onConfirm,
}: ImageLightingDialogProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lightPlaneRef = useRef<HTMLDivElement | null>(null);
  const renderedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewImage, setPreviewImage] = useState<HTMLImageElement | null>(
    null,
  );
  const [config, setConfig] = useState<LightingConfig>(
    DEFAULT_LIGHTING_CONFIG,
  );
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const [isRotatingImage, setIsRotatingImage] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setConfig(DEFAULT_LIGHTING_CONFIG);
    setPresetMenuOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open || !imageUrl) {
      setPreviewImage(null);
      return;
    }

    let cancelled = false;
    setIsLoadingImage(true);
    setLoadError(null);
    setPreviewImage(null);

    loadLightingImage(imageUrl)
      .then((image) => {
        if (cancelled) {
          return;
        }
        setPreviewImage(image);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        console.error("灯光预览图片加载失败:", error);
        setLoadError("图片加载失败，无法进行本地灯光处理");
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingImage(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [imageUrl, open]);

  useEffect(() => {
    if (!open || !canvasRef.current || !previewImage) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      if (!canvasRef.current) {
        return;
      }

      try {
        renderedCanvasRef.current = canvasRef.current;
        renderLightingToCanvas(previewImage, config, canvasRef.current, {
          maxSide: 900,
        });
      } catch (error) {
        console.error("灯光预览渲染失败:", error);
        setLoadError("灯光预览渲染失败");
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [config, open, previewImage]);

  useEffect(() => {
    if (open) {
      return;
    }

    if (renderedCanvasRef.current) {
      disposeLightingRenderer(renderedCanvasRef.current);
      renderedCanvasRef.current = null;
    }
  }, [open]);

  useEffect(
    () => () => {
      if (renderedCanvasRef.current) {
        disposeLightingRenderer(renderedCanvasRef.current);
      }
    },
    [],
  );

  const lightPoint = useMemo(() => getLightingPoint(config), [config]);
  const selectedPreset = useMemo(() => {
    return LIGHTING_PRESETS.find(
      (preset) => preset.presetId === config.presetId,
    );
  }, [config.presetId]);

  const updateConfig = useCallback((patch: Partial<LightingConfig>) => {
    setConfig((current) => ({
      ...current,
      ...patch,
      presetId: patch.presetId ?? "custom",
    }));
  }, []);

  const updateLightPoint = useCallback((clientX: number, clientY: number) => {
    const rect = lightPlaneRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const point = {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
    setConfig((current) => getLightingConfigFromPoint(current, point));
  }, []);

  const handleLightPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const rect = lightPlaneRef.current?.getBoundingClientRect();
      const offset = rect
        ? {
            x: event.clientX - (rect.left + lightPoint.x * rect.width),
            y: event.clientY - (rect.top + lightPoint.y * rect.height),
          }
        : { x: 0, y: 0 };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        updateLightPoint(
          moveEvent.clientX - offset.x,
          moveEvent.clientY - offset.y,
        );
      };

      const stopDragging = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", stopDragging);
        window.removeEventListener("pointercancel", stopDragging);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", stopDragging);
      window.addEventListener("pointercancel", stopDragging);
    },
    [lightPoint, updateLightPoint],
  );

  const handleImageRotationPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startRotationY = config.rotationY ?? 0;
      setIsRotatingImage(true);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const nextRotationY = clamp(startRotationY + deltaX * 0.25, -60, 60);
        setConfig((current) => ({
          ...current,
          presetId: "custom",
          rotationY: Math.round(nextRotationY),
        }));
      };

      const stopDragging = () => {
        setIsRotatingImage(false);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", stopDragging);
        window.removeEventListener("pointercancel", stopDragging);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", stopDragging);
      window.addEventListener("pointercancel", stopDragging);
    },
    [config.rotationY],
  );

  const handleConfirm = useCallback(async () => {
    if (!imageUrl || isSaving || isLoadingImage || loadError) {
      return;
    }

    setIsSaving(true);
    try {
      await onConfirm(config);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  }, [
    config,
    imageUrl,
    isLoadingImage,
    isSaving,
    loadError,
    onConfirm,
    onOpenChange,
  ]);

  const canSave = Boolean(imageUrl) && !isLoadingImage && !loadError;

  if (!open) {
    return null;
  }

  const content = (
    <div className="fixed inset-0 z-[80] overflow-hidden bg-[radial-gradient(circle_at_50%_30%,rgba(92,34,163,0.08)_0%,rgba(11,11,14,0.14)_28%,rgba(6,6,8,0.66)_100%)] backdrop-blur-[3px]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.01)_18%,rgba(0,0,0,0)_34%,rgba(0,0,0,0.2)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(0,0,0,0.42)_0%,rgba(0,0,0,0)_100%)]" />
      <div className="absolute inset-0 flex flex-col items-center justify-start gap-4 px-8 pt-6 pb-8">
        <div className="relative z-[90] flex max-w-[calc(100vw-32px)] flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#1f1f22]/95 px-3 py-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-transparent bg-white/[0.04] text-white/75 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSaving}
            onClick={() => {
              if (!isSaving) {
                onOpenChange(false);
              }
            }}
            title="取消"
            aria-label="取消"
          >
            <IconX size={18} />
          </button>

          <div className="h-8 w-px bg-white/10" />

          <div className="relative">
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-3 text-sm font-medium text-white/85 transition hover:bg-white/[0.08]"
              onClick={() => setPresetMenuOpen((prev) => !prev)}
            >
              <IconSun size={17} />
              {selectedPreset?.name ?? "自定义光影"}
              <IconChevronDown size={15} className="text-white/45" />
            </button>

            {presetMenuOpen ? (
              <div className="absolute left-0 top-[calc(100%+8px)] z-[220] grid max-h-[360px] w-72 grid-cols-2 gap-1.5 overflow-y-auto rounded-2xl border border-white/10 bg-[#252528]/98 p-1.5 shadow-[0_22px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                {LIGHTING_PRESETS.map((preset) => {
                  const active = preset.presetId === config.presetId;
                  return (
                    <button
                      key={preset.presetId}
                      type="button"
                      className={cn(
                        "rounded-xl px-2.5 py-2 text-left transition",
                        active
                          ? "bg-white/[0.08] text-white"
                          : "text-white/62 hover:bg-white/[0.06] hover:text-white",
                      )}
                      onClick={() => {
                        setConfig(preset);
                        setPresetMenuOpen(false);
                      }}
                    >
                      <span className="block text-xs font-medium">
                        {preset.name}
                      </span>
                      <span className="mt-1 block text-[10px] leading-snug text-white/40">
                        {preset.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="h-8 w-px bg-white/10" />

          <div className="flex items-center gap-1 rounded-xl border border-white/8 bg-white/[0.04] p-1">
            {(["soft", "hard"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => updateConfig({ lightType: type })}
                className={cn(
                  "h-8 rounded-lg px-3 text-xs font-medium transition",
                  config.lightType === type
                    ? "bg-white text-black"
                    : "text-white/62 hover:bg-white/[0.07] hover:text-white",
                )}
              >
                {type === "soft" ? "柔光" : "硬光"}
              </button>
            ))}
          </div>

          <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-3 text-sm text-white/82">
            <IconPalette size={16} className="text-white/50" />
            <input
              type="color"
              value={config.color}
              onChange={(event) => updateConfig({ color: event.target.value })}
              className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
              aria-label="灯光颜色"
            />
            <span className="font-mono text-xs text-white/60">
              {config.color.toUpperCase()}
            </span>
          </label>

          <div className="h-8 w-px bg-white/10" />

          <button
            type="button"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.04] px-3 text-sm font-medium text-white/75 transition hover:bg-white/[0.08] hover:text-white"
            onClick={() => setConfig(DEFAULT_LIGHTING_CONFIG)}
          >
            <IconRotateClockwise size={16} />
            重置
          </button>

          <Button
            type="button"
            size="sm"
            className="h-10 rounded-xl bg-white px-5 text-sm font-semibold text-black hover:bg-white/90"
            loading={isSaving}
            disabled={!canSave}
            onClick={handleConfirm}
          >
            <span className="inline-flex items-center gap-1.5">
              <IconCheck size={16} />
              确认
            </span>
          </Button>
        </div>

        <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-[28px]">
          <div className="relative">
            <div className="pointer-events-none absolute inset-[-26px] rounded-[36px] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12)_0%,rgba(180,63,235,0.08)_20%,rgba(180,63,235,0.03)_40%,rgba(0,0,0,0)_72%)] blur-2xl" />
            <div
              className="relative flex h-[calc(100vh-150px)] w-[min(1180px,86vw)] flex-col rounded-[24px] border border-white/10 bg-[#111113] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.52),0_0_0_1px_rgba(255,255,255,0.04)]"
            >
              <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[18px] bg-black/25">
                {isLoadingImage ? (
                  <div className="text-sm text-white/50">加载预览中...</div>
                ) : loadError ? (
                  <div className="max-w-80 text-center text-sm text-red-300/90">
                    {loadError}
                  </div>
                ) : imageUrl ? (
                  <div
                    ref={lightPlaneRef}
                    className={cn(
                      "relative inline-flex max-h-full max-w-full",
                      isRotatingImage ? "cursor-grabbing" : "cursor-grab",
                    )}
                    title="左右拖动图片调整 Y 轴旋转"
                    onPointerDown={handleImageRotationPointerDown}
                  >
                    <canvas
                      ref={canvasRef}
                      className="block max-h-full max-w-full select-none rounded-lg shadow-[0_22px_70px_rgba(0,0,0,0.42)]"
                    />
                    <button
                      type="button"
                      aria-label="拖拽光源位置"
                      onPointerDown={handleLightPointerDown}
                      className="absolute z-10 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-white shadow-[0_0_22px_rgba(255,255,255,0.78),0_0_42px_rgba(180,63,235,0.34)] transition-transform hover:scale-110"
                      style={{
                        left: `${lightPoint.x * 100}%`,
                        top: `${lightPoint.y * 100}%`,
                      }}
                    >
                      <span
                        className="block size-full rounded-full"
                        style={{ backgroundColor: config.color }}
                      />
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-white/50">暂无可处理图片</div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-4 gap-3 rounded-2xl border border-white/8 bg-white/[0.035] p-4">
                <SliderControl
                  label="Y轴旋转"
                  value={config.rotationY ?? 0}
                  min={-60}
                  max={60}
                  suffix="°"
                  onChange={(value) => updateConfig({ rotationY: value })}
                />
                <SliderControl
                  label="光源水平"
                  value={config.horizontalAngle}
                  min={-110}
                  max={110}
                  suffix="°"
                  onChange={(value) => updateConfig({ horizontalAngle: value })}
                />
                <SliderControl
                  label="光源俯仰"
                  value={config.pitchAngle}
                  min={-70}
                  max={70}
                  suffix="°"
                  onChange={(value) => updateConfig({ pitchAngle: value })}
                />
                <SliderControl
                  label="灯光强度"
                  value={config.intensity}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(value) => updateConfig({ intensity: value })}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
