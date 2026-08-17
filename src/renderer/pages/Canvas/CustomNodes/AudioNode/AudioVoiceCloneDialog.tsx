import {
  IconCheck,
  IconMicrophone,
  IconPlayerPlay,
  IconUpload,
} from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cloneDesktopAudioVoice } from "@/api/jikeGo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useGenerationPoints } from "@/hooks/useGenerationPoints";
import useMessage from "@/hooks/useMessage";
import type {
  AudioVoiceCloneResponse,
  AudioVoiceProfile,
} from "shared/types/audio";
import { cn } from "shared/utils/utils";
import { uploadFileToOSS } from "service/oss";
import {
  getAudioDuration,
  getCloneAudioValidationMessage,
  isCloneAudioDurationValid,
} from "./utils/audioCloneFile";

const MINIMAX_VOICE_CLONE_POINTS = 594;
const DEFAULT_PREVIEW_TEXT = "你好，很高兴认识你，今天也要保持好心情。";

type AudioVoiceCloneDialogProps = {
  open: boolean;
  scoreCost?: number;
  onOpenChange: (open: boolean) => void;
  onCreated: (voice: AudioVoiceProfile) => void;
};

const unwrapResponse = <T,>(response: T | { data?: T }): T =>
  ((response as { data?: T })?.data ?? response) as T;

