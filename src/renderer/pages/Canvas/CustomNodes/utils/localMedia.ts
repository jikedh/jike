import {
  type MediaRef,
  saveMediaBuffer,
  saveMediaFromUrl,
} from "service/projectStorage";

type MediaType = "image" | "video" | "generate_image" | "generate_video";

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

  const buffer = await file.arrayBuffer();
  const localRef = await saveMediaBuffer(
    projectId,
    buffer,
    mediaType,
    extension,
    fileNamePrefix,
  );
  return mergeLocalMediaRef(item, localRef);
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

  const localRef = await saveMediaFromUrl(
    projectId,
    item.url,
    mediaType,
    extension,
    fileNamePrefix,
  );
  return mergeLocalMediaRef(item, localRef);
};
