/**
 * 支持的图片格式扩展名
 */
export const SUPPORTED_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
] as const;

/**
 * 支持的视频格式扩展名
 */
export const SUPPORTED_VIDEO_EXTENSIONS = [
  ".mp4",
  ".webm",
  ".mov",
  ".avi",
  ".mkv",
  ".flv",
] as const;

/**
 * 支持的音频格式扩展名
 */
export const SUPPORTED_AUDIO_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".ogg",
  ".aac",
  ".flac",
  ".m4a",
] as const;

/**
 * 资产库支持的图片格式扩展名
 * 这里比通用画布上传更收窄，避免 bmp/svg 等格式在资产预览、AI 引用链路中表现不一致。
 */
export const SUPPORTED_ASSET_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
] as const;

/**
 * 资产库支持的视频格式扩展名
 */
export const SUPPORTED_ASSET_VIDEO_EXTENSIONS = [
  ".mp4",
  ".webm",
  ".mov",
] as const;

/**
 * 资产库支持的音频格式扩展名
 */
export const SUPPORTED_ASSET_AUDIO_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".ogg",
] as const;

export const SUPPORTED_ASSET_EXTENSIONS = [
  ...SUPPORTED_ASSET_IMAGE_EXTENSIONS,
  ...SUPPORTED_ASSET_VIDEO_EXTENSIONS,
  ...SUPPORTED_ASSET_AUDIO_EXTENSIONS,
] as const;

export const ASSET_FILE_ACCEPT = SUPPORTED_ASSET_EXTENSIONS.join(",");

export const ASSET_SUPPORTED_TYPES_LABEL =
  "图片 jpg/jpeg/png/webp/gif，视频 mp4/webm/mov，音频 mp3/wav/m4a/aac/ogg";

/**
 * 图片 MIME 类型映射
 */
export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/svg+xml",
] as const;

/**
 * 视频 MIME 类型映射
 */
export const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/x-flv",
] as const;

/**
 * 音频 MIME 类型映射
 */
export const AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "audio/flac",
  "audio/mp4",
  "audio/x-m4a",
] as const;

/**
 * 媒体类型枚举
 */
export type MediaType = "image" | "video" | "audio";

/**
 * 获取文件扩展名（包含点号）
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filename.slice(lastDot).toLowerCase();
}

/**
 * 根据文件扩展名判断是否为资产库支持的媒体类型。
 * 资产库存储使用原始扩展名落盘，因此这里以扩展名作为准入标准。
 */
export function getAssetMediaTypeByFileName(
  filename: string,
): MediaType | null {
  const ext = getFileExtension(filename);
  if (SUPPORTED_ASSET_IMAGE_EXTENSIONS.includes(ext as any)) return "image";
  if (SUPPORTED_ASSET_VIDEO_EXTENSIONS.includes(ext as any)) return "video";
  if (SUPPORTED_ASSET_AUDIO_EXTENSIONS.includes(ext as any)) return "audio";
  return null;
}

export function getAssetMediaType(file: File): MediaType | null {
  return getAssetMediaTypeByFileName(file.name);
}

/**
 * 判断是否为支持的图片类型
 */
export function isSupportedImage(file: File): boolean {
  const ext = getFileExtension(file.name);
  return (
    SUPPORTED_IMAGE_EXTENSIONS.includes(ext as any) ||
    IMAGE_MIME_TYPES.includes(file.type as any)
  );
}

/**
 * 判断是否为支持的视频类型
 */
export function isSupportedVideo(file: File): boolean {
  const ext = getFileExtension(file.name);
  return (
    SUPPORTED_VIDEO_EXTENSIONS.includes(ext as any) ||
    VIDEO_MIME_TYPES.includes(file.type as any)
  );
}

/**
 * 判断是否为支持的音频类型
 */
export function isSupportedAudio(file: File): boolean {
  const ext = getFileExtension(file.name);
  return (
    SUPPORTED_AUDIO_EXTENSIONS.includes(ext as any) ||
    AUDIO_MIME_TYPES.includes(file.type as any)
  );
}

/**
 * 获取文件媒体类型
 * @returns MediaType 或 null（不支持的类型）
 */
export function getMediaType(file: File): MediaType | null {
  if (isSupportedImage(file)) return "image";
  if (isSupportedVideo(file)) return "video";
  if (isSupportedAudio(file)) return "audio";
  return null;
}
