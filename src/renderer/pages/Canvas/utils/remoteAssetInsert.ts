/**
 * Canvas 远程资产插入
 *
 * 将 RemoteAsset（来自后端）插入为画布节点。
 * 与旧版 `assetInsert.ts` 区别：
 * - 直接使用 fileUrl / thumbnailUrl（公网可达）
 * - 不再依赖本地资产路径、OSS 懒上传、本地存储 service
 * - 节点宽高比从 width/height 直接得出，无需读 Image/Video DOM
 */

import { GenerationStatus } from "shared/constants/enum";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import {
    getAspectRatioFromImageUrl,
    getExactAspectRatio,
    getVideoDimensions,
} from "../CustomNodes/ImageNode/utils/aspectRatioUtils";
import { guessExtensionFromUrl, type RemoteAsset } from "./remoteAssets";

interface InsertPosition {
    x: number;
    y: number;
}

const getAspectRatio = async (asset: RemoteAsset): Promise<string | null> => {
    if (asset.width && asset.height && asset.width > 0 && asset.height > 0) {
        return getExactAspectRatio(asset.width, asset.height);
    }

    try {
        if (asset.mediaType === "image" && asset.fileUrl) {
            return await getAspectRatioFromImageUrl(asset.fileUrl);
        }
        if (asset.mediaType === "video" && asset.fileUrl) {
            const dimensions = await getVideoDimensions(asset.fileUrl);
            return getExactAspectRatio(dimensions.width, dimensions.height);
        }
    } catch (error) {
        console.warn("[remoteAssetInsert] aspect ratio failed", error);
    }
    return null;
};

const buildLocalName = (asset: RemoteAsset, defaultExt: string) => {
    const ext = guessExtensionFromUrl(asset.fileUrl) || defaultExt;
    const safeName = asset.name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "asset";
    return `${safeName}.${ext}`;
};

/**
 * 将远程资产插入画布。
 *
 * 调用方约定：
 * - `asset.fileUrl` 必须为绝对 URL（http/https/blob/data），由后端返回
 * - 插入完成后会自动触发画布历史快照与保存
 */
export const insertRemoteAssetIntoCanvas = async (
    asset: RemoteAsset,
    position: InsertPosition,
) => {
    if (!asset.fileUrl) {
        throw new Error("资产 URL 不存在");
    }

    const store = useCanvasFlowStore.getState();
    const aspectRatio = await getAspectRatio(asset);

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
                        url: asset.fileUrl,
                        localName: buildLocalName(asset, "png"),
                        assetName: asset.name,
                    },
                ],
            },
        });
    } else if (asset.mediaType === "video") {
        const nodeId = store.addNode("newVideo", position);
        const localName = buildLocalName(asset, "mp4");
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
                        url: asset.fileUrl,
                        localName,
                        assetName: asset.name,
                        format: localName.split(".").pop() || "mp4",
                        ...(asset.thumbnailUrl ? { coverUrl: asset.thumbnailUrl } : {}),
                    },
                ],
            },
        });
    } else {
        const nodeId = store.addNode("audio", position);
        const localName = buildLocalName(asset, "mp3");
        store.updateAudioNodeData(nodeId, {
            nickname: asset.name,
            status: GenerationStatus.COMPLETED,
            progress: 100,
            isUpload: true,
            result: {
                type: "audio",
                data: [
                    {
                        url: asset.fileUrl,
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
