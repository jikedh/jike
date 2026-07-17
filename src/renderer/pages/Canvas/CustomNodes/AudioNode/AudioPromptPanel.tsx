import {
  IconMicrophone,
  IconPlayerPlay,
  IconSparkles,
  IconVolume,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  confirmDesktopProxyScore,
  getDesktopAudioVoices,
  refundDesktopProxyScore,
  synthesizeDesktopAudio,
} from "@/api/jikeGo";
import { ModelPointsBadge } from "@/components/ModelPointsBadge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGenerationPoints } from "@/hooks/useGenerationPoints";
import useMessage from "@/hooks/useMessage";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import {
  AUDIO_TEXT_MARKERS,
  AUDIO_TTS_MODEL_OPTIONS,
} from "shared/constants/audio-models";
import { GenerationStatus } from "shared/constants/enum";
import type {
  AudioSynthesisResponse,
  AudioTtsModelId,
  AudioTtsModelInfo,
  AudioTtsSegment,
} from "shared/types/audio";
import type { AudioGenerationNode } from "shared/types/flow";
import {
  getAudioBillableChars,
  getAudioGenerationPoints,
  normalizeAudioTtsModel,
} from "shared/utils/audioTts";
import { cn } from "shared/utils/utils";
import { copyMediaUrlToOss, uploadFileToOSS } from "service/oss";
import { AudioVoiceCloneDialog } from "./AudioVoiceCloneDialog";

type AudioPromptPanelProps = {
  nodeId: string;
};

type MaterializedAudio = {
  url: string;
  format: string;
  duration?: number;
};

const unwrapResponse = <T,>(response: T | { data?: T }): T =>
  ((response as { data?: T })?.data ?? response) as T;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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
      const sample = Math.max(
        -1,
        Math.min(1, buffer.getChannelData(channel)[frame]),
      );
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true,
      );
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

const persistAudioSource = async (url: string): Promise<string> => {
  const persistedUrl = await copyMediaUrlToOss(url);
  if (!persistedUrl) {
    throw new Error("生成音频转存失败");
  }
  return persistedUrl;
};

const materializeAudioSegments = async (
  segments: AudioTtsSegment[],
): Promise<MaterializedAudio> => {
  const audioSegments = segments.filter(
    (segment): segment is AudioTtsSegment & { url: string } =>
      segment.type === "audio" && Boolean(segment.url),
  );
  if (audioSegments.length === 0) {
    throw new Error("语音服务未返回有效音频");
  }

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
    return {
      url: persistedUrls.get(audioSegments[0])!,
      format: "mp3",
    };
  }

  const audioContext = new AudioContext();
  try {
    const decodedBuffers = new Map<AudioTtsSegment, AudioBuffer>();
    for (const segment of audioSegments) {
      const response = await fetch(persistedUrls.get(segment)!);
      if (!response.ok) {
        throw new Error("读取生成音频失败");
      }
      decodedBuffers.set(
        segment,
        await audioContext.decodeAudioData(await response.arrayBuffer()),
      );
    }

    const sampleRate = audioContext.sampleRate;
    const channelCount = Math.max(
      1,
      ...Array.from(decodedBuffers.values()).map(
        (buffer) => buffer.numberOfChannels,
      ),
    );
    const totalFrames = segments.reduce((total, segment) => {
      if (segment.type === "silence") {
        return (
          total + Math.round(((segment.durationMs ?? 0) / 1000) * sampleRate)
        );
      }
      const buffer = decodedBuffers.get(segment);
      return total + Math.round((buffer?.duration ?? 0) * sampleRate);
    }, 0);
    const outputBuffer = audioContext.createBuffer(
      channelCount,
      Math.max(1, totalFrames),
      sampleRate,
    );

    let targetOffset = 0;
    for (const segment of segments) {
      if (segment.type === "silence") {
        targetOffset += Math.round(
          ((segment.durationMs ?? 0) / 1000) * sampleRate,
        );
        continue;
      }
      const sourceBuffer = decodedBuffers.get(segment);
      if (!sourceBuffer) continue;
      const targetLength = Math.round(sourceBuffer.duration * sampleRate);
      for (let channel = 0; channel < channelCount; channel++) {
        const sourceChannel = sourceBuffer.getChannelData(
          Math.min(channel, sourceBuffer.numberOfChannels - 1),
        );
        copyResampledChannel(
          sourceChannel,
          outputBuffer.getChannelData(channel),
          targetOffset,
          targetLength,
        );
      }
      targetOffset += targetLength;
    }

    const file = new File(
      [audioBufferToWav(outputBuffer)],
      `generated_audio_${Date.now()}.wav`,
      { type: "audio/wav" },
    );
    const upload = await uploadFileToOSS(file);
    if (!upload.url) {
      throw new Error("合并音频上传失败");
    }
    return {
      url: upload.url,
      format: "wav",
      duration: outputBuffer.duration,
    };
  } finally {
    await audioContext.close();
  }
};

