type MediaLike = Record<string, unknown> & {
  url?: string;
  remoteUrl?: string;
  displayUrl?: string;
  localPath?: string;
  relativePath?: string;
  localName?: string;
  localFileName?: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isEphemeralMediaUrl(url?: string | null): boolean {
  if (!url) return false;
  return /^(blob:|data:)/i.test(url.trim());
}

export function getRemoteMediaUrl(item?: Partial<MediaLike> | null): string | undefined {
  if (!item) return undefined;
  if (typeof item.remoteUrl === "string" && item.remoteUrl.trim()) {
    return item.remoteUrl.trim();
  }
  if (typeof item.url === "string" && item.url.trim() && !isEphemeralMediaUrl(item.url)) {
    return item.url.trim();
  }
  return undefined;
}

export function getDisplayMediaUrl(item?: Partial<MediaLike> | null): string | undefined {
  if (!item) return undefined;
  if (typeof item.displayUrl === "string" && item.displayUrl.trim()) {
    return item.displayUrl.trim();
  }
  if (typeof item.url === "string" && item.url.trim()) {
    return item.url.trim();
  }
  return getRemoteMediaUrl(item);
}

function hasMediaShape(value: Record<string, unknown>): value is MediaLike {
  return (
    "url" in value ||
    "remoteUrl" in value ||
    "displayUrl" in value ||
    "localPath" in value ||
    "relativePath" in value ||
    "localName" in value ||
    "localFileName" in value
  );
}

function syncCompatibilityFields<T extends MediaLike>(item: T): T {
  const next = { ...item };
  const localPath = next.localPath || next.relativePath;
  const localName = next.localName || next.localFileName;

  if (localPath) {
    next.localPath = String(localPath);
    next.relativePath = String(localPath);
  }

  if (localName) {
    next.localName = String(localName);
    next.localFileName = String(localName);
  }

  return next;
}

export function hydrateMediaForRuntime<T extends MediaLike>(
  item: T,
  displayUrl?: string,
): T {
  const normalized = syncCompatibilityFields(item);
  const remoteUrl = getRemoteMediaUrl(normalized);
  const nextDisplayUrl = displayUrl || getDisplayMediaUrl(normalized);

  return {
    ...normalized,
    remoteUrl,
    displayUrl: nextDisplayUrl,
    url: remoteUrl || nextDisplayUrl || "",
  };
}

export function sanitizeMediaForPersistence<T extends MediaLike>(item: T): T {
  const normalized = syncCompatibilityFields(item);
  const remoteUrl = getRemoteMediaUrl(normalized);
  const persistedUrl =
    remoteUrl ||
    (typeof normalized.url === "string" && !isEphemeralMediaUrl(normalized.url)
      ? normalized.url.trim()
      : "");

  const { displayUrl: _displayUrl, ...rest } = normalized;

  return {
    ...rest,
    remoteUrl,
    url: persistedUrl,
  } as T;
}

export function sanitizeMediaTreeForPersistence<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMediaTreeForPersistence(item)) as T;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const next: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(value)) {
    if (key === "displayUrl") {
      continue;
    }
    next[key] = sanitizeMediaTreeForPersistence(child);
  }

  if (hasMediaShape(next)) {
    return sanitizeMediaForPersistence(next) as T;
  }

  return next as T;
}
