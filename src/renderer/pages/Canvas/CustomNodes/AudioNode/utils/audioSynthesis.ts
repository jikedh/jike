import type { AudioTtsSegment } from "shared/types/audio";
import { copyMediaUrlToOss, uploadFileToOSS } from "service/oss";

type MaterializedAudio = {
    url: string;
    format: string;
    duration?: number;
};

const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const channelCount = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const blockAlign = channelCount * 2;
    const dataLength = buffer.length * blockAlign;
    const output = new ArrayBuffer(44 + dataLength);
    const view = new DataView(output);
    const writeString = (offset: number, value: string) => {
        for (let index = 0; index < value.length; index++) {
            view.setUint8(offset + index, value.charCodeAt(index));
        }
    };

    writeString(0, "RIFF");
    view.setUint32(4, output.byteLength - 8, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channelCount, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, dataLength, true);

    let offset = 44;
    for (let frame = 0; frame < buffer.length; frame++) {
        for (let channel = 0; channel < channelCount; channel++) {
            const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[frame]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
            offset += 2;
        }
    }

    return new Blob([output], { type: "audio/wav" });
};

const copyResampledChannel = (
    source: Float32Array,
    target: Float32Array,
    targetOffset: number,
    targetLength: number,
) => {
    if (source.length === targetLength) {
        target.set(source, targetOffset);
        return;
    }

    const ratio = source.length / targetLength;
    for (let index = 0; index < targetLength; index++) {
        const sourcePosition = index * ratio;
        const leftIndex = Math.floor(sourcePosition);
        const rightIndex = Math.min(source.length - 1, leftIndex + 1);
        const mix = sourcePosition - leftIndex;
        target[targetOffset + index] =
            source[leftIndex] * (1 - mix) + source[rightIndex] * mix;
    }
};

const persistAudioSource = async (url: string) => {
    const persistedUrl = await copyMediaUrlToOss(url);
    if (!persistedUrl) throw new Error("生成音频转存失败");
    return persistedUrl;
};

export const materializeAudioSegments = async (
    segments: AudioTtsSegment[],
): Promise<MaterializedAudio> => {
    const audioSegments = segments.filter(
        (segment): segment is AudioTtsSegment & { url: string } =>
            segment.type === "audio" && Boolean(segment.url),
    );
    if (audioSegments.length === 0) throw new Error("语音服务未返回有效音频");

    const persistedUrls = new Map<AudioTtsSegment, string>();
    for (const segment of audioSegments) {
        persistedUrls.set(segment, await persistAudioSource(segment.url));
    }

    const needsMerge =
        audioSegments.length > 1 ||
        segments.some(
            (segment) => segment.type === "silence" && (segment.durationMs ?? 0) > 0,
        );
    if (!needsMerge) {
        return { url: persistedUrls.get(audioSegments[0])!, format: "mp3" };
    }

    const audioContext = new AudioContext();
    try {
        const decodedBuffers = new Map<AudioTtsSegment, AudioBuffer>();
        for (const segment of audioSegments) {
            const response = await fetch(persistedUrls.get(segment)!);
            if (!response.ok) throw new Error("读取生成音频失败");
            decodedBuffers.set(segment, await audioContext.decodeAudioData(await response.arrayBuffer()));
        }

        const sampleRate = audioContext.sampleRate;
        const channelCount = Math.max(
            1,
            ...Array.from(decodedBuffers.values()).map((buffer) => buffer.numberOfChannels),
        );
        const totalFrames = segments.reduce((total, segment) => {
            if (segment.type === "silence") {
                return total + Math.round(((segment.durationMs ?? 0) / 1000) * sampleRate);
            }
            return total + Math.round((decodedBuffers.get(segment)?.duration ?? 0) * sampleRate);
        }, 0);
        const outputBuffer = audioContext.createBuffer(channelCount, Math.max(1, totalFrames), sampleRate);

        let targetOffset = 0;
        for (const segment of segments) {
            if (segment.type === "silence") {
                targetOffset += Math.round(((segment.durationMs ?? 0) / 1000) * sampleRate);
                continue;
            }
            const sourceBuffer = decodedBuffers.get(segment);
            if (!sourceBuffer) continue;
            const targetLength = Math.round(sourceBuffer.duration * sampleRate);
            for (let channel = 0; channel < channelCount; channel++) {
                copyResampledChannel(
                    sourceBuffer.getChannelData(Math.min(channel, sourceBuffer.numberOfChannels - 1)),
                    outputBuffer.getChannelData(channel),
                    targetOffset,
                    targetLength,
                );
            }
            targetOffset += targetLength;
        }

        const upload = await uploadFileToOSS(
            new File([audioBufferToWav(outputBuffer)], `generated_audio_${Date.now()}.wav`, {
                type: "audio/wav",
            }),
        );
        if (!upload.url) throw new Error("合并音频上传失败");
        return { url: upload.url, format: "wav", duration: outputBuffer.duration };
    } finally {
        await audioContext.close();
    }
};
