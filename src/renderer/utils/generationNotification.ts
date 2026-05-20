import { GenerationStatus } from "shared/constants/enum";
import type { AllNodeType } from "shared/types/flow";

type GenerationNotificationType = "image" | "video";
const notificationBodyMap: Record<GenerationNotificationType, string> = {
    image: "图片生成任务已完成，可以回到画布查看结果。",
    video: "视频生成任务已完成，可以回到画布查看结果。",
};
const notificationTitleMap: Record<GenerationNotificationType, string> = {
    image: "图片生成完成",
    video: "视频生成完成",
};
const resultCountMap: Record<
    GenerationNotificationType,
    (node: AllNodeType) => number
> = {
    image: (node) =>
        node.type === "imageNode"
            ? (node.data.result?.data?.filter((item) => item?.url).length ?? 0)
            : 0,
    video: (node) =>
        node.type === "newVideoNode"
            ? (node.data.result?.data?.filter((item) => item?.url).length ?? 0)
            : 0,
};
export const notifyGenerationCompleted = (
    type: GenerationNotificationType,
) => {
    void window.notification?.show({
        title: notificationTitleMap[type],
        body: notificationBodyMap[type],
    });
};
export const notifyCompletedGenerationDiff = (
    previousNodes: AllNodeType[],
    nextNodes: AllNodeType[],
) => {
    const previousNodeMap = new Map(previousNodes.map((node) => [node.id, node]));
    const shouldNotifyMap: Record<GenerationNotificationType, boolean> = {
        image: false,
        video: false,
    };
    nextNodes.forEach((node) => {
        const type =
            node.type === "imageNode"
                ? "image"
                : node.type === "newVideoNode"
                    ? "video"
                    : null;
        if (!type || node.data.status !== GenerationStatus.COMPLETED) {
            return;
        }
        const previousNode = previousNodeMap.get(node.id);
        const previousStatus = previousNode?.data.status;
        const wasGenerating =
            previousStatus === GenerationStatus.QUEUED ||
            previousStatus === GenerationStatus.IN_PROGRESS;
        if (!wasGenerating) {
            return;
        }
        const currentCount = resultCountMap[type](node);
        const previousCount = previousNode ? resultCountMap[type](previousNode) : 0;
        if (currentCount > previousCount) {
            shouldNotifyMap[type] = true;
        }
    });
    if (shouldNotifyMap.image) {
        notifyGenerationCompleted("image");
    }
    if (shouldNotifyMap.video) {
        notifyGenerationCompleted("video");
    }
};
