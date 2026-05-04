import {
  IconCheck,
  IconCut,
  IconDownload,
  IconMusic,
  IconPlayerPause,
  IconPlayerPlay,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import {
  type NodeProps,
  NodeToolbar,
  Position,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { uploadFileToOSS } from "service/oss";
import { GenerationStatus } from "shared/constants/enum";
import type { AudioNodeType } from "shared/types/flow";
import { cn } from "shared/utils/utils";
import { ButtonHandle } from "@/components/button-handle";
import useMessage from "@/hooks/useMessage";
import { useNodeScale } from "@/hooks/useNodeScale";
import { NodeContextMenu } from "@/pages/Canvas/components/NodeContextMenu";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { NodeNameBadge } from "../shared/NodeNameBadge";

const formatTime = (time: number) => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const formatTimeDetailed = (time: number) => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  const ms = Math.floor((time % 1) * 100);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
};

const audioBufferToWav = (buffer: AudioBuffer): Blob => {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, bufferLength - 8, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
};

// 直接从原始 AudioBuffer 中截取指定时间区间，避免依赖实际播放时长。
const sliceAudioBuffer = (
  audioContext: AudioContext,
  buffer: AudioBuffer,
  startTime: number,
  endTime: number,
) => {
  const sampleRate = buffer.sampleRate;
  const startFrame = Math.max(0, Math.floor(startTime * sampleRate));
  const endFrame = Math.min(buffer.length, Math.ceil(endTime * sampleRate));
  const sliceLength = Math.max(1, endFrame - startFrame);

  // 使用同样的采样率和声道数创建新的 AudioBuffer，确保导出结果时长和裁剪区间一致。
  const slicedBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    sliceLength,
    sampleRate,
  );

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    // 直接复制目标时间段的采样数据，不经过播放或录音流程。
    const sourceData = buffer
      .getChannelData(channel)
      .subarray(startFrame, endFrame);
    slicedBuffer.copyToChannel(sourceData, channel, 0);
  }

  return slicedBuffer;
};

