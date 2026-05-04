import { IconCheck, IconGridDots, IconX } from "@tabler/icons-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "shared/utils/utils";
import { createCroppedImageFile } from "./utils/cropImage";

type GridPreset = {
  label: string;
  rows: number;
  cols: number;
};

type GridCell = {
  row: number;
  col: number;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ImageGridCropDialogProps = {
  open: boolean;
  imageUrl?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (files: File[]) => Promise<void>;
};

const GRID_PRESETS: GridPreset[] = [
  { label: "2x2", rows: 2, cols: 2 },
  { label: "3x3", rows: 3, cols: 3 },
  { label: "4x4", rows: 4, cols: 4 },
  { label: "5x5", rows: 5, cols: 5 },
  { label: "6x6", rows: 6, cols: 6 },
  { label: "7x7", rows: 7, cols: 7 },
];

const getViewportSize = () => {
  if (typeof window === "undefined") {
    return { width: 1280, height: 720 };
  }
  return { width: window.innerWidth, height: window.innerHeight };
};

const cellKey = (cell: GridCell) => `${cell.row}-${cell.col}`;

const getSelectedRatio = (selectedCount: number, totalCount: number) => {
  if (totalCount <= 0) {
    return "未检测";
  }
  return `检测到 ${totalCount} 个宫格，已选中 ${selectedCount} 个`;
};

const getFittedImageFrame = ({
  imageRatio,
  maxWidth,
  maxHeight,
}: {
  imageRatio: number;
  maxWidth: number;
  maxHeight: number;
}) => {
  const safeRatio =
    Number.isFinite(imageRatio) && imageRatio > 0 ? imageRatio : 16 / 9;
  let width = maxWidth;
  let height = width / safeRatio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * safeRatio;
  }

  const minWidth = 240;
  if (width < minWidth && minWidth <= maxWidth) {
    width = minWidth;
    height = width / safeRatio;
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
};

export const ImageGridCropDialog = memo(
  ({ open, imageUrl, onOpenChange, onConfirm }: ImageGridCropDialogProps) => {
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const [viewportSize, setViewportSize] = useState(getViewportSize);
    const [rows, setRows] = useState(3);
    const [cols, setCols] = useState(3);
    const [gap, setGap] = useState(0);
    const [selectedCells, setSelectedCells] = useState<Set<string>>(
      () => new Set(),
    );
    const [imageBounds, setImageBounds] = useState<Rect | null>(null);
    const [naturalSize, setNaturalSize] = useState<{
      width: number;
      height: number;
    } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const totalCells = rows * cols;
    const isAllSelected =
      totalCells > 0 && selectedCells.size === totalCells;

    const workspaceFrame = useMemo(() => {
      const maxWidth = Math.min(viewportSize.width - 160, 980);
      const maxHeight = Math.min(viewportSize.height - 260, 620);
      const imageRatio =
        naturalSize?.width && naturalSize?.height
          ? naturalSize.width / naturalSize.height
          : 16 / 9;

      return getFittedImageFrame({
        imageRatio,
        maxWidth,
        maxHeight,
      });
    }, [
      naturalSize?.height,
      naturalSize?.width,
      viewportSize.height,
      viewportSize.width,
    ]);

    const dialogWidth = useMemo(
      () =>
        Math.min(viewportSize.width - 48, Math.max(980, workspaceFrame.width + 120)),
      [viewportSize.width, workspaceFrame.width],
    );

    const gridCells = useMemo(() => {
      return Array.from({ length: totalCells }, (_, index) => ({
        row: Math.floor(index / cols),
        col: index % cols,
      }));
    }, [cols, totalCells]);

    const syncImageBounds = useCallback(() => {
      if (!viewportRef.current || !imageRef.current) {
        return;
      }

      const viewportRect = viewportRef.current.getBoundingClientRect();
      const imageRect = imageRef.current.getBoundingClientRect();
      setImageBounds({
        x: imageRect.left - viewportRect.left,
        y: imageRect.top - viewportRect.top,
        width: imageRect.width,
        height: imageRect.height,
      });
      setNaturalSize({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
      });
    }, []);

    useEffect(() => {
      if (!open) {
        return;
      }

      setRows(3);
      setCols(3);
      setGap(0);
      setSelectedCells(new Set());
      setImageBounds(null);
      setNaturalSize(null);
      setIsSubmitting(false);
    }, [imageUrl, open]);

    useEffect(() => {
      if (!open) {
        return;
      }

      const handleResize = () => {
        setViewportSize(getViewportSize());
        window.requestAnimationFrame(syncImageBounds);
      };

      handleResize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, [open, syncImageBounds]);

    useEffect(() => {
      if (!open || !naturalSize) {
        return;
      }

      const frameId = window.requestAnimationFrame(syncImageBounds);
      return () => window.cancelAnimationFrame(frameId);
    }, [
      naturalSize,
      open,
      syncImageBounds,
      workspaceFrame.height,
      workspaceFrame.width,
    ]);

    const toggleCell = useCallback((cell: GridCell) => {
      const key = cellKey(cell);
      setSelectedCells((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
    }, []);

    const handleSelectAll = useCallback(() => {
      if (isAllSelected) {
        setSelectedCells(new Set());
        return;
      }

      setSelectedCells(new Set(gridCells.map(cellKey)));
    }, [gridCells, isAllSelected]);

    const handlePresetChange = useCallback((preset: GridPreset) => {
      setRows(preset.rows);
      setCols(preset.cols);
      setSelectedCells(new Set());
    }, []);

    const handleConfirm = useCallback(async () => {
      if (
        !imageUrl ||
        !imageBounds ||
        !naturalSize ||
        selectedCells.size === 0
      ) {
        return;
      }

      setIsSubmitting(true);

      try {
        const scaleX = naturalSize.width / imageBounds.width;
        const scaleY = naturalSize.height / imageBounds.height;
        const displayGapX = Math.min(
          Math.max(gap, 0),
          imageBounds.width / Math.max(cols, 1) / 2,
        );
        const displayGapY = Math.min(
          Math.max(gap, 0),
          imageBounds.height / Math.max(rows, 1) / 2,
        );
        const cellWidth =
          (imageBounds.width - displayGapX * Math.max(cols - 1, 0)) / cols;
        const cellHeight =
          (imageBounds.height - displayGapY * Math.max(rows - 1, 0)) / rows;
        const selectedList = gridCells.filter((cell) =>
          selectedCells.has(cellKey(cell)),
        );

        const files = await Promise.all(
          selectedList.map((cell, index) =>
            createCroppedImageFile(
              imageUrl,
              {
                x: (cell.col * (cellWidth + displayGapX)) * scaleX,
                y: (cell.row * (cellHeight + displayGapY)) * scaleY,
                width: cellWidth * scaleX,
                height: cellHeight * scaleY,
              },
              `grid-crop-${cell.row + 1}-${cell.col + 1}-${Date.now()}-${index}.png`,
            ),
          ),
        );

        await onConfirm(files);
        onOpenChange(false);
      } catch (error) {
        console.error("宫格裁剪失败:", error);
      } finally {
        setIsSubmitting(false);
      }
    }, [
      cols,
      gap,
      gridCells,
      imageBounds,
      imageUrl,
      naturalSize,
      onConfirm,
      onOpenChange,
      rows,
      selectedCells,
    ]);

    return (
      <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onOpenChange(false)}>
        <DialogContent
          className="flex max-h-[92vh] w-auto max-w-[96vw] flex-col overflow-hidden border border-white/10 bg-[#121214] p-0 text-white"
          style={{ width: `${dialogWidth}px` }}
        >
          <DialogHeader className="shrink-0 border-b border-white/5 bg-[#18181b] px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-2 text-base font-semibold text-white">
                <IconGridDots size={18} />
                宫格裁剪
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-9 rounded-lg border border-white/10 bg-transparent px-3 text-xs text-white/80 hover:bg-white/5 hover:text-white"
                  onClick={handleSelectAll}
                >
                  {isAllSelected ? "取消全选" : "全选"}
                </Button>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-white/55 transition hover:bg-white/5 hover:text-white"
                  onClick={() => onOpenChange(false)}
                  aria-label="关闭"
                >
                  <IconX size={18} />
                </button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col bg-[#101012]">
            <div className="flex min-h-0 flex-1 items-center justify-center p-6">
              <div
                ref={viewportRef}
                className="relative flex items-center justify-center overflow-hidden rounded-lg border border-white/8 bg-black"
                style={{
                  width: `${workspaceFrame.width}px`,
                  height: `${workspaceFrame.height}px`,
                }}
              >
                {imageUrl ? (
                  <>
                    <img
                      ref={imageRef}
                      src={imageUrl}
                      alt="宫格裁剪预览"
                      className="h-full w-full select-none object-fill"
                      draggable={false}
                      onLoad={syncImageBounds}
                    />

                    {imageBounds ? (
                      <div
                        className="absolute overflow-hidden"
                        style={{
                          left: imageBounds.x,
                          top: imageBounds.y,
                          width: imageBounds.width,
                          height: imageBounds.height,
                        }}
                      >
                        <div
                          className="grid h-full w-full"
                          style={{
                            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
                            gap: `${Math.max(gap, 0)}px`,
                          }}
                        >
                          {gridCells.map((cell, index) => {
                            const key = cellKey(cell);
                            const selected = selectedCells.has(key);
                            return (
                              <button
                                key={key}
                                type="button"
                                className={cn(
                                  "group relative overflow-hidden border border-white/28 bg-black/42 text-left transition",
                                  selected
                                    ? "border-[#B43FEB] bg-[#B43FEB]/22 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.7),0_0_28px_rgba(180,63,235,0.42)]"
                                    : "hover:border-white/70 hover:bg-white/10",
                                )}
                                onClick={() => toggleCell(cell)}
                              >
                                <span
                                  className={cn(
                                    "absolute left-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-semibold",
                                    selected
                                      ? "bg-[#B43FEB] text-white"
                                      : "bg-white/24 text-white/88",
                                  )}
                                >
                                  {index + 1}
                                </span>
                                {selected ? (
                                  <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#B43FEB]">
                                    <IconCheck size={15} />
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="text-sm text-white/55">暂无可裁剪图片</div>
                )}

                <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-[#181825]/92 px-6 py-3 text-center shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
                  <div className="text-sm font-semibold text-white">
                    {getSelectedRatio(selectedCells.size, totalCells)}
                  </div>
                  <div className="mt-1 text-xs text-white/50">
                    点击宫格进行选择/取消
                  </div>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-4 border-t border-white/5 bg-[#18181b] px-6 py-4">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm text-white/62">
                <span className="mr-1">手动网格:</span>
                {GRID_PRESETS.map((preset) => {
                  const active = rows === preset.rows && cols === preset.cols;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      className={cn(
                        "h-9 rounded-lg border px-3 text-sm font-semibold transition",
                        active
                          ? "border-[#B43FEB]/70 bg-[#B43FEB]/18 text-white"
                          : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.07] hover:text-white",
                      )}
                      onClick={() => handlePresetChange(preset)}
                    >
                      {preset.label}
                    </button>
                  );
                })}
                <span className="ml-2">自定义:</span>
                <NumberInput value={cols} onChange={setCols} />
                <span className="text-white/35">×</span>
                <NumberInput value={rows} onChange={setRows} />
                <span className="ml-2">间距:</span>
                <NumberInput value={gap} onChange={setGap} min={0} max={80} />
                <span className="text-xs text-white/35">px</span>
              </div>

              <div className="ml-auto flex shrink-0 items-center justify-end gap-3">
                <Button
                  type="button"
                  className="min-w-22 border border-white/10 bg-transparent text-white/70 hover:bg-white/5 hover:text-white"
                  onClick={() => onOpenChange(false)}
                >
                  取消
                </Button>
                <Button
                  type="button"
                  className="min-w-36 bg-white/10 text-white/42 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  loading={isSubmitting}
                  disabled={!imageUrl || selectedCells.size === 0}
                  onClick={() => void handleConfirm()}
                >
                  裁剪选中区域 ({selectedCells.size}张)
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  },
);

ImageGridCropDialog.displayName = "ImageGridCropDialog";

const NumberInput = ({
  value,
  onChange,
  min = 1,
  max = 12,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) => {
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(event) => {
        const next = Number(event.target.value);
        if (!Number.isFinite(next)) {
          return;
        }
        onChange(Math.min(max, Math.max(min, Math.round(next))));
      }}
      className="h-9 w-14 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-center text-sm font-semibold text-white outline-none transition focus:border-[#B43FEB]/70"
    />
  );
};
