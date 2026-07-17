import { GenerationStatus } from "shared/constants/enum";
import {
  detectMediaType,
  type MediaFileType,
} from "shared/constants/mediaTypes";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import {
  getAspectRatioFromImageUrl,
  getExactAspectRatio,
  getVideoDimensions,
} from "../CustomNodes/ImageNode/utils/aspectRatioUtils";

type FlowPosition = { x: number; y: number };

export type OssUploadResult = {
  url: string;
  name: string;
  key: string;
  size: number;
  contentType: string;
};

export type DroppedFile = {
  name: string;
  size: number;
  contentType: string;
  mediaType: MediaFileType;
};

const getAspectRatio = async (
  fileUrl: string,
  mediaType: MediaFileType,
): Promise<string | null> => {
  try {
    if (mediaType === "image") {
      return await getAspectRatioFromImageUrl(fileUrl);
    }
    if (mediaType === "video") {
      const dimensions = await getVideoDimensions(fileUrl);
      return getExactAspectRatio(dimensions.width, dimensions.height);
    }
  } catch (error) {
    console.warn("[fileDropInsert] get aspect ratio failed", error);
  }
  return null;
};

/**
 * 将 OSS 上传完成的文件插入画布，创建对应媒体节点。
 * 参考 assetInsert.ts 中的 insertAssetIntoCanvas 逻辑。
 */
export function insertFileDropIntoCanvas(
  file: DroppedFile,
  uploadResult: OssUploadResult,
  position: FlowPosition,
): string | null {
  const store = useCanvasFlowStore.getState();
  const mediaType = file.mediaType;
  const localName = file.name;
  const format = localName.split(".").pop() || "";

  if (mediaType === "unknown") {
    return null;
  }

  const nodeType = mediaType === "image"
    ? "image"
    : mediaType === "video"
      ? "newVideo"
      : "audio";

  const nodeId = store.addNode(nodeType as "image" | "newVideo" | "audio", position);

  if (mediaType === "image") {
    store.updateImageNodeData(nodeId, {
      nickname: file.name,
      status: GenerationStatus.COMPLETED,
      progress: 100,
      isUpload: true,
      result: {
        type: "image",
        data: [
          {
            url: uploadResult.url,
          },
        ],
      },
    });
  } else if (mediaType === "video") {
    store.updateNewVideoNodeData(nodeId, {
      nickname: file.name,
      status: GenerationStatus.COMPLETED,
      progress: 100,
      isUpload: true,
      result: {
        type: "video",
        data: [
          {
            url: uploadResult.url,
            localPath: uploadResult.key,
            localName,
            format,
          },
        ],
      },
    });
  } else {
    store.updateAudioNodeData(nodeId, {
      nickname: file.name,
      status: GenerationStatus.COMPLETED,
      progress: 100,
      isUpload: true,
      result: {
        type: "audio",
        data: [
          {
            url: uploadResult.url,
            localPath: uploadResult.key,
            localName,
            format,
          },
        ],
      },
    });
  }

  store.requestHistorySave();
  store.saveGraph();

  return nodeId;
}

/**
 * 异步补充宽高比信息到已创建的节点。
 * 在节点已渲染后调用，避免阻塞节点创建。
 */
export async function applyAspectRatioToNode(
  nodeId: string,
  mediaType: MediaFileType,
  fileUrl: string,
): Promise<void> {
  const store = useCanvasFlowStore.getState();
  const aspectRatio = await getAspectRatio(fileUrl, mediaType);

  if (!aspectRatio) return;

  if (mediaType === "image") {
    store.updateImageNodeData(nodeId, { size: aspectRatio });
  } else if (mediaType === "video") {
    store.updateNewVideoNodeData(nodeId, { aspect_ratio: aspectRatio });
  }
}