const AudioContent = memo(
  ({
    data,
    isTrimming,
    trimStart,
    trimEnd,
    onTrimStartChange,
    onTrimEndChange,
    onPreviewTrim,
    audioRef,
  }: {
    data: AudioNodeType["data"];
    isTrimming: boolean;
    trimStart: number;
    trimEnd: number;
    onTrimStartChange: (value: number) => void;
    onTrimEndChange: (value: number) => void;
    onPreviewTrim: () => void;
    audioRef: React.RefObject<HTMLAudioElement | null>;
  }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [startInput, setStartInput] = useState("0");
    const [endInput, setEndInput] = useState("0");

    const audioUrl = data.result?.data?.[0]?.url;
    const status = data.status;
    const progress = data.progress ?? 0;
    const isUpload = data.isUpload;

    useEffect(() => {
      setStartInput(trimStart.toFixed(2));
    }, [trimStart]);

    useEffect(() => {
      setEndInput(trimEnd.toFixed(2));
    }, [trimEnd]);

    const handleStartInputChange = useCallback(
      (value: string) => {
        setStartInput(value);
        const num = parseFloat(value);
        if (!isNaN(num) && num >= 0 && num < trimEnd) {
          onTrimStartChange(num);
        }
      },
      [trimEnd, onTrimStartChange],
    );

    const handleEndInputChange = useCallback(
      (value: string) => {
        setEndInput(value);
        const num = parseFloat(value);
        if (!isNaN(num) && num > trimStart && num <= duration) {
          onTrimEndChange(num);
        }
      },
      [trimStart, duration, onTrimEndChange],
    );

    const handleStartInputBlur = useCallback(() => {
      const num = parseFloat(startInput);
      if (isNaN(num) || num < 0) {
        setStartInput("0");
        onTrimStartChange(0);
      } else if (num >= trimEnd) {
        setStartInput((trimEnd - 0.1).toFixed(2));
        onTrimStartChange(trimEnd - 0.1);
      } else {
        setStartInput(num.toFixed(2));
        onTrimStartChange(num);
      }
    }, [startInput, trimEnd, onTrimStartChange]);

    const handleEndInputBlur = useCallback(() => {
      const num = parseFloat(endInput);
      if (isNaN(num) || num > duration) {
        setEndInput(duration.toFixed(2));
        onTrimEndChange(duration);
      } else if (num <= trimStart) {
        setEndInput((trimStart + 0.1).toFixed(2));
        onTrimEndChange(trimStart + 0.1);
      } else {
        setEndInput(num.toFixed(2));
        onTrimEndChange(num);
      }
    }, [endInput, duration, trimStart, onTrimEndChange]);

    useEffect(() => {
      if (audioRef.current && duration > 0) {
        if (trimEnd > duration) {
          onTrimEndChange(duration);
        }
      }
    }, [duration, trimEnd, onTrimEndChange]);

    const handlePlayPause = useCallback(() => {
      if (!audioRef.current) return;

      if (isPlaying) {
        audioRef.current.pause();
      } else {
        if (isTrimming && trimStart > 0) {
          audioRef.current.currentTime = trimStart;
        }
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }, [isPlaying, isTrimming, trimStart]);

    const handleTimeUpdate = useCallback(() => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);

        if (isTrimming && audioRef.current.currentTime >= trimEnd) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      }
    }, [isTrimming, trimEnd]);

    const handleLoadedMetadata = useCallback(() => {
      if (audioRef.current) {
        const dur = audioRef.current.duration;
        setDuration(dur);
        if (trimEnd === 0 || trimEnd > dur) {
          onTrimEndChange(dur);
        }
      }
    }, [trimEnd, onTrimEndChange]);

    const handleSeek = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current || !duration) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const newTime = percentage * duration;

        if (isTrimming) {
          if (newTime < trimStart) {
            audioRef.current.currentTime = trimStart;
            setCurrentTime(trimStart);
          } else if (newTime > trimEnd) {
            audioRef.current.currentTime = trimEnd;
            setCurrentTime(trimEnd);
          } else {
            audioRef.current.currentTime = newTime;
            setCurrentTime(newTime);
          }
        } else {
          audioRef.current.currentTime = newTime;
          setCurrentTime(newTime);
        }
      },
      [duration, isTrimming, trimStart, trimEnd],
    );

    if (status === GenerationStatus.IN_PROGRESS) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3">
          <div className="relative">
            <IconMusic size={48} className="text-[#B43FEB]/50" />
            <div className="absolute inset-0 animate-pulse">
              <IconMusic size={48} className="text-[#B43FEB]" />
            </div>
          </div>
          <div className="text-sm text-white/60">生成中...</div>
          <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#B43FEB] rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      );
    }

    if (status === GenerationStatus.QUEUED) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3">
          <IconMusic size={48} className="text-white/30" />
          <div className="text-sm text-white/60">排队中...</div>
        </div>
      );
    }

    if (status === GenerationStatus.FAILED) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3">
          <IconMusic size={48} className="text-red-400/50" />
          <div className="text-sm text-red-400">
            {data.error?.message || "生成失败"}
          </div>
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

    const trimDuration = trimEnd - trimStart;
    const isValidTrim = trimDuration > 0 && trimDuration <= 15;

    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4">
        <audio
          ref={audioRef}
          src={audioUrl}
          crossOrigin="anonymous"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
        />

        <div className="flex items-center gap-4 w-full">
          <button
            onClick={handlePlayPause}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#B43FEB] text-white transition-all hover:bg-[#B43FEB]/80 hover:scale-105 shrink-0"
          >
            {isPlaying ? (
              <IconPlayerPause size={20} />
            ) : (
              <IconPlayerPlay size={20} className="ml-0.5" />
            )}
          </button>

          <div className="flex-1 flex flex-col gap-1.5">
            <div
              className="relative h-2 bg-white/10 rounded-full cursor-pointer overflow-hidden"
              onClick={handleSeek}
            >
              {isTrimming && (
                <>
                  <div
                    className="absolute top-0 bottom-0 bg-white/20"
                    style={{
                      left: 0,
                      width: `${(trimStart / duration) * 100}%`,
                    }}
                  />
                  <div
                    className="absolute top-0 bottom-0 bg-[#B43FEB]/30"
                    style={{
                      left: `${(trimStart / duration) * 100}%`,
                      width: `${((trimEnd - trimStart) / duration) * 100}%`,
                    }}
                  />
                  <div
                    className="absolute top-0 bottom-0 bg-white/20"
                    style={{
                      left: `${(trimEnd / duration) * 100}%`,
                      width: `${100 - (trimEnd / duration) * 100}%`,
                    }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[#B43FEB] rounded-full border-2 border-white cursor-ew-resize z-10"
                    style={{
                      left: `calc(${(trimStart / duration) * 100}% - 6px)`,
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      const startX = e.clientX;
                      const startValue = trimStart;
                      const handleMove = (moveE: MouseEvent) => {
                        const rect = (
                          e.target as HTMLElement
                        ).parentElement!.getBoundingClientRect();
                        const delta =
                          ((moveE.clientX - startX) / rect.width) * duration;
                        const newStart = Math.max(
                          0,
                          Math.min(trimEnd - 0.1, startValue + delta),
                        );
                        onTrimStartChange(newStart);
                      };
                      const handleUp = () => {
                        document.removeEventListener("mousemove", handleMove);
                        document.removeEventListener("mouseup", handleUp);
                      };
                      document.addEventListener("mousemove", handleMove);
                      document.addEventListener("mouseup", handleUp);
                    }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[#B43FEB] rounded-full border-2 border-white cursor-ew-resize z-10"
                    style={{
                      left: `calc(${(trimEnd / duration) * 100}% - 6px)`,
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      const startX = e.clientX;
                      const startValue = trimEnd;
                      const handleMove = (moveE: MouseEvent) => {
                        const rect = (
                          e.target as HTMLElement
                        ).parentElement!.getBoundingClientRect();
                        const delta =
                          ((moveE.clientX - startX) / rect.width) * duration;
                        const newEnd = Math.max(
                          trimStart + 0.1,
                          Math.min(duration, startValue + delta),
                        );
                        onTrimEndChange(newEnd);
                      };
                      const handleUp = () => {
                        document.removeEventListener("mousemove", handleMove);
                        document.removeEventListener("mouseup", handleUp);
                      };
                      document.addEventListener("mousemove", handleMove);
                      document.addEventListener("mouseup", handleUp);
                    }}
                  />
                </>
              )}
              {!isTrimming && (
                <div
                  className="h-full bg-[#B43FEB] rounded-full transition-all"
                  style={{
                    width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                  }}
                />
              )}
              {isTrimming && (
                <div
                  className="absolute h-full bg-white/50 rounded-full"
                  style={{
                    left: `${(trimStart / duration) * 100}%`,
                    width: `${((currentTime - trimStart) / (trimEnd - trimStart)) * ((trimEnd - trimStart) / duration) * 100}%`,
                    maxWidth: `${((trimEnd - trimStart) / duration) * 100}%`,
                  }}
                />
              )}
            </div>
            <div className="flex justify-between text-xs text-white/50">
              <span>
                {formatTime(
                  isTrimming
                    ? Math.max(trimStart, Math.min(trimEnd, currentTime))
                    : currentTime,
                )}
              </span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        {isTrimming && (
          <div className="w-full flex flex-col gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-white/50">开始:</span>
                  <input
                    type="text"
                    value={startInput}
                    onChange={(e) => handleStartInputChange(e.target.value)}
                    onBlur={handleStartInputBlur}
                    className="w-14 px-1.5 py-0.5 bg-white/10 border border-white/20 rounded text-white font-mono text-center focus:outline-none focus:border-[#B43FEB]"
                  />
                  <span className="text-white/30">s</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-white/50">结束:</span>
                  <input
                    type="text"
                    value={endInput}
                    onChange={(e) => handleEndInputChange(e.target.value)}
                    onBlur={handleEndInputBlur}
                    className="w-14 px-1.5 py-0.5 bg-white/10 border border-white/20 rounded text-white font-mono text-center focus:outline-none focus:border-[#B43FEB]"
                  />
                  <span className="text-white/30">s</span>
                </div>
              </div>
              <div
                className={cn(
                  "flex items-center gap-1.5 px-2 py-0.5 rounded",
                  isValidTrim
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400",
                )}
              >
                <span>时长:</span>
                <span className="font-mono">{trimDuration.toFixed(2)}s</span>
                {!isValidTrim && trimDuration > 15 && (
                  <span className="text-red-400">(超过15s)</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={trimStart}
                onChange={(e) => onTrimStartChange(Number(e.target.value))}
                className="flex-1 h-1 cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#B43FEB]"
              />
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={trimEnd}
                onChange={(e) => onTrimEndChange(Number(e.target.value))}
                className="flex-1 h-1 cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#B43FEB]"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-white/40 text-xs">
          <IconMusic size={14} />
          <span>{isUpload ? "已上传音频" : "AI 生成音频"}</span>
          {duration > 0 && <span className="text-white/30">|</span>}
          {duration > 0 && <span>{formatTime(duration)}</span>}
        </div>
      </div>
    );
  },
);

AudioContent.displayName = "AudioContent";

const AudioToolbar = memo(
  ({
    nodeId,
    data,
    onDuplicate,
    onDelete,
    isTrimming,
    onToggleTrim,
    onConfirmTrim,
    canConfirmTrim,
  }: {
    nodeId: string;
    data: AudioNodeType["data"];
    onDuplicate: () => void;
    onDelete: () => void;
    isTrimming: boolean;
    onToggleTrim: () => void;
    onConfirmTrim: () => void;
    canConfirmTrim: boolean;
  }) => {
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const updateAudioNodeData = useCanvasFlowStore(
      (state) => state.updateAudioNodeData,
    );
    const { success, warning, error } = useMessage();

    const audioUrl = data.result?.data?.[0]?.url;
    const hasAudio = Boolean(audioUrl);

    const handleUploadClick = useCallback(() => {
      if (isUploading) return;
      fileInputRef.current?.click();
    }, [isUploading]);

    const handleFileChange = useCallback(
      async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validTypes = [
          "audio/mpeg",
          "audio/wav",
          "audio/mp3",
          "audio/ogg",
          "audio/aac",
        ];
        if (
          !validTypes.includes(file.type) &&
          !file.name.match(/\.(mp3|wav|ogg|aac)$/i)
        ) {
          warning("请上传 MP3、WAV、OGG 或 AAC 格式的音频文件");
          return;
        }

        setIsUploading(true);

        try {
          const result = await uploadFileToOSS(file);
          const url = result.url;

          if (!url) {
            warning("上传成功但未返回音频地址");
            return;
          }

          updateAudioNodeData(nodeId, {
            status: GenerationStatus.COMPLETED,
            progress: 100,
            isUpload: true,
            result: {
              type: "audio",
              data: [{ url }],
            },
          });
          success("上传成功");
        } catch (err) {
          console.error("上传音频失败:", err);
          error("上传失败，请重试");
        } finally {
          setIsUploading(false);
          e.target.value = "";
        }
      },
      [nodeId, updateAudioNodeData, success, warning, error],
    );

    const handleDownload = useCallback(() => {
      if (!audioUrl) return;
      const link = document.createElement("a");
      link.href = audioUrl;
      link.download = `audio_${nodeId}.mp3`;
      link.click();
    }, [audioUrl, nodeId]);

    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-neutral-900/90 px-2 py-1.5 shadow-lg backdrop-blur-sm">
          {isTrimming ? (
            <>
              <button
                onClick={onConfirmTrim}
                disabled={!canConfirmTrim}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                  canConfirmTrim
                    ? "text-green-400 hover:bg-green-500/20"
                    : "cursor-not-allowed text-white/30",
                )}
              >
                <IconCheck size={14} />
                <span>确认</span>
              </button>
              <button
                onClick={onToggleTrim}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all"
              >
                <IconX size={14} />
                <span>取消</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleUploadClick}
                disabled={isUploading}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                  isUploading
                    ? "cursor-not-allowed text-white/30"
                    : "text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                <IconUpload size={14} />
                <span>{isUploading ? "上传中" : "上传"}</span>
              </button>
              <button
                onClick={onToggleTrim}
                disabled={!hasAudio}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                  !hasAudio
                    ? "cursor-not-allowed text-white/30"
                    : "text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                <IconCut size={14} />
                <span>裁剪</span>
              </button>
              <button
                onClick={handleDownload}
                disabled={!hasAudio}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                  !hasAudio
                    ? "cursor-not-allowed text-white/30"
                    : "text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                <IconDownload size={14} />
                <span>下载</span>
              </button>
              <button
                onClick={onDelete}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all"
              >
                <IconTrash size={14} />
                <span>删除</span>
              </button>
            </>
          )}
        </div>
      </>
    );
  },
);

