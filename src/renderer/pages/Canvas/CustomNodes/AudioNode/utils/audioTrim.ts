const writeAscii = (view: DataView, offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset + index, value.charCodeAt(index));
    }
};

const encodeAudioClipAsWav = (
    audioBuffer: AudioBuffer,
    startFrame: number,
    endFrame: number,
) => {
    const channelCount = audioBuffer.numberOfChannels;
    const frameCount = endFrame - startFrame;
    const bytesPerSample = 2;
    const dataSize = frameCount * channelCount * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    writeAscii(view, 0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeAscii(view, 8, "WAVE");
    writeAscii(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channelCount, true);
    view.setUint32(24, audioBuffer.sampleRate, true);
    view.setUint32(
        28,
        audioBuffer.sampleRate * channelCount * bytesPerSample,
        true,
    );
    view.setUint16(32, channelCount * bytesPerSample, true);
    view.setUint16(34, 16, true);
    writeAscii(view, 36, "data");
    view.setUint32(40, dataSize, true);

    const channels = Array.from({ length: channelCount }, (_, channel) =>
        audioBuffer.getChannelData(channel),
    );
    let offset = 44;

    for (let frame = startFrame; frame < endFrame; frame += 1) {
        for (let channel = 0; channel < channelCount; channel += 1) {
            const sample = Math.max(-1, Math.min(1, channels[channel][frame] ?? 0));
            view.setInt16(
                offset,
                sample < 0 ? sample * 0x8000 : sample * 0x7fff,
                true,
            );
            offset += bytesPerSample;
        }
    }

    return new Blob([buffer], { type: "audio/wav" });
};

export const createTrimmedAudioFile = async (
    audioUrl: string,
    startTime: number,
    endTime: number,
) => {
    const response = await fetch(audioUrl);
    if (!response.ok) {
        throw new Error("无法读取待截取的音频文件");
    }

    const audioContext = new AudioContext();
    try {
        const audioBuffer = await audioContext.decodeAudioData(
            await response.arrayBuffer(),
        );
        const safeStartTime = Math.max(0, Math.min(startTime, audioBuffer.duration));
        const safeEndTime = Math.max(
            safeStartTime,
            Math.min(endTime, audioBuffer.duration),
        );
        const startFrame = Math.floor(safeStartTime * audioBuffer.sampleRate);
        const endFrame = Math.min(
            audioBuffer.length,
            Math.ceil(safeEndTime * audioBuffer.sampleRate),
        );

        if (endFrame <= startFrame) {
            throw new Error("截取区间无效");
        }

        const blob = encodeAudioClipAsWav(audioBuffer, startFrame, endFrame);
        return new File([blob], `audio-clip-${Date.now()}.wav`, {
            type: "audio/wav",
        });
    } finally {
        await audioContext.close();
    }
};
