import {
  generateFileName,
  localStorageService,
} from "service/localStorageService";

export type StoryboardImageCacheEntry = {
  remoteUrl: string;
  localName?: string;
  localPath?: string;
  contentType?: string;
  extension?: string;
  cachedAt?: number;
  error?: string;
};

export type StoryboardImageCacheMap = Record<string, StoryboardImageCacheEntry>;

type CacheStoryboardImageOptions = {
  projectId: string | null | undefined;
  url: string;
  rowIndex?: number;
  signal?: AbortSignal;
};

const inFlightStoryboardImageCache = new Map<
  string,
  Promise<StoryboardImageCacheEntry>
>();
const MAX_CACHED_STORYBOARD_IMAGE_READS = 64;
const cachedStoryboardImageReads = new Map<
  string,
  Promise<{ bytes: Uint8Array; contentType: string } | null>
>();

const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
]);

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
};

const normalizeExtension = (extension?: string | null) => {
  const normalized = extension?.toLowerCase().replace(/^\./, "") || "";
  if (normalized === "jpg") return "jpeg";
  return SUPPORTED_IMAGE_EXTENSIONS.has(normalized) ? normalized : "png";
};

const getExtensionFromContentType = (contentType?: string | null) => {
  const normalized = contentType?.toLowerCase().split(";")[0]?.trim();
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpeg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/gif") return "gif";
  if (normalized === "image/webp") return "webp";
  return null;
};

const getContentTypeFromExtension = (extension?: string | null) => {
  const normalized = normalizeExtension(extension);
  if (normalized === "jpeg") return "image/jpeg";
  if (normalized === "gif") return "image/gif";
  if (normalized === "webp") return "image/webp";
  return "image/png";
};

const extractExtensionFromUrl = (url: string) => {
  try {
    const pathname = new URL(url).pathname;
    return normalizeExtension(pathname.split(".").pop());
  } catch {
    return "png";
  }
};

const getGeneratedImageRelativePath = (projectId: string, fileName: string) =>
  [projectId, "generate_image", fileName].filter(Boolean).join("/");

const getInFlightCacheKey = (
  projectId: string | null | undefined,
  url: string,
) => `${projectId || "global"}::${getStoryboardImageCacheKey(url)}`;

const rememberCachedImageRead = (
  key: string,
  task: Promise<{ bytes: Uint8Array; contentType: string } | null>,
) => {
  cachedStoryboardImageReads.set(key, task);
  while (cachedStoryboardImageReads.size > MAX_CACHED_STORYBOARD_IMAGE_READS) {
    const oldestKey = cachedStoryboardImageReads.keys().next().value;
    if (!oldestKey) break;
    cachedStoryboardImageReads.delete(oldestKey);
  }
};

const fetchImageBytes = async (
  source: string,
  signal?: AbortSignal,
): Promise<{ bytes: Uint8Array; contentType: string }> => {
  if (/^https?:\/\//i.test(source) && window.download?.imageAsBuffer) {
    const result = await window.download.imageAsBuffer(source);
    if (!result.success || !result.data?.data) {
      throw new Error(result.error || "图片下载失败");
    }
    return {
      bytes: new Uint8Array(result.data.data),
      contentType: result.data.mimeType || "image/png",
    };
  }

  const response = await fetch(source, { signal });
  if (!response.ok) {
    throw new Error(`图片下载失败: HTTP ${response.status}`);
  }

  const blob = await response.blob();
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    contentType:
      blob.type || response.headers.get("content-type") || "image/png",
  };
};

export const getStoryboardImageCacheKey = (url: string) => url.trim();

export const cacheStoryboardImageToProject = async ({
  projectId,
  url,
  rowIndex,
  signal,
}: CacheStoryboardImageOptions): Promise<StoryboardImageCacheEntry> => {
  const remoteUrl = url.trim();
  if (!remoteUrl || !projectId || !localStorageService.isAvailable()) {
    return { remoteUrl };
  }

  const cacheKey = getInFlightCacheKey(projectId, remoteUrl);
  const existingTask = inFlightStoryboardImageCache.get(cacheKey);
  if (existingTask) return existingTask;

  const task = (async () => {
    const image = await fetchImageBytes(remoteUrl, signal);
    const extension =
      getExtensionFromContentType(image.contentType) ??
      extractExtensionFromUrl(remoteUrl);
    const fileName = generateFileName(
      rowIndex == null ? "storyboard" : `storyboard-${rowIndex + 1}`,
      extension,
    );
    const saveResult = await localStorageService.saveGeneratedImage(
      projectId,
      fileName,
      toArrayBuffer(image.bytes),
    );
    if (!saveResult.success) {
      throw new Error(saveResult.error || "保存分镜图缓存失败");
    }

    return {
      remoteUrl,
      localName: fileName,
      localPath: getGeneratedImageRelativePath(projectId, fileName),
      contentType: image.contentType || getContentTypeFromExtension(extension),
      extension,
      cachedAt: Date.now(),
    };
  })();

  inFlightStoryboardImageCache.set(cacheKey, task);
  try {
    return await task;
  } finally {
    inFlightStoryboardImageCache.delete(cacheKey);
  }
};

export const readCachedStoryboardImage = async (
  entry?: StoryboardImageCacheEntry | null,
): Promise<{ bytes: Uint8Array; contentType: string } | null> => {
  if (!entry?.localPath || !localStorageService.isAvailable()) {
    return null;
  }

  const cacheKey = entry.localPath;
  const existingRead = cachedStoryboardImageReads.get(cacheKey);
  if (existingRead) return existingRead;

  const readTask = (async () => {
    const result = await localStorageService.readMedia(entry.localPath!);
    if (!result.success || !result.data) {
      return null;
    }

    return {
      bytes: new Uint8Array(result.data),
      contentType:
        entry.contentType ||
        getContentTypeFromExtension(entry.extension || entry.localPath),
    };
  })();

  rememberCachedImageRead(cacheKey, readTask);
  try {
    return await readTask;
  } catch (error) {
    cachedStoryboardImageReads.delete(cacheKey);
    throw error;
  }
};

export const readInFlightStoryboardImage = async (
  url: string,
  projectId?: string | null,
): Promise<{ bytes: Uint8Array; contentType: string } | null> => {
  const task = inFlightStoryboardImageCache.get(
    getInFlightCacheKey(projectId, url),
  );
  if (!task) return null;

  try {
    return readCachedStoryboardImage(await task);
  } catch {
    return null;
  }
};
