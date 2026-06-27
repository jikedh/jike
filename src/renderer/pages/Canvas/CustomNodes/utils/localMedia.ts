type MediaType = "image" | "video" | "generate_image" | "generate_video";

type MediaRef = {
  url: string;
  remoteUrl?: string;
  localName?: string;
  localPath?: string;
};

export const mergeLocalMediaRef = <T extends { url: string; remoteUrl?: string }>(
  item: T,
  localRef: MediaRef,
): T & Pick<MediaRef, "remoteUrl" | "localName" | "localPath"> => ({
  ...item,
  remoteUrl: item.remoteUrl ?? localRef.remoteUrl ?? item.url,
  localName: localRef.localName,
  localPath: localRef.localPath,
});

export const saveToolMediaFileToProject = async <T extends { url: string }>(
  projectId: string | null | undefined,
  item: T,
  file: File,
  mediaType: MediaType,
  extension: string,
  fileNamePrefix?: string,
): Promise<T & Pick<MediaRef, "remoteUrl" | "localName" | "localPath">> => {
  if (!projectId) {
    return item;
  }

  void file;
  void mediaType;
  void extension;
  void fileNamePrefix;
  return mergeLocalMediaRef(item, { url: item.url, remoteUrl: item.url });
};

export const saveToolMediaUrlToProject = async <T extends { url: string }>(
  projectId: string | null | undefined,
  item: T,
  mediaType: MediaType,
  extension?: string,
  fileNamePrefix?: string,
): Promise<T & Pick<MediaRef, "remoteUrl" | "localName" | "localPath">> => {
  if (!projectId) {
    return item;
  }

  void mediaType;
  void extension;
  void fileNamePrefix;
  return mergeLocalMediaRef(item, { url: item.url, remoteUrl: item.url });
};
