import { IconMusic, IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react";
import { memo } from "react";
import { GenerationStatus } from "shared/constants/enum";
import type { AudioNodeType } from "shared/types/flow";
import { useAudioPlayback } from "../hooks/useAudioPlayback";
import { formatAudioTime } from "../utils/audioPlayback";
import { GenerationErrorTooltip } from "../../shared/GenerationErrorTooltip";

type AudioContentProps = {
    data: AudioNodeType["data"];
    audioRef: React.RefObject<HTMLAudioElement | null>;
};

export const AudioContent = memo(({ data, audioRef }: AudioContentProps) => {
    const audioUrl = data.result?.data?.[0]?.url;
    const { isPlaying, currentTime, duration, togglePlayback, updateCurrentTime, loadMetadata, seek, stopPlayback } =
        useAudioPlayback(audioRef);

    if (data.status === GenerationStatus.IN_PROGRESS) {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3">
                <div className="relative">
                    <IconMusic size={48} className="text-[#B43FEB]/50" />
                    <div className="absolute inset-0 animate-pulse">
                        <IconMusic size={48} className="text-[#B43FEB]" />
                    </div>
                </div>
                <div className="text-sm text-white/60">生成中...</div>
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[#B43FEB] transition-all duration-300" style={{ width: `${data.progress ?? 0}%` }} />
                </div>
            </div>
        );
    }

    if (data.status === GenerationStatus.QUEUED) {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3">
                <IconMusic size={48} className="text-white/30" />
                <div className="text-sm text-white/60">排队中...</div>
            </div>
        );
    }

    if (data.status === GenerationStatus.FAILED) {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3">
                <IconMusic size={48} className="text-red-400/50" />
                <GenerationErrorTooltip message={data.error?.message || "生成失败"} />
            </div>
        );
    }

    if (!audioUrl) {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3">
                <IconMusic size={48} className="text-white/20" />
                <div className="text-sm text-white/40">暂无音频</div>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4">
            <audio ref={audioRef} src={audioUrl} onTimeUpdate={updateCurrentTime} onLoadedMetadata={loadMetadata} onEnded={stopPlayback} />
            <div className="flex w-full items-center gap-4">
                <button onClick={togglePlayback} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#B43FEB] text-white transition-all hover:scale-105 hover:bg-[#B43FEB]/80">
                    {isPlaying ? <IconPlayerPause size={20} /> : <IconPlayerPlay size={20} className="ml-0.5" />}
                </button>
                <div className="flex flex-1 flex-col gap-1.5">
                    <div className="relative h-2 cursor-pointer overflow-hidden rounded-full bg-white/10" onClick={seek}>
                        <div className="h-full rounded-full bg-[#B43FEB] transition-all" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-white/50">
                        <span>{formatAudioTime(currentTime)}</span>
                        <span>{formatAudioTime(duration)}</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/40">
                <IconMusic size={14} />
                <span>{data.isUpload ? "已上传音频" : "AI 生成音频"}</span>
                {duration > 0 ? <span className="text-white/30">|</span> : null}
                {duration > 0 ? <span>{formatAudioTime(duration)}</span> : null}
            </div>
        </div>
    );
});

AudioContent.displayName = "AudioContent";
