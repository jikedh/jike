import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBrush,
  IconEraser,
  IconPencil,
  IconSquare,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { uploadFileToOSS } from "service/oss";
import { GenerationStatus } from "shared/constants/enum";
import { compressImage, MAX_IMAGE_SIZE_MB } from "shared/utils/imageCompress";
import { cn } from "shared/utils/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

type AnnotationTool = "idle" | "brush" | "rect" | "text" | "eraser";

type Point = {
  x: number;
  y: number;
};

type TextItem = {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  scale: number;
};

type BrushShapeItem = {
  id: string;
  type: "brush";
  points: Point[];
  color: string;
  strokeWidth: number;
};

type BrushGroupShapeItem = {
  id: string;
  type: "brushGroup";
  strokes: Point[][];
  color: string;
  strokeWidth: number;
};

type RectShapeItem = {
  id: string;
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
};

type ShapeItem = BrushShapeItem | BrushGroupShapeItem | RectShapeItem;

type AnnotationSnapshot = {
  imageData: ImageData;
  textItems: TextItem[];
  shapeItems: ShapeItem[];
};

type PendingTextDraft = {
  itemId?: string;
  x: number;
  y: number;
  value: string;
};

type EditTarget =
  | {
      type: "text";
      id: string;
    }
  | {
      type: "shape";
      id: string;
    };

type DragTextState =
  | {
      type: "move";
      id: string;
      offsetX: number;
      offsetY: number;
    }
  | {
      type: "scale";
      id: string;
      centerX: number;
      centerY: number;
      startDistance: number;
      startScale: number;
    };

type DraftRect = {
  start: Point;
  current: Point;
};

type ShapeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type DragShapeState =
  | {
      type: "move";
      id: string;
      startPoint: Point;
      startShape: ShapeItem;
      startBounds: { x: number; y: number; width: number; height: number };
    }
  | {
      type: "scale";
      id: string;
      handle: ShapeHandle;
      startPoint: Point;
      startShape: ShapeItem;
      startBounds: { x: number; y: number; width: number; height: number };
    };

type ImageAnnotationWorkspaceProps = {
  open: boolean;
  imageUrl: string | null;
  sourceNodeId: string | null;
  onClose: () => void;
};

const HISTORY_LIMIT = 40;
const BASE_TEXT_FONT_SIZE = 28;
const MIN_TEXT_SCALE = 0.5;
const MAX_TEXT_SCALE = 8;
const MIN_STROKE_WIDTH = 4;
const MAX_STROKE_WIDTH = 40;
const COLOR_OPTIONS = [
  "#ff3b30",
  "#ff9500",
  "#ffcc00",
  "#34c759",
  "#0a84ff",
  "#5e5ce6",
  "#bf5af2",
  "#ffffff",
] as const;
const TEXT_HANDLE_CONFIG = [
  { key: "nw", className: "-left-2 -top-2 cursor-nwse-resize" },
  { key: "ne", className: "-right-2 -top-2 cursor-nesw-resize" },
  { key: "se", className: "-right-2 -bottom-2 cursor-nwse-resize" },
  { key: "sw", className: "-left-2 -bottom-2 cursor-nesw-resize" },
] as const;
const SHAPE_HANDLE_CONFIG = [
  { key: "nw", className: "-left-2 -top-2 cursor-nwse-resize" },
  { key: "n", className: "left-1/2 -top-2 -translate-x-1/2 cursor-ns-resize" },
  { key: "ne", className: "-right-2 -top-2 cursor-nesw-resize" },
  { key: "e", className: "-right-2 top-1/2 -translate-y-1/2 cursor-ew-resize" },
  { key: "se", className: "-right-2 -bottom-2 cursor-nwse-resize" },
  { key: "s", className: "left-1/2 -bottom-2 -translate-x-1/2 cursor-ns-resize" },
  { key: "sw", className: "-left-2 -bottom-2 cursor-nesw-resize" },
  { key: "w", className: "-left-2 top-1/2 -translate-y-1/2 cursor-ew-resize" },
] as const;

const measureCanvas =
  typeof document !== "undefined" ? document.createElement("canvas") : null;

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const getDistance = (a: Point, b: Point) => {
  return Math.hypot(a.x - b.x, a.y - b.y);
};

const deepCloneTextItems = (items: TextItem[]) => {
  return items.map((item) => ({ ...item }));
};

const deepCloneShapeItems = (items: ShapeItem[]) => {
  return items.map((item) =>
    item.type === "brush"
      ? {
          ...item,
          points: item.points.map((point) => ({ ...point })),
        }
      : item.type === "brushGroup"
        ? {
            ...item,
            strokes: item.strokes.map((stroke) =>
              stroke.map((point) => ({ ...point })),
            ),
          }
      : { ...item },
  );
};

