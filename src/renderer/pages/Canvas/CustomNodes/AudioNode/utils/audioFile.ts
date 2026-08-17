export const AUDIO_FILE_EXTENSIONS = /\.(mp3|wav|ogg|aac)$/i;

export const isSupportedUploadAudioFile = (file: File) =>
    ["audio/mpeg", "audio/wav", "audio/mp3", "audio/ogg", "audio/aac"].includes(
        file.type,
    ) || AUDIO_FILE_EXTENSIONS.test(file.name);

export const getAudioDownloadExtension = (format?: string) =>
    typeof format === "string" && /^(mp3|wav|ogg|aac)$/i.test(format)
        ? format.toLowerCase()
        : "mp3";