export const AudioVoiceCloneDialog = ({
  open,
  scoreCost = MINIMAX_VOICE_CLONE_POINTS,
  onOpenChange,
  onCreated,
}: AudioVoiceCloneDialogProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { warning, error, success } = useMessage();
  const { validateBalanceBeforeGenerate, refreshBalanceInfo } =
    useGenerationPoints();
  const [name, setName] = useState("");
  const [previewText, setPreviewText] = useState(DEFAULT_PREVIEW_TEXT);
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [needNoiseReduction, setNeedNoiseReduction] = useState(false);
  const [needVolumeNormalization, setNeedVolumeNormalization] = useState(false);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [previewObjectURL, setPreviewObjectURL] = useState("");

  const reset = useCallback(() => {
    setName("");
    setPreviewText(DEFAULT_PREVIEW_TEXT);
    setFile(null);
    setDuration(null);
    setNeedNoiseReduction(false);
    setNeedVolumeNormalization(false);
    setConsentConfirmed(false);
    setIsInspecting(false);
    setIsCreating(false);
    setPreviewObjectURL("");
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(
    () => () => {
      if (previewObjectURL) URL.revokeObjectURL(previewObjectURL);
    },
    [previewObjectURL],
  );

  const handleFileChange = useCallback(
    async (selectedFile: File | undefined) => {
      if (!selectedFile) return;
      const validationMessage = getCloneAudioValidationMessage(selectedFile);
      if (validationMessage) {
        warning(validationMessage);
        return;
      }

      setIsInspecting(true);
      try {
        const nextDuration = await getAudioDuration(selectedFile);
        if (!isCloneAudioDurationValid(nextDuration)) {
          warning("音频时长需在10秒到5分钟之间");
          return;
        }
        if (previewObjectURL) URL.revokeObjectURL(previewObjectURL);
        setFile(selectedFile);
        setDuration(nextDuration);
        setPreviewObjectURL(URL.createObjectURL(selectedFile));
        if (!name.trim()) {
          setName(selectedFile.name.replace(/\.[^.]+$/, "").slice(0, 100));
        }
      } catch (inspectError) {
        error(
          inspectError instanceof Error
            ? inspectError.message
            : "读取音频失败",
        );
      } finally {
        setIsInspecting(false);
      }
    },
    [error, name, previewObjectURL, warning],
  );

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      warning("请输入音色名称");
      return;
    }
    if (!file || duration === null) {
      warning("请上传复刻音频");
      return;
    }
    if (!previewText.trim()) {
      warning("请输入试听台词");
      return;
    }
    if (!consentConfirmed) {
      warning("请确认已获得该声音的使用授权");
      return;
    }

    const hasEnoughPoints = await validateBalanceBeforeGenerate({
      requiredPoints: scoreCost,
      warning,
      insufficientMessage: (required, current) =>
        `积分不足，创建音色需 ${required} 积分，当前剩余 ${current} 积分`,
    });
    if (!hasEnoughPoints) return;

    setIsCreating(true);
    try {
      const upload = await uploadFileToOSS(file);
      if (!upload.url) {
        throw new Error("复刻音频上传失败");
      }
      const response = unwrapResponse<AudioVoiceCloneResponse>(
        await cloneDesktopAudioVoice({
          name: name.trim(),
          audioUrl: upload.url,
          previewText: previewText.trim(),
          needNoiseReduction,
          needVolumeNormalization,
          consentConfirmed: true,
        }),
      );
      if (!response.voice?.profileId) {
        throw new Error("音色创建成功但未返回音色信息");
      }
      onCreated(response.voice);
      await refreshBalanceInfo();
      success("音色创建完成");
      onOpenChange(false);
    } catch (createError) {
      error(
        createError instanceof Error ? createError.message : "音色创建失败",
      );
      await refreshBalanceInfo();
    } finally {
      setIsCreating(false);
    }
  }, [
    consentConfirmed,
    duration,
    error,
    file,
    name,
    needNoiseReduction,
    needVolumeNormalization,
    onCreated,
    onOpenChange,
    previewText,
    refreshBalanceInfo,
    scoreCost,
    success,
    validateBalanceBeforeGenerate,
    warning,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(520px,92vw)] border-white/10 bg-[#141418] p-0 text-white">
        <DialogHeader className="border-b border-white/8 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-white">
            <IconMicrophone size={18} className="text-[#B43FEB]" />
            创建 MiniMax 音色
          </DialogTitle>
          <DialogDescription className="text-white/45">
            MP3 / M4A / WAV · 10秒-5分钟 · 最大20MB
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[68vh] space-y-4 overflow-y-auto px-5 py-4">
          <label className="block space-y-1.5">
            <span className="text-xs text-white/55">音色名称</span>
            <Input
              value={name}
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              placeholder="输入音色名称"
              className="h-9 border-white/10 bg-white/5 text-white placeholder:text-white/25"
            />
          </label>

          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/wav"
              className="hidden"
              onChange={(event) =>
                void handleFileChange(event.target.files?.[0])
              }
            />
            <button
              type="button"
              disabled={isInspecting || isCreating}
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-20 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 bg-white/3 px-4 text-sm text-white/60 transition-colors hover:border-[#B43FEB]/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconUpload size={18} />
              <span>
                {isInspecting
                  ? "读取中"
                  : file
                    ? file.name
                    : "选择复刻音频"}
              </span>
            </button>
            {duration !== null ? (
              <div className="flex items-center justify-between text-xs text-white/40">
                <span>{(file?.size ?? 0) / 1024 / 1024 < 0.01 ? "<0.01" : ((file?.size ?? 0) / 1024 / 1024).toFixed(2)} MB</span>
                <span>{duration.toFixed(1)} 秒</span>
              </div>
            ) : null}
            {previewObjectURL ? (
              <audio
                controls
                src={previewObjectURL}
                className="h-9 w-full"
              />
            ) : null}
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs text-white/55">试听台词</span>
            <textarea
              value={previewText}
              maxLength={300}
              onChange={(event) => setPreviewText(event.target.value)}
              className="h-20 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-[#B43FEB]/60"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center justify-between rounded-lg border border-white/8 bg-white/3 px-3 py-2.5">
              <span className="text-sm text-white/65">音频降噪</span>
              <Switch
                checked={needNoiseReduction}
                onCheckedChange={setNeedNoiseReduction}
                className="data-[state=checked]:bg-[#B43FEB]"
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-white/8 bg-white/3 px-3 py-2.5">
              <span className="text-sm text-white/65">音量归一化</span>
              <Switch
                checked={needVolumeNormalization}
                onCheckedChange={setNeedVolumeNormalization}
                className="data-[state=checked]:bg-[#B43FEB]"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => setConsentConfirmed((value) => !value)}
            className="flex w-full items-start gap-2 text-left text-xs leading-5 text-white/55"
          >
            <span
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                consentConfirmed
                  ? "border-[#B43FEB] bg-[#B43FEB] text-white"
                  : "border-white/20 bg-white/5",
              )}
            >
              {consentConfirmed ? <IconCheck size={12} /> : null}
            </span>
            <span>我已获得该声音的合法使用授权，并同意创建共享音色。</span>
          </button>
        </div>

        <DialogFooter className="m-0 border-white/8 px-5 py-4">
          <button
            type="button"
            disabled={isCreating}
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-lg px-4 text-sm text-white/55 hover:bg-white/8 hover:text-white"
          >
            取消
          </button>
          <button
            type="button"
            disabled={
              isCreating ||
              isInspecting ||
              !file ||
              !name.trim() ||
              !previewText.trim() ||
              !consentConfirmed
            }
            onClick={() => void handleCreate()}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#B43FEB] px-4 text-sm font-medium text-white hover:bg-[#9d32ce] disabled:cursor-not-allowed disabled:bg-white/8 disabled:text-white/30"
          >
            <IconPlayerPlay size={15} />
            {isCreating ? "创建中" : `创建 · ${scoreCost}积分`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
