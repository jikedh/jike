const MAX_AUDIO_SIZE = 20 * 1024 * 1024;
const MIN_AUDIO_DURATION = 10;
const MAX_AUDIO_DURATION = 5 * 60;

export const getCloneAudioValidationMessage = (file: File) => {
    const isSupported =
        /\.(mp3|m4a|wav)$/i.test(file.name) ||
        ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/x-wav"].includes(
            file.type,
        );

    if (!isSupported) return "请选择 MP3、M4A 或 WAV 音频";
    if (file.size > MAX_AUDIO_SIZE) return "音频文件不能超过20MB";
    return "";
};

export const getAudioDuration = (file: File): Promise<number> =>
    new Promise((resolve, reject) => {
        const audio = document.createElement("audio");
        const objectURL = URL.createObjectURL(file);
        const cleanup = () => {
            audio.removeAttribute("src");
            audio.load();
            URL.revokeObjectURL(objectURL);
        };

        audio.preload = "metadata";
        audio.onloadedmetadata = () => {
            const duration = audio.duration;
            cleanup();
            if (!Number.isFinite(duration)) {
                reject(new Error("无法读取音频时长"));
                return;
            }
            resolve(duration);
        };
        audio.onerror = () => {
            cleanup();
            reject(new Error("无法读取音频文件"));
        };
        audio.src = objectURL;
    });

export const isCloneAudioDurationValid = (duration: number) =>
    duration >= MIN_AUDIO_DURATION && duration <= MAX_AUDIO_DURATION;
