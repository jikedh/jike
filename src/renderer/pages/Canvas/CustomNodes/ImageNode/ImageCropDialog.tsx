import {
  IconArrowsMaximize,
  IconAspectRatio,
  IconCheck,
  IconChevronDown,
  IconColorSwatch,
  IconPhoto,
  IconX,
} from "@tabler/icons-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "shared/utils/utils";
import {
  createCroppedImageFile,
  createExpandedImageFile,
  getExpandedCanvasSize,
} from "./utils/cropImage";

type CropRatioKey =
  | "original"
  | "custom"
  | "1:1"
  | "4:3"
  | "16:9"
  | "21:9"
  | "3:4"
  | "9:16";

type ImageCropDialogProps = {
  open: boolean;
  imageUrl?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (file: File, cropRatio: string) => Promise<void>;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DragMode = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const ratioOptions: Array<{
  value: CropRatioKey;
  label: string;
  aspect?: number;
}> = [
  { value: "original", label: "原图比例" },
  { value: "custom", label: "自定义" },
  { value: "1:1", label: "1:1", aspect: 1 },
  { value: "4:3", label: "4:3", aspect: 4 / 3 },
  { value: "16:9", label: "16:9", aspect: 16 / 9 },
  { value: "21:9", label: "21:9", aspect: 21 / 9 },
  { value: "3:4", label: "3:4", aspect: 3 / 4 },
  { value: "9:16", label: "9:16", aspect: 9 / 16 },
];

const HANDLE_CONFIG = [
  { mode: "nw", className: "-left-2 -top-2 cursor-nwse-resize" },
  {
    mode: "n",
    className: "left-1/2 -top-2 -translate-x-1/2 cursor-ns-resize",
  },
  { mode: "ne", className: "-right-2 -top-2 cursor-nesw-resize" },
  {
    mode: "e",
    className: "-right-2 top-1/2 -translate-y-1/2 cursor-ew-resize",
  },
  { mode: "se", className: "-right-2 -bottom-2 cursor-nwse-resize" },
  {
    mode: "s",
    className: "left-1/2 -bottom-2 -translate-x-1/2 cursor-ns-resize",
  },
  { mode: "sw", className: "-left-2 -bottom-2 cursor-nesw-resize" },
  {
    mode: "w",
    className: "-left-2 top-1/2 -translate-y-1/2 cursor-ew-resize",
  },
] as const;

const DEFAULT_EXPAND_BACKGROUND = "#ffffff";

export const ImageCropDialog = memo(
  ({ open, imageUrl, onOpenChange, onConfirm }: ImageCropDialogProps) => {
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const dragRef = useRef<{
      mode: DragMode;
      startX: number;
      startY: number;
      startRect: Rect;
    } | null>(null);

    const [cropRatio, setCropRatio] = useState<CropRatioKey>("original");
    const [ratioMenuOpen, setRatioMenuOpen] = useState(false);
    const [imageBounds, setImageBounds] = useState<Rect | null>(null);
    const [cropRect, setCropRect] = useState<Rect | null>(null);
    const [naturalSize, setNaturalSize] = useState<{
      width: number;
      height: number;
    } | null>(null);
    const [viewportSize, setViewportSize] = useState<{
      width: number;
      height: number;
    } | null>(null);
    const [expandMode, setExpandMode] = useState(false);
    const [expandBackground, setExpandBackground] = useState(
      DEFAULT_EXPAND_BACKGROUND,
    );
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectedRatio = useMemo(() => {
      return (
        ratioOptions.find((item) => item.value === cropRatio) ??
        ratioOptions[0]
      );
    }, [cropRatio]);

    const aspect = useMemo(() => {
      if (cropRatio === "custom") {
        return null;
      }

      if (cropRatio === "original") {
        if (naturalSize?.width && naturalSize?.height) {
          return naturalSize.width / naturalSize.height;
        }
        return 1;
      }

      return selectedRatio.aspect ?? 1;
    }, [cropRatio, naturalSize?.height, naturalSize?.width, selectedRatio]);

    const expandTargetAspect = useMemo(() => {
      if (cropRatio === "custom" && cropRect?.width && cropRect.height) {
        return cropRect.width / cropRect.height;
      }

      if (aspect) {
        return aspect;
      }

      if (naturalSize?.width && naturalSize.height) {
        return naturalSize.width / naturalSize.height;
      }

      return 1;
    }, [aspect, cropRatio, cropRect, naturalSize?.height, naturalSize?.width]);

    const clamp = useCallback(
      (value: number, minValue: number, maxValue: number) => {
        return Math.min(maxValue, Math.max(minValue, value));
      },
      [],
    );

    const isRectEqual = useCallback((a: Rect, b: Rect) => {
      const epsilon = 0.01;
      return (
        Math.abs(a.x - b.x) < epsilon &&
        Math.abs(a.y - b.y) < epsilon &&
        Math.abs(a.width - b.width) < epsilon &&
        Math.abs(a.height - b.height) < epsilon
      );
    }, []);

    const applyAspectToRect = useCallback(
      (rect: Rect, bounds: Rect) => {
        const minSize = 36;
        if (!aspect) {
          const width = clamp(rect.width, minSize, bounds.width);
          const height = clamp(rect.height, minSize, bounds.height);
          return {
            x: clamp(rect.x, 0, bounds.width - width),
            y: clamp(rect.y, 0, bounds.height - height),
            width,
            height,
          };
        }

        const safeAspect = Math.max(0.1, aspect);

        let width = clamp(rect.width, minSize, bounds.width);
        let height = width / safeAspect;

        if (height > bounds.height) {
          height = bounds.height;
          width = height * safeAspect;
        }

        width = Math.max(minSize, width);
        height = Math.max(minSize, height);

        const x = clamp(rect.x, 0, bounds.width - width);
        const y = clamp(rect.y, 0, bounds.height - height);

        return { x, y, width, height };
      },
      [aspect, clamp],
    );

    const syncImageBounds = useCallback(() => {
      if (!viewportRef.current || !imageRef.current) {
        return;
      }

      const viewportRect = viewportRef.current.getBoundingClientRect();
      setViewportSize({
        width: viewportRect.width,
        height: viewportRect.height,
      });
      setNaturalSize({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
      });

      if (expandMode) {
        return;
      }

      const imageRect = imageRef.current.getBoundingClientRect();
      const nextBounds = {
        x: imageRect.left - viewportRect.left,
        y: imageRect.top - viewportRect.top,
        width: imageRect.width,
        height: imageRect.height,
      };

      setImageBounds(nextBounds);
      setCropRect((prev) => {
        if (!prev) {
          const baseRect = {
            x: nextBounds.width * 0.08,
            y: nextBounds.height * 0.08,
            width: nextBounds.width * 0.84,
            height: nextBounds.height * 0.84,
          };
          return applyAspectToRect(baseRect, nextBounds);
        }

        const scaledRect = {
          x:
            (prev.x / (imageBounds?.width || prev.width || 1)) *
            nextBounds.width,
          y:
            (prev.y / (imageBounds?.height || prev.height || 1)) *
            nextBounds.height,
          width:
            (prev.width / (imageBounds?.width || prev.width || 1)) *
            nextBounds.width,
          height:
            (prev.height / (imageBounds?.height || prev.height || 1)) *
            nextBounds.height,
        };

        return applyAspectToRect(scaledRect, nextBounds);
      });
    }, [
      applyAspectToRect,
      expandMode,
      imageBounds?.height,
      imageBounds?.width,
    ]);

    useEffect(() => {
      if (!open) {
        return;
      }

      setCropRatio("original");
      setRatioMenuOpen(false);
      setImageBounds(null);
      setCropRect(null);
      setNaturalSize(null);
      setViewportSize(null);
      setExpandMode(false);
      setExpandBackground(DEFAULT_EXPAND_BACKGROUND);
      setIsSubmitting(false);
    }, [open, imageUrl]);

    useEffect(() => {
      if (!open) {
        return;
      }

      const handleResize = () => syncImageBounds();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, [open, syncImageBounds]);

    useEffect(() => {
      if (!open || expandMode) {
        return;
      }

      const frame = window.requestAnimationFrame(syncImageBounds);
      return () => window.cancelAnimationFrame(frame);
    }, [expandMode, open, syncImageBounds]);

    useEffect(() => {
      if (!imageBounds) {
        return;
      }

      setCropRect((prev) => {
        if (!prev) {
          return prev;
        }

        const nextRect = applyAspectToRect(prev, imageBounds);
        return isRectEqual(prev, nextRect) ? prev : nextRect;
      });
    }, [applyAspectToRect, cropRatio, imageBounds, isRectEqual]);

    const handlePointerMove = useCallback(
      (event: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag || !imageBounds) {
          return;
        }

        const minSize = 36;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        const start = drag.startRect;
        const mode = drag.mode;
        let nextRect: Rect = { ...start };

        if (expandMode) {
          return;
        }

        if (mode === "move") {
          nextRect.x = clamp(start.x + dx, 0, imageBounds.width - start.width);
          nextRect.y = clamp(
            start.y + dy,
            0,
            imageBounds.height - start.height,
          );
          setCropRect(nextRect);
          return;
        }

        setCropRatio("custom");

        if (mode.includes("e")) {
          nextRect.width = clamp(
            start.width + dx,
            minSize,
            imageBounds.width - start.x,
          );
        }
        if (mode.includes("s")) {
          nextRect.height = clamp(
            start.height + dy,
            minSize,
            imageBounds.height - start.y,
          );
        }
        if (mode.includes("w")) {
          const nextX = clamp(start.x + dx, 0, start.x + start.width - minSize);
          nextRect.width = start.width - (nextX - start.x);
          nextRect.x = nextX;
        }
        if (mode.includes("n")) {
          const nextY = clamp(
            start.y + dy,
            0,
            start.y + start.height - minSize,
          );
          nextRect.height = start.height - (nextY - start.y);
          nextRect.y = nextY;
        }

        setCropRect({
          x: clamp(nextRect.x, 0, imageBounds.width - nextRect.width),
          y: clamp(nextRect.y, 0, imageBounds.height - nextRect.height),
          width: clamp(nextRect.width, minSize, imageBounds.width),
          height: clamp(nextRect.height, minSize, imageBounds.height),
        });
      },
      [clamp, expandMode, imageBounds],
    );

    const handlePointerUp = useCallback(() => {
      dragRef.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }, [handlePointerMove]);

    const startDrag = useCallback(
      (mode: DragMode, event: React.PointerEvent<HTMLDivElement>) => {
        if (!cropRect || expandMode) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        dragRef.current = {
          mode,
          startX: event.clientX,
          startY: event.clientY,
          startRect: cropRect,
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
      },
      [cropRect, expandMode, handlePointerMove, handlePointerUp],
    );

    const handleConfirm = useCallback(async () => {
      if (!imageUrl || !naturalSize) {
        return;
      }

      setIsSubmitting(true);

      try {
        if (expandMode) {
          const expandedFile = await createExpandedImageFile(
            imageUrl,
            expandTargetAspect,
            expandBackground,
            `expanded-${Date.now()}.png`,
          );
          await onConfirm(
            expandedFile,
            cropRatio === "custom" ? "original" : selectedRatio.value,
          );
          onOpenChange(false);
          return;
        }

        if (!cropRect || !imageBounds) {
          return;
        }

        const scaleX = naturalSize.width / imageBounds.width;
        const scaleY = naturalSize.height / imageBounds.height;
        const croppedFile = await createCroppedImageFile(
          imageUrl,
          {
            x: cropRect.x * scaleX,
            y: cropRect.y * scaleY,
            width: cropRect.width * scaleX,
            height: cropRect.height * scaleY,
          },
          `cropped-${Date.now()}.png`,
        );

        await onConfirm(croppedFile, selectedRatio.value);
        onOpenChange(false);
      } catch (error) {
        console.error("裁剪确认失败:", error);
      } finally {
        setIsSubmitting(false);
      }
    }, [
      cropRect,
      cropRatio,
      expandBackground,
      expandMode,
      expandTargetAspect,
      imageBounds,
      imageUrl,
      naturalSize,
      onConfirm,
      onOpenChange,
      selectedRatio.value,
    ]);

    useEffect(() => {
      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };
    }, [handlePointerMove, handlePointerUp]);

    if (!open) {
      return null;
    }

    const expandedPreview =
      expandMode && naturalSize && viewportSize
        ? (() => {
            const canvasSize = getExpandedCanvasSize(
              naturalSize.width,
              naturalSize.height,
              expandTargetAspect,
            );
            const maxWidth = Math.max(1, viewportSize.width - 48);
            const maxHeight = Math.max(1, viewportSize.height - 48);
            const scale = Math.min(
              maxWidth / canvasSize.width,
              maxHeight / canvasSize.height,
              1,
            );
            const canvasWidth = canvasSize.width * scale;
            const canvasHeight = canvasSize.height * scale;
            const canvasX = (viewportSize.width - canvasWidth) / 2;
            const canvasY = (viewportSize.height - canvasHeight) / 2;
            const imageWidth = naturalSize.width * scale;
            const imageHeight = naturalSize.height * scale;

            return {
              canvas: {
                x: canvasX,
                y: canvasY,
                width: canvasWidth,
                height: canvasHeight,
              },
              image: {
                x: canvasX + (canvasWidth - imageWidth) / 2,
                y: canvasY + (canvasHeight - imageHeight) / 2,
                width: imageWidth,
                height: imageHeight,
              },
            };
          })()
        : null;

    const content = (
      <div
        data-slot="dialog-content"
        className="fixed inset-0 z-[80] overflow-hidden bg-[radial-gradient(circle_at_50%_30%,rgba(92,34,163,0.08)_0%,rgba(11,11,14,0.14)_28%,rgba(6,6,8,0.66)_100%)] backdrop-blur-[3px]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.01)_18%,rgba(0,0,0,0)_34%,rgba(0,0,0,0.2)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(0,0,0,0.42)_0%,rgba(0,0,0,0)_100%)]" />
        <div className="absolute inset-0 flex flex-col items-center justify-start gap-4 px-8 pt-6 pb-8">
          <div className="relative z-[90] flex items-center gap-2 rounded-2xl border border-white/10 bg-[#1f1f22]/95 px-3 py-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-transparent bg-white/[0.04] text-white/75 transition hover:bg-white/[0.08] hover:text-white"
              onClick={() => onOpenChange(false)}
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
                onClick={() => setRatioMenuOpen((prev) => !prev)}
              >
                <IconAspectRatio size={17} />
                {selectedRatio.label}
                <IconChevronDown size={15} className="text-white/45" />
              </button>

              {ratioMenuOpen ? (
                <div className="absolute left-0 top-[calc(100%+8px)] z-[220] w-36 rounded-2xl border border-white/10 bg-[#252528]/98 p-1.5 shadow-[0_22px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                  {ratioOptions.map((item) => {
                    const active = item.value === cropRatio;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        className={cn(
                          "flex h-9 w-full items-center gap-2 rounded-xl px-2.5 text-left text-sm transition",
                          active
                            ? "bg-white/[0.08] text-white"
                            : "text-white/62 hover:bg-white/[0.06] hover:text-white",
                        )}
                        onClick={() => {
                          setCropRatio(item.value);
                          setRatioMenuOpen(false);
                        }}
                      >
                        <IconPhoto size={15} className="text-white/45" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="h-8 w-px bg-white/10" />

            <div className="flex h-10 items-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-3">
              <IconArrowsMaximize size={17} className="text-white/55" />
              <span className="text-sm font-medium text-white/82">图片扩比</span>
              <Switch
                checked={expandMode}
                onCheckedChange={setExpandMode}
                className="h-5 w-9 data-[state=checked]:bg-white/80 data-[state=unchecked]:bg-white/15"
                aria-label="图片扩比"
              />
            </div>

            {expandMode ? (
              <label className="flex h-10 items-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-3">
                <IconColorSwatch size={17} className="text-white/55" />
                <span className="text-sm font-medium text-white/75">背景</span>
                <span
                  className="h-5 w-5 rounded-md border border-white/20 shadow-inner"
                  style={{ backgroundColor: expandBackground }}
                />
                <input
                  type="color"
                  value={expandBackground}
                  onChange={(event) => setExpandBackground(event.target.value)}
                  className="h-6 w-6 cursor-pointer opacity-0"
                  aria-label="扩比背景颜色"
                />
              </label>
            ) : null}

            <div className="h-8 w-px bg-white/10" />

            <Button
              type="button"
              size="sm"
              className="h-10 rounded-xl bg-white px-5 text-sm font-semibold text-black hover:bg-white/90"
              loading={isSubmitting}
              disabled={
                !imageUrl ||
                !naturalSize ||
                (!expandMode && (!cropRect || !imageBounds))
              }
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
                ref={viewportRef}
                className="relative flex h-[calc(100vh-150px)] w-[min(1180px,86vw)] items-center justify-center rounded-[24px] border border-white/10 bg-[#111113] shadow-[0_30px_100px_rgba(0,0,0,0.52),0_0_0_1px_rgba(255,255,255,0.04)]"
              >
                {imageUrl ? (
                  <>
                    {expandedPreview ? (
                      <div
                        className="pointer-events-none absolute rounded-sm border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
                        style={{
                          left: expandedPreview.canvas.x,
                          top: expandedPreview.canvas.y,
                          width: expandedPreview.canvas.width,
                          height: expandedPreview.canvas.height,
                          backgroundColor: expandBackground,
                          boxShadow: "0 0 0 9999px rgba(0,0,0,0.48)",
                        }}
                      />
                    ) : null}
                    <img
                      ref={imageRef}
                      src={imageUrl}
                      alt="裁剪预览"
                      className={cn(
                        "select-none object-contain",
                        expandedPreview
                          ? "absolute z-[1]"
                          : "max-h-full max-w-full",
                      )}
                      style={
                        expandedPreview
                          ? {
                              left: expandedPreview.image.x,
                              top: expandedPreview.image.y,
                              width: expandedPreview.image.width,
                              height: expandedPreview.image.height,
                            }
                          : undefined
                      }
                      draggable={false}
                      onLoad={syncImageBounds}
                    />

                    {imageBounds && cropRect && !expandMode ? (
                      <>
                        <div
                          className="pointer-events-none absolute"
                          style={{
                            left: imageBounds.x,
                            top: imageBounds.y,
                            width: imageBounds.width,
                            height: imageBounds.height,
                            boxShadow: "0 0 0 9999px rgba(0,0,0,0.48)",
                          }}
                        />
                        <div
                          className="absolute cursor-move border-2 border-white bg-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
                          style={{
                            left: imageBounds.x + cropRect.x,
                            top: imageBounds.y + cropRect.y,
                            width: cropRect.width,
                            height: cropRect.height,
                          }}
                          onPointerDown={(event) => startDrag("move", event)}
                        >
                          <div className="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-white/35" />
                          <div className="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-white/35" />
                          <div className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-white/35" />
                          <div className="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-white/35" />
                          {HANDLE_CONFIG.map((item) => (
                            <div
                              key={item.mode}
                              className={cn(
                                "absolute h-4 w-4 rounded-full border border-white bg-[#B43FEB] shadow-[0_4px_14px_rgba(180,63,235,0.35)]",
                                item.className,
                              )}
                              onPointerDown={(event) =>
                                startDrag(item.mode as DragMode, event)
                              }
                            />
                          ))}
                        </div>
                      </>
                    ) : null}
                  </>
                ) : (
                  <div className="text-sm text-white/55">暂无可裁剪图片</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );

    return createPortal(content, document.body);
  },
);

ImageCropDialog.displayName = "ImageCropDialog";
