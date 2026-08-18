import {
    IconCheck,
    IconMusic,
    IconPlayerPause,
    IconPlayerPlay,
    IconX,
} from "@tabler/icons-react";
import { memo, useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { uploadFileToOSS } from "service/oss";
import { GenerationStatus } from "shared/constants/enum";
import type { AudioNodeType } from "shared/types/flow";
import { cn } from "shared/utils/utils";
import useMessage from "@/hooks/useMessage";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { useAudioPlayback } from "../hooks/useAudioPlayback";
import { formatAudioTime } from "../utils/audioPlayback";
import { createTrimmedAudioFile } from "../utils/audioTrim";
import { GenerationErrorTooltip } from "../../shared/GenerationErrorTooltip";

type AudioContentProps = {
    nodeId: string;
    data: AudioNodeType["data"];
    isTrimming: boolean;
    onCancelTrim: () => void;
};

const MIN_TRIM_DURATION = 0.5;

export const AudioContent = memo(({ nodeId, data, isTrimming, onCancelTrim }: AudioContentProps) => {
    const waveformViewportRef = useRef<HTMLDivElement | null>(null);
    const activeTrimEdgeRef = useRef<"start" | "end" | null>(null);
    const [trimRange, setTrimRange] = useState({ start: 0, end: 0 });
    const [isCreatingClip, setIsCreatingClip] = useState(false);
    const addNode = useCanvasFlowStore((state) => state.addNode);
    const onConnect = useCanvasFlowStore((state) => state.onConnect);
    const updateAudioNodeData = useCanvasFlowStore((state) => state.updateAudioNodeData);
    const { success, error } = useMessage();
    const audioUrl = data.result?.data?.[0]?.url;
    const playbackUnavailable =
        data.status === GenerationStatus.IN_PROGRESS ||
        data.status === GenerationStatus.QUEUED ||
        data.status === GenerationStatus.FAILED;
    const playableAudioUrl = playbackUnavailable ? undefined : audioUrl;
    const trimDuration = Math.max(0, trimRange.end - trimRange.start);
    const playbackRange =
        isTrimming && trimDuration >= MIN_TRIM_DURATION
            ? trimRange
            : undefined;
    const {
        waveformRef,
        isPlaying,
        currentTime,
        duration,
        isLoading,
        playbackError,
        togglePlayback,
    } = useAudioPlayback(playableAudioUrl, playbackRange);
    const playbackDisabled = isLoading || duration <= 0 || Boolean(playbackError);
    const startPercent = duration > 0 ? (trimRange.start / duration) * 100 : 0;
    const endPercent = duration > 0 ? (trimRange.end / duration) * 100 : 100;

    useEffect(() => {
        if (!isTrimming || duration <= 0) return;
        setTrimRange({ start: 0, end: duration });
    }, [duration, isTrimming]);

    const handleTrimPointerDown = useCallback(
        (edge: "start" | "end", event: PointerEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();
            activeTrimEdgeRef.current = edge;
            event.currentTarget.setPointerCapture(event.pointerId);
        },
        [],
    );

    const handleTrimPointerMove = useCallback(
        (event: PointerEvent<HTMLButtonElement>) => {
            const activeEdge = activeTrimEdgeRef.current;
            const viewport = waveformViewportRef.current;
            if (!activeEdge || !viewport || duration <= 0) return;

            const rect = viewport.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
            const nextTime = ratio * duration;

            setTrimRange((current) => {
                if (activeEdge === "start") {
                    return {
                        ...current,
                        start: Math.max(0, Math.min(nextTime, current.end - MIN_TRIM_DURATION)),
                    };
                }
                return {
                    ...current,
                    end: Math.min(duration, Math.max(nextTime, current.start + MIN_TRIM_DURATION)),
                };
            });
        },
        [duration],
    );

    const handleTrimPointerEnd = useCallback(() => {
        activeTrimEdgeRef.current = null;
    }, []);

    const handleGenerateClip = useCallback(async () => {
        if (!audioUrl || duration <= 0 || trimDuration < MIN_TRIM_DURATION || isCreatingClip) return;

        setIsCreatingClip(true);
        try {
            const sourceNode = useCanvasFlowStore
                .getState()
                .nodes.find((node) => node.id === nodeId && node.type === "audioNode");
            if (!sourceNode) {
                throw new Error("当前音频节点不存在");
            }

            const file = await createTrimmedAudioFile(
                audioUrl,
                trimRange.start,
                trimRange.end,
            );
            const uploadResult = await uploadFileToOSS(file);
            if (!uploadResult.url) {
                throw new Error("截取音频上传失败");
            }

            const childPosition = {
                x: sourceNode.position.x + (sourceNode.width ?? 350) + 80,
                y: sourceNode.position.y,
            };
            const childId = addNode("audio", childPosition);
            if (!childId) {
                throw new Error("截取音频节点创建失败");
            }

            onConnect({
                source: nodeId,
                target: childId,
                sourceHandle: "output",
                targetHandle: "input",
            });
            updateAudioNodeData(childId, {
                nickname: `${data.nickname ?? "音频"}截取`,
                duration: trimDuration,
                status: GenerationStatus.COMPLETED,
                progress: 100,
                isUpload: true,
                trimInfo: {
                    sourceNodeId: nodeId,
                    startTime: trimRange.start,
                    endTime: trimRange.end,
                },
                result: {
                    type: "audio",
                    data: [
                        {
                            url: uploadResult.url,
                            remoteUrl: uploadResult.url,
                            format: "wav",
                            duration: trimDuration,
                        },
                    ],
                },
            });

            const flowStore = useCanvasFlowStore.getState();
            flowStore.requestHistorySave();
            flowStore.saveGraph();
            success("音频截取完成");
            onCancelTrim();
        } catch (trimError: any) {
            console.error("音频截取失败:", trimError);
            error(trimError?.message ?? "音频截取失败，请重试");
        } finally {
            setIsCreatingClip(false);
        }
    }, [
        addNode,
        audioUrl,
        data.nickname,
        duration,
        error,
        isCreatingClip,
        nodeId,
        onCancelTrim,
        onConnect,
        success,
        trimDuration,
        trimRange.end,
        trimRange.start,
        updateAudioNodeData,
    ]);

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
                <div ref={waveformViewportRef} className="relative h-full w-full">
                    <div ref={waveformRef} className="h-full w-full cursor-pointer" />
                    {isTrimming && duration > 0 ? (
                        <div className="pointer-events-none absolute inset-0 z-10">
                            <div
                                className="absolute inset-y-0 left-0 bg-black/50"
                                style={{ width: `${startPercent}%` }}
                            />
                            <div
                                className="absolute inset-y-0 right-0 bg-black/50"
                                style={{ left: `${endPercent}%` }}
                            />
                            <div
                                className="absolute inset-y-0 border-y border-[#B43FEB]/60"
                                style={{
                                    left: `${startPercent}%`,
                                    width: `${endPercent - startPercent}%`,
                                }}
                            >
                                <span className="absolute left-1/2 top-2 -translate-x-1/2 rounded-md bg-black/55 px-2 py-1 text-[11px] tabular-nums text-white/85">
                                    {trimDuration.toFixed(2)} s
                                </span>
                            </div>
                            <button
                                type="button"
                                title="调整截取开始位置"
                                className="pointer-events-auto absolute inset-y-0 z-20 w-4 touch-none cursor-ew-resize border-x border-[#d896f7]/80 bg-[#B43FEB]/25"
                                style={{ left: `${startPercent}%` }}
                                onPointerDown={(event) => handleTrimPointerDown("start", event)}
                                onPointerMove={handleTrimPointerMove}
                                onPointerUp={handleTrimPointerEnd}
                                onPointerCancel={handleTrimPointerEnd}
                            />
                            <button
                                type="button"
                                title="调整截取结束位置"
                                className="pointer-events-auto absolute inset-y-0 z-20 w-4 -translate-x-full touch-none cursor-ew-resize border-x border-[#d896f7]/80 bg-[#B43FEB]/25"
                                style={{ left: `${endPercent}%` }}
                                onPointerDown={(event) => handleTrimPointerDown("end", event)}
                                onPointerMove={handleTrimPointerMove}
                                onPointerUp={handleTrimPointerEnd}
                                onPointerCancel={handleTrimPointerEnd}
                            />
                        </div>
                    ) : null}
                </div>
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
            {isTrimming ? (
                <div className="nodrag nopan flex h-11 shrink-0 items-center justify-between border-t border-white/8 px-1.5">
                    <button
                        type="button"
                        onClick={onCancelTrim}
                        disabled={isCreatingClip}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/55 hover:bg-white/6 hover:text-white"
                    >
                        <IconX size={14} />
                        取消
                    </button>
                    <span className="text-xs tabular-nums text-white/60">
                        {formatAudioTime(trimRange.start)} - {formatAudioTime(trimRange.end)}
                    </span>
                    <button
                        type="button"
                        onClick={() => void handleGenerateClip()}
                        disabled={
                            isCreatingClip ||
                            duration <= 0 ||
                            trimDuration < MIN_TRIM_DURATION
                        }
                        className="flex items-center gap-1.5 rounded-lg bg-[#B43FEB] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#c058ef] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <IconCheck size={14} />
                        {isCreatingClip ? "生成中" : "生成"}
                    </button>
                </div>
            ) : null}
        </div>
    );
});

AudioContent.displayName = "AudioContent";