const getTextMetrics = (text: string, scale: number) => {
  const lines = String(text || "").split(/\r?\n/);
  const fontSize = BASE_TEXT_FONT_SIZE * scale;
  const lineHeight = fontSize * 1.35;

  if (!measureCanvas) {
    return {
      width: fontSize,
      height: lineHeight,
      fontSize,
      lineHeight,
      lines,
    };
  }

  const ctx = measureCanvas.getContext("2d");
  if (!ctx) {
    return {
      width: fontSize,
      height: lineHeight,
      fontSize,
      lineHeight,
      lines,
    };
  }

  ctx.font = `600 ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  const width = Math.max(
    fontSize,
    ...lines.map((line) => ctx.measureText(line || " ").width),
  );

  return {
    width,
    height: Math.max(lineHeight, lines.length * lineHeight),
    fontSize,
    lineHeight,
    lines,
  };
};

const normalizeRect = (start: Point, current: Point) => {
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  const width = Math.abs(current.x - start.x);
  const height = Math.abs(current.y - start.y);
  return { x, y, width, height };
};

const getShapeBounds = (shape: ShapeItem) => {
  if (shape.type === "rect") {
    return {
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
    };
  }

  const points =
    shape.type === "brushGroup" ? shape.strokes.flat() : shape.points;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
};

const getBrushPath = (points: Point[]) => {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    const point = points[0];
    return `M ${point.x} ${point.y} L ${point.x} ${point.y}`;
  }

  return points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
    )
    .join(" ");
};

const clampBoundsToImage = (
  bounds: { x: number; y: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number,
) => {
  const width = clamp(bounds.width, 1, imageWidth);
  const height = clamp(bounds.height, 1, imageHeight);
  return {
    x: clamp(bounds.x, 0, imageWidth - width),
    y: clamp(bounds.y, 0, imageHeight - height),
    width,
    height,
  };
};

const transformShapeByBounds = (
  shape: ShapeItem,
  startBounds: { x: number; y: number; width: number; height: number },
  nextBounds: { x: number; y: number; width: number; height: number },
): ShapeItem => {
  if (shape.type === "rect") {
    return {
      ...shape,
      x: nextBounds.x,
      y: nextBounds.y,
      width: nextBounds.width,
      height: nextBounds.height,
    };
  }

  const scaleX = nextBounds.width / Math.max(1, startBounds.width);
  const scaleY = nextBounds.height / Math.max(1, startBounds.height);

  if (shape.type === "brushGroup") {
    return {
      ...shape,
      strokes: shape.strokes.map((stroke) =>
        stroke.map((point) => ({
          x: nextBounds.x + (point.x - startBounds.x) * scaleX,
          y: nextBounds.y + (point.y - startBounds.y) * scaleY,
        })),
      ),
    };
  }

  return {
    ...shape,
    points: shape.points.map((point) => ({
      x: nextBounds.x + (point.x - startBounds.x) * scaleX,
      y: nextBounds.y + (point.y - startBounds.y) * scaleY,
    })),
  };
};

const resizeBoundsFromHandle = (
  startBounds: { x: number; y: number; width: number; height: number },
  point: Point,
  handle: ShapeHandle,
) => {
  const minSize = 12;
  const startRight = startBounds.x + startBounds.width;
  const startBottom = startBounds.y + startBounds.height;
  let left = startBounds.x;
  let top = startBounds.y;
  let right = startRight;
  let bottom = startBottom;

  if (handle.includes("w")) {
    left = Math.min(point.x, startRight - minSize);
  }
  if (handle.includes("e")) {
    right = Math.max(point.x, startBounds.x + minSize);
  }
  if (handle.includes("n")) {
    top = Math.min(point.y, startBottom - minSize);
  }
  if (handle.includes("s")) {
    bottom = Math.max(point.y, startBounds.y + minSize);
  }

  return {
    x: left,
    y: top,
    width: Math.max(minSize, right - left),
    height: Math.max(minSize, bottom - top),
  };
};

const drawRectOnCanvas = (
  canvas: HTMLCanvasElement | null,
  rect: { x: number; y: number; width: number; height: number },
  color: string,
  lineWidth: number,
) => {
  if (!canvas || rect.width <= 0 || rect.height <= 0) {
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
};

export const ImageAnnotationWorkspace = ({
  open,
  imageUrl,
  sourceNodeId,
  onClose,
}: ImageAnnotationWorkspaceProps) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragTextRef = useRef<DragTextState | null>(null);
  const dragShapeRef = useRef<DragShapeState | null>(null);
  const drawingRef = useRef(false);
  const lastDrawPointRef = useRef<Point | null>(null);

  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [imageNaturalSize, setImageNaturalSize] = useState({
    width: 0,
    height: 0,
  });
  const [viewportSize, setViewportSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1440,
    height: typeof window !== "undefined" ? window.innerHeight : 900,
  });
  const [tool, setTool] = useState<AnnotationTool>("idle");
  const [currentColor, setCurrentColor] = useState<string>(COLOR_OPTIONS[0]);
  const [strokeWidth, setStrokeWidth] = useState(10);
  const [history, setHistory] = useState<AnnotationSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [shapeItems, setShapeItems] = useState<ShapeItem[]>([]);
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [hoverTextId, setHoverTextId] = useState<string | null>(null);
  const [draftRect, setDraftRect] = useState<DraftRect | null>(null);
  const [draftBrushPoints, setDraftBrushPoints] = useState<Point[]>([]);
  const [pendingBrushStrokes, setPendingBrushStrokes] = useState<Point[][]>([]);
  const [pendingTextDraft, setPendingTextDraft] = useState<PendingTextDraft | null>(
    null,
  );
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const addNode = useCanvasFlowStore((state) => state.addNode);
  const updateImageNodeData = useCanvasFlowStore(
    (state) => state.updateImageNodeData,
  );
  const onConnect = useCanvasFlowStore((state) => state.onConnect);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex >= 0 && historyIndex < history.length - 1;
  const isBrushCanvasMode = tool === "brush";
  const isCanvasOnlyMode = tool === "brush" || tool === "eraser";

  const stageScale = useMemo(() => {
    if (!imageNaturalSize.width || !imageNaturalSize.height) {
      return 1;
    }

    const maxWidth = viewportSize.width * 0.72;
    const maxHeight = viewportSize.height * 0.7;
    return Math.max(
      0.2,
      Math.min(
        maxWidth / imageNaturalSize.width,
        maxHeight / imageNaturalSize.height,
        2.5,
      ),
    );
  }, [imageNaturalSize.height, imageNaturalSize.width, viewportSize.height, viewportSize.width]);

  const stageSize = useMemo(() => {
    return {
      width: Math.max(320, Math.round(imageNaturalSize.width * stageScale) || 320),
      height: Math.max(
        220,
        Math.round(imageNaturalSize.height * stageScale) || 220,
      ),
    };
  }, [imageNaturalSize.height, imageNaturalSize.width, stageScale]);

  const getCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage || !imageNaturalSize.width || !imageNaturalSize.height) {
      return null;
    }

    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return null;
    }

    return {
      x: clamp(
        ((clientX - rect.left) / rect.width) * imageNaturalSize.width,
        0,
        imageNaturalSize.width,
      ),
      y: clamp(
        ((clientY - rect.top) / rect.height) * imageNaturalSize.height,
        0,
        imageNaturalSize.height,
      ),
    };
  }, [imageNaturalSize.height, imageNaturalSize.width]);

  const pushHistory = useCallback(
    (nextTextItems?: TextItem[], nextShapeItems?: ShapeItem[]) => {
      const canvas = drawingCanvasRef.current;
      if (!canvas) {
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }

      const snapshot: AnnotationSnapshot = {
        imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
        textItems: deepCloneTextItems(nextTextItems ?? textItems),
        shapeItems: deepCloneShapeItems(nextShapeItems ?? shapeItems),
      };

      setHistory((prev) => {
        const truncated = prev.slice(0, historyIndex + 1);
        const next = [...truncated, snapshot];
        return next.length > HISTORY_LIMIT
          ? next.slice(next.length - HISTORY_LIMIT)
          : next;
      });
      setHistoryIndex((prev) => {
        const nextIndex = Math.min(prev + 1, HISTORY_LIMIT - 1);
        return nextIndex;
      });
    },
    [historyIndex, shapeItems, textItems],
  );

  const restoreSnapshot = useCallback(
    (snapshotIndex: number) => {
      const canvas = drawingCanvasRef.current;
      if (!canvas || snapshotIndex < 0 || snapshotIndex >= history.length) {
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }

      const snapshot = history[snapshotIndex];
      ctx.putImageData(snapshot.imageData, 0, 0);
      setTextItems(deepCloneTextItems(snapshot.textItems));
      setShapeItems(deepCloneShapeItems(snapshot.shapeItems ?? []));
      setSelectedTextId(null);
      setSelectedShapeId(null);
      setEditTarget(null);
      setPendingTextDraft(null);
      setDraftRect(null);
      setDraftBrushPoints([]);
      setPendingBrushStrokes([]);
      setHistoryIndex(snapshotIndex);
    },
    [history],
  );

  const handleUndo = useCallback(() => {
    if (!canUndo) {
      return;
    }
    restoreSnapshot(historyIndex - 1);
  }, [canUndo, historyIndex, restoreSnapshot]);

  const handleRedo = useCallback(() => {
    if (!canRedo) {
      return;
    }
    restoreSnapshot(historyIndex + 1);
  }, [canRedo, historyIndex, restoreSnapshot]);

  const drawStroke = useCallback(
    (from: Point, to: Point) => {
      const canvas = drawingCanvasRef.current;
      if (!canvas) {
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = strokeWidth;
      ctx.globalCompositeOperation =
        tool === "eraser" ? "destination-out" : "source-over";
      ctx.strokeStyle = currentColor;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();
    },
    [currentColor, strokeWidth, tool],
  );

  const commitTextItems = useCallback((updater: (items: TextItem[]) => TextItem[]) => {
    setTextItems((prev) => {
      const next = updater(prev);
      queueMicrotask(() => {
        pushHistory(next);
      });
      return next;
    });
  }, [pushHistory]);

  const commitShapeItems = useCallback(
    (updater: (items: ShapeItem[]) => ShapeItem[]) => {
      setShapeItems((prev) => {
        const next = updater(prev);
        queueMicrotask(() => {
          pushHistory(undefined, next);
        });
        return next;
      });
    },
    [pushHistory],
  );

  useEffect(() => {
    if (!open || !imageUrl) {
      return;
    }

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      imageRef.current = image;
      setLoadedImage(image);
      setImageNaturalSize({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.src = imageUrl;
  }, [imageUrl, open]);

  useEffect(() => {
    if (!open || !loadedImage) {
      return;
    }

    const canvas = drawingCanvasRef.current;
    if (!canvas) {
      return;
    }

    canvas.width = loadedImage.naturalWidth;
    canvas.height = loadedImage.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTextItems([]);
    setSelectedTextId(null);
    setEditTarget(null);
    setHoverTextId(null);
    setPendingTextDraft(null);
    setDraftRect(null);
    setTool("idle");
    setCurrentColor(COLOR_OPTIONS[0]);
    setStrokeWidth(10);
    const initialSnapshot: AnnotationSnapshot = {
      imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
      textItems: [],
      shapeItems: [],
    };
    setHistory([initialSnapshot]);
    setHistoryIndex(0);
    setShapeItems([]);
    setSelectedShapeId(null);
    setDraftBrushPoints([]);
    setPendingBrushStrokes([]);
  }, [loadedImage, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        handleRedo();
        return;
      }

      if (
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        (event.key === "Backspace" || event.key === "Delete") &&
        editTarget
      ) {
        event.preventDefault();

        if (editTarget.type === "text") {
          const deletingId = editTarget.id;
          commitTextItems((prev) => prev.filter((item) => item.id !== deletingId));
          setSelectedTextId(null);
        } else {
          const deletingId = editTarget.id;
          commitShapeItems((prev) => prev.filter((item) => item.id !== deletingId));
          setSelectedShapeId(null);
        }

        setEditTarget(null);
        setPendingTextDraft(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commitShapeItems, commitTextItems, editTarget, handleRedo, handleUndo, open]);

  const endTextDrag = useCallback(() => {
    if (!dragTextRef.current) {
      return;
    }
    dragTextRef.current = null;
    pushHistory();
  }, [pushHistory]);

  const endShapeDrag = useCallback(() => {
    if (!dragShapeRef.current) {
      return;
    }
    dragShapeRef.current = null;
    pushHistory();
  }, [pushHistory]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragTextRef.current;
      if (!dragState) {
        return;
      }

      const point = getCanvasPoint(event.clientX, event.clientY);
      if (!point) {
        return;
      }

      setTextItems((prev) =>
        prev.map((item) => {
          if (item.id !== dragState.id) {
            return item;
          }

          if (dragState.type === "move") {
            return {
              ...item,
              x: clamp(
                point.x - dragState.offsetX,
                0,
                imageNaturalSize.width,
              ),
              y: clamp(
                point.y - dragState.offsetY,
                0,
                imageNaturalSize.height,
              ),
            };
          }

          const currentDistance = getDistance(point, {
            x: dragState.centerX,
            y: dragState.centerY,
          });
          const nextScale = clamp(
            dragState.startScale *
              (currentDistance / Math.max(1, dragState.startDistance)),
            MIN_TEXT_SCALE,
            MAX_TEXT_SCALE,
          );
          const metrics = getTextMetrics(item.text, nextScale);
          return {
            ...item,
            scale: nextScale,
            x: dragState.centerX - metrics.width / 2,
            y: dragState.centerY - metrics.height / 2,
          };
        }),
      );
    };

    const handlePointerUp = () => {
      endTextDrag();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [endTextDrag, getCanvasPoint, imageNaturalSize.height, imageNaturalSize.width, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragShapeRef.current;
      if (!dragState) {
        return;
      }

      const point = getCanvasPoint(event.clientX, event.clientY);
      if (!point) {
        return;
      }

      setShapeItems((prev) =>
        prev.map((shape) => {
          if (shape.id !== dragState.id) {
            return shape;
          }

          if (dragState.type === "move") {
            const deltaX = point.x - dragState.startPoint.x;
            const deltaY = point.y - dragState.startPoint.y;
            const nextBounds = clampBoundsToImage(
              {
                ...dragState.startBounds,
                x: dragState.startBounds.x + deltaX,
                y: dragState.startBounds.y + deltaY,
              },
              imageNaturalSize.width,
              imageNaturalSize.height,
            );
            return transformShapeByBounds(
              dragState.startShape,
              dragState.startBounds,
              nextBounds,
            );
          }

          const resizedBounds = resizeBoundsFromHandle(
            dragState.startBounds,
            point,
            dragState.handle,
          );
          const nextBounds = clampBoundsToImage(
            resizedBounds,
            imageNaturalSize.width,
            imageNaturalSize.height,
          );
          return transformShapeByBounds(
            dragState.startShape,
            dragState.startBounds,
            nextBounds,
          );
        }),
      );
    };

    const handlePointerUp = () => {
      endShapeDrag();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [endShapeDrag, getCanvasPoint, imageNaturalSize.height, imageNaturalSize.width, open]);

  const handleStagePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const point = getCanvasPoint(event.clientX, event.clientY);
      if (!point) {
        return;
      }

      setSelectedTextId(null);
      setSelectedShapeId(null);
      setEditTarget(null);
      setColorPickerOpen(false);

      if (tool === "text") {
        setPendingTextDraft({
          itemId: undefined,
          x: point.x,
          y: point.y,
          value: "",
        });
        return;
      }

      if (tool === "rect") {
        setDraftRect({ start: point, current: point });
        return;
      }

      if (tool === "brush") {
        drawingRef.current = true;
        lastDrawPointRef.current = point;
        setDraftBrushPoints([point]);
        return;
      }

      if (tool === "eraser") {
        drawingRef.current = true;
        lastDrawPointRef.current = point;
        drawStroke(point, point);
      }
    },
    [drawStroke, getCanvasPoint, tool],
  );

  const handleStagePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const point = getCanvasPoint(event.clientX, event.clientY);
      if (!point) {
        return;
      }

      if (tool === "rect" && draftRect) {
        setDraftRect((prev) => (prev ? { ...prev, current: point } : prev));
        return;
      }

      if (tool === "brush" && drawingRef.current) {
        setDraftBrushPoints((prev) => [...prev, point]);
        lastDrawPointRef.current = point;
        return;
      }

      if (!drawingRef.current || !lastDrawPointRef.current) {
        return;
      }

      drawStroke(lastDrawPointRef.current, point);
      lastDrawPointRef.current = point;
    },
    [draftRect, drawStroke, getCanvasPoint, tool],
  );

  const handleStagePointerUp = useCallback(() => {
    if (tool === "rect" && draftRect) {
      const rect = normalizeRect(draftRect.start, draftRect.current);
      if (rect.width > 0 && rect.height > 0) {
        const nextShape: RectShapeItem = {
          id: `annotation-rect-${Date.now()}`,
          type: "rect",
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          color: currentColor,
          strokeWidth,
        };
        commitShapeItems((prev) => [...prev, nextShape]);
        setSelectedShapeId(null);
        setEditTarget(null);
      }
      setDraftRect(null);
      return;
    }

    if (drawingRef.current) {
      drawingRef.current = false;
      if (tool === "brush") {
        const points = draftBrushPoints;
        if (points.length > 0) {
          setPendingBrushStrokes((prev) => [
            ...prev,
            points.map((point) => ({ ...point })),
          ]);
        }
        setDraftBrushPoints([]);
      } else {
        pushHistory();
      }
      lastDrawPointRef.current = null;
    }
  }, [
    commitShapeItems,
    currentColor,
    draftBrushPoints,
    draftRect,
    pushHistory,
    strokeWidth,
    tool,
  ]);

  const handleCancelBrushCanvasMode = useCallback(() => {
    setPendingBrushStrokes([]);
    setDraftBrushPoints([]);
    setSelectedShapeId(null);
    setEditTarget(null);
    setTool("idle");
  }, []);

  const handleConfirmBrushCanvasMode = useCallback(() => {
    const strokes = pendingBrushStrokes
      .map((stroke) => stroke.map((point) => ({ ...point })))
      .filter((stroke) => stroke.length > 0);

    if (strokes.length === 0) {
      setTool("idle");
      return;
    }

    const nextShape: BrushGroupShapeItem = {
      id: `annotation-brush-group-${Date.now()}`,
      type: "brushGroup",
      strokes,
      color: currentColor,
      strokeWidth,
    };

    commitShapeItems((prev) => [...prev, nextShape]);
    setPendingBrushStrokes([]);
    setDraftBrushPoints([]);
    setSelectedShapeId(null);
    setEditTarget(null);
    setTool("idle");
  }, [commitShapeItems, currentColor, pendingBrushStrokes, strokeWidth]);

  const handleCommitPendingText = useCallback(() => {
    if (!pendingTextDraft) {
      return;
    }

    const value = pendingTextDraft.value.trim();
    if (!value) {
      setPendingTextDraft(null);
      return;
    }

    if (pendingTextDraft.itemId) {
      const editingId = pendingTextDraft.itemId;
      commitTextItems((prev) =>
        prev.map((item) =>
          item.id === editingId
            ? {
                ...item,
                text: value,
              }
            : item,
        ),
      );
      setSelectedTextId(null);
      setEditTarget(null);
      setPendingTextDraft(null);
      return;
    }

    const nextItem: TextItem = {
      id: `annotation-text-${Date.now()}`,
      x: pendingTextDraft.x,
      y: pendingTextDraft.y,
      text: value,
      color: currentColor,
      scale: 1,
    };

    commitTextItems((prev) => [...prev, nextItem]);
    setSelectedTextId(null);
    setEditTarget(null);
    setPendingTextDraft(null);
  }, [commitTextItems, currentColor, pendingTextDraft]);

  const handleEnterTextEditMode = useCallback((item: TextItem) => {
    setSelectedTextId(item.id);
    setSelectedShapeId(null);
    setPendingTextDraft(null);
    setEditTarget({ type: "text", id: item.id });
  }, []);

  const handleEnterShapeEditMode = useCallback((shape: ShapeItem) => {
    setSelectedShapeId(shape.id);
    setSelectedTextId(null);
    setPendingTextDraft(null);
    setEditTarget({ type: "shape", id: shape.id });
  }, []);

  const handleStartTextScale = useCallback(
    (item: TextItem, event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const point = getCanvasPoint(event.clientX, event.clientY);
      if (!point) {
        return;
      }

      const metrics = getTextMetrics(item.text, item.scale);
      const centerX = item.x + metrics.width / 2;
      const centerY = item.y + metrics.height / 2;

      setSelectedTextId(item.id);
      setSelectedShapeId(null);
      setEditTarget({ type: "text", id: item.id });
      dragTextRef.current = {
        type: "scale",
        id: item.id,
        centerX,
        centerY,
        startDistance: Math.max(1, getDistance(point, { x: centerX, y: centerY })),
        startScale: item.scale,
      };
    },
    [getCanvasPoint],
  );

  const handleStartShapeScale = useCallback(
    (
      shape: ShapeItem,
      handle: ShapeHandle,
      event: React.PointerEvent<HTMLDivElement>,
    ) => {
      event.preventDefault();
      event.stopPropagation();
      const point = getCanvasPoint(event.clientX, event.clientY);
      if (!point) {
        return;
      }

      const bounds = getShapeBounds(shape);
      setSelectedShapeId(shape.id);
      setSelectedTextId(null);
      setEditTarget({ type: "shape", id: shape.id });
      dragShapeRef.current = {
        type: "scale",
        id: shape.id,
        handle,
        startPoint: point,
        startShape: deepCloneShapeItems([shape])[0],
        startBounds: bounds,
      };
    },
    [getCanvasPoint],
  );

  const handleSave = useCallback(async () => {
    if (!sourceNodeId || !loadedImage || !imageNaturalSize.width || !imageUrl) {
      return;
    }

    setIsSaving(true);

    try {
      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = imageNaturalSize.width;
      outputCanvas.height = imageNaturalSize.height;

      const outputCtx = outputCanvas.getContext("2d");
      if (!outputCtx) {
        throw new Error("无法创建导出画布");
      }

      outputCtx.drawImage(loadedImage, 0, 0, outputCanvas.width, outputCanvas.height);

      const drawingCanvas = drawingCanvasRef.current;
      if (drawingCanvas) {
        outputCtx.drawImage(drawingCanvas, 0, 0);
      }

      shapeItems.forEach((shape) => {
        outputCtx.save();
        outputCtx.strokeStyle = shape.color;
        outputCtx.lineJoin = "round";
        outputCtx.lineCap = "round";
        outputCtx.lineWidth = shape.strokeWidth;

        if (shape.type === "rect") {
          outputCtx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        } else if (shape.type === "brushGroup") {
          shape.strokes.forEach((stroke) => {
            if (stroke.length === 0) {
              return;
            }
            outputCtx.beginPath();
            stroke.forEach((point, index) => {
              if (index === 0) {
                outputCtx.moveTo(point.x, point.y);
              } else {
                outputCtx.lineTo(point.x, point.y);
              }
            });
            if (stroke.length === 1) {
              outputCtx.lineTo(stroke[0].x, stroke[0].y);
            }
            outputCtx.stroke();
          });
        } else if (shape.points.length > 0) {
          outputCtx.beginPath();
          shape.points.forEach((point, index) => {
            if (index === 0) {
              outputCtx.moveTo(point.x, point.y);
            } else {
              outputCtx.lineTo(point.x, point.y);
            }
          });
          if (shape.points.length === 1) {
            outputCtx.lineTo(shape.points[0].x, shape.points[0].y);
          }
          outputCtx.stroke();
        }

        outputCtx.restore();
      });

      textItems.forEach((item) => {
        const metrics = getTextMetrics(item.text, item.scale);
        outputCtx.save();
        outputCtx.fillStyle = item.color;
        outputCtx.font = `600 ${metrics.fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
        outputCtx.textBaseline = "top";
        metrics.lines.forEach((line, index) => {
          outputCtx.fillText(line, item.x, item.y + index * metrics.lineHeight);
        });
        outputCtx.restore();
      });

      const blob = await new Promise<Blob | null>((resolve) => {
        outputCanvas.toBlob((value) => resolve(value), "image/png");
      });

      if (!blob) {
        throw new Error("导出标注图片失败");
      }

      let file = new File([blob], `annotation-${Date.now()}.png`, {
        type: "image/png",
      });

      if (file.size > MAX_IMAGE_SIZE_MB) {
        file = await compressImage(file);
      }

      const uploadResult = await uploadFileToOSS(file);
      if (!uploadResult.url) {
        throw new Error("标注图片上传失败");
      }

      const sourceNode = useCanvasFlowStore
        .getState()
        .nodes.find((node) => node.id === sourceNodeId);
      if (!sourceNode || sourceNode.type !== "imageNode") {
        throw new Error("源图片节点不存在");
      }

      const childPosition = {
        x: sourceNode.position.x + (sourceNode.width ?? 350) + 80,
        y: sourceNode.position.y,
      };

      const childId = addNode("image", childPosition);
      onConnect({
        source: sourceNodeId,
        target: childId,
        sourceHandle: "output",
        targetHandle: "input",
      });

      updateImageNodeData(childId, {
        image_urls: [imageUrl],
        size: sourceNode.data?.size,
        result: {
          type: "image",
          data: [{ url: uploadResult.url, remoteUrl: uploadResult.url }],
        },
        status: GenerationStatus.COMPLETED,
        progress: 100,
      });

      toast.success("标注已保存");
      onClose();
    } catch (error: any) {
      console.error("保存标注失败:", error);
      toast.error(error?.message || "保存标注失败，请重试");
    } finally {
      setIsSaving(false);
    }
  }, [
    addNode,
    imageNaturalSize.height,
    imageNaturalSize.width,
    imageUrl,
    loadedImage,
    onClose,
    onConnect,
    sourceNodeId,
    shapeItems,
    textItems,
    updateImageNodeData,
  ]);

  const selectedText = useMemo(() => {
    return textItems.find((item) => item.id === selectedTextId) ?? null;
  }, [selectedTextId, textItems]);

  const selectedShape = useMemo(() => {
    return shapeItems.find((item) => item.id === selectedShapeId) ?? null;
  }, [selectedShapeId, shapeItems]);

  if (!open || !imageUrl) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden bg-[radial-gradient(circle_at_50%_30%,rgba(92,34,163,0.08)_0%,rgba(11,11,14,0.14)_28%,rgba(6,6,8,0.64)_100%)] backdrop-blur-[3px]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.01)_18%,rgba(0,0,0,0)_34%,rgba(0,0,0,0.18)_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-[18%] h-[42vh] w-[42vw] -translate-x-1/2 rounded-full bg-[#B43FEB]/[0.07] blur-[120px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(0,0,0,0.42)_0%,rgba(0,0,0,0)_100%)]" />
      <div className="absolute inset-0 flex items-start justify-center px-8 pt-6 pb-8">
        <div className="flex w-full max-w-[1400px] flex-col items-center gap-4">
          <div className="flex w-full max-w-[1100px] items-center justify-between rounded-2xl border border-white/10 bg-[#1f1f22]/95 px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white/85 transition hover:bg-white/[0.08]"
                onClick={onClose}
              >
                <IconArrowBackUp size={18} />
                返回
              </button>
            </div>

            <div className="relative flex items-center gap-2 rounded-2xl border border-white/8 bg-black/15 px-3 py-2">
              {([
                { key: "brush", label: "画笔", icon: IconBrush },
                { key: "rect", label: "矩形", icon: IconSquare },
                { key: "text", label: "文字", icon: null },
                { key: "eraser", label: "橡皮擦", icon: IconEraser },
              ] as const).map((item) => {
                const Icon = item.icon;
                const active = tool === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={cn(
                      "inline-flex h-10 w-10 items-center justify-center rounded-xl border transition",
                      active
                        ? "border-[#B43FEB]/60 bg-[#B43FEB]/18 text-white"
                        : "border-transparent bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white",
                    )}
                    onClick={() => setTool(item.key)}
                    title={item.label}
                    aria-label={item.label}
                  >
                    {item.key === "text" ? (
                      <span className="text-[18px] font-semibold leading-none">T</span>
                    ) : (
                      <Icon size={18} />
                    )}
                  </button>
                );
              })}

              <div className="mx-1 h-8 w-px bg-white/10" />

              <div className="relative">
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-transparent bg-white/[0.04] text-white/85 transition hover:bg-white/[0.08]"
                  onClick={() => setColorPickerOpen((prev) => !prev)}
                  title="颜色"
                  aria-label="颜色"
                >
                  <span
                    className="h-5 w-5 rounded-full border border-white/30"
                    style={{ backgroundColor: currentColor }}
                  />
                </button>

                {colorPickerOpen ? (
                  <div className="absolute left-0 top-[calc(100%+10px)] z-[120] grid w-44 grid-cols-4 gap-2 rounded-2xl border border-white/10 bg-[#1a1a1d] p-3 shadow-2xl">
                    {COLOR_OPTIONS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={cn(
                          "h-8 w-8 rounded-full border transition",
                          currentColor === color
                            ? "border-white"
                            : "border-white/20 hover:border-white/50",
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => {
                          setCurrentColor(color);
                          setColorPickerOpen(false);
                        }}
                        aria-label={`选择颜色 ${color}`}
                      />
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-2 px-1">
                <IconPencil size={16} className="text-white/55" />
                <Input
                  type="range"
                  min={MIN_STROKE_WIDTH}
                  max={MAX_STROKE_WIDTH}
                  step={1}
                  value={strokeWidth}
                  className="h-8 w-28 border-none bg-transparent px-0"
                  onChange={(event) => setStrokeWidth(Number(event.target.value) || 10)}
                />
              </div>

              <div className="mx-1 h-8 w-px bg-white/10" />

              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-transparent bg-white/[0.04] text-white/65 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-35"
                onClick={handleUndo}
                disabled={!canUndo}
                title="撤销"
                aria-label="撤销"
              >
                <IconArrowBackUp size={18} />
              </button>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-transparent bg-white/[0.04] text-white/65 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-35"
                onClick={handleRedo}
                disabled={!canRedo}
                title="重做"
                aria-label="重做"
              >
                <IconArrowForwardUp size={18} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {isBrushCanvasMode ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white/80 hover:bg-white/[0.08] hover:text-white"
                    onClick={handleCancelBrushCanvasMode}
                  >
                    取消
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-10 rounded-xl bg-[#B43FEB] px-4 text-sm font-semibold text-white hover:bg-[#B43FEB]/90"
                    onClick={handleConfirmBrushCanvasMode}
                    disabled={pendingBrushStrokes.length === 0}
                  >
                    确认
                  </Button>
                </>
              ) : null}

              <Button
                type="button"
                size="sm"
                className="h-10 rounded-xl bg-white px-5 text-sm font-semibold text-black hover:bg-white/90"
                loading={isSaving}
                onClick={handleSave}
              >
                保存
              </Button>
            </div>
          </div>

          <div className="flex w-full flex-1 items-center justify-center overflow-hidden rounded-[28px]">
            <div className="relative">
              <div className="pointer-events-none absolute inset-[-26px] rounded-[36px] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12)_0%,rgba(180,63,235,0.08)_20%,rgba(180,63,235,0.03)_40%,rgba(0,0,0,0)_72%)] blur-2xl" />
              <div
                ref={stageRef}
                className="relative rounded-[24px] border border-white/10 bg-[#111113] shadow-[0_30px_100px_rgba(0,0,0,0.52),0_0_0_1px_rgba(255,255,255,0.04)]"
                style={{
                  width: stageSize.width,
                  height: stageSize.height,
                }}
                onPointerDown={handleStagePointerDown}
                onPointerMove={handleStagePointerMove}
                onPointerUp={handleStagePointerUp}
                onPointerLeave={handleStagePointerUp}
              >
                {loadedImage ? (
                  <img
                    src={loadedImage.src}
                    alt="标注编辑"
                    className="pointer-events-none absolute inset-0 h-full w-full rounded-[24px] object-cover select-none"
                    draggable={false}
                  />
                ) : null}

                {isBrushCanvasMode ? (
                  <div className="pointer-events-none absolute inset-0 rounded-[24px] bg-white/72" />
                ) : null}

                <div className="pointer-events-none absolute inset-0 rounded-[24px] ring-1 ring-white/6" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-16 rounded-t-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0)_100%)]" />

                <canvas
                  ref={drawingCanvasRef}
                  className={cn(
                    "absolute inset-0 h-full w-full rounded-[24px]",
                    tool === "text" ? "cursor-text" : "cursor-crosshair",
                  )}
                  style={{
                    width: stageSize.width,
                    height: stageSize.height,
                  }}
                />

                {draftRect ? (
                  (() => {
                    const rect = normalizeRect(draftRect.start, draftRect.current);
                    return (
                      <div
                        className="pointer-events-none absolute"
                        style={{
                          left: rect.x * stageScale,
                          top: rect.y * stageScale,
                          width: rect.width * stageScale,
                          height: rect.height * stageScale,
                        }}
                      >
                        <div
                          className="absolute inset-0 rounded-[10px] border"
                          style={{
                            borderColor: currentColor,
                            borderWidth: Math.max(1.5, strokeWidth * stageScale * 0.3),
                          }}
                        />
                        <div
                          className="absolute inset-0 rounded-[10px]"
                          style={{
                            boxShadow: `0 0 0 1px ${currentColor}26, inset 0 0 0 1px ${currentColor}18`,
                          }}
                        />
                      </div>
                    );
                  })()
                ) : null}

                <svg
                  className="absolute inset-0 h-full w-full"
                  viewBox={`0 0 ${imageNaturalSize.width || 1} ${imageNaturalSize.height || 1}`}
                >
                  {shapeItems.map((shape) => {
                    const isSelected = shape.id === selectedShapeId;
                    const canInteractWithShape =
                      !isCanvasOnlyMode ||
                      (editTarget?.type === "shape" && editTarget.id === shape.id);
                    return (
                      <g key={shape.id}>
                        {shape.type === "rect" ? (
                          <>
                            <rect
                              x={shape.x}
                              y={shape.y}
                              width={shape.width}
                              height={shape.height}
                              fill="transparent"
                              stroke="transparent"
                              strokeWidth={Math.max(shape.strokeWidth + 18, 20)}
                              pointerEvents={canInteractWithShape ? "stroke" : "none"}
                              onDoubleClick={
                                canInteractWithShape
                                  ? (event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      handleEnterShapeEditMode(shape);
                                    }
                                  : undefined
                              }
                            />
                            <rect
                              x={shape.x}
                              y={shape.y}
                              width={shape.width}
                              height={shape.height}
                              fill="none"
                              stroke={shape.color}
                              strokeWidth={shape.strokeWidth}
                              strokeLinejoin="round"
                              pointerEvents="none"
                            />
                          </>
                        ) : shape.type === "brushGroup" ? (
                          <>
                            {shape.strokes.map((stroke, index) => {
                              const brushPath = getBrushPath(stroke);
                              return (
                                <g key={`${shape.id}-${index}`}>
                                  <path
                                    d={brushPath}
                                    fill="none"
                                    stroke="transparent"
                                    strokeWidth={Math.max(shape.strokeWidth + 18, 20)}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    pointerEvents={canInteractWithShape ? "stroke" : "none"}
                                    onDoubleClick={
                                      canInteractWithShape
                                        ? (event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            handleEnterShapeEditMode(shape);
                                          }
                                        : undefined
                                    }
                                  />
                                  <path
                                    d={brushPath}
                                    fill="none"
                                    stroke={shape.color}
                                    strokeWidth={shape.strokeWidth}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    pointerEvents="none"
                                  />
                                </g>
                              );
                            })}
                          </>
                        ) : (
                          <>
                            <path
                              d={getBrushPath(shape.points)}
                              fill="none"
                              stroke="transparent"
                              strokeWidth={Math.max(shape.strokeWidth + 18, 20)}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              pointerEvents={canInteractWithShape ? "stroke" : "none"}
                              onDoubleClick={
                                canInteractWithShape
                                  ? (event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      handleEnterShapeEditMode(shape);
                                    }
                                  : undefined
                              }
                            />
                            <path
                              d={getBrushPath(shape.points)}
                              fill="none"
                              stroke={shape.color}
                              strokeWidth={shape.strokeWidth}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              pointerEvents="none"
                            />
                          </>
                        )}

                        {isSelected ? (
                          (() => {
                            const bounds = getShapeBounds(shape);
                            return (
                              <rect
                                x={bounds.x}
                                y={bounds.y}
                                width={bounds.width}
                                height={bounds.height}
                                fill="none"
                                stroke="rgba(180,63,235,0.9)"
                                strokeWidth={1.5}
                                strokeDasharray="8 6"
                                pointerEvents="none"
                              />
                            );
                          })()
                        ) : null}
                      </g>
                    );
                  })}

                  {pendingBrushStrokes.map((stroke, index) => (
                    <path
                      key={`pending-brush-${index}`}
                      d={getBrushPath(stroke)}
                      fill="none"
                      stroke={currentColor}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.95}
                      pointerEvents="none"
                    />
                  ))}
                  {draftBrushPoints.length > 0 ? (
                    <path
                      d={getBrushPath(draftBrushPoints)}
                      fill="none"
                      stroke={currentColor}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.95}
                      pointerEvents="none"
                    />
                  ) : null}
                </svg>

                {selectedShape ? (
                  (() => {
                    const bounds = getShapeBounds(selectedShape);
                    const isEditing =
                      editTarget?.type === "shape" && editTarget.id === selectedShape.id;
                    const canInteractWithShape =
                      !isCanvasOnlyMode ||
                      (editTarget?.type === "shape" && editTarget.id === selectedShape.id);
                    return (
                      <div
                        className="absolute"
                        style={{
                          left: bounds.x * stageScale,
                          top: bounds.y * stageScale,
                          width: bounds.width * stageScale,
                          height: bounds.height * stageScale,
                          pointerEvents: canInteractWithShape ? "auto" : "none",
                        }}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                      >
                        <div className="absolute inset-0 rounded-[10px] border border-[#B43FEB]/55 bg-[#B43FEB]/[0.04] shadow-[0_0_0_1px_rgba(180,63,235,0.18)]" />
                        {isEditing
                          ? ([
                          {
                            key: "n",
                            className:
                              "left-3 right-3 -top-2 h-4 cursor-ns-resize",
                          },
                          {
                            key: "s",
                            className:
                              "left-3 right-3 -bottom-2 h-4 cursor-ns-resize",
                          },
                          {
                            key: "w",
                            className:
                              "-left-2 top-3 bottom-3 w-4 cursor-ew-resize",
                          },
                          {
                            key: "e",
                            className:
                              "-right-2 top-3 bottom-3 w-4 cursor-ew-resize",
                          },
                        ] as const).map((edge) => (
                          <div
                            key={edge.key}
                            className={cn("absolute", edge.className)}
                            onPointerDown={(event) =>
                              handleStartShapeScale(selectedShape, edge.key, event)
                            }
                          />
                        ))
                          : null}
                        {isEditing
                          ? SHAPE_HANDLE_CONFIG.map((handle) => (
                          <div
                            key={handle.key}
                            className={cn(
                              "absolute h-4 w-4 rounded-full border border-white/70 bg-[#B43FEB] shadow-[0_4px_12px_rgba(180,63,235,0.35)]",
                              handle.className,
                            )}
                            onPointerDown={(event) =>
                              handleStartShapeScale(selectedShape, handle.key, event)
                            }
                          />
                        ))
                          : null}
                      </div>
                    );
                  })()
                ) : null}

                {textItems.map((item) => {
                  if (pendingTextDraft?.itemId === item.id) {
                    return null;
                  }

                  const metrics = getTextMetrics(item.text, item.scale);
                  const isSelected = item.id === selectedTextId;
                  const isEditing =
                    editTarget?.type === "text" && editTarget.id === item.id;
                  const canInteractWithText =
                    !isCanvasOnlyMode ||
                    (editTarget?.type === "text" && editTarget.id === item.id);
                  const isHovered = item.id === hoverTextId;
                  const left = item.x * stageScale;
                  const top = item.y * stageScale;
                  const width = metrics.width * stageScale;
                  const height = metrics.height * stageScale;

                  return (
                    <div
                      key={item.id}
                      className="absolute"
                      style={{
                        left,
                        top,
                        width,
                        height,
                        pointerEvents: canInteractWithText ? "auto" : "none",
                      }}
                      onMouseEnter={() => setHoverTextId(item.id)}
                      onMouseLeave={() => setHoverTextId((prev) => (prev === item.id ? null : prev))}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onDoubleClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleEnterTextEditMode(item);
                      }}
                    >
                      <div
                        className={cn(
                          "group relative h-full w-full rounded-xl px-1.5 py-1 transition-all duration-150",
                          isSelected
                            ? "border border-[#B43FEB]/70 bg-black/12 shadow-[0_0_0_1px_rgba(180,63,235,0.18),0_10px_30px_rgba(0,0,0,0.18)]"
                            : isHovered
                              ? "border border-white/10 bg-black/8 shadow-[0_0_0_1px_rgba(255,255,255,0.05)]"
                              : "border border-transparent bg-transparent shadow-none",
                        )}
                      >
                        <div
                          className="pointer-events-none absolute inset-0 rounded-xl transition-opacity duration-150"
                          style={{
                            opacity: isSelected ? 1 : isHovered ? 0.6 : 0,
                            boxShadow: isSelected
                              ? "inset 0 0 0 1px rgba(255,255,255,0.06)"
                              : "inset 0 0 0 1px rgba(255,255,255,0.03)",
                          }}
                        />
                        <div
                          className="whitespace-pre font-semibold leading-[1.35] select-none"
                          style={{
                            color: item.color,
                            fontSize: metrics.fontSize * stageScale,
                            textShadow:
                              isSelected || isHovered
                                ? "0 1px 10px rgba(0,0,0,0.18)"
                                : "0 1px 8px rgba(0,0,0,0.12)",
                          }}
                        >
                          {item.text}
                        </div>

                        {isSelected && isEditing ? (
                          <>
                            {TEXT_HANDLE_CONFIG.map((handle) => (
                              <div
                                key={handle.key}
                                className={cn(
                                  "absolute h-4 w-4 rounded-full border border-white/70 bg-[#B43FEB] shadow-[0_4px_12px_rgba(180,63,235,0.35)]",
                                  handle.className,
                                )}
                                onPointerDown={(event) =>
                                  handleStartTextScale(item, event)
                                }
                              />
                            ))}
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {pendingTextDraft ? (
                  <div
                    className="absolute z-[110] w-56 rounded-2xl border border-white/10 bg-[#1a1a1d]/98 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.42)] backdrop-blur-xl"
                    style={{
                      left: clamp(
                        pendingTextDraft.x * stageScale,
                        12,
                        Math.max(12, stageSize.width - 236),
                      ),
                      top: clamp(
                        pendingTextDraft.y * stageScale,
                        12,
                        Math.max(12, stageSize.height - 132),
                      ),
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <div className="mb-2 text-xs text-white/55">输入标注文字</div>
                    <textarea
                      autoFocus
                      value={pendingTextDraft.value}
                      onChange={(event) =>
                        setPendingTextDraft((prev) =>
                          prev ? { ...prev, value: event.target.value } : prev,
                        )
                      }
                      rows={3}
                      className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/25"
                    placeholder={
                      pendingTextDraft.itemId
                        ? "编辑文字后点击确定"
                        : "输入内容后点击确定"
                    }
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                        onClick={() => setPendingTextDraft(null)}
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        className="rounded-lg bg-[#B43FEB] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#B43FEB]/85"
                        onClick={handleCommitPendingText}
                      >
                        确定
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {isBrushCanvasMode ? (
            <div className="text-xs text-white/45">
              画布模式中只能绘制，完成后点击确认会把当前笔迹合并成一个整体对象
            </div>
          ) : selectedShape ? (
            <div className="text-xs text-white/45">
              已选中标注对象，双击边框进入编辑态；编辑态可拖拽控制点缩放，按 Backspace/Delete 删除
            </div>
          ) : selectedText ? (
            <div className="text-xs text-white/45">
              已选中文字，双击边框进入编辑态；编辑态可拖拽四角控制点缩放，按 Backspace/Delete 删除
            </div>
          ) : (
            <div className="text-xs text-white/45">
              点击图片即可开始标注，文字工具为点一下输入后再确认
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
