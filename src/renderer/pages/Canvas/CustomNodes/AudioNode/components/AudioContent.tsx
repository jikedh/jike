import { IconMusic, IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react";
import { memo } from "react";
import { GenerationStatus } from "shared/constants/enum";
import type { AudioNodeType } from "shared/types/flow";
import { cn } from "shared/utils/utils";
import { useAudioPlayback } from "../hooks/useAudioPlayback";
import { formatAudioTime } from "../utils/audioPlayback";
import { GenerationErrorTooltip } from "../../shared/GenerationErrorTooltip";

type AudioContentProps = {
    data: AudioNodeType["data"];
};

export const AudioContent = memo(({ data }: AudioContentProps) => {
    const audioUrl = data.result?.data?.[0]?.url;
    const playbackUnavailable =
        data.status === GenerationStatus.IN_PROGRESS ||
        data.status === GenerationStatus.QUEUED ||
        data.status === GenerationStatus.FAILED;
    const playableAudioUrl = playbackUnavailable ? undefined : audioUrl;
    const {
        waveformRef,
        isPlaying,
        currentTime,
        duration,
        isLoading,
        playbackError,
        togglePlayback,
    } = useAudioPlayback(playableAudioUrl);
    const playbackDisabled = isLoading || duration <= 0 || Boolean(playbackError);

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
        <div className="flex h-full w-full flex-col rounded-[18px] bg-[#111116]">
            <div className="nodrag nopan nowheel relative flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-black/70 bg-[#07070a] px-4 shadow-[inset_0_6px_20px_rgba(0,0,0,0.75),inset_0_-1px_0_rgba(255,255,255,0.04)]">
                <div ref={waveformRef} className="h-full w-full cursor-pointer" />
                {isLoading ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#07070a]/70 text-xs text-white/40">
                        正在加载波形...
                    </div>
                ) : null}
                {playbackError ? (
                    <div className="pointer-events-none absolute inset-x-3 bottom-2 text-center text-[11px] text-red-400/80">
                        {playbackError}
                    </div>
                ) : null}
            </div>

            <div className="relative flex h-9 items-center justify-center px-1">
                <span className="absolute left-1 text-[11px] tabular-nums text-white/55">
                    {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
                </span>
                <button
                    type="button"
                    title={isPlaying ? "暂停" : "播放"}
                    onClick={() => void togglePlayback()}
                    disabled={playbackDisabled}
                    className={cn(
                        "nodrag nopan flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white text-[#111116] shadow-[0_4px_12px_rgba(0,0,0,0.3)] hover:bg-white/90",
                        playbackDisabled && "cursor-not-allowed opacity-40",
                    )}
                >
                    {isPlaying ? (
                        <IconPlayerPause size={15} fill="currentColor" />
                    ) : (
                        <IconPlayerPlay size={15} fill="currentColor" className="ml-0.5" />
                    )}
                </button>
            </div>
        </div>
    );
});

AudioContent.displayName = "AudioContent";
