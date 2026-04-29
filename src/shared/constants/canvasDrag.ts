export const CANVAS_IMAGE_DRAG_MIME = "application/x-jike-canvas-image";
export const CANVAS_IMAGE_DRAG_TYPE = "jike-canvas-image";

export type CanvasImageDragItem = {
  url: string;
  previewUrl?: string;
  originalUrl?: string;
  localPath?: string;
  localName?: string;
  width?: number;
  height?: number;
};

export type CanvasImageDragPayload = {
  type: typeof CANVAS_IMAGE_DRAG_TYPE;
  images: CanvasImageDragItem[];
};
