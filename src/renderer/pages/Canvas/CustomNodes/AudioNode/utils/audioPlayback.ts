export const formatAudioTime = (time: number) => {
    const safeTime = Number.isFinite(time) ? Math.max(0, time) : 0;
    const minutes = Math.floor(safeTime / 60);
    const seconds = Math.floor(safeTime % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};
