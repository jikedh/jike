export type VideoPosterFields = {
  url?: string;
  remoteUrl?: string;
  thumbnailUrl?: string;
  posterUrl?: string;
  coverUrl?: string;
  mediaType?: string;
};

export const isAliyunOssUrl = (url?: string | null) => {
  if (!url) {
    return false;
  }

  try {
    return new URL(url).hostname.includes("aliyuncs.com");
  } catch {
    return false;
  }
};

export const buildVideoPosterUrl = (url?: string | null) => {
  if (!isAliyunOssUrl(url)) {
    return undefined;
  }

  const [baseUrl] = (url as string).split("?");
  return `${baseUrl}?x-oss-process=video/snapshot,t_1000,f_jpg,w_480,h_0,interlace_1`;
};

export const getVideoPosterUrl = (
  item?: VideoPosterFields | null,
): string | undefined => {
  if (!item) {
    return undefined;
  }

  return (
    item.posterUrl ||
    item.thumbnailUrl ||
    item.coverUrl ||
    buildVideoPosterUrl(item.remoteUrl || item.url)
  );
};

export const withVideoPosterFields = <T extends VideoPosterFields>(item: T) => {
  const posterUrl = getVideoPosterUrl(item);

  return {
    ...item,
    mediaType: "video" as const,
    ...(posterUrl
      ? {
          posterUrl,
          thumbnailUrl: item.thumbnailUrl ?? posterUrl,
          coverUrl: item.coverUrl ?? posterUrl,
        }
      : {}),
  };
};
