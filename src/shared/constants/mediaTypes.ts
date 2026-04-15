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
