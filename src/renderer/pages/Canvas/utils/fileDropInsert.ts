import { GenerationStatus } from "shared/constants/enum";
import {
  detectMediaType,
  type MediaFileType,
} from "shared/constants/mediaTypes";
import {
  FILE_DROP_MAX_COUNT,
  FILE_DROP_MAX_SIZE,
} from "shared/constants/fileDrop";
import { uploadFileToOSS } from "service/oss";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { toast } from "sonner";
import {
  getAspectRatioFromImageUrl,
  getExactAspectRatio,
  getVideoDimensions,
} from "../CustomNodes/ImageNode/utils/aspectRatioUtils";

type FlowPosition = { x: number; y: number };

type OssUploadResult = {
  url: string;
  name: string;
  key: string;
  size: number;
  contentType: string;
};

const getLocalName = (path: string) => path.split("/").pop() || path.split("\\").pop() || "file";

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
 * 批量上传文件到 OSS。
 * 对每个文件调用 uploadFileToOSS，失败时返回 null。
 */
export async function uploadFilesToOss(
  files: File[],
): Promise<Array<{ file: File; uploadResult: OssUploadResult } | null>> {
  // 过滤超大文件
  const validFiles = files.filter((f) => {
    if (f.size > FILE_DROP_MAX_SIZE) {
      toast.warning(`${f.name} 超过 500MB 限制，已跳过`);
      return false;
    }
    return true;
  });

  // 限制数量
  const toUpload = validFiles.slice(0, FILE_DROP_MAX_COUNT);
  if (validFiles.length > FILE_DROP_MAX_COUNT) {
    toast.warning(`最多支持一次拖入 ${FILE_DROP_MAX_COUNT} 个文件，已截断`);
  }

  const results: Array<{ file: File; uploadResult: OssUploadResult } | null> = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < toUpload.length; i++) {
    const file = toUpload[i];
    try {
      const uploadResult = await uploadFileToOSS(file);
      if (!uploadResult.url) {
        throw new Error("upload returned empty url");
      }
      results.push({ file, uploadResult });
      successCount++;
    } catch (error) {
      console.warn(`[fileDropInsert] upload failed: ${file.name}`, error);
      results.push(null);
      failCount++;
    }
  }

  // 汇总通知
  if (failCount > 0 && successCount > 0) {
    toast.warning(`已创建 ${successCount} 个节点，${failCount} 个文件上传失败`);
  } else if (failCount > 0 && successCount === 0) {
    toast.error(`${failCount} 个文件上传失败，请重试`);
  }

  return results;
}

/**
 * 将 OSS 上传完成的文件插入画布，创建对应媒体节点。
 * 参考 assetInsert.ts 中的 insertAssetIntoCanvas 逻辑。
 */
export function insertFileDropIntoCanvas(
  file: File,
  uploadResult: OssUploadResult,
  position: FlowPosition,
): string | null {
  const store = useCanvasFlowStore.getState();
  const mediaType = detectMediaType(file.name, file.type);
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
