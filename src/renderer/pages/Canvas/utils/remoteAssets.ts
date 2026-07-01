/**
 * Canvas 远程资产模型与展示工具
 *
 * 把后端 AssetListItem / AssetDetail 收敛为 Canvas UI 使用的统一模型。
 * 集中处理：
 * - Snowflake ID 字符串化（避免 number 精度丢失，但兼容后端 number 类型）
 * - 缩略图 fallback 到 fileUrl
 * - 文件大小/时长格式化
 * - 名称、描述、标签作为纯文本展示（XSS 防御依赖 React 自动转义）
 */

import type {
  AssetConditions,
  AssetDetail,
  AssetListItem,
  AssetScope,
  AssetTag,
  MediaType,
  PrimaryCategory,
} from "shared/types/api/assets";
import { buildVideoPosterUrl } from "shared/utils/videoPoster";

/** UI 使用的统一资产对象（来自远程 API） */
export interface RemoteAsset {
  id: string;
  userId: string;
  scope: AssetScope;
  projectId: string | null;
  name: string;
  description: string;
  mediaType: MediaType;
  primaryCategory: PrimaryCategory;
  fileUrl: string;
  thumbnailUrl: string;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  status: 0 | 1;
  createTime: number;
  updateTime: number;
  refCount: number;
  /** 仅字符串标签（详情接口 tag 列表会另外携带 tag.id） */
  tagNames: string[];
  conditions: AssetConditions | null;
}

const toStringId = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

const toStringOrEmpty = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
};

const getRemoteAssetThumbnailUrl = (mediaType: MediaType, fileUrl: string, thumbnailUrl: string) => {
  if (thumbnailUrl) return thumbnailUrl;
  if (mediaType === "image") return fileUrl;
  if (mediaType === "video") return buildVideoPosterUrl(fileUrl) || "";
  return "";
};

const tagNamesFromList = (tags: string[] | undefined): string[] =>
  Array.isArray(tags) ? tags.filter((tag) => typeof tag === "string" && tag.length > 0) : [];

const tagNamesFromDetail = (tags: AssetTag[] | undefined): string[] =>
  Array.isArray(tags)
    ? tags
      .map((tag) => (typeof tag.tag === "string" ? tag.tag : ""))
      .filter((tag) => tag.length > 0)
    : [];

export const mapListItemToRemoteAsset = (item: AssetListItem): RemoteAsset => ({
  id: toStringId(item.id),
  userId: toStringId(item.userId),
  scope: item.scope,
  projectId: item.projectId == null ? null : toStringId(item.projectId),
  name: toStringOrEmpty(item.name),
  description: toStringOrEmpty(item.description),
  mediaType: item.mediaType,
  primaryCategory: item.primaryCategory,
  fileUrl: toStringOrEmpty(item.fileUrl),
  thumbnailUrl: getRemoteAssetThumbnailUrl(
    item.mediaType,
    toStringOrEmpty(item.fileUrl),
    toStringOrEmpty(item.thumbnailUrl),
  ),
  fileSize: typeof item.fileSize === "number" ? item.fileSize : null,
  width: typeof item.width === "number" ? item.width : null,
  height: typeof item.height === "number" ? item.height : null,
  duration: null,
  status: item.status,
  createTime: typeof item.createTime === "number" ? item.createTime : 0,
  updateTime: typeof item.updateTime === "number" ? item.updateTime : 0,
  refCount: typeof item.refCount === "number" ? item.refCount : 0,
  tagNames: tagNamesFromList(item.tags),
  conditions: (item.conditions as AssetConditions | null) || null,
});

export const mapDetailToRemoteAsset = (detail: AssetDetail): RemoteAsset => ({
  id: toStringId(detail.id),
  userId: toStringId(detail.userId),
  scope: detail.scope,
  projectId: detail.projectId == null ? null : toStringId(detail.projectId),
  name: toStringOrEmpty(detail.name),
  description: toStringOrEmpty(detail.description),
  mediaType: detail.mediaType,
  primaryCategory: detail.primaryCategory,
  fileUrl: toStringOrEmpty(detail.fileUrl),
  thumbnailUrl: getRemoteAssetThumbnailUrl(
    detail.mediaType,
    toStringOrEmpty(detail.fileUrl),
    toStringOrEmpty(detail.thumbnailUrl),
  ),
  fileSize: typeof detail.fileSize === "number" ? detail.fileSize : null,
  width: typeof detail.width === "number" ? detail.width : null,
  height: typeof detail.height === "number" ? detail.height : null,
  duration: typeof detail.duration === "number" ? detail.duration : null,
  status: detail.status,
  createTime: typeof detail.createTime === "number" ? detail.createTime : 0,
  updateTime: typeof detail.updateTime === "number" ? detail.updateTime : 0,
  refCount: typeof detail.refCount === "number" ? detail.refCount : 0,
  tagNames: tagNamesFromDetail(detail.tags),
  conditions: (detail.conditions as AssetConditions | null) || null,
});

// ===================== 展示工具 =====================

export const SCOPE_LABEL_MAP: Record<AssetScope, string> = {
  personal: "个人资产",
  project: "项目资产",
  public: "公共资产",
};

export const MEDIA_LABEL_MAP: Record<MediaType, string> = {
  image: "图片",
  video: "视频",
  audio: "音频",
};

export const CATEGORY_LABEL_MAP: Record<PrimaryCategory, string> = {
  character: "角色",
  scene: "场景",
  prop: "道具",
};

export const getScopeLabel = (scope: AssetScope) =>
  SCOPE_LABEL_MAP[scope] || scope;

export const getMediaTypeLabel = (mediaType: MediaType) =>
  MEDIA_LABEL_MAP[mediaType] || mediaType;

export const getCategoryLabel = (category: PrimaryCategory) =>
  CATEGORY_LABEL_MAP[category] || category;

/** 字节大小格式化：1.2 MB / 32 KB */
export const formatFileSize = (size: number | null | undefined): string => {
  if (!size || size <= 0) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

/** 时间戳格式化 yyyy-MM-dd HH:mm */
export const formatTimestamp = (timestamp: number | null | undefined): string => {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "-";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** 从 URL 推断文件扩展名（不带点） */
export const guessExtensionFromUrl = (url: string): string => {
  if (!url) return "";
  const path = url.split("?")[0].split("#")[0];
  const last = path.split("/").pop() || "";
  const ext = last.split(".").pop();
  return ext && /^[a-z0-9]+$/i.test(ext) ? ext.toLowerCase() : "";
};

/** 推断默认主分类（用于资产创建表单初始化） */
export const getDefaultPrimaryCategory = (
  mediaType: MediaType,
): PrimaryCategory => {
  if (mediaType === "audio") return "scene";
  return "character";
};
