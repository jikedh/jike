import type { AssetRecord } from "service/assetStorage";
import {
  ensureAssetOssUrl,
  getAssetFileUrl,
  getAssetStoragePath,
} from "service/assetStorage";
import { GenerationStatus } from "shared/constants/enum";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import {
  getAspectRatioFromImageUrl,
  getExactAspectRatio,
  getVideoDimensions,
} from "../CustomNodes/ImageNode/utils/aspectRatioUtils";

type InsertPosition = {
  x: number;
  y: number;
};

const getLocalName = (path: string) => path.split("/").pop() || "asset";

const isAbsoluteMediaUrl = (value: string) =>
  /^(https?:|file:|blob:|data:)/i.test(value.trim());

const getProjectStoragePath = () => {
  try {
    const raw = localStorage.getItem("canvas-chat-settings");
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return parsed.state?.storagePath || "";
  } catch {
    return "";
  }
};

const resolveAssetFileUrl = (asset: AssetRecord) => {
  // 优先使用创建时已有的 OSS 公网 URL。
  if (asset.ossUrl) {
    return asset.ossUrl;
  }

  if (isAbsoluteMediaUrl(asset.fileUrl)) {
    return asset.fileUrl;
  }

  const basePath =
    asset.source?.type === "canvas" && !asset.fileUrl.startsWith("assets/")
      ? getProjectStoragePath()
      : getAssetStoragePath();

  return getAssetFileUrl(basePath, asset.fileUrl);
};

const resolveAssetRemoteUrl = async (asset: AssetRecord) => {
  if (asset.source?.type === "canvas") {
    return resolveAssetFileUrl(asset);
  }

  const basePath = getAssetStoragePath();
  if (!basePath) {
    return resolveAssetFileUrl(asset);
  }

  return ensureAssetOssUrl(basePath, asset);
};

const getNodeLocalPath = (asset: AssetRecord) => {
  const candidate =
    asset.source?.type === "canvas"
      ? asset.originalFile || asset.fileUrl
      : asset.fileUrl;

  return candidate && !isAbsoluteMediaUrl(candidate) ? candidate : "";
};

const getAspectRatioFromAssetUrl = async (
  fileUrl: string,
  mediaType: AssetRecord["mediaType"],
) => {
  try {
    if (mediaType === "image") {
      return await getAspectRatioFromImageUrl(fileUrl);
    }

    if (mediaType === "video") {
      const dimensions = await getVideoDimensions(fileUrl);
      return getExactAspectRatio(dimensions.width, dimensions.height);
    }
  } catch (error) {
    console.warn("[assetInsert] get asset aspect ratio failed", error);
  }

  return null;
};

export const insertAssetIntoCanvas = async (
  asset: AssetRecord,
  position: InsertPosition,
) => {
  const store = useCanvasFlowStore.getState();
  const fileUrl = await resolveAssetRemoteUrl(asset);
  const localPath = getNodeLocalPath(asset);
  const localName = getLocalName(
    localPath || asset.originalFile || asset.fileUrl,
  );
  const aspectRatio = await getAspectRatioFromAssetUrl(
    fileUrl,
    asset.mediaType,
  );

  if (asset.mediaType === "image") {
    const nodeId = store.addNode("image", position);
    store.updateImageNodeData(nodeId, {
      nickname: asset.name,
      status: GenerationStatus.COMPLETED,
      progress: 100,
      isUpload: true,
      ...(aspectRatio ? { size: aspectRatio } : {}),
      result: {
        type: "image",
        data: [
          {
            url: fileUrl,
            ...(localPath ? { localPath } : {}),
            localName,
            assetName: asset.name,
          },
        ],
      },
    });
  } else if (asset.mediaType === "video") {
    const nodeId = store.addNode("newVideo", position);
    store.updateNewVideoNodeData(nodeId, {
      nickname: asset.name,
      status: GenerationStatus.COMPLETED,
      progress: 100,
      isUpload: true,
      ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
      result: {
        type: "video",
        data: [
          {
            url: fileUrl,
            ...(localPath ? { localPath } : {}),
            localName,
            assetName: asset.name,
            format: localName.split(".").pop() || "mp4",
            ...(asset.coverUrl ? { coverUrl: asset.coverUrl } : {}),
          },
        ],
      },
    });
  } else {
    const nodeId = store.addNode("audio", position);
    store.updateAudioNodeData(nodeId, {
      nickname: asset.name,
      status: GenerationStatus.COMPLETED,
      progress: 100,
      isUpload: true,
      result: {
        type: "audio",
        data: [
          {
            url: fileUrl,
            ...(localPath ? { localPath } : {}),
            localName,
            assetName: asset.name,
            format: localName.split(".").pop() || "mp3",
          },
        ],
      },
    });
  }

  store.requestHistorySave();
  store.saveGraph();
};