export const AudioPromptPanel = ({ nodeId }: AudioPromptPanelProps) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { warning, error, success } = useMessage();
  const { totalPoints, refreshBalanceInfo, validateBalanceBeforeGenerate } =
    useGenerationPoints();
  const updateAudioNodeData = useCanvasFlowStore(
    (state) => state.updateAudioNodeData,
  );
  const currentData = useCanvasFlowStore((state) => {
    const node = state.nodes.find(
      (item) => item.id === nodeId && item.type === "audioNode",
    );
    return node?.data as AudioGenerationNode | undefined;
  });

  const [models, setModels] = useState<AudioTtsModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<AudioTtsModelId>(() =>
    normalizeAudioTtsModel(currentData?.model),
  );
  const [selectedVoiceId, setSelectedVoiceId] = useState(
    currentData?.voiceProfileId ?? "",
  );
  const [text, setText] = useState(
    currentData?.promptDraft ?? currentData?.prompt ?? "",
  );
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);

  const loadVoices = useCallback(
    async (syncMiniMax: boolean) => {
      const response = await getDesktopAudioVoices(syncMiniMax);
      const payload = unwrapResponse(response);
      setModels(payload.models ?? []);
      return payload.models ?? [];
    },
    [],
  );

  useEffect(() => {
    let disposed = false;
    void getDesktopAudioVoices(true)
      .then((response) => {
        if (disposed) return;
        const payload = unwrapResponse(response);
        setModels(payload.models ?? []);
      })
      .catch(() => {
        if (!disposed) setModels([]);
      })
      .finally(() => {
        if (!disposed) setLoadingVoices(false);
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    setText(currentData?.promptDraft ?? currentData?.prompt ?? "");
  }, [currentData?.prompt, currentData?.promptDraft]);

  const currentModel = useMemo(
    () => models.find((model) => model.id === selectedModel),
    [models, selectedModel],
  );
  const voiceOptions = currentModel?.voices ?? [];
  const systemVoiceOptions = voiceOptions.filter(
    (voice) => voice.voiceType !== "cloned",
  );
  const clonedVoiceOptions = voiceOptions.filter(
    (voice) => voice.voiceType === "cloned",
  );
  const selectedVoice = voiceOptions.find(
    (voice) => voice.profileId === selectedVoiceId,
  );
  const modelAvailable =
    currentModel?.available ?? selectedModel === AUDIO_TTS_MODEL_OPTIONS[0].id;

  useEffect(() => {
    if (voiceOptions.some((voice) => voice.profileId === selectedVoiceId)) {
      return;
    }
    const defaultVoice =
      voiceOptions.find((voice) => voice.isDefault) ?? voiceOptions[0];
    const nextVoiceId = defaultVoice?.profileId ?? "";
    if (nextVoiceId === selectedVoiceId) {
      return;
    }
    setSelectedVoiceId(nextVoiceId);
    updateAudioNodeData(nodeId, { voiceProfileId: nextVoiceId });
  }, [nodeId, selectedVoiceId, updateAudioNodeData, voiceOptions]);

  const billableChars = useMemo(() => getAudioBillableChars(text), [text]);
  const requiredPoints = useMemo(
    () => getAudioGenerationPoints(selectedModel, text),
    [selectedModel, text],
  );

  const handleTextChange = useCallback(
    (value: string) => {
      setText(value);
      updateAudioNodeData(nodeId, {
        promptDraft: value,
        promptDraftHtml: value
          ? `<p>${escapeHtml(value).replace(/\n/g, "<br>")}</p>`
          : "<p></p>",
        requiredPoints: getAudioGenerationPoints(selectedModel, value),
      });
    },
    [nodeId, selectedModel, updateAudioNodeData],
  );

  const insertMarker = useCallback(
    (marker: string) => {
      const textarea = textareaRef.current;
      const start = textarea?.selectionStart ?? text.length;
      const end = textarea?.selectionEnd ?? start;
      const nextText = `${text.slice(0, start)}${marker}${text.slice(end)}`;
      handleTextChange(nextText);
      requestAnimationFrame(() => {
        textarea?.focus();
        textarea?.setSelectionRange(
          start + marker.length,
          start + marker.length,
        );
      });
    },
    [handleTextChange, text],
  );

  const handleModelChange = useCallback(
    (value: string) => {
      const model = normalizeAudioTtsModel(value);
      setSelectedModel(model);
      setSelectedVoiceId("");
      updateAudioNodeData(nodeId, {
        model,
        voiceProfileId: "",
        requiredPoints: getAudioGenerationPoints(model, text),
      });
    },
    [nodeId, text, updateAudioNodeData],
  );

  const handleGenerate = useCallback(async () => {
    if (!text.trim() || billableChars <= 0) {
      warning("请输入需要合成的台词");
      return;
    }
    if (!selectedVoiceId) {
      warning(
        selectedModel === "cosyvoice-v3.5-plus"
          ? "CosyVoice 尚未配置可用音色"
          : "请选择音色",
      );
      return;
    }

    const hasEnoughPoints = await validateBalanceBeforeGenerate({
      requiredPoints,
      warning,
    });
    if (!hasEnoughPoints) return;

    let ledgerBizId = "";
    setIsGenerating(true);
    updateAudioNodeData(nodeId, {
      model: selectedModel,
      voiceProfileId: selectedVoiceId,
      prompt: text,
      promptDraft: text,
      requiredPoints,
      status: GenerationStatus.IN_PROGRESS,
      progress: 15,
      error: undefined,
    });

    try {
      const response = unwrapResponse<AudioSynthesisResponse>(
        await synthesizeDesktopAudio({
          model: selectedModel,
          voiceProfileId: selectedVoiceId,
          text,
        }),
      );
      ledgerBizId = String(response.ledgerBizId ?? "");
      updateAudioNodeData(nodeId, { progress: 60 });
      const audio = await materializeAudioSegments(response.segments ?? []);

      if (ledgerBizId) {
        await confirmDesktopProxyScore(ledgerBizId, "audio", {
          scoreModel: selectedModel,
          scoreSource: "dashscope",
          scoreSourceLabel: selectedModel,
          generateTime: Math.floor(Date.now() / 1000),
        });
      }

      updateAudioNodeData(nodeId, {
        model: selectedModel,
        voiceProfileId: selectedVoiceId,
        prompt: text,
        promptDraft: text,
        requiredPoints: response.scoreCost ?? requiredPoints,
        status: GenerationStatus.COMPLETED,
        progress: 100,
        isUpload: false,
        result: {
          type: "audio",
          data: [
            {
              url: audio.url,
              remoteUrl: audio.url,
              format: audio.format,
              duration: audio.duration,
            },
          ],
        },
        error: undefined,
      });
      const flowStore = useCanvasFlowStore.getState();
      flowStore.requestHistorySave();
      flowStore.saveGraph();
      await refreshBalanceInfo();
      success("音频生成完成");
    } catch (generateError) {
      const message =
        generateError instanceof Error
          ? generateError.message
          : "音频生成失败，请稍后重试";
      if (ledgerBizId) {
        await refundDesktopProxyScore(ledgerBizId, message, "audio", {
          scoreModel: selectedModel,
          scoreSource: "dashscope",
          scoreSourceLabel: selectedModel,
        }).catch(() => undefined);
      }
      updateAudioNodeData(nodeId, {
        status: GenerationStatus.FAILED,
        progress: 0,
        error: { code: "AUDIO_GENERATION_FAILED", message },
      });
      await refreshBalanceInfo();
      error(message);
    } finally {
      setIsGenerating(false);
    }
  }, [
    billableChars,
    error,
    nodeId,
    refreshBalanceInfo,
    requiredPoints,
    selectedModel,
    selectedVoiceId,
    success,
    text,
    updateAudioNodeData,
    validateBalanceBeforeGenerate,
    warning,
  ]);

  const handlePreviewVoice = useCallback(() => {
    if (!selectedVoice?.previewUrl) {
      warning("当前音色没有试听音频");
      return;
    }
    const audio = new Audio(selectedVoice.previewUrl);
    void audio.play().catch(() => warning("试听音频播放失败"));
  }, [selectedVoice?.previewUrl, warning]);

  const handleVoiceCreated = useCallback(
    (voice: AudioTtsModelInfo["voices"][number]) => {
      setModels((currentModels) =>
        currentModels.map((model) =>
          model.id === voice.model
            ? {
                ...model,
                available: true,
                voices: [
                  ...model.voices.filter(
                    (item) => item.profileId !== voice.profileId,
                  ),
                  voice,
                ],
              }
            : model,
        ),
      );
      setSelectedModel(voice.model);
      setSelectedVoiceId(voice.profileId);
      updateAudioNodeData(nodeId, {
        model: voice.model,
        voiceProfileId: voice.profileId,
      });
      void loadVoices(false);
    },
    [loadVoices, nodeId, updateAudioNodeData],
  );

  return (
    <div className="nodrag nopan nowheel absolute left-1/2 top-[calc(100%+12px)] z-50 w-[420px] -translate-x-1/2 overflow-hidden rounded-lg border border-white/10 bg-[#17171b] shadow-2xl">
      <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2.5">
        <IconSparkles size={16} className="text-[#B43FEB]" />
        <span className="text-sm font-medium text-white">语音合成</span>
        <ModelPointsBadge
          totalPoints={totalPoints}
          requiredPoints={requiredPoints}
          className="ml-auto"
          title={`${billableChars} 个计费字符，预计 ${requiredPoints} 积分`}
        />
      </div>

      <div className="flex flex-col gap-3 p-3">
        <div className="grid grid-cols-2 gap-2">
          <Select value={selectedModel} onValueChange={handleModelChange}>
            <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
              <SelectValue placeholder="选择模型" />
            </SelectTrigger>
            <SelectContent>
              {AUDIO_TTS_MODEL_OPTIONS.map((option) => {
                const serverModel = models.find(
                  (model) => model.id === option.id,
                );
                return (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                    {serverModel && !serverModel.available
                      ? "（待配置音色）"
                      : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <div className="flex min-w-0 gap-1.5">
            <Select
              value={selectedVoiceId}
              onValueChange={(value) => {
                setSelectedVoiceId(value);
                updateAudioNodeData(nodeId, { voiceProfileId: value });
              }}
              disabled={loadingVoices || voiceOptions.length === 0}
            >
              <SelectTrigger className="min-w-0 flex-1 border-white/10 bg-white/5 text-white">
                <SelectValue
                  placeholder={loadingVoices ? "加载音色..." : "暂无可用音色"}
                />
              </SelectTrigger>
              <SelectContent>
                {systemVoiceOptions.length > 0 ? (
                  <SelectGroup>
                    <SelectLabel>系统音色</SelectLabel>
                    {systemVoiceOptions.map((voice) => (
                      <SelectItem
                        key={voice.profileId}
                        value={voice.profileId}
                      >
                        {voice.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
                {clonedVoiceOptions.length > 0 ? (
                  <SelectGroup>
                    <SelectLabel>共享复刻音色</SelectLabel>
                    {clonedVoiceOptions.map((voice) => (
                      <SelectItem
                        key={voice.profileId}
                        value={voice.profileId}
                      >
                        {voice.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
              </SelectContent>
            </Select>
            <button
              type="button"
              title="试听音色"
              disabled={!selectedVoice?.previewUrl}
              onClick={handlePreviewVoice}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/55 hover:border-[#B43FEB]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              <IconVolume size={15} />
            </button>
            <button
              type="button"
              title="创建音色"
              disabled={
                selectedModel !== "MiniMax/speech-2.8-hd" ||
                !currentModel?.cloneSupported
              }
              onClick={() => setIsCloneDialogOpen(true)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/55 hover:border-[#B43FEB]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              <IconMicrophone size={15} />
            </button>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => handleTextChange(event.target.value)}
          placeholder="输入台词，可插入停顿、笑、叹气等标记"
          className="h-28 w-full resize-none rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-white/30 focus:border-[#B43FEB]/70"
        />

        <div className="flex flex-wrap gap-1.5">
          {AUDIO_TEXT_MARKERS.map((marker) => (
            <button
              key={marker}
              type="button"
              onClick={() => insertMarker(marker)}
              className="rounded-md border border-white/8 bg-white/5 px-2 py-1 text-[11px] text-white/65 transition-colors hover:border-[#B43FEB]/40 hover:text-white"
            >
              {marker}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-white/40">
            {billableChars} 个计费字符 · 每 100 字{" "}
            {currentModel?.pointsPer100 ??
              AUDIO_TTS_MODEL_OPTIONS.find(
                (option) => option.id === selectedModel,
              )?.pointsPer100}{" "}
            积分
          </span>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={
              isGenerating ||
              !modelAvailable ||
              !selectedVoiceId ||
              billableChars <= 0
            }
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
              isGenerating ||
                !modelAvailable ||
                !selectedVoiceId ||
                billableChars <= 0
                ? "cursor-not-allowed bg-white/8 text-white/30"
                : "bg-[#B43FEB] text-white hover:bg-[#9d32ce]",
            )}
          >
            <IconPlayerPlay size={14} />
            {isGenerating ? "生成中" : "生成"}
          </button>
        </div>
      </div>
      <AudioVoiceCloneDialog
        open={isCloneDialogOpen}
        scoreCost={currentModel?.cloneScoreCost}
        onOpenChange={setIsCloneDialogOpen}
        onCreated={handleVoiceCreated}
      />
    </div>
  );
};