AudioToolbar.displayName = "AudioToolbar";

export const AudioNode = memo(
  ({ id, data, selected, dragging }: NodeProps<AudioNodeType>) => {
    const isDragging = Boolean(dragging);
    const { zoom } = useNodeScale();
    const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode);
    const deleteNode = useCanvasFlowStore((state) => state.deleteNode);
    const addNode = useCanvasFlowStore((state) => state.addNode);
    const updateAudioNodeData = useCanvasFlowStore(
      (state) => state.updateAudioNodeData,
    );
    const onConnect = useCanvasFlowStore((state) => state.onConnect);
    const highlightedSourceNodeIds = useCanvasFlowStore(
      (state) => state.highlightedSourceNodeIds,
    );
    const { setNodes: setReactFlowNodes } = useReactFlow();
    const { success, error: showError } = useMessage();

    const audioRef = useRef<HTMLAudioElement>(null);
    const [isTrimming, setIsTrimming] = useState(false);
    const [trimStart, setTrimStart] = useState(0);
    const [trimEnd, setTrimEnd] = useState(0);

    const audioUrl = data.result?.data?.[0]?.url;

    const selectedNodesCount = useStore((state) => {
      let count = 0;
      for (const node of state.nodes) {
        if (node.selected) count++;
      }
      return count;
    });

    useEffect(() => {
      if (!selected && isTrimming) {
        setIsTrimming(false);
      }
    }, [selected, isTrimming]);

    useEffect(() => {
      setReactFlowNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            return { ...node, draggable: !isTrimming };
          }
          return node;
        }),
      );
    }, [isTrimming, id, setReactFlowNodes]);

    const handleVisibilityClass = useMemo(
      () =>
        selected
          ? "visible opacity-100"
          : "invisible opacity-0 group-hover/node:visible group-hover/node:opacity-100",
      [selected],
    );

    const shouldShowToolbar = useMemo(
      () => selected && !isDragging && selectedNodesCount <= 1,
      [selected, isDragging, selectedNodesCount],
    );

    const isSourceHighlighted = useMemo(() => {
      return highlightedSourceNodeIds.includes(id);
    }, [highlightedSourceNodeIds, id]);

    const handleDuplicate = useCallback(() => {
      duplicateNode(id);
    }, [duplicateNode, id]);

    const handleDelete = useCallback(() => {
      deleteNode(id);
    }, [deleteNode, id]);

    const handleToggleTrim = useCallback(() => {
      setIsTrimming((prev) => !prev);
    }, []);

    const handleConfirmTrim = useCallback(async () => {
      const trimDuration = trimEnd - trimStart;
      if (trimDuration <= 0 || trimDuration > 15) return;

      if (!audioUrl) return;

      setIsTrimming(false);

      let audioContext: AudioContext | null = null;

      try {
        // 先把原始音频完整拉取到内存，再基于 AudioBuffer 做裁剪。
        audioContext = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
        const response = await fetch(audioUrl);

        if (!response.ok) {
          throw new Error("音频资源拉取失败，请稍后重试");
        }

        const arrayBuffer = await response.arrayBuffer();
        const originalBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const trimmedBuffer = sliceAudioBuffer(
          audioContext,
          originalBuffer,
          trimStart,
          trimEnd,
        );
        const wavBlob = audioBufferToWav(trimmedBuffer);

        const file = new File([wavBlob], `trimmed_audio_${Date.now()}.wav`, {
          type: "audio/wav",
        });
        const uploadResult = await uploadFileToOSS(file);
        const newAudioUrl = uploadResult.url;

        if (newAudioUrl) {
          const sourceNode = useCanvasFlowStore
            .getState()
            .nodes.find((node) => node.id === id);
          if (!sourceNode) {
            throw new Error("当前音频节点不存在");
          }

          // 在原节点右侧创建一个新的子节点，保持原音频不变。
          const childPosition = {
            x: sourceNode.position.x + (sourceNode.width ?? 350) + 80,
            y: sourceNode.position.y,
          };

          const childNodeId = addNode("audio", childPosition);

          // 先建立父子节点之间的连线，形成明确的裁剪派生关系。
          onConnect({
            source: id,
            target: childNodeId,
            sourceHandle: "output",
            targetHandle: "input",
          });

          // 将裁剪后的音频结果写入子节点，不改动源节点本身。
          updateAudioNodeData(childNodeId, {
            badgeLabel: "裁剪",
            status: GenerationStatus.COMPLETED,
            progress: 100,
            isUpload: true,
            result: {
              type: "audio",
              data: [
                {
                  url: newAudioUrl,
                  duration: trimDuration,
                },
              ],
            },
            trimInfo: {
              sourceNodeId: id,
              startTime: trimStart,
              endTime: trimEnd,
            },
          });

          success("裁剪成功，已生成子节点");
        } else {
          showError("裁剪后上传失败");
        }
      } catch (error) {
        console.error("裁剪音频失败:", error);
        const errorMessage =
          error instanceof Error ? error.message : "裁剪音频失败，请重试";
        showError(errorMessage);
      } finally {
        // 及时关闭音频上下文，避免浏览器里堆积音频资源。
        await audioContext?.close();
      }
    }, [
      trimStart,
      trimEnd,
      id,
      audioUrl,
      addNode,
      onConnect,
      success,
      showError,
      updateAudioNodeData,
    ]);

    const canConfirmTrim = useMemo(() => {
      const trimDuration = trimEnd - trimStart;
      return trimDuration > 0 && trimDuration <= 15;
    }, [trimStart, trimEnd]);
    const isUploadAudio = data.isUpload ?? false;
    const badgeLabel =
      data.badgeLabel ?? (isUploadAudio ? "上传音频" : "生成音频");

    return (
      <NodeContextMenu onDuplicate={handleDuplicate} onDelete={handleDelete}>
        <div
          className="group/node relative"
          style={{ pointerEvents: isTrimming ? "none" : "auto" }}
        >
          <NodeToolbar
            isVisible={shouldShowToolbar}
            position={Position.Top}
            offset={10 * zoom}
          >
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "bottom center",
              }}
            >
              <AudioToolbar
                nodeId={id}
                data={data}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                isTrimming={isTrimming}
                onToggleTrim={handleToggleTrim}
                onConfirmTrim={handleConfirmTrim}
                canConfirmTrim={canConfirmTrim}
              />
            </div>
          </NodeToolbar>

          <div
            className={cn(
              "group/card relative flex w-87.5 h-62.5 flex-col rounded-xl border bg-linear-to-br from-[#141418] to-[#0d0d10] transition-all duration-300 ease-out",
              isTrimming && "ring-2 ring-[#B43FEB]",
              selected
                ? "border-[#B43FEB]/80 shadow-[0_0_25px_rgba(180,63,235,0.4),0_0_50px_rgba(180,63,235,0.15)] ring-1 ring-[#B43FEB]/30"
                : isSourceHighlighted
                  ? "border-[#B43FEB]/65 shadow-[0_0_18px_rgba(180,63,235,0.28),0_0_36px_rgba(180,63,235,0.12)] ring-1 ring-[#B43FEB]/20"
                  : "border-white/6 hover:border-white/12 hover:bg-linear-to-br hover:from-[#18181c] hover:to-[#101014]",
            )}
            style={{ pointerEvents: "auto" }}
          >
            <NodeNameBadge>{badgeLabel}</NodeNameBadge>

            {/* 左侧输入 Handle */}
            <ButtonHandle
              type="target"
              position={Position.Left}
              id="input"
              visible
              className={`transition-opacity duration-150 ${handleVisibilityClass}`}
            />

            {/* 右侧输出 Handle */}
            <ButtonHandle
              type="source"
              position={Position.Right}
              id="output"
              visible
              className={`transition-opacity duration-150 ${handleVisibilityClass}`}
            />
            {selected && (
              <>
                <div className="absolute -top-px -left-px w-4 h-4 border-l-2 border-t-2 border-[#B43FEB] rounded-tl-xl" />
                <div className="absolute -top-px -right-px w-4 h-4 border-r-2 border-t-2 border-[#B43FEB] rounded-tr-xl" />
                <div className="absolute -bottom-px -left-px w-4 h-4 border-l-2 border-b-2 border-[#B43FEB] rounded-bl-xl" />
                <div className="absolute -bottom-px -right-px w-4 h-4 border-r-2 border-b-2 border-[#B43FEB] rounded-br-xl" />
              </>
            )}

            <div className="pointer-events-none absolute inset-0 rounded-xl bg-linear-to-tr from-transparent via-white/2 to-transparent opacity-0 transition-opacity duration-500 group-hover/card:opacity-100" />

            <div className="relative flex h-full w-full overflow-hidden rounded-lg bg-black/30">
              <AudioContent
                data={data}
                isTrimming={isTrimming}
                trimStart={trimStart}
                trimEnd={trimEnd}
                onTrimStartChange={setTrimStart}
                onTrimEndChange={setTrimEnd}
                onPreviewTrim={() => {}}
                audioRef={audioRef}
              />
            </div>
          </div>
        </div>
      </NodeContextMenu>
    );
  },
);

AudioNode.displayName = "AudioNode";
