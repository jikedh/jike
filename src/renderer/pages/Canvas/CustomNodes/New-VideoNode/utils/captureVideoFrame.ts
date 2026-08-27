export type VideoFrameCaptureMode = "current" | "start" | "end";

export const getVideoFrameCaptureTime = (
    video: HTMLVideoElement,
    mode: VideoFrameCaptureMode,
) => {
    if (!video.videoWidth || !video.videoHeight) {
        throw new Error("视频尚未加载完成，请稍后重试");
    }

    if (mode !== "current") {
        return 0;
    }

    const current = Math.max(0, video.currentTime);
    // 末尾留 0.2s 余量，与服务端截帧钳制保持一致，避免截到空帧
    const safeEnd = Math.max(0, video.duration - 0.2);
    return Number.isFinite(safeEnd) ? Math.min(current, safeEnd) : current;
};