import type { PrimaryCategory } from "shared/types/api/assets";

export const CANVAS_IMAGE_DRAG_MIME = "application/x-jike-canvas-image";
export const CANVAS_IMAGE_DRAG_TYPE = "jike-canvas-image";

/** 旧版资产拖拽 MIME（本地资产库使用），保留供 Story / Assets 页面兼容 */
export const CANVAS_ASSET_DRAG_MIME = "application/x-jike-canvas-asset";
export const CANVAS_ASSET_DRAG_TYPE = "jike-canvas-asset";

/** 远程资产拖拽 MIME（Canvas 远程资产库使用） */
export const CANVAS_REMOTE_ASSET_DRAG_MIME =
  "application/x-jike-canvas-remote-asset";
export const CANVAS_REMOTE_ASSET_DRAG_TYPE = "jike-canvas-remote-asset";

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

/** 远程资产拖拽 payload */
export type CanvasRemoteAssetDragItem = {
  id: string;
  name: string;
  scope: "personal" | "project" | "public";
  mediaType: "image" | "video" | "audio";
  primaryCategory: PrimaryCategory;
  fileUrl: string;
  thumbnailUrl: string;
  projectId?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
};

export type CanvasRemoteAssetDragPayload = {
  type: typeof CANVAS_REMOTE_ASSET_DRAG_TYPE;
  asset: CanvasRemoteAssetDragItem;
};
