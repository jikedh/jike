import type { AssetRecord } from "service/assetStorage";
import { getAssetFileUrl, getAssetStoragePath } from "service/assetStorage";
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
  const assetStoragePath = getAssetStoragePath();
  const fileUrl = getAssetFileUrl(assetStoragePath, asset.fileUrl);
  const localName = getLocalName(asset.fileUrl);
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
            localPath: asset.fileUrl,
            localName,
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
            localPath: asset.fileUrl,
            localName,
            format: localName.split(".").pop() || "mp4",
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
            localPath: asset.fileUrl,
            localName,
            format: localName.split(".").pop() || "mp3",
          },
        ],
      },
    });
  }

  store.requestHistorySave();
  store.saveGraph();
};
