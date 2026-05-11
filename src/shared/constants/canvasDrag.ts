export const CANVAS_IMAGE_DRAG_MIME = "application/x-jike-canvas-image";
export const CANVAS_IMAGE_DRAG_TYPE = "jike-canvas-image";
export const CANVAS_ASSET_DRAG_MIME = "application/x-jike-canvas-asset";
export const CANVAS_ASSET_DRAG_TYPE = "jike-canvas-asset";

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

export type CanvasAssetDragItem = {
  id: string;
  name: string;
  scope: "project" | "canvas";
  mediaType: "image" | "video" | "audio";
  category: "role" | "scene" | "prop" | "image" | "video" | "audio";
  fileUrl: string;
  originalFile?: string;
  coverUrl?: string;
  localName?: string;
  projectId?: string;
};

export type CanvasAssetDragPayload = {
  type: typeof CANVAS_ASSET_DRAG_TYPE;
  asset: CanvasAssetDragItem;
};
