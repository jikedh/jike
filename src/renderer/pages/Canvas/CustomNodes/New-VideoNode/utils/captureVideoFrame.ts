export type VideoFrameCaptureMode = "current" | "start" | "end";

export const getVideoFrameCaptureTime = (
    video: HTMLVideoElement,
    mode: VideoFrameCaptureMode,
) => {
    if (!video.videoWidth || !video.videoHeight) {
        throw new Error("视频尚未加载完成，请稍后重试");
    }

    return mode === "current" ? Math.max(0, video.currentTime) : 0;
};