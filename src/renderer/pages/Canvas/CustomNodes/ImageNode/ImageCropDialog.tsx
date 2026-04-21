import { IconX } from "@tabler/icons-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createCroppedImageFile } from "./utils/cropImage";

type CropRatioKey = "free" | "1:1" | "4:3" | "16:9" | "3:4" | "9:16";

type ImageCropDialogProps = {
  open: boolean;
  imageUrl?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (file: File) => Promise<void>;
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
  { value: "free", label: "自由裁剪" },
  { value: "1:1", label: "1:1", aspect: 1 },
  { value: "4:3", label: "4:3", aspect: 4 / 3 },
  { value: "16:9", label: "16:9", aspect: 16 / 9 },
  { value: "3:4", label: "3:4", aspect: 3 / 4 },
  { value: "9:16", label: "9:16", aspect: 9 / 16 },
];

/**
 * 图片裁剪弹窗。
 * 负责展示裁剪面板、切换裁剪比例，并在确认时输出裁剪后的文件。
 */
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

    const [cropRatio, setCropRatio] = useState<CropRatioKey>("free");
    const [freeRatioWidth, setFreeRatioWidth] = useState(1);
    const [freeRatioHeight, setFreeRatioHeight] = useState(1);
    const [imageBounds, setImageBounds] = useState<Rect | null>(null);
    const [cropRect, setCropRect] = useState<Rect | null>(null);
    const [naturalSize, setNaturalSize] = useState<{
      width: number;
      height: number;
    } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectedRatio = useMemo(() => {
      return (
        ratioOptions.find((item) => item.value === cropRatio) ?? ratioOptions[0]
      );
    }, [cropRatio]);

    const aspect = useMemo(() => {
      if (cropRatio === "free") {
        const safeWidth = Math.max(1, freeRatioWidth);
        const safeHeight = Math.max(1, freeRatioHeight);
        return safeWidth / safeHeight;
      }

      return selectedRatio.aspect ?? 1;
    }, [cropRatio, freeRatioHeight, freeRatioWidth, selectedRatio.aspect]);

    const clamp = useCallback(
      (value: number, minValue: number, maxValue: number) => {
        return Math.min(maxValue, Math.max(minValue, value));
      },
      [],
    );

    // 判断两个裁剪矩形是否等价，避免 setState 产生无意义的新对象导致重渲染循环。
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
        const minSize = 24;
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
      const imageRect = imageRef.current.getBoundingClientRect();

      const nextBounds = {
        x: imageRect.left - viewportRect.left,
        y: imageRect.top - viewportRect.top,
        width: imageRect.width,
        height: imageRect.height,
      };

      setImageBounds(nextBounds);
      setNaturalSize({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
      });

      setCropRect((prev) => {
        if (!prev) {
          const initialWidth = nextBounds.width * 0.7;
          const initialHeight = nextBounds.height * 0.7;
          const baseRect = {
            x: nextBounds.width * 0.15,
            y: nextBounds.height * 0.15,
            width: initialWidth,
            height: initialHeight,
          };

          return cropRatio === "free"
            ? baseRect
            : applyAspectToRect(baseRect, nextBounds);
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

        return cropRatio === "free"
          ? scaledRect
          : applyAspectToRect(scaledRect, nextBounds);
      });
    }, [applyAspectToRect, cropRatio, imageBounds?.height, imageBounds?.width]);

    useEffect(() => {
      if (!open) {
        return;
      }

      // 每次打开都重置状态，避免上一次操作残留。
      setCropRatio("free");
      setFreeRatioWidth(1);
      setFreeRatioHeight(1);
      setImageBounds(null);
      setCropRect(null);
      setNaturalSize(null);
      setIsSubmitting(false);
    }, [open, imageUrl]);

    useEffect(() => {
      if (!open) {
        return;
      }

      const handleResize = () => {
        syncImageBounds();
      };

      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }, [open, syncImageBounds]);

    useEffect(() => {
      if (!imageBounds || cropRatio === "free") {
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

    const startDrag = useCallback(
      (mode: DragMode, event: React.PointerEvent<HTMLDivElement>) => {
        if (!cropRect) {
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
      [cropRect],
    );

    const handlePointerUp = useCallback(() => {
      dragRef.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }, []);

    const handlePointerMove = useCallback(
      (event: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag || !imageBounds) {
          return;
        }

        const minSize = 24;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        const start = drag.startRect;
        const mode = drag.mode;

        let nextRect: Rect = { ...start };

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

        // 固定比例时，统一在当前锚点基础上做比例校正。
        if (cropRatio !== "free") {
          const fixed = applyAspectToRect(nextRect, imageBounds);
          nextRect = fixed;
        }

        setCropRect(nextRect);
      },
      [applyAspectToRect, clamp, cropRatio, imageBounds],
    );

    const handleConfirm = useCallback(async () => {
      if (!imageUrl || !cropRect || !imageBounds || !naturalSize) {
        return;
      }

      setIsSubmitting(true);

      try {
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

        await onConfirm(croppedFile);
        onOpenChange(false);
      } catch (error: any) {
        console.error("裁剪确认失败:", error);
      } finally {
        setIsSubmitting(false);
      }
    }, [cropRect, imageBounds, imageUrl, naturalSize, onConfirm, onOpenChange]);

    useEffect(() => {
      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };
    }, [handlePointerMove, handlePointerUp]);

    const handleConfig = useMemo(() => {
      return [
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
    }, []);

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[min(980px,96vw)] max-h-[92vh] overflow-hidden border border-white/5 bg-[#1e1e20] p-0">
          <div className="flex items-start justify-between border-b border-white/8 px-5 py-4">
            <DialogHeader className="space-y-1">
              <DialogTitle>裁剪图片</DialogTitle>
              <DialogDescription>
                选择裁剪比例，拖动图片并调整缩放后，确认生成新的裁剪结果。
              </DialogDescription>
            </DialogHeader>

            <DialogClose className="static rounded-md p-2 text-white/60 hover:bg-white/5 hover:text-white">
              <IconX size={18} />
            </DialogClose>
          </div>

          <div className="space-y-4 px-5 py-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
              <div
                ref={viewportRef}
                className="relative min-h-130 overflow-hidden rounded-xl border border-white/8 bg-black/60"
              >
                {imageUrl ? (
                  <>
                    <img
                      ref={imageRef}
                      src={imageUrl}
                      alt="裁剪预览"
                      className="absolute inset-0 m-auto max-h-full max-w-full select-none"
                      draggable={false}
                      onLoad={syncImageBounds}
                    />

                    {imageBounds && cropRect ? (
                      <div
                        className="absolute border border-[#B43FEB]/70 bg-[#B43FEB]/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
                        style={{
                          left: imageBounds.x + cropRect.x,
                          top: imageBounds.y + cropRect.y,
                          width: cropRect.width,
                          height: cropRect.height,
                        }}
                        onPointerDown={(event) => startDrag("move", event)}
                      >
                        {handleConfig.map((item) => (
                          <div
                            key={item.mode}
                            className={`absolute h-4 w-4 rounded-full border border-white/70 bg-[#B43FEB] ${item.className}`}
                            onPointerDown={(event) =>
                              startDrag(item.mode as DragMode, event)
                            }
                          />
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="flex h-full min-h-130 items-center justify-center text-sm text-white/60">
                    暂无可裁剪图片
                  </div>
                )}
              </div>

              <div className="space-y-4 rounded-xl border border-white/8 bg-[#121214] p-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-white/85">
                    裁剪比例
                  </div>
                  <Select
                    value={cropRatio}
                    onValueChange={(value) =>
                      setCropRatio(value as CropRatioKey)
                    }
                  >
                    <SelectTrigger className="w-full border border-white/10 bg-white/5 text-white/80">
                      <SelectValue placeholder="选择比例" />
                    </SelectTrigger>
                    <SelectContent className="border border-white/10 bg-[#1a1a1d] text-white/80">
                      {ratioOptions.map((item) => (
                        <SelectItem
                          key={item.value}
                          value={item.value}
                          className="cursor-pointer focus:bg-white/10 focus:text-white"
                        >
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {cropRatio === "free" ? (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-white/85">
                      自由比例（宽 : 高）
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={freeRatioWidth}
                        className="h-9 border-white/10 bg-white/[0.03] text-white/90"
                        onChange={(event) => {
                          const nextValue = Number(event.target.value);
                          setFreeRatioWidth(
                            Number.isFinite(nextValue) && nextValue > 0
                              ? Math.round(nextValue)
                              : 1,
                          );
                        }}
                      />
                      <span className="text-sm text-white/40">:</span>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={freeRatioHeight}
                        className="h-9 border-white/10 bg-white/[0.03] text-white/90"
                        onChange={(event) => {
                          const nextValue = Number(event.target.value);
                          setFreeRatioHeight(
                            Number.isFinite(nextValue) && nextValue > 0
                              ? Math.round(nextValue)
                              : 1,
                          );
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-white/60">
                  当前模式：{selectedRatio.label}
                  <br />
                  当前比例：{aspect.toFixed(2)}
                  <br />
                  确认后会生成裁剪文件，并交给画布节点流程创建新的子节点。
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-white/8 bg-[#1e1e20] px-5 py-4">
            <Button
              variant="default"
              size="sm"
              loading={isSubmitting}
              disabled={!imageUrl || !cropRect || !imageBounds || !naturalSize}
              onClick={handleConfirm}
            >
              确认裁剪
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
);

ImageCropDialog.displayName = "ImageCropDialog";
